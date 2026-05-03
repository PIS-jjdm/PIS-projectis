mod avatar;
mod config;
mod db;
mod metrics;
mod models;
mod service;

use config::Config;
use db::Db;
use models::JwtKeys;
use opentelemetry_appender_tracing::layer::OpenTelemetryTracingBridge;
use service::auth::auth_service_server::AuthServiceServer;
use service::AuthGrpc;

use opentelemetry::trace::TracerProvider as _;
use opentelemetry_otlp::WithExportConfig;
use opentelemetry_sdk::{
    logs::SdkLoggerProvider, metrics::SdkMeterProvider, trace::SdkTracerProvider, Resource,
};
use tokio::signal;
use tonic::transport::{Channel, Endpoint, Server};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt, EnvFilter};

use crate::metrics::{GrpcMetricsLayer, Metrics};

const RETRY_ATTEMPTS: usize = 20;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    dotenvy::dotenv().ok();

    let config = Config::from_env();
    init_telemetry(&config.otel_service_name, &config.otel_endpoint)?;

    let db = Db::connect(&config).await?;

    if config.seed_demo_users {
        db.seed_demo_users("./demo_users.toml").await?;
    }

    let jwt_keys = JwtKeys {
        secret: config.jwt_secret.clone(),
    };

    let notification_grpc_client = connect_with_retry(config.notification_grpc_endpoint.clone())
        .await
        .expect("Failed to connect to notification-service after multiple attempts");

    let grpc_service = AuthGrpc::new(db, jwt_keys, notification_grpc_client);
    let addr = config.grpc_addr.parse()?;

    let (health_reporter, health_service) = tonic_health::server::health_reporter();
    health_reporter
        .set_serving::<AuthServiceServer<AuthGrpc>>()
        .await;

    Server::builder()
        .layer(GrpcMetricsLayer::new(Metrics::new(
            "auth",
            &config.otel_service_name,
        )))
        .add_service(health_service)
        .add_service(AuthServiceServer::new(grpc_service))
        .serve_with_shutdown(addr, shutdown_signal())
        .await?;

    Ok(())
}

async fn connect_with_retry(endpoint: String) -> anyhow::Result<Channel> {
    let endpoint = Endpoint::from_shared(endpoint)?
        .connect_timeout(std::time::Duration::from_secs(3))
        .timeout(std::time::Duration::from_secs(5));

    let mut last_err = None;

    for attempt in 0..RETRY_ATTEMPTS {
        match endpoint.clone().connect().await {
            Ok(channel) => return Ok(channel),
            Err(err) => {
                tracing::warn!(attempt, error = %err, "failed to connect to notification-service");
                last_err = Some(err);
                tokio::time::sleep(std::time::Duration::from_secs(2)).await;
            }
        }
    }

    Err(last_err.unwrap().into())
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
