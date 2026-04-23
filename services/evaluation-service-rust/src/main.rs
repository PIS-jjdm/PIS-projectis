use evaluation_service_rust::infrastructure::{self};

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    dotenvy::dotenv().ok();

    if let Err(e) = infrastructure::api::run().await {
        log::error!("{e}")
    }

    Ok(())
}
