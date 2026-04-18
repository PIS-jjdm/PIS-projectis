use thiserror::Error;

use crate::{
    application::{
        repository::project_evaluation::{self as proj_eval, GetError, SaveError},
        usecase::project_evaluation::UpdateResult,
    },
    domain::{Id, ProjectEvaluation},
};

#[derive(Debug)]
pub struct Request {
    pub evaluation_id: Id,
    pub total_score: Option<f32>,
    pub feedback: Option<String>,
}

pub type Response = ProjectEvaluation;

#[derive(Debug, Error)]
pub enum Error {
    #[error("{0}")]
    Repo(#[from] proj_eval::ConnectionError),
    #[error("Project evaluation to update was not found")]
    NotFound,
}

impl From<GetError> for Error {
    fn from(value: GetError) -> Self {
        match value {
            GetError::NotFound => Error::NotFound,
            GetError::Connection(connection_error) => Error::Repo(connection_error),
        }
    }
}

impl From<SaveError> for Error {
    fn from(value: SaveError) -> Self {
        match value {
            SaveError::Connection(connection_error) => Error::Repo(connection_error),
        }
    }
}

#[derive(Debug)]
pub struct Update<'r, R> {
    repo: &'r R,
}

impl<'r, R> Update<'r, R>
where
    R: proj_eval::Repo,
{
    pub fn new(repo: &'r R) -> Self {
        Self { repo }
    }

    pub async fn exec(&self, req: Request) -> UpdateResult {
        log::debug!("Update project evaluation: {:?}", req);

        let mut eval = self.repo.get(req.evaluation_id.clone()).await?;
        eval.total_score = req.total_score.unwrap_or(eval.total_score);
        eval.feedback = req.feedback.unwrap_or(eval.feedback);

        self.repo.save(eval).await?;

        let eval = self.repo.get(req.evaluation_id).await?;
        Ok(eval)
    }
}
