mod grpc;
pub mod grpc_models;
mod observe;

use clap::Parser;
use opentelemetry::trace::TracerProvider;
use opentelemetry_appender_tracing::layer::OpenTelemetryTracingBridge;
use opentelemetry_otlp::WithExportConfig;
use opentelemetry_sdk::{
    Resource,
    logs::SdkLoggerProvider,
    metrics::{SdkMeterProvider, periodic_reader_with_async_runtime::PeriodicReader},
    runtime,
    trace::SdkTracerProvider,
};
use std::{
    net::{IpAddr, SocketAddr},
    path::PathBuf,
    sync::Arc,
    time::Duration,
};
use thiserror::Error;
use tokio::signal;
use tracing_subscriber::{EnvFilter, layer::SubscriberExt, util::SubscriberInitExt};

use crate::infrastructure::{
    gateway::{
        GrpcGatewayCollection, GrpcNotificationGateway, GrpcProjectGateway, GrpcSubjectGateway,
    },
    init_logging, storage,
};

pub const SERVICE_NAME: &str = "evaluation-service";

pub async fn run() -> Result<(), anyhow::Error> {
    let args = Args::parse();
    if let Some(endpoint) = args.otlp_endpoint {
        init_telemetry(SERVICE_NAME, &endpoint)?;
    } else {
        init_logging();
    }
    let db = storage::data_storage_fjall(args.data_dir, args.seeds).await?;
    let gateways = init_gateways(
        &args.notification_endpoint,
        &args.project_endpoint,
        &args.subject_endpoint,
    )
    .await?;
    let addr = SocketAddr::from((args.bind, args.port));

    grpc::run(db, gateways, addr).await
}

#[derive(Debug, Error)]
pub enum InitGatewaysError {
    #[error("Couldn't connect to {0} service: {1}")]
    Connect(&'static str, anyhow::Error),
}

pub async fn init_gateways(
    ne: &str,
    pe: &str,
    se: &str,
) -> Result<Arc<GrpcGatewayCollection>, anyhow::Error> {
    tracing::info!(endpoint = ne, "Initializing notification service gateway");
    let notification = GrpcNotificationGateway::connect(ne)
        .await
        .map_err(|e| InitGatewaysError::Connect("notification", e))?;

    tracing::info!(endpoint = pe, "Initializing project service gateway");
    let project = GrpcProjectGateway::connect(pe)
        .await
        .map_err(|e| InitGatewaysError::Connect("project", e))?;

    tracing::info!(endpoint = se, "Initializing subject service gateway");
    let subject = GrpcSubjectGateway::connect(se)
        .await
        .map_err(|e| InitGatewaysError::Connect("subject", e))?;

    log::info!("Gateways initialized");
    Ok(Arc::new(GrpcGatewayCollection {
        notification,
        project,
        subject,
    }))
}

#[derive(Parser)]
struct Args {
    /// IP address to bind to
    #[arg(short('a'), long, default_value = "127.0.0.1", env = "BIND_ADDRESS")]
    bind: IpAddr,

    /// TCP port
    #[arg(long, default_value = "50055", env = "BIND_PORT")]
    port: u16,

    /// Path to the seeds TOML file
    #[arg(short, long, env = "SEEDS_PATH")]
    seeds: Option<PathBuf>,

    /// Database directory path
    #[arg(short, long, env = "DATA_DIR")]
    data_dir: PathBuf,

    /// OTLP endpoint address
    #[arg(short, long, env = "OTLP_ENDPOINT")]
    otlp_endpoint: Option<String>,

    /// GRPC notification service endpoint
    #[arg(
        long,
        default_value = "http://127.0.0.1:50052",
        env = "NOTIFICATION_ENDPOINT"
    )]
    notification_endpoint: String,

    /// GRPC project service endpoint
    #[arg(
        long,
        default_value = "http://127.0.0.1:50053",
        env = "SUBJECT_ENDPOINT"
    )]
    subject_endpoint: String,

    /// GRPC project service endpoint
    #[arg(
        long,
        default_value = "http://127.0.0.1:50054",
        env = "PROJECT_ENDPOINT"
    )]
    project_endpoint: String,
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
        _ = ctrl_c => {
            tracing::info!("Shutting down..")
        },
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
