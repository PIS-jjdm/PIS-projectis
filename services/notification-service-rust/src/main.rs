mod config;
mod metrics;
mod service;
mod store;

use config::Config;
use opentelemetry_appender_tracing::layer::OpenTelemetryTracingBridge;
use service::{
    notification::notification_service_server::NotificationServiceServer, NotificationGrpc,
};
use store::NotificationStore;

use opentelemetry::trace::TracerProvider as _;
use opentelemetry_otlp::WithExportConfig;
use opentelemetry_sdk::{
    logs::SdkLoggerProvider, metrics::SdkMeterProvider, trace::SdkTracerProvider, Resource,
};
use std::sync::Arc;
use std::time::Duration;
use tokio::signal;
use tonic::transport::Server;
use tracing::error;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt, EnvFilter};

use crate::metrics::{GrpcMetricsLayer, Metrics};

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    dotenvy::dotenv().ok();
    let config = Config::from_env();
    init_telemetry(&config.otel_service_name, &config.otel_endpoint)?;

    let (health_reporter, health_service) = tonic_health::server::health_reporter();
    health_reporter
        .set_serving::<NotificationServiceServer<NotificationGrpc>>()
        .await;

    let store = Arc::new(NotificationStore::open(&config.db_path)?);
    tokio::spawn(delivery_loop(Arc::clone(&store)));
    let addr = config.grpc_addr.parse()?;

    Server::builder()
        .layer(GrpcMetricsLayer::new(Metrics::new(
            "notification",
            &config.otel_service_name,
        )))
        .add_service(health_service)
        .add_service(NotificationServiceServer::new(NotificationGrpc::new(store)))
        .serve_with_shutdown(addr, shutdown_signal())
        .await?;

    Ok(())
}

async fn delivery_loop(store: Arc<NotificationStore>) {
    let scheduler = store.scheduler_notifier();

    loop {
        if let Err(err) = store.deliver_due_notifications(chrono::Utc::now()) {
            error!(error = %err, "failed to deliver scheduled notifications");
        }

        let sleep_duration = match store.next_scheduled_trigger_at() {
            Ok(Some(trigger_at)) => {
                let now = chrono::Utc::now();
                if trigger_at <= now {
                    Duration::from_millis(100)
                } else {
                    (trigger_at - now)
                        .to_std()
                        .unwrap_or_else(|_| Duration::from_millis(100))
                }
            }
            Ok(None) => Duration::from_secs(3600),
            Err(err) => {
                error!(error = %err, "failed to determine next scheduled notification");
                Duration::from_secs(1)
            }
        };

        tokio::select! {
            _ = tokio::time::sleep(sleep_duration) => {},
            _ = scheduler.notified() => {},
        }
    }
}

// Samelessly taken from axum's graceful shutdown example:
// https://github.com/tokio-rs/axum/blob/da26db264f811e73485f1db1c134d374e8f99464/examples/graceful-shutdown/src/main.rs#L54
async fn shutdown_signal() {
    let ctrl_c = async {
        signal::ctrl_c()
            .await
            .expect("failed to install Ctrl+C handler");
    };

    #[cfg(unix)]
    let terminate = async {
        signal::unix::signal(signal::unix::SignalKind::terminate())
            .expect("failed to install signal handler")
            .recv()
            .await;
    };

    #[cfg(not(unix))]
    let terminate = std::future::pending::<()>();

    tokio::select! {
        _ = ctrl_c => {},
        _ = terminate => {},
    }
}

fn init_telemetry(service_name: &str, otlp_endpoint: &str) -> anyhow::Result<()> {
    let resource = Resource::builder()
        .with_service_name(service_name.to_string())
        .build();

    // ------ Tracing -------
    let trace_exporter = opentelemetry_otlp::SpanExporter::builder()
        .with_tonic()
        .with_endpoint(otlp_endpoint)
        .build()?;
    let tracer_provider = SdkTracerProvider::builder()
        .with_batch_exporter(trace_exporter)
        .with_resource(resource.clone())
        .build();
    let tracer = tracer_provider.tracer(service_name.to_string());

    // ------ Logs ------
    let log_exporter = opentelemetry_otlp::LogExporter::builder()
        .with_tonic()
        .with_endpoint(otlp_endpoint)
        .build()?;
    let log_provider = SdkLoggerProvider::builder()
        .with_batch_exporter(log_exporter)
        .with_resource(resource.clone())
        .build();

    // ------ Metrics -------
    let metric_exporter = opentelemetry_otlp::MetricExporter::builder()
        .with_tonic()
        .with_endpoint(otlp_endpoint)
        .build()?;
    let metric_provider = SdkMeterProvider::builder()
        .with_periodic_exporter(metric_exporter)
        .with_resource(resource.clone())
        .build();
    opentelemetry::global::set_meter_provider(metric_provider);

    // ------ Integration with Tracing ------
    tracing_subscriber::registry()
        .with(EnvFilter::from_default_env())
        .with(tracing_subscriber::fmt::layer())
        .with(tracing_opentelemetry::layer().with_tracer(tracer))
        .with(OpenTelemetryTracingBridge::new(&log_provider))
        .init();

    opentelemetry::global::set_tracer_provider(tracer_provider);

    Ok(())
}
