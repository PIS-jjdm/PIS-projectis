use std::sync::Arc;
use tokio::sync::Mutex;
use tonic::{async_trait, transport::Channel};

use crate::{
    application::gateway::{ProjectError, ProjectGateway, models},
    domain::Id,
    infrastructure::api::grpc_models::project::project_service_client::ProjectServiceClient,
};

pub struct GrpcProjectGateway {
    client: Arc<Mutex<ProjectServiceClient<Channel>>>,
}

impl GrpcProjectGateway {
    pub async fn connect(addr: &str) -> Result<Self, anyhow::Error> {
        let client = ProjectServiceClient::connect(addr.to_owned()).await?;

        Ok(Self {
            client: Arc::new(Mutex::new(client)),
        })
    }
}

#[async_trait]
impl ProjectGateway for GrpcProjectGateway {
    async fn get_project_info(&self, _project_id: Id) -> Result<models::Project, ProjectError> {
        todo!()
    }

    async fn get_team_info(&self, _team_id: Id) -> Result<models::Team, ProjectError> {
        todo!()
    }
}
