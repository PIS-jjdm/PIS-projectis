pub mod models;

use thiserror::Error;
use tonic::async_trait;

use crate::domain::Id;
use models::*;

pub trait GatewayCollection {
    fn notification(&self) -> &impl NotificationGateway;
    fn project(&self) -> &impl ProjectGateway;
    fn subject(&self) -> &impl SubjectGateway;
}

#[derive(Debug)]
pub struct EvaluationSavedEvent {
    pub creator_id: Id,
    pub total_score: f32,
    pub team: Team,
    pub project: Project,
    pub subject: Subject,
}

#[derive(Debug)]
pub struct EvaluationDeletedEvent {
    pub creator_id: Id,
    pub team: Team,
    pub project: Project,
    pub subject: Subject,
}

#[async_trait]
pub trait NotificationGateway: Send + Sync {
    async fn send_evaluation_created(
        &self,
        event: EvaluationSavedEvent,
    ) -> Result<(), NotificationError>;

    async fn send_evaluation_updated(
        &self,
        event: EvaluationSavedEvent,
    ) -> Result<(), NotificationError>;

    async fn send_evaluation_deleted(
        &self,
        event: EvaluationDeletedEvent,
    ) -> Result<(), NotificationError>;
}

#[derive(Debug, Error)]
pub enum NotificationError {
    #[error("Notification service unavailable")]
    Unavailable,
    #[error("Notification request failed: {0}")]
    Failed(String),
}

#[async_trait]
pub trait ProjectGateway: Send + Sync {
    async fn get_project_info(&self, project_id: Id) -> Result<Project, ProjectError>;
    async fn get_team_info(&self, team_id: Id) -> Result<Team, ProjectError>;
}

#[derive(Debug, Error)]
pub enum ProjectError {
    #[error("Project service unavailable")]
    Unavailable,
    #[error("Project info request failed: {0}")]
    Failed(String),
}

#[async_trait]
pub trait SubjectGateway: Send + Sync {
    async fn get_subject_info(&self, subject_id: Id) -> Result<Subject, SubjectError>;
}

#[derive(Debug, Error)]
pub enum SubjectError {
    #[error("Subject service unavailable")]
    Unavailable,
    #[error("Subject info request failed: {0}")]
    Failed(String),
}
