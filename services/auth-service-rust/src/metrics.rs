use http::StatusCode;
use opentelemetry::{
    metrics::{Counter, Histogram, UpDownCounter},
    KeyValue,
};
use std::{
    future::Future,
    pin::Pin,
    sync::Arc,
    task::{Context, Poll},
    time::Instant,
};
use tokio::sync::Mutex;
use tonic::Code;
use tower::Service;

#[derive(Debug)]
pub struct Metrics {
    total_requests: Counter<u64>,
    request_duration: Histogram<f64>,
    active_requests: UpDownCounter<i64>,
    service_name: String,
}

impl Metrics {
    pub fn new(meter_name: &'static str, service_name: &str) -> Self {
        let meter = opentelemetry::global::meter(meter_name);

        let total_requests = meter
            .u64_counter("grpc_requests_total")
            .with_description("Counts the number of total gRPC requests")
            .build();

        let request_duration = meter
            .f64_histogram("grpc_request_duration_seconds")
            .with_description("Duration of gRPC requests")
            .with_unit("s")
            .build();

        let active_requests = meter
            .i64_up_down_counter("grpc_active_requests")
            .with_description("Current number of in-flight gRPC requests")
            .build();

        Self {
            total_requests,
            request_duration,
            active_requests,
            service_name: service_name.to_owned(),
        }
    }

    pub async fn record_call<R, E>(
        &self,
        method: &str,
        func: impl AsyncFnOnce() -> Result<http::Response<R>, E>,
    ) -> Result<http::Response<R>, E> {
        let active_tags = &[
            KeyValue::new("rpc.system", "grpc"),
            KeyValue::new("rpc.service", self.service_name.clone()),
            KeyValue::new("rpc.method", method.to_owned()),
        ];
        self.active_requests.add(1, active_tags);

        let start = Instant::now();
        let res = func().await;
        let duration = Instant::now().duration_since(start).as_secs_f64();

        let grpc_status_code = match &res {
            Ok(resp) => {
                if resp.status() != StatusCode::OK {
                    Code::Unknown
                } else {
                    Code::Ok
                }
            }
            Err(_) => Code::Internal,
        };

        let tags = &[
            KeyValue::new("rpc.system", "grpc"),
            KeyValue::new("rpc.service", self.service_name.clone()),
            KeyValue::new("rpc.method", method.to_owned()),
            KeyValue::new(
                "rpc.grpc.status_code",
                (grpc_status_code as u32).to_string(),
            ),
        ];
        self.active_requests.add(-1, active_tags);
        self.total_requests.add(1, tags);
        self.request_duration.record(duration, tags);

        res
    }
}

#[derive(Debug, Clone)]
pub struct GrpcMetricsLayer {
    metrics: Arc<Mutex<Metrics>>,
}

impl GrpcMetricsLayer {
    pub fn new(metrics: Metrics) -> Self {
        Self {
            metrics: Arc::new(Mutex::new(metrics)),
        }
    }
}

impl<S> tower::Layer<S> for GrpcMetricsLayer {
    type Service = GrpcMetricsService<S>;

    fn layer(&self, inner: S) -> Self::Service {
        Self::Service {
            inner,
            metrics: self.metrics.clone(),
        }
    }
}

#[derive(Debug, Clone)]
pub struct GrpcMetricsService<S> {
    inner: S,
    metrics: Arc<Mutex<Metrics>>,
}

type BoxFuture<'a, T> = Pin<Box<dyn Future<Output = T> + Send + 'a>>;

impl<S, ReqBody, ResBody> Service<http::Request<ReqBody>> for GrpcMetricsService<S>
where
    S: Service<http::Request<ReqBody>, Response = http::Response<ResBody>> + Clone + Send + 'static,
    S::Future: Send + 'static,
    ReqBody: Send + 'static,
{
    type Response = S::Response;
    type Error = S::Error;
    type Future = BoxFuture<'static, Result<Self::Response, Self::Error>>;

    fn poll_ready(&mut self, cx: &mut Context<'_>) -> Poll<Result<(), Self::Error>> {
        self.inner.poll_ready(cx)
    }

    fn call(&mut self, req: http::Request<ReqBody>) -> Self::Future {
        // See the tower docs for duplicating the inner service
        let clone = self.inner.clone();
        let mut inner = std::mem::replace(&mut self.inner, clone);

        let metrics = self.metrics.clone();

        Box::pin(async move {
            let path = req.uri().path();
            let method_name = path
                .split("/")
                .last()
                .unwrap_or_else(|| {
                    tracing::warn!(path = %path, "Failed to extract service name from URI path");
                    "unknown"
                })
                .to_owned();

            metrics
                .lock()
                .await
                .record_call(&method_name, async move || inner.call(req).await)
                .await
        })
    }
}
