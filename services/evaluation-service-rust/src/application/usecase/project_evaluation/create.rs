use derive_getters::Getters;
use thiserror::Error;

use crate::{
    application::{
        repository::project_evaluation as proj_eval, usecase::project_evaluation::CreateResult,
    },
    domain::{Id, ProjectEvaluation},
};

#[derive(Debug)]
pub struct Request {
    pub project_id: Id,
    pub team_id: Id,
    pub evaluator_teacher_id: Id,
    pub total_score: f32,
    pub feedback: String,
}

#[derive(Getters)]
pub struct Response {
    evaluation_id: Id,
}

#[derive(Debug, Error)]
pub enum Error {
    #[error("{0}")]
    Repo(#[from] proj_eval::SaveError),
    #[error("Project evaluation create request has invalid fields")]
    Invalid,
}

#[derive(Debug)]
pub struct Create<'r, R> {
    repo: &'r R,
}

impl<'r, R> Create<'r, R>
where
    R: proj_eval::Repo,
{
    pub fn new(repo: &'r R) -> Self {
        Self { repo }
    }

    pub async fn exec(&self, req: Request) -> CreateResult {
        log::debug!("Create new project evaluation: {:?}", req);

        let id = self.repo.new_id(&req.project_id, &req.team_id).await;

        let record = ProjectEvaluation {
            id: id.clone(),
            project_id: req.project_id,
            team_id: req.team_id,
            evaluator_teacher_id: req.evaluator_teacher_id,
            total_score: req.total_score,
            feedback: req.feedback,
            created_at_utc: chrono::Utc::now(),
        };

        self.repo.save(record).await?;

        Ok(Response { evaluation_id: id })
    }
}
