use thiserror::Error;

use crate::{
    application::{
        gateway::*,
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
pub struct Update<'r, 'g, R, G> {
    repo: &'r R,
    gateways: &'g G,
}

impl<'r, 'g, R, G> Update<'r, 'g, R, G>
where
    R: proj_eval::Repo,
    G: GatewayCollection,
{
    pub fn new(repo: &'r R, gateways: &'g G) -> Self {
        Self { repo, gateways }
    }

    pub async fn exec(&self, req: Request) -> UpdateResult {
        log::debug!("Update project evaluation: {:?}", req);

        let mut eval = self.repo.get(req.evaluation_id.clone()).await?;
        eval.total_score = req.total_score.unwrap_or(eval.total_score);
        eval.feedback = req.feedback.unwrap_or(eval.feedback);

        self.repo.save(eval).await?;

        let eval = self.repo.get(req.evaluation_id).await?;

        if let Err(e) = self.notify(&eval).await {
            log::error!("Notification creation failed: {e}");
        }

        Ok(eval)
    }

    async fn notify(&self, record: &ProjectEvaluation) -> Result<(), anyhow::Error> {
        let project = self
            .gateways
            .project()
            .get_project_info(record.project_id.clone())
            .await?;

        let team = self
            .gateways
            .project()
            .get_team_info(record.team_id.clone())
            .await?;

        let subject = self
            .gateways
            .subject()
            .get_subject_info(project.subject_id.clone())
            .await?;

        self.gateways
            .notification()
            .send_evaluation_updated(EvaluationSavedEvent {
                creator_id: record.evaluator_teacher_id.clone(),
                total_score: record.total_score,
                team,
                project,
                subject,
            })
            .await?;

        Ok(())
    }
}
