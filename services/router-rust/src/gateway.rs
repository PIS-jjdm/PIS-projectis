use tonic::{Request, Response, Status};

use crate::auth_context::{AuthToken, CurrentUser};
use crate::proto::{
    auth::{AuthResponse, GetUserRequest, LoginRequest, LogoutRequest, RegisterRequest, User},
    common::{Ack, Empty, UserRole},
    gateway::{
        frontend_gateway_server::FrontendGateway, RegisterSubjectGatewayRequest,
        RegisterTeamGatewayRequest,
    },
    notification::{
        CreateNotificationRequest, ListNotificationsRequest, ListNotificationsResponse,
        MarkAsReadRequest, Notification, StreamNotificationsRequest,
    },
    project::{
        AddTeamMemberRequest, GetProjectRequest, ListProjectsRequest, ListProjectsResponse,
        Project, RegisterTeamRequest, RemoveTeamMemberRequest, Team,
    },
    subject::{
        CreateSubjectRequest, DeleteSubjectRequest, ListSubjectsRequest, ListSubjectsResponse,
        RegisterStudentToSubjectRequest, Subject, UpdateSubjectRequest,
    },
};
use crate::AppState;

#[derive(Clone)]
pub struct FrontendGatewayService {
    state: AppState,
}

impl FrontendGatewayService {
    pub fn new(state: AppState) -> Self {
        Self { state }
    }

    fn current_user<T>(request: &Request<T>) -> Result<CurrentUser, Status> {
        request
            .extensions()
            .get::<CurrentUser>()
            .cloned()
            .ok_or_else(|| Status::unauthenticated("missing authenticated user"))
    }

    fn auth_token<T>(request: &Request<T>) -> Result<String, Status> {
        request
            .extensions()
            .get::<AuthToken>()
            .map(|token| token.access_token.clone())
            .ok_or_else(|| Status::unauthenticated("missing auth token"))
    }

    fn require_roles(user: &CurrentUser, allowed_roles: &[UserRole]) -> Result<(), Status> {
        if allowed_roles.contains(&user.role) {
            return Ok(());
        }

        Err(Status::permission_denied(
            "user role does not have permission to access this resource",
        ))
    }

    fn require_non_empty(value: &str, name: &str) -> Result<(), Status> {
        if value.trim().is_empty() {
            return Err(Status::invalid_argument(format!("missing {name}")));
        }

        Ok(())
    }
}

#[tonic::async_trait]
impl FrontendGateway for FrontendGatewayService {
    async fn register(
        &self,
        request: Request<RegisterRequest>,
    ) -> Result<Response<AuthResponse>, Status> {
        let response = self
            .state
            .auth_client()
            .register(request.into_inner())
            .await?
            .into_inner();

        Ok(Response::new(response))
    }

    async fn login(
        &self,
        request: Request<LoginRequest>,
    ) -> Result<Response<AuthResponse>, Status> {
        let response = self
            .state
            .auth_client()
            .login(request.into_inner())
            .await?
            .into_inner();

        Ok(Response::new(response))
    }

    async fn get_me(&self, request: Request<Empty>) -> Result<Response<User>, Status> {
        let current_user = Self::current_user(&request)?;
        let response = self
            .state
            .auth_client()
            .get_user(GetUserRequest {
                user_id: current_user.user_id,
            })
            .await?
            .into_inner();

        Ok(Response::new(response))
    }

    async fn logout(&self, request: Request<Empty>) -> Result<Response<Ack>, Status> {
        let access_token = Self::auth_token(&request)?;
        let response = self
            .state
            .auth_client()
            .logout(LogoutRequest { access_token })
            .await?
            .into_inner();

        Ok(Response::new(response))
    }

    async fn list_subjects(
        &self,
        _request: Request<Empty>,
    ) -> Result<Response<ListSubjectsResponse>, Status> {
        let response = self
            .state
            .subject_client()
            .list_subjects(ListSubjectsRequest {})
            .await?
            .into_inner();

        Ok(Response::new(response))
    }

    async fn create_subject(
        &self,
        request: Request<CreateSubjectRequest>,
    ) -> Result<Response<Subject>, Status> {
        let current_user = Self::current_user(&request)?;
        Self::require_roles(&current_user, &[UserRole::Teacher, UserRole::Admin])?;

        let response = self
            .state
            .subject_client()
            .create_subject(request.into_inner())
            .await?
            .into_inner();

        Ok(Response::new(response))
    }

