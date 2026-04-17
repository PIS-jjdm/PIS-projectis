use std::path::PathBuf;

use crate::domain::ProjectEvaluation;
use serde::Deserialize;
use thiserror::Error;
use tokio::fs;

#[derive(Deserialize)]
pub struct Seeds {
    pub project_evaluations: Option<Vec<ProjectEvaluation>>,
}

#[derive(Debug, Error)]
pub enum LoadError {
    #[error("Failed to load seed file: {0}")]
    IO(#[from] std::io::Error),
    #[error("Failed to deserialize the seeds file: {0}")]
    Deserialize(#[from] toml::de::Error),
}

pub async fn load_toml_seedings(path: &PathBuf) -> Result<Seeds, LoadError> {
    let contents = fs::read_to_string(path).await?;
    let seeds: Seeds = toml::from_str(contents.as_str())?;

    Ok(seeds)
}
