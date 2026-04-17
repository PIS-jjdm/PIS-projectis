use std::{collections::HashMap, sync::RwLock};

use async_trait::async_trait;
use nid::Nanoid;

use crate::{
    adapter,
    application::repository::project_evaluation as proj_repo,
    domain::{Id, ProjectEvaluation},
};

#[derive(Default)]
pub struct InMemory {
    project_evaluations: RwLock<HashMap<Id, ProjectEvaluation>>,
}

impl adapter::Db for InMemory {}

#[async_trait]
impl proj_repo::Repo for InMemory {
    async fn save(&self, record: ProjectEvaluation) -> Result<(), proj_repo::SaveError> {
        self.project_evaluations
            .write()
            .map_err(|_| proj_repo::ConnectionError)?
            .insert(record.id.clone(), record);

        Ok(())
    }

    async fn get(&self, id: Id) -> Result<ProjectEvaluation, proj_repo::GetError> {
        let eval = self
            .project_evaluations
            .read()
            .map_err(|_| proj_repo::ConnectionError)?
            .get(&id)
            .cloned()
            .ok_or(proj_repo::GetError::NotFound)?;

        Ok(eval)
    }

    async fn get_all(&self) -> Result<Vec<ProjectEvaluation>, proj_repo::GetAllError> {
        let all = self
            .project_evaluations
            .read()
            .map_err(|_| proj_repo::ConnectionError)?
            .values()
            .cloned()
            .collect();

        Ok(all)
    }

    async fn delete(&self, _id: Id) -> Result<ProjectEvaluation, proj_repo::DeleteError> {
        todo!()
    }

    async fn len(&self) -> Result<usize, proj_repo::CountError> {
        let count = self
            .project_evaluations
            .read()
            .map_err(|_| proj_repo::ConnectionError)?
            .len();

        Ok(count)
    }

    async fn new_id(&self, project_id: &Id, team_id: &Id) -> Id {
        let id = Nanoid::<4, nid::alphabet::Base64UrlAlphabet>::new();
        format!("{}{}{}", project_id, team_id, id)
    }
}
