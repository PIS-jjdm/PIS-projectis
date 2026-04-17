use crate::{
    application::{
        repository::project_evaluation as proj_eval,
        usecase::project_evaluation::{CreateResult, FindByIdResult},
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
}
