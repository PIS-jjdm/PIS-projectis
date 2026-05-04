use std::time::Instant;

use opentelemetry::{
    KeyValue,
    metrics::{Counter, Histogram, UpDownCounter},
};
use tonic::{Code, Response, Status};

#[derive(Debug)]
pub struct Metrics {
    total_requests: Counter<u64>,
    request_duration: Histogram<f64>,
    active_requests: UpDownCounter<i64>,
    service_name: &'static str,
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
            service_name: meter_name,
        }
    }

    pub async fn record_grpc_call<R>(
        &self,
        method: &str,
        func: impl AsyncFnOnce() -> Result<Response<R>, Status>,
    ) -> Result<Response<R>, Status> {
        let active_tags = &[
            KeyValue::new("rpc.system", "grpc"),
            KeyValue::new("rpc.service", self.service_name),
            KeyValue::new("rpc.method", method.to_owned()),
        ];
        self.active_requests.add(1, active_tags);

        let start = Instant::now();
        let res = func().await;
        let duration = Instant::now().duration_since(start).as_secs_f64();

        let grpc_status_code = match &res {
            Ok(_) => Code::Ok,
            Err(s) => s.code(),
        };

        let tags = &[
            KeyValue::new("rpc.system", "grpc"),
            KeyValue::new("rpc.service", self.service_name),
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
