use crate::{
    application::{
        gateway::*, repository::project_evaluation as proj_eval,
        usecase::project_evaluation::DeleteResult,
    },
    domain::{Id, ProjectEvaluation},
};

pub type Request = Id;
pub type Response = ProjectEvaluation;
pub type Error = proj_eval::DeleteError;

#[derive(Debug)]
pub struct Delete<'r, 'g, R, G> {
    repo: &'r R,
    gateways: &'g G,
}

impl<'r, 'g, R, G> Delete<'r, 'g, R, G>
where
    R: proj_eval::Repo,
    G: GatewayCollection,
{
    pub fn new(repo: &'r R, gateways: &'g G) -> Self {
        Self { repo, gateways }
    }

    pub async fn exec(&self, evaluation_id: Request) -> DeleteResult {
        log::debug!("Delete project evaluation with Id = {evaluation_id:?}");

        let eval = self.repo.delete(evaluation_id).await?;

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
            .send_evaluation_deleted(EvaluationDeletedEvent {
                creator_id: record.evaluator_teacher_id.clone(),
                team,
                project,
                subject,
            })
            .await?;

        Ok(())
    }
}
