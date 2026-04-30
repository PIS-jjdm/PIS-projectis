use std::{str::FromStr, sync::Arc};

use tokio::sync::Mutex;
use tonic::{
    async_trait,
    transport::{Channel, Uri},
};

use crate::{
    application::gateway::{SubjectError, SubjectGateway, models},
    domain::Id,
    infrastructure::api::grpc_models::subject::{
        self as grpc, subject_service_client::SubjectServiceClient,
    },
};

pub struct GrpcSubjectGateway {
    client: Arc<Mutex<SubjectServiceClient<Channel>>>,
}

impl GrpcSubjectGateway {
    pub async fn connect(addr: &str) -> Result<Self, anyhow::Error> {
        let channel = Channel::builder(Uri::from_str(addr)?).connect_lazy();
        let client = SubjectServiceClient::new(channel);

        tracing::info!(addr = addr, "Using lazy connect");

        Ok(Self {
            client: Arc::new(Mutex::new(client)),
        })
    }
}

#[async_trait]
impl SubjectGateway for GrpcSubjectGateway {
    async fn get_subject_info(&self, subject_id: Id) -> Result<models::Subject, SubjectError> {
        let req = grpc::GetSubjectRequest { subject_id };
        let res = self.client.lock().await.get_subject(req).await?;

        Ok(res.into_inner().into())
    }
}

impl From<tonic::Status> for SubjectError {
    fn from(status: tonic::Status) -> Self {
        match status.code() {
            tonic::Code::Unavailable => Self::Unavailable,
            _ => Self::Failed(status.message().to_owned()),
        }
    }
}

impl From<grpc::Subject> for models::Subject {
    fn from(subject: grpc::Subject) -> Self {
        Self {
            name: subject.name,
            abbreviation: subject.abbreviation,
        }
    }
}
