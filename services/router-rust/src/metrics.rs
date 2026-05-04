use std::{
    convert::Infallible,
    future::Future,
    pin::Pin,
    sync::Arc,
    task::{Context, Poll},
    time::Instant,
};

use axum::http::{Request, Response};
use opentelemetry::{
    metrics::{Counter, Histogram, UpDownCounter},
    KeyValue,
};
use tokio::sync::Mutex;
use tonic::{body::Body, server::NamedService, Code};
use tower::Service;

#[derive(Clone, Debug)]
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

    pub async fn record_grpc_call<R>(
        &self,
        method: &str,
        func: impl AsyncFnOnce() -> Result<Response<R>, Infallible>,
    ) -> Result<Response<R>, Infallible> {
        let active_tags = &[
            KeyValue::new("rpc.system", "grpc"),
            KeyValue::new("rpc.service", self.service_name.clone()),
            KeyValue::new("rpc.method", method.to_owned()),
        ];
        self.active_requests.add(1, active_tags);

        let start = Instant::now();
        let res = func().await;
        let duration = Instant::now().duration_since(start).as_secs_f64();

        let grpc_status_code = Code::Ok;

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

#[derive(Clone)]
pub struct GrpcMetricsLayer {
    pub metrics: Arc<Mutex<Metrics>>,
}

impl<S> tower::Layer<S> for GrpcMetricsLayer {
    type Service = GrpcMetricsService<S>;

    fn layer(&self, inner: S) -> Self::Service {
        GrpcMetricsService::<S> {
            inner,
            metrics: self.metrics.clone(),
        }
    }
}

#[derive(Clone)]
pub struct GrpcMetricsService<S> {
    inner: S,
    metrics: std::sync::Arc<tokio::sync::Mutex<Metrics>>,
}

impl<S> NamedService for GrpcMetricsService<S>
where
    S: NamedService,
{
    const NAME: &'static str = S::NAME;
}

impl<S> Service<Request<Body>> for GrpcMetricsService<S>
where
    S: Service<Request<Body>, Response = Response<Body>, Error = Infallible>
        + Clone
        + Send
        + 'static,
    S::Future: Send + 'static,
{
    type Response = Response<Body>;
    type Error = Infallible;
    type Future = Pin<Box<dyn Future<Output = Result<Self::Response, Self::Error>> + Send>>;

    fn poll_ready(&mut self, cx: &mut Context<'_>) -> Poll<Result<(), Self::Error>> {
        self.inner.poll_ready(cx)
    }

    fn call(&mut self, req: Request<Body>) -> Self::Future {
        let mut inner = self.inner.clone();
        let metrics = self.metrics.clone();

        let path = req.uri().path().to_owned();

        Box::pin(async move {
            let method = path.split("/").last().unwrap_or_else(|| {
                tracing::warn!(uri = %path, "Failed to extract method name from URI");
                "unknown"
            });

            metrics
                .lock()
                .await
                .record_grpc_call(method, async move || inner.call(req).await)
                .await
        })
    }
}
