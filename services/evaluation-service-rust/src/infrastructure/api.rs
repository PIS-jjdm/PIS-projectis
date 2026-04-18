mod grpc;

use clap::Parser;
use opentelemetry::trace::TracerProvider;
use opentelemetry_otlp::WithExportConfig;
use opentelemetry_sdk::{Resource, trace::SdkTracerProvider};
use std::{
    net::{IpAddr, SocketAddr},
    path::PathBuf,
};
use tracing_subscriber::{EnvFilter, layer::SubscriberExt, util::SubscriberInitExt};

use crate::infrastructure::{init_logging, storage};

fn init_telemetry(service_name: &str, otlp_endpoint: &str) -> anyhow::Result<()> {
    let exporter = opentelemetry_otlp::SpanExporter::builder()
        .with_tonic()
        .with_endpoint(otlp_endpoint)
        .build()?;
    let provider = SdkTracerProvider::builder()
        .with_batch_exporter(exporter)
        .with_resource(
            Resource::builder()
                .with_service_name(service_name.to_string())
                .build(),
        )
        .build();
    let tracer = provider.tracer(service_name.to_string());

    tracing_subscriber::registry()
        .with(EnvFilter::from_default_env())
        .with(tracing_subscriber::fmt::layer())
        .with(tracing_opentelemetry::layer().with_tracer(tracer))
        .init();

    opentelemetry::global::set_tracer_provider(provider);
    Ok(())
}

#[derive(Parser)]
struct Args {
    /// IP address to bind to
    #[arg(short('a'), long, default_value = "127.0.0.1", env = "BIND_ADDRESS")]
    bind: IpAddr,

    /// TCP port
    #[arg(long, default_value = "50123", env = "BIND_PORT")]
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
}

const SERVICE_NAME: &str = "Evaluation Service";

pub async fn run() -> Result<(), anyhow::Error> {
    let args = Args::parse();
    if let Some(endpoint) = args.otlp_endpoint {
        init_telemetry(SERVICE_NAME, &endpoint)?;
    } else {
        init_logging();
    }
    let db = storage::data_storage_fjall(args.data_dir, args.seeds).await?;
    let addr = SocketAddr::from((args.bind, args.port));

    grpc::run(db, addr).await
}
