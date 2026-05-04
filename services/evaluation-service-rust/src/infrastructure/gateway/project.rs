use std::str::FromStr;
use tonic::{
    Code, async_trait,
    transport::{Channel, Uri},
};

use crate::{
    application::gateway::{ProjectError, ProjectGateway, models},
    domain::Id,
    infrastructure::{
        api::grpc_models::project::{self as grpc, project_service_client::ProjectServiceClient},
        gateway::WithSessionAuth,
    },
};

pub struct GrpcProjectGateway {
    client: ProjectServiceClient<Channel>,
}

impl GrpcProjectGateway {
    pub async fn connect(addr: &str) -> Result<Self, anyhow::Error> {
        let channel = Channel::builder(Uri::from_str(addr)?).connect_lazy();
        let client = ProjectServiceClient::new(channel);

        tracing::info!(addr = addr, "Using lazy connect");

        Ok(Self { client })
    }
}

#[async_trait]
impl ProjectGateway for GrpcProjectGateway {
    async fn get_project_info(&self, project_id: Id) -> Result<models::Project, ProjectError> {
        let req =
            tonic::Request::new(grpc::GetProjectRequest { project_id }).with_session_auth()?;
        let response = self.client.clone().get_project(req).await?;

        Ok(response.into_inner().into())
    }

    async fn get_team_info(&self, team_id: Id) -> Result<models::Team, ProjectError> {
        let req = tonic::Request::new(grpc::GetTeamRequest { team_id }).with_session_auth()?;
        let response = self.client.clone().get_team(req).await?;

        Ok(response.into_inner().into())
    }
}

impl From<grpc::Project> for models::Project {
    fn from(proj: grpc::Project) -> Self {
        Self {
            name: proj.title,
            subject_id: proj.subject_id,
            max_points: proj.max_points,
        }
    }
}

impl From<grpc::TeamDetail> for models::Team {
    fn from(team: grpc::TeamDetail) -> Self {
        Self {
            name: team.name,
            members: team.students.iter().map(|s| s.id.clone()).collect(),
        }
    }
}

impl From<tonic::Status> for ProjectError {
    fn from(value: tonic::Status) -> Self {
        match value.code() {
            Code::Unavailable => Self::Unavailable,
            _ => Self::Failed(value.message().to_owned()),
        }
    }
}

impl From<anyhow::Error> for ProjectError {
    fn from(error: anyhow::Error) -> Self {
        Self::Failed(error.to_string())
    }
}
