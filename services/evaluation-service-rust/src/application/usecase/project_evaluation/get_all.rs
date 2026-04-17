use thiserror::Error;

use crate::{
    application::{
        repository::project_evaluation as proj_eval, usecase::project_evaluation::GetAllResult,
    },
    domain::ProjectEvaluation,
};

pub type Response = Vec<ProjectEvaluation>;

#[derive(Debug, Error)]
pub enum Error {
    #[error("{0}")]
    Repo(#[from] proj_eval::GetAllError),
}

#[derive(Debug)]
pub struct GetAll<'r, R> {
    repo: &'r R,
}

impl<'a, 'r, R> GetAll<'r, R>
where
    R: proj_eval::Repo,
{
    pub fn new(repo: &'r R) -> Self {
        Self { repo }
    }

    pub async fn exec(&self) -> GetAllResult {
        log::debug!("Get all project evaluations");

        let all = self.repo.get_all().await?;

        Ok(all)
    }
}
