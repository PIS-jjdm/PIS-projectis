use evaluation_service_rust::infrastructure::{self, init_logging};

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    dotenvy::dotenv().ok();
    init_logging();

    if let Err(e) = infrastructure::cli::run().await {
        log::error!("{e}")
    }

    Ok(())
}
