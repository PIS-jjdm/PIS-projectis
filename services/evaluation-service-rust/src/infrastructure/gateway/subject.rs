use std::sync::{Arc, Mutex};

use tonic::{async_trait, transport::Channel};

use crate::{
    application::gateway::{SubjectError, SubjectGateway, models},
    domain::Id,
    infrastructure::api::grpc_models::subject::subject_service_client::SubjectServiceClient,
};

pub struct GrpcSubjectGateway {
    client: Option<Arc<Mutex<SubjectServiceClient<Channel>>>>,
}

impl GrpcSubjectGateway {
    pub async fn connect(addr: &str) -> Result<Self, anyhow::Error> {
        // let client = SubjectServiceClient::connect(addr.to_owned()).await?;
        log::warn!("Subject gateway not implemented yet. Skipping.");

        Ok(Self {
            client: None, //Arc::new(Mutex::new(client)),
        })
    }
}

#[async_trait]
impl SubjectGateway for GrpcSubjectGateway {
    async fn get_subject_info(&self, _subject_id: Id) -> Result<models::Subject, SubjectError> {
        todo!()
    }
}
