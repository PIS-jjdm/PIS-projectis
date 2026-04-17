use crate::{
    application::{
        repository::project_evaluation as proj_eval, usecase::project_evaluation::DeleteResult,
    },
    domain::{Id, ProjectEvaluation},
};

pub type Request = Id;
pub type Response = ProjectEvaluation;
pub type Error = proj_eval::DeleteError;

#[derive(Debug)]
pub struct Delete<'r, R> {
    repo: &'r R,
}

impl<'r, R> Delete<'r, R>
where
    R: proj_eval::Repo,
{
    pub fn new(repo: &'r R) -> Self {
        Self { repo }
    }

    pub async fn exec(&self, evaluation_id: Request) -> DeleteResult {
        log::debug!("Delete project evaluation with Id = {evaluation_id:?}");

        let eval = self.repo.delete(evaluation_id).await?;

        Ok(eval)
    }
}
