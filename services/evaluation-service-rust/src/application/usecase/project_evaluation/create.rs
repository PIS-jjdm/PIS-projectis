use thiserror::Error;

use crate::{
    application::{
        gateway::*,
        repository::project_evaluation::{self as proj_eval, ConnectionError},
        usecase::project_evaluation::{self as usecase, CreateResult},
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

pub type Response = ProjectEvaluation;

#[derive(Debug, Error)]
pub enum Error {
    #[error("{0}")]
    Repo(#[from] proj_eval::SaveError),
    #[error("Project evaluation create request validation failed: {0}")]
    Invalid(#[from] usecase::validate::Error),
}

#[derive(Debug)]
pub struct Create<'r, 'g, R, G> {
    repo: &'r R,
    gateways: &'g G,
}

impl<'r, 'g, R, G> Create<'r, 'g, R, G>
where
    R: proj_eval::Repo,
    G: GatewayCollection,
{
    pub fn new(repo: &'r R, gateways: &'g G) -> Self {
        Self { repo, gateways }
    }

    pub async fn exec(&self, req: Request) -> CreateResult {
        log::debug!("Create new project evaluation: {:?}", req);

        // Create domain record
        let id = self.repo.make_id(&req.project_id, &req.team_id).await;
        let record = ProjectEvaluation {
            id: id.clone(),
            project_id: req.project_id,
            team_id: req.team_id,
            evaluator_teacher_id: req.evaluator_teacher_id,
            total_score: req.total_score,
            feedback: req.feedback,
            created_at_utc: chrono::Utc::now(),
        };

        // Validate
        usecase::Validate::new(self.repo, self.gateways)
            .exec(&record)
            .await?;

        // Save
        self.repo.save(record).await?;

        // Get new
        let eval = self
            .repo
            .get(id)
            .await
            .map_err(|_| Error::Repo(ConnectionError.into()))?;

        // Notify
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
            .send_evaluation_created(EvaluationSavedEvent {
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
