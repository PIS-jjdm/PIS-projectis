use crate::proto::{auth, notification, project, subject};
use crate::{config::Config, proto::eval};
use std::time::Duration;
use tokio::time::sleep;
use tonic::transport::Channel;
use tonic::transport::Endpoint;

// Sometime it takes a while for gRPC services to start up and be ready to accept connections
// maybe should implement health checks and wait for the service to be healthy before trying to connect
// instead of just retrying blindly...
const RETRY_ATTEMPTS: usize = 20;

// 12 MiB: leaves headroom on top of the 10 MB user-facing submission size cap for protobuf framing.
pub const MAX_GRPC_MESSAGE_SIZE: usize = 12 * 1024 * 1024;

#[derive(Clone)]
pub struct AppState {
    pub auth_grpc_client: Channel,
    pub notification_grpc_client: Channel,
    pub subject_grpc_client: Channel,
    pub project_grpc_client: Channel,
    pub eval_grpc_client: Channel,
}

async fn connect_with_retry(endpoint: String) -> anyhow::Result<Channel> {
    let endpoint = Endpoint::from_shared(endpoint)?
        .connect_timeout(Duration::from_secs(3))
        .timeout(Duration::from_secs(5));

    let mut last_err = None;

    for attempt in 1..=RETRY_ATTEMPTS {
        match endpoint.clone().connect().await {
            Ok(channel) => return Ok(channel),
            Err(err) => {
                tracing::warn!(attempt, error = %err, "failed to connect to auth-service");
                last_err = Some(err);
                sleep(Duration::from_secs(2)).await;
            }
        }
    }

    Err(last_err.unwrap().into())
}

impl AppState {
    pub async fn from_config(config: &Config) -> Self {
        let auth_grpc_client = connect_with_retry(config.auth_grpc_endpoint.clone())
            .await
            .expect("Failed to connect to auth-service after multiple attempts");

        let notification_grpc_client =
            connect_with_retry(config.notification_grpc_endpoint.clone())
                .await
                .expect("Failed to connect to notification-service after multiple attempts");

        // not yet implemented, lazy connect for now
        let subject_grpc_client = Channel::from_shared(config.subject_grpc_endpoint.clone())
            .expect("Invalid subject gRPC endpoint")
            .connect_lazy();

        // not yet implemented, lazy connect for now
        let project_grpc_client = Channel::from_shared(config.project_grpc_endpoint.clone())
            .expect("Invalid project gRPC endpoint")
            .connect_lazy();

        let eval_grpc_client = connect_with_retry(config.eval_grpc_endpoint.clone())
            .await
            .expect("Failed to connect to evaluation-service after multiple attempts");

        Self {
            auth_grpc_client,
            notification_grpc_client,
            subject_grpc_client,
            project_grpc_client,
            eval_grpc_client,
        }
    }

    pub fn auth_client(&self) -> auth::auth_service_client::AuthServiceClient<Channel> {
        auth::auth_service_client::AuthServiceClient::new(self.auth_grpc_client.clone())
    }

    pub fn notification_client(
        &self,
    ) -> notification::notification_service_client::NotificationServiceClient<Channel> {
        notification::notification_service_client::NotificationServiceClient::new(
            self.notification_grpc_client.clone(),
        )
    }

    pub fn subject_client(&self) -> subject::subject_service_client::SubjectServiceClient<Channel> {
        subject::subject_service_client::SubjectServiceClient::new(self.subject_grpc_client.clone())
    }

    pub fn project_client(&self) -> project::project_service_client::ProjectServiceClient<Channel> {
        project::project_service_client::ProjectServiceClient::new(self.project_grpc_client.clone())
            .max_decoding_message_size(MAX_GRPC_MESSAGE_SIZE)
            .max_encoding_message_size(MAX_GRPC_MESSAGE_SIZE)
    }

    pub fn eval_client(&self) -> eval::evaluation_service_client::EvaluationServiceClient<Channel> {
        eval::evaluation_service_client::EvaluationServiceClient::new(self.eval_grpc_client.clone())
    }
}
