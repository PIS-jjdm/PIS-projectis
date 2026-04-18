mod notification;
mod project;
mod subject;

pub use notification::GrpcNotificationGateway;
pub use project::GrpcProjectGateway;
pub use subject::GrpcSubjectGateway;

use crate::application::gateway::{
    GatewayCollection, NotificationGateway, ProjectGateway, SubjectGateway,
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
