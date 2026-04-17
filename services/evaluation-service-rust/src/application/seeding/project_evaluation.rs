use thiserror::Error;

use crate::application::repository::project_evaluation::*;
use crate::domain::*;

#[derive(Debug)]
pub struct SeedData {
    pub evaluations: Vec<ProjectEvaluation>,
}

pub struct Seeder<'a, R> {
    repo: &'a R,
}

#[derive(Debug, Error)]
pub enum SeedError {
    #[error("{0}")]
    Count(#[from] CountError),
    #[error("{0}")]
    Save(#[from] SaveError),
    #[error("Database already has data present")]
    DataPresent,
}

impl<'a, R: Repo> Seeder<'a, R> {
    pub fn new(repo: &'a R) -> Self {
        Self { repo }
    }

    pub async fn seed(self, data: SeedData) -> Result<(), SeedError> {
        log::debug!("Seeding {} rows", data.evaluations.len());

        if self.repo.len().await? > 0 {
            return Ok(());
        }

        for seed in data.evaluations {
            self.repo.save(seed).await?;
        }

        Ok(())
    }
}
