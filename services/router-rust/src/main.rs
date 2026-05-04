mod auth_context;
mod config;
mod file_http;
mod gateway;
mod grpc_auth;
mod metrics;
mod proto;
mod state;

use std::sync::Arc;

use config::Config;
use grpc_auth::GrpcAuthLayer;
use state::MAX_GRPC_MESSAGE_SIZE;
use opentelemetry_appender_tracing::layer::OpenTelemetryTracingBridge;
pub use state::AppState;

use opentelemetry::trace::TracerProvider as _;
use opentelemetry_otlp::WithExportConfig;
use opentelemetry_sdk::{
    logs::SdkLoggerProvider, metrics::SdkMeterProvider, trace::SdkTracerProvider, Resource,
};
use tokio::signal;
use tokio::{net::TcpListener, sync::Mutex};
use tower::Layer as _;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt, EnvFilter};

use crate::{
    metrics::{GrpcMetricsLayer, Metrics},
    proto::gateway::frontend_gateway_server,
};

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

async fn health() -> axum::http::StatusCode {
    axum::http::StatusCode::OK
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    dotenvy::dotenv().ok();

    let config = Config::from_env();
    init_telemetry(&config.otel_service_name, &config.otel_endpoint)?;

    let metrics = Metrics::new("router", &config.otel_service_name);

    let state = AppState::from_config(&config).await;
    let grpc_service = tonic_web::GrpcWebLayer::new().layer(
        GrpcMetricsLayer {
            metrics: Arc::new(Mutex::new(metrics)),
        }
        .layer(GrpcAuthLayer::new(state.clone()).layer(
            frontend_gateway_server::FrontendGatewayServer::new(
                gateway::FrontendGatewayService::new(state.clone()),
            )
            .max_decoding_message_size(MAX_GRPC_MESSAGE_SIZE)
            .max_encoding_message_size(MAX_GRPC_MESSAGE_SIZE),
        )),
    );

    let app = file_http::routes(state)
        .route("/health", axum::routing::get(health))
        .fallback_service(grpc_service)
        .layer(axum::extract::DefaultBodyLimit::max(MAX_GRPC_MESSAGE_SIZE));
    let listener = TcpListener::bind(&config.grpc_addr).await?;

    axum::serve(listener, app)
        .with_graceful_shutdown(shutdown_signal())
        .await
        .map_err(anyhow::Error::from)
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