    async fn update_subject(
        &self,
        request: Request<UpdateSubjectRequest>,
    ) -> Result<Response<Subject>, Status> {
        let current_user = Self::current_user(&request)?;
        Self::require_roles(&current_user, &[UserRole::Teacher, UserRole::Admin])?;

        let response = self
            .state
            .subject_client()
            .update_subject(request.into_inner())
            .await?
            .into_inner();

        Ok(Response::new(response))
    }

    async fn delete_subject(
        &self,
        request: Request<DeleteSubjectRequest>,
    ) -> Result<Response<Ack>, Status> {
        let current_user = Self::current_user(&request)?;
        Self::require_roles(&current_user, &[UserRole::Teacher, UserRole::Admin])?;

        let response = self
            .state
            .subject_client()
            .delete_subject(request.into_inner())
            .await?
            .into_inner();

        Ok(Response::new(response))
    }

    async fn register_subject(
        &self,
        request: Request<RegisterSubjectGatewayRequest>,
    ) -> Result<Response<Ack>, Status> {
        let current_user = Self::current_user(&request)?;
        Self::require_roles(&current_user, &[UserRole::Student])?;

        let body = request.into_inner();
        Self::require_non_empty(&body.subject_id, "subject id")?;

        let response = self
            .state
            .subject_client()
            .register_student_to_subject(RegisterStudentToSubjectRequest {
                subject_id: body.subject_id,
                student_id: current_user.user_id,
            })
            .await?
            .into_inner();

        Ok(Response::new(response))
    }

    async fn list_projects(
        &self,
        _request: Request<Empty>,
    ) -> Result<Response<ListProjectsResponse>, Status> {
        let response = self
            .state
            .project_client()
            .list_projects(ListProjectsRequest {})
            .await?
            .into_inner();

        Ok(Response::new(response))
    }

    async fn get_project(
        &self,
        request: Request<GetProjectRequest>,
    ) -> Result<Response<Project>, Status> {
        let response = self
            .state
            .project_client()
            .get_project(request.into_inner())
            .await?
            .into_inner();

        Ok(Response::new(response))
    }

    async fn register_team(
        &self,
        request: Request<RegisterTeamGatewayRequest>,
    ) -> Result<Response<Team>, Status> {
        let current_user = Self::current_user(&request)?;
        let body = request.into_inner();
        Self::require_non_empty(&body.project_id, "project id")?;

        let response = self
            .state
            .project_client()
            .register_team(RegisterTeamRequest {
                project_id: body.project_id,
                creator_student_id: current_user.user_id,
            })
            .await?
            .into_inner();

        Ok(Response::new(response))
    }

    async fn add_team_member(
        &self,
        request: Request<AddTeamMemberRequest>,
    ) -> Result<Response<Team>, Status> {
        let response = self
            .state
            .project_client()
            .add_team_member(request.into_inner())
            .await?
            .into_inner();

        Ok(Response::new(response))
    }

    async fn remove_team_member(
        &self,
        request: Request<RemoveTeamMemberRequest>,
    ) -> Result<Response<Team>, Status> {
        let response = self
            .state
            .project_client()
            .remove_team_member(request.into_inner())
            .await?
            .into_inner();

        Ok(Response::new(response))
    }

    async fn list_notifications(
        &self,
        request: Request<Empty>,
    ) -> Result<Response<ListNotificationsResponse>, Status> {
        let current_user = Self::current_user(&request)?;
        let response = self
            .state
            .notification_client()
            .list_notifications(ListNotificationsRequest {
                user_id: current_user.user_id,
            })
            .await?
            .into_inner();

        Ok(Response::new(response))
    }

    async fn create_notification(
        &self,
        request: Request<CreateNotificationRequest>,
    ) -> Result<Response<Notification>, Status> {
        let current_user = Self::current_user(&request)?;
        Self::require_roles(&current_user, &[UserRole::Teacher, UserRole::Admin])?;

        let response = self
            .state
            .notification_client()
            .create_notification(request.into_inner())
            .await?
            .into_inner();

        Ok(Response::new(response))
    }

    async fn mark_notification_read(
        &self,
        request: Request<MarkAsReadRequest>,
    ) -> Result<Response<Ack>, Status> {
        let response = self
            .state
            .notification_client()
            .mark_as_read(request.into_inner())
            .await?
            .into_inner();

        Ok(Response::new(response))
    }

    type StreamNotificationsStream = tonic::Streaming<Notification>;

    async fn stream_notifications(
        &self,
        request: Request<Empty>,
    ) -> Result<Response<Self::StreamNotificationsStream>, Status> {
        let current_user = Self::current_user(&request)?;
        let response = self
            .state
            .notification_client()
            .stream_notifications(StreamNotificationsRequest {
                user_id: current_user.user_id,
            })
            .await?;

        Ok(Response::new(response.into_inner()))
    }
}
