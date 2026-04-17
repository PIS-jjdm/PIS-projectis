use async_trait::async_trait;
use fjall::{Database, Keyspace, KeyspaceCreateOptions, Slice};
use nid::Nanoid;
use std::path::PathBuf;

use crate::adapter::Db;
use crate::application::repository::project_evaluation::{self as proj, GetError};
use crate::domain::*;

pub type Error = anyhow::Error;

pub struct KeyValue {
    db: Database,
    project_evaluations: Keyspace,
}

impl KeyValue {
    pub const PROJ_KEYSPACE: &'static str = "project_evaluations";

    pub fn try_from(db_path: &PathBuf) -> Result<Self, Error> {
        let db = Database::builder(db_path).open()?;
        let project_evaluations =
            db.keyspace(KeyValue::PROJ_KEYSPACE, KeyspaceCreateOptions::default)?;

        Ok(Self {
            db,
            project_evaluations,
        })
    }
}

impl Db for KeyValue {}

#[async_trait]
impl proj::Repo for KeyValue {
    async fn save(&self, record: ProjectEvaluation) -> Result<(), proj::SaveError> {
        let items = self.project_evaluations.clone();
        let db = self.db.clone();

        tokio::task::spawn_blocking(move || -> anyhow::Result<()> {
            let serialized = Vec::<u8>::from(&record);
            items.insert(record.id, serialized)?;
            db.persist(fjall::PersistMode::SyncAll)?;
            Ok(())
        })
        .await
        .map_err(|_| proj::ConnectionError)? // Join error
        .map_err(|_| proj::ConnectionError)?; // Task error

        Ok(())
    }

    async fn get(&self, id: Id) -> Result<ProjectEvaluation, proj::GetError> {
        let items = self.project_evaluations.clone();
        tokio::task::spawn_blocking(move || {
            items
                .get(id)
                .map_err(|_| proj::ConnectionError)?
                .ok_or(proj::GetError::NotFound)
                .map(|bytes| ProjectEvaluation::from(&bytes))
        })
        .await
        .map_err(|_| proj::ConnectionError)?
    }

    async fn get_all(&self) -> Result<Vec<ProjectEvaluation>, proj::GetAllError> {
        let items = self.project_evaluations.clone();
        tokio::task::spawn_blocking(move || {
            let mut evals: Vec<ProjectEvaluation> = vec![];
            for res in items.iter().map(|b| b.value()) {
                let Ok(bytes) = res else {
                    return Err(proj::ConnectionError.into());
                };

                evals.push(ProjectEvaluation::from(&bytes));
            }

            Ok(evals)
        })
        .await
        .map_err(|_| proj::ConnectionError)?
    }

    async fn delete(&self, id: Id) -> Result<ProjectEvaluation, proj::DeleteError> {
        let eval = self.get(id.clone()).await?;
        let items = self.project_evaluations.clone();

        tokio::task::spawn_blocking(move || {
            items.remove(id).map_err(|_| proj::ConnectionError)?;
            Ok(eval)
        })
        .await
        .map_err(|_| proj::ConnectionError)?
    }

    async fn len(&self) -> Result<usize, proj::CountError> {
        let items = self.project_evaluations.clone();
        tokio::task::spawn_blocking(move || {
            let len = items
                .len() // FIXME: O(n) complexity!! Use range (filters)
                .map_err(|_| proj::ConnectionError)?;
            Ok(len)
        })
        .await
        .map_err(|_| proj::ConnectionError)?
    }

    async fn new_id(&self, project_id: &Id, team_id: &Id) -> Id {
        let id = Nanoid::<4, nid::alphabet::Base64UrlAlphabet>::new();
        format!("{}{}{}", project_id, team_id, id)
    }
}

impl From<&ProjectEvaluation> for Vec<u8> {
    fn from(val: &ProjectEvaluation) -> Self {
        rmp_serde::to_vec(&val).expect("should serialize")
    }
}

impl From<&Slice> for ProjectEvaluation {
    fn from(val: &Slice) -> Self {
        rmp_serde::from_slice(val).expect("should deserialize")
    }
}

impl From<proj::GetError> for proj::DeleteError {
    fn from(value: proj::GetError) -> Self {
        match value {
            GetError::NotFound => proj::DeleteError::NotFound,
            GetError::Connection(connection_error) => {
                proj::DeleteError::Connection(connection_error)
            }
        }
    }
}
