mod notification;
mod project;
mod subject;

pub use notification::GrpcNotificationGateway;
pub use project::GrpcProjectGateway;
pub use subject::GrpcSubjectGateway;
use thiserror::Error;
use tonic::metadata::MetadataValue;

use crate::{
    application::gateway::{
        GatewayCollection, NotificationGateway, ProjectGateway, SubjectGateway,
    },
    infrastructure::api::REQUEST_CONTEXT,
};

pub struct GrpcGatewayCollection {
    pub notification: GrpcNotificationGateway,
    pub project: GrpcProjectGateway,
    pub subject: GrpcSubjectGateway,
}

impl GatewayCollection for GrpcGatewayCollection {
    fn notification(&self) -> &impl NotificationGateway {
        &self.notification
    }

    fn project(&self) -> &impl ProjectGateway {
        &self.project
    }

    fn subject(&self) -> &impl SubjectGateway {
        &self.subject
    }
}

#[derive(Debug, Error)]
enum AuthError {
    #[error("Request context extraction failed: {0}")]
    Context(anyhow::Error),
    #[error("Failed to convert auth token to metadata value")]
    Meta,
}

trait WithSessionAuth {
    fn with_session_auth(self) -> Result<Self, anyhow::Error>
    where
        Self: Sized;
}

impl<T> WithSessionAuth for tonic::Request<T> {
    fn with_session_auth(mut self) -> Result<Self, anyhow::Error> {
        let ctx = REQUEST_CONTEXT
            .try_get()
            .map_err(|e| AuthError::Context(e.into()))?;
        let auth_token = ctx.auth_token();

        self.metadata_mut().append(
            "authorization",
            MetadataValue::try_from(auth_token).map_err(|_| AuthError::Meta)?,
        );

        Ok(self)
    }
}
