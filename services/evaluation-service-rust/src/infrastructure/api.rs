mod grpc;

use clap::Parser;
use std::{
    net::{IpAddr, SocketAddr},
    path::PathBuf,
};

use crate::infrastructure::storage::data_storage_fjall;

#[derive(Parser)]
struct Args {
    /// IP address to bind to
    #[arg(short('a'), long, default_value = "127.0.0.1")]
    bind: IpAddr,

    /// TCP port
    #[arg(long, default_value = "50123")]
    port: u16,

    /// Path to the seeds TOML file
    #[arg(short, long)]
    seeds: Option<PathBuf>,

    /// Database directory path
    #[arg(short, long)]
    data_dir: PathBuf,
}

pub async fn run() -> Result<(), anyhow::Error> {
    let args = Args::parse();
    let db = data_storage_fjall(args.data_dir, args.seeds).await?;
    let addr = SocketAddr::from((args.bind, args.port));

    grpc::run(db, addr).await
}
