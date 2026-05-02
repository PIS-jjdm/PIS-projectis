use std::time::Instant;

use opentelemetry::{
    KeyValue,
    metrics::{Counter, Histogram},
};
use tonic::{Code, Response, Status};

#[derive(Debug)]
pub struct Metrics {
    total_requests: Counter<u64>,
    request_duration: Histogram<f64>,
}

impl Metrics {
    pub fn new(meter_name: &'static str) -> Self {
        let meter = opentelemetry::global::meter(meter_name);

        let total_requests = meter
            .u64_counter("grpc_requests_total")
            .with_description("Counts the number of total gRPC requests")
            .build();

        let request_duration = meter
            .f64_histogram("grpc_request_duration_seconds")
            .with_description("Duration of evaluation-service gRPC requests")
            .build();

        Self {
            total_requests,
            request_duration,
        }
    }

    pub async fn record_grpc_call<R>(
        &self,
        method: &str,
        func: impl AsyncFnOnce() -> Result<Response<R>, Status>,
    ) -> Result<Response<R>, Status> {
        let start = Instant::now();
        let res = func().await;
        let duration = Instant::now().duration_since(start).as_secs_f64();

        let grpc_status_code = match &res {
            Ok(_) => Code::Ok,
            Err(s) => s.code(),
        };

        let tags = &[
            KeyValue::new("rpc.system", "grpc"),
            KeyValue::new("rpc.service", "EvaluationService"),
            KeyValue::new("rpc.method", method.to_owned()),
            KeyValue::new(
                "rpc.grpc.status_code",
                (grpc_status_code as u32).to_string(),
            ),
        ];
        self.total_requests.add(1, tags);
        self.request_duration.record(duration, tags);

        res
    }
}
