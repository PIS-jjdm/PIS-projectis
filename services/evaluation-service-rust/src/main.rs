use evaluation_service_rust::infrastructure::{self, init_logging};

fn main() -> anyhow::Result<()> {
    dotenvy::dotenv().ok();
    init_logging();

    infrastructure::cli::run();

    Ok(())
}
