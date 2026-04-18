use std::{path::PathBuf, sync::Arc};

use serde::Deserialize;
use thiserror::Error;
use tokio::fs;
use tracing::info;

use crate::{
    adapter::Db,
    domain::ProjectEvaluation,
    infrastructure::db::{InMemory, KeyValue},
};

pub async fn data_storage_fjall(
    data_dir: PathBuf,
    seeds: Option<PathBuf>,
) -> Result<Arc<KeyValue>, anyhow::Error> {
    info!(data_dir = %data_dir.to_string_lossy(), "Using Fjall database");

    let kv = Arc::new(KeyValue::try_from(&data_dir)?);

    if let Some(seeds) = seeds {
        load_seeds(kv.clone(), &seeds).await?;
    }

    Ok(kv)
}

pub async fn data_storage_in_memory(
    seeds: Option<PathBuf>,
) -> Result<Arc<InMemory>, anyhow::Error> {
    log::info!("Using in-memory database");

    let im = Arc::new(InMemory::default());

    if let Some(seeds) = seeds {
        load_seeds(im.clone(), &seeds).await?;
    }

    Ok(im)
}

async fn load_seeds(db: Arc<impl Db>, path: &PathBuf) -> anyhow::Result<()> {
    use crate::application::seeding::project_evaluation::*;

    let mut seeds = load_toml_seedings(path).await?;

    let eval_seeds = SeedData {
        evaluations: seeds.project_evaluations.take().unwrap_or(vec![]),
    };

    match Seeder::new(&*db).seed(eval_seeds).await {
        Err(SeedError::DataPresent) => {
            log::warn!("Database not empty. Seeding skipped.")
        }
        other => other?,
    }

    Ok(())
}

#[derive(Deserialize)]
struct Seeds {
    pub project_evaluations: Option<Vec<ProjectEvaluation>>,
}

#[derive(Debug, Error)]
enum LoadError {
    #[error("Failed to load seed file: {0}")]
    IO(#[from] std::io::Error),
    #[error("Failed to deserialize the seeds file: {0}")]
    Deserialize(#[from] toml::de::Error),
}

async fn load_toml_seedings(path: &PathBuf) -> Result<Seeds, LoadError> {
    let contents = fs::read_to_string(path).await?;
    let seeds: Seeds = toml::from_str(contents.as_str())?;

    Ok(seeds)
}
