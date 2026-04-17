use async_trait::async_trait;
use thiserror::Error;

use crate::domain::{Id, ProjectEvaluation};

#[derive(Debug, Error)]
#[error("Project evaluation repository connection failed")]
pub struct ConnectionError;

#[derive(Debug, Error)]
pub enum SaveError {
    #[error("{0}")]
    Connection(#[from] ConnectionError),
}

#[derive(Debug, Error)]
pub enum GetError {
    #[error("Project evaluation record not found")]
    NotFound,
    #[error("{0}")]
    Connection(#[from] ConnectionError),
}

#[derive(Debug, Error)]
pub enum GetAllError {
    #[error("Project evaluation repository connection failed")]
    Connection(#[from] ConnectionError),
}

#[derive(Debug, Error)]
pub enum DeleteError {
    #[error("Project evaluation record not found")]
    NotFound,
    #[error("{0}")]
    Connection(#[from] ConnectionError),
}

#[derive(Debug, Error)]
pub enum CountError {
    #[error("{0}")]
    Connection(#[from] ConnectionError),
}

#[async_trait]
pub trait Repo: Send + Sync {
    async fn save(&self, record: ProjectEvaluation) -> Result<(), SaveError>;
    async fn get(&self, id: Id) -> Result<ProjectEvaluation, GetError>;
    async fn get_all(&self) -> Result<Vec<ProjectEvaluation>, GetAllError>;
    async fn delete(&self, id: Id) -> Result<ProjectEvaluation, DeleteError>;
    async fn len(&self) -> Result<usize, CountError>;

    async fn new_id(&self, project_id: &Id, team_id: &Id) -> Id;
}
