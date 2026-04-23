use std::sync::Arc;
use tokio::sync::Mutex;
use tonic::{Code, async_trait, transport::Channel};

use crate::{
    application::gateway::{EvaluationCreatedEvent, NotificationError, NotificationGateway},
    infrastructure::api::grpc_models::notification::{
        CreateNotificationRequest, notification_service_client::NotificationServiceClient,
    },
};

pub struct GrpcNotificationGateway {
    client: Arc<Mutex<NotificationServiceClient<Channel>>>,
}

impl GrpcNotificationGateway {
    pub async fn connect(addr: &str) -> Result<Self, anyhow::Error> {
        let client = NotificationServiceClient::connect(addr.to_owned()).await?;

        Ok(Self {
            client: Arc::new(Mutex::new(client)),
        })
    }
}

#[async_trait]
impl NotificationGateway for GrpcNotificationGateway {
    async fn send_evaluation_created(
        &self,
        event: EvaluationCreatedEvent,
    ) -> Result<(), NotificationError> {
        let message = format!("{event}");
        let request = tonic::Request::new(CreateNotificationRequest {
            user_ids: event.team.members,
            message,
            trigger_at: None,
            creator_user_id: event.creator_id,
        });

        self.client
            .lock()
            .await
            .create_notification(request)
            .await
            .map_err(|e| match e.code() {
                Code::Unavailable => NotificationError::Unavailable,
                _ => NotificationError::Failed(e.message().to_owned()),
            })?;

        Ok(())
    }
}

impl std::fmt::Display for EvaluationCreatedEvent {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(
            f,
            "[{}] {}: New evaluation: {}b for project {}",
            self.subject.abbreviation, self.team.name, self.total_score, self.project.name
        )
    }
}
