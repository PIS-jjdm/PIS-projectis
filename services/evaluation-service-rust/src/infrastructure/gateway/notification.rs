use std::str::FromStr;
use tonic::{
    Code, async_trait,
    transport::{Channel, Uri},
};

use crate::{
    application::gateway::{
        EvaluationDeletedEvent, EvaluationSavedEvent, NotificationError, NotificationGateway,
    },
    infrastructure::{
        api::grpc_models::notification::{
            CreateNotificationRequest, notification_service_client::NotificationServiceClient,
        },
        gateway::WithSessionAuth,
    },
};

pub struct GrpcNotificationGateway {
    client: NotificationServiceClient<Channel>,
}

impl GrpcNotificationGateway {
    pub async fn connect(addr: &str) -> Result<Self, anyhow::Error> {
        let channel = Channel::builder(Uri::from_str(addr)?).connect_lazy();
        let client = NotificationServiceClient::new(channel);

        tracing::info!(addr = addr, "Using lazy connect");

        Ok(Self { client })
    }
}

impl GrpcNotificationGateway {
    async fn send_evaluation_saved(
        &self,
        event: EvaluationSavedEvent,
        message: String,
    ) -> Result<(), NotificationError> {
        let request = tonic::Request::new(CreateNotificationRequest {
            user_ids: event.team.members,
            message,
            trigger_at: None,
            creator_user_id: event.creator_id,
        })
        .with_session_auth()?;

        self.client.clone().create_notification(request).await?;

        Ok(())
    }

    async fn send_evaluation_deleted(
        &self,
        event: EvaluationDeletedEvent,
        message: String,
    ) -> Result<(), NotificationError> {
        let request = tonic::Request::new(CreateNotificationRequest {
            user_ids: event.team.members,
            message,
            trigger_at: None,
            creator_user_id: event.creator_id,
        })
        .with_session_auth()?;

        self.client.clone().create_notification(request).await?;

        Ok(())
    }
}

#[async_trait]
impl NotificationGateway for GrpcNotificationGateway {
    async fn send_evaluation_created(
        &self,
        event: EvaluationSavedEvent,
    ) -> Result<(), NotificationError> {
        let msg = format!(
            "[{}] {}: New evaluation: {}b for project {}",
            event.subject.abbreviation, event.team.name, event.total_score, event.project.name
        );
        self.send_evaluation_saved(event, msg).await
    }

    async fn send_evaluation_updated(
        &self,
        event: EvaluationSavedEvent,
    ) -> Result<(), NotificationError> {
        let msg = format!(
            "[{}] {}: Updated evaluation: {}b for project {}",
            event.subject.abbreviation, event.team.name, event.total_score, event.project.name
        );
        self.send_evaluation_saved(event, msg).await
    }

    async fn send_evaluation_deleted(
        &self,
        event: crate::application::gateway::EvaluationDeletedEvent,
    ) -> Result<(), NotificationError> {
        let msg = format!(
            "[{}] {}: Deleted evaluation for project {}",
            event.subject.abbreviation, event.team.name, event.project.name
        );
        self.send_evaluation_deleted(event, msg).await
    }
}

impl From<tonic::Status> for NotificationError {
    fn from(status: tonic::Status) -> Self {
        match status.code() {
            Code::Unavailable => NotificationError::Unavailable,
            _ => NotificationError::Failed(status.message().to_owned()),
        }
    }
}

impl From<anyhow::Error> for NotificationError {
    fn from(error: anyhow::Error) -> Self {
        Self::Failed(error.to_string())
    }
}
