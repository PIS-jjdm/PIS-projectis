use crate::{
    application::{
        repository::project_evaluation as proj_eval, usecase::project_evaluation::FindByIdResult,
    },
    domain::{Id, ProjectEvaluation},
};

pub type Request = Id;
pub type Response = ProjectEvaluation;
pub type Error = proj_eval::GetError;

#[derive(Debug)]
pub struct FindById<'r, R> {
    repo: &'r R,
}

impl<'r, R> FindById<'r, R>
where
    R: proj_eval::Repo,
{
    pub fn new(repo: &'r R) -> Self {
        Self { repo }
    }

    pub async fn exec(&self, evaluation_id: Request) -> FindByIdResult {
        log::debug!("Get project evaluation with Id = {:?}", evaluation_id);

        let proj_eval = self.repo.get(evaluation_id).await?;

        Ok(proj_eval)
    }

    pub async fn by_proj_team_id(&self, project_id: Id, team_id: Id) -> FindByIdResult {
        log::debug!(
            "Get project evaluation with ProjectId = {:?}, TeamId = {:?}",
            project_id,
            team_id
        );

        self.exec(self.repo.make_id(&project_id, &team_id).await)
            .await
    }
}
