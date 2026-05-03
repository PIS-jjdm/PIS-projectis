mod auth;
mod eval;
mod notifications;
mod projects;
mod subjects;

use std::{collections::HashMap, pin::Pin};

use tonic::{Request, Response, Status};

use crate::auth_context::{AuthToken, CurrentUser};
use crate::proto::{
    auth::{
        AuthResponse, CreateUserRequest, GetUserRequest, ListUsersResponse, LoginRequest,
        RegisterRequest, SetUserAvatarRequest, UpdateUserRequest, User,
    },
    common::{Ack, Empty, UserRole},
    gateway::{
        frontend_gateway_server::FrontendGateway, CancelScheduledNotificationGatewayRequest,
        ChangePasswordGatewayRequest, CreateNotificationGatewayRequest,
        CreateNotificationGatewayResponse, CreateProjectGatewayRequest,
        ListNotificationsGatewayResponse, ListTeamsByProjectGatewayResponse,
        NotificationWithSender, RegisterSubjectGatewayRequest,
        RescheduleScheduledNotificationGatewayRequest,
    },
    notification::{ListScheduledNotificationsResponse, MarkAsReadRequest, Notification},
    project::{
        AddTeamMemberRequest, ChangeTeamLeaderRequest, CreateJoinRequestRequest,
        DeleteJoinRequestRequest, DeleteProjectRequest, DeleteSubmissionRequest,
        DownloadSubmissionRequest, FileChunk, GetProjectRequest, GetTeamRequest, JoinRequest,
        LeaveTeamRequest, ListJoinRequestsRequest, ListJoinRequestsResponse, ListProjectsRequest,
        ListProjectsResponse, ListTeamsByProjectRequest, Project,
        ProjectSubmission, RegisterTeamRequest, RemoveTeamMemberRequest, ResolveJoinRequestRequest,
        SubmitProjectRequest, Team, TeamDetail, UpdateProjectRequest,
    },
    subject::{
        CreateSubjectRequest, DeleteSubjectRequest, GetSubjectRequest, ListSubjectsResponse,
        Subject, TeacherSubjectRequest, UpdateSubjectRequest, UserSubjectRequest,
    },
};
use crate::AppState;

type NotificationStream =
    Pin<Box<dyn tokio_stream::Stream<Item = Result<NotificationWithSender, Status>> + Send>>;

/// Snapshots the resolved auth context off an inbound request and re-attaches
/// it as metadata on outbound calls to downstream services. Without this,
/// downstream services that validate the JWT (e.g. project-service) reject
/// every call from the gateway with UNAUTHENTICATED.
#[derive(Clone)]
pub struct ForwardContext {
    token: Option<String>,
}

impl ForwardContext {
    pub fn from_request<T>(request: &Request<T>) -> Self {
        Self {
            token: request
                .extensions()
                .get::<AuthToken>()
                .map(|token| token.access_token.clone()),
        }
    }

    pub fn into_request<T>(self, payload: T) -> Result<Request<T>, Status> {
        let mut request = Request::new(payload);
        if let Some(token) = self.token {
            let value = format!("Bearer {token}")
                .parse()
                .map_err(|_| Status::internal("invalid auth token metadata"))?;
            request.metadata_mut().insert("authorization", value);
        }
        Ok(request)
    }
}

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

    async fn sender_by_id(&self, user_id: &str) -> Option<User> {
        let user_id = user_id.trim();
        if user_id.is_empty() || user_id == "system" {
            return None;
        }

        match self
            .state
            .auth_client()
            .get_user(GetUserRequest {
                user_id: user_id.to_string(),
            })
            .await
        {
            Ok(response) => Some(response.into_inner()),
            Err(status) => {
                tracing::warn!(
                    sender_user_id = user_id,
                    code = ?status.code(),
                    message = status.message(),
                    "failed to fetch notification sender details"
                );
                None
            }
        }
    }

    async fn sender_map(&self, notifications: &[Notification]) -> HashMap<String, User> {
        let mut senders = HashMap::new();

        for notification in notifications {
            let sender_id = notification.creator_user_id.trim();
            if sender_id.is_empty() || sender_id == "system" || senders.contains_key(sender_id) {
                continue;
            }

            if let Some(sender) = self.sender_by_id(sender_id).await {
                senders.insert(sender_id.to_string(), sender);
            }
        }

        senders
    }

    async fn enrich_notification(&self, notification: Notification) -> NotificationWithSender {
        let sender = self.sender_by_id(&notification.creator_user_id).await;
        NotificationWithSender {
            notification: Some(notification),
            sender,
        }
    }

    async fn enrich_notifications(
        &self,
        notifications: Vec<Notification>,
    ) -> Vec<NotificationWithSender> {
        let senders = self.sender_map(&notifications).await;

        notifications
            .into_iter()
            .map(|notification| NotificationWithSender {
                sender: senders.get(&notification.creator_user_id).cloned(),
                notification: Some(notification),
            })
            .collect()
    }
}

#[tonic::async_trait]
impl FrontendGateway for FrontendGatewayService {
    async fn register(
        &self,
        request: Request<RegisterRequest>,
    ) -> Result<Response<AuthResponse>, Status> {
        auth::register(self, request).await
    }

    async fn create_user(
        &self,
        request: Request<CreateUserRequest>,
    ) -> Result<Response<User>, Status> {
        auth::create_user(self, request).await
    }

    async fn update_user(
        &self,
        request: Request<UpdateUserRequest>,
    ) -> Result<Response<User>, Status> {
        auth::update_user(self, request).await
    }

    async fn set_user_avatar(
        &self,
        request: Request<SetUserAvatarRequest>,
    ) -> Result<Response<Ack>, Status> {
        auth::set_user_avatar(self, request).await
    }

    async fn login(
        &self,
        request: Request<LoginRequest>,
    ) -> Result<Response<AuthResponse>, Status> {
        auth::login(self, request).await
    }

    async fn get_me(&self, request: Request<Empty>) -> Result<Response<User>, Status> {
        auth::get_me(self, request).await
    }

    async fn get_user(&self, request: Request<GetUserRequest>) -> Result<Response<User>, Status> {
        auth::get_user(self, request).await
    }

    async fn list_users(
        &self,
        request: Request<Empty>,
    ) -> Result<Response<ListUsersResponse>, Status> {
        auth::list_users(self, request).await
    }

    async fn logout(&self, request: Request<Empty>) -> Result<Response<Ack>, Status> {
        auth::logout(self, request).await
    }

    async fn change_password(
        &self,
        request: Request<ChangePasswordGatewayRequest>,
    ) -> Result<Response<Ack>, Status> {
        auth::change_password(self, request).await
    }

    async fn list_subjects(
        &self,
        request: Request<Empty>,
    ) -> Result<Response<ListSubjectsResponse>, Status> {
        subjects::list_subjects(self, request).await
    }

    async fn get_subject(
        &self,
        request: Request<GetSubjectRequest>,
    ) -> Result<Response<Subject>, Status> {
        subjects::get_subject(self, request).await
    }

    async fn create_subject(
        &self,
        request: Request<CreateSubjectRequest>,
    ) -> Result<Response<Subject>, Status> {
        subjects::create_subject(self, request).await
    }

    async fn update_subject(
        &self,
        request: Request<UpdateSubjectRequest>,
    ) -> Result<Response<Subject>, Status> {
        subjects::update_subject(self, request).await
    }

    async fn delete_subject(
        &self,
        request: Request<DeleteSubjectRequest>,
    ) -> Result<Response<Ack>, Status> {
        subjects::delete_subject(self, request).await
    }

    async fn register_subject(
        &self,
        request: Request<RegisterSubjectGatewayRequest>,
    ) -> Result<Response<Ack>, Status> {
        subjects::register_subject(self, request).await
    }

    async fn add_student_to_subject(
        &self,
        request: Request<UserSubjectRequest>,
    ) -> Result<Response<Ack>, Status> {
        subjects::add_student_to_subject(self, request).await
    }

    async fn remove_student_from_subject(
        &self,
        request: Request<UserSubjectRequest>,
    ) -> Result<Response<Ack>, Status> {
        subjects::remove_student_from_subject(self, request).await
    }

    async fn assign_teacher_to_subject(
        &self,
        request: Request<TeacherSubjectRequest>,
    ) -> Result<Response<Subject>, Status> {
        subjects::assign_teacher_to_subject(self, request).await
    }

    async fn remove_teacher_from_subject(
        &self,
        request: Request<TeacherSubjectRequest>,
    ) -> Result<Response<Subject>, Status> {
        subjects::remove_teacher_from_subject(self, request).await
    }

    async fn list_projects(
        &self,
        request: Request<ListProjectsRequest>,
    ) -> Result<Response<ListProjectsResponse>, Status> {
        projects::list_projects(self, request).await
    }

    async fn create_project(
        &self,
        request: Request<CreateProjectGatewayRequest>,
    ) -> Result<Response<Project>, Status> {
        projects::create_project(self, request).await
    }

    async fn get_project(
        &self,
        request: Request<GetProjectRequest>,
    ) -> Result<Response<Project>, Status> {
        projects::get_project(self, request).await
    }

    async fn update_project(
        &self,
        request: Request<UpdateProjectRequest>,
    ) -> Result<Response<Project>, Status> {
        projects::update_project(self, request).await
    }

    async fn delete_project(
        &self,
        request: Request<DeleteProjectRequest>,
    ) -> Result<Response<Ack>, Status> {
        projects::delete_project(self, request).await
    }

    async fn register_team(
        &self,
        request: Request<RegisterTeamRequest>,
    ) -> Result<Response<Team>, Status> {
        projects::register_team(self, request).await
    }

    async fn get_team(
        &self,
        request: Request<GetTeamRequest>,
    ) -> Result<Response<TeamDetail>, Status> {
        projects::get_team(self, request).await
    }

    async fn list_teams_by_project(
        &self,
        request: Request<ListTeamsByProjectRequest>,
    ) -> Result<Response<ListTeamsByProjectGatewayResponse>, Status> {
        projects::list_teams_by_project(self, request).await
    }

    async fn leave_team(
        &self,
        request: Request<LeaveTeamRequest>,
    ) -> Result<Response<Ack>, Status> {
        projects::leave_team(self, request).await
    }

    async fn change_team_leader(
        &self,
        request: Request<ChangeTeamLeaderRequest>,
    ) -> Result<Response<Team>, Status> {
        projects::change_team_leader(self, request).await
    }

    async fn add_team_member(
        &self,
        request: Request<AddTeamMemberRequest>,
    ) -> Result<Response<Team>, Status> {
        projects::add_team_member(self, request).await
    }

    async fn remove_team_member(
        &self,
        request: Request<RemoveTeamMemberRequest>,
    ) -> Result<Response<Team>, Status> {
        projects::remove_team_member(self, request).await
    }

    async fn create_join_request(
        &self,
        request: Request<CreateJoinRequestRequest>,
    ) -> Result<Response<JoinRequest>, Status> {
        projects::create_join_request(self, request).await
    }

    async fn delete_join_request(
        &self,
        request: Request<DeleteJoinRequestRequest>,
    ) -> Result<Response<Ack>, Status> {
        projects::delete_join_request(self, request).await
    }

    async fn resolve_join_request(
        &self,
        request: Request<ResolveJoinRequestRequest>,
    ) -> Result<Response<JoinRequest>, Status> {
        projects::resolve_join_request(self, request).await
    }

    async fn list_join_requests(
        &self,
        request: Request<ListJoinRequestsRequest>,
    ) -> Result<Response<ListJoinRequestsResponse>, Status> {
        projects::list_join_requests(self, request).await
    }

    async fn submit_project(
        &self,
        request: Request<SubmitProjectRequest>,
    ) -> Result<Response<ProjectSubmission>, Status> {
        projects::submit_project(self, request).await
    }

    type DownloadSubmissionStream =
        Pin<Box<dyn tokio_stream::Stream<Item = Result<FileChunk, Status>> + Send>>;

    async fn delete_submission(
        &self,
        request: Request<DeleteSubmissionRequest>,
    ) -> Result<Response<Ack>, Status> {
        projects::delete_submission(self, request).await
    }

    async fn download_submission(
        &self,
        request: Request<DownloadSubmissionRequest>,
    ) -> Result<Response<Self::DownloadSubmissionStream>, Status> {
        projects::download_submission(self, request).await
    }

    async fn list_notifications(
        &self,
        request: Request<Empty>,
    ) -> Result<Response<ListNotificationsGatewayResponse>, Status> {
        notifications::list_notifications(self, request).await
    }

    async fn list_scheduled_notifications(
        &self,
        request: Request<Empty>,
    ) -> Result<Response<ListScheduledNotificationsResponse>, Status> {
        notifications::list_scheduled_notifications(self, request).await
    }

    async fn create_notification(
        &self,
        request: Request<CreateNotificationGatewayRequest>,
    ) -> Result<Response<CreateNotificationGatewayResponse>, Status> {
        notifications::create_notification(self, request).await
    }

    async fn mark_notification_read(
        &self,
        request: Request<MarkAsReadRequest>,
    ) -> Result<Response<Ack>, Status> {
        notifications::mark_notification_read(self, request).await
    }

    async fn cancel_scheduled_notification(
        &self,
        request: Request<CancelScheduledNotificationGatewayRequest>,
    ) -> Result<Response<Ack>, Status> {
        notifications::cancel_scheduled_notification(self, request).await
    }

    async fn reschedule_scheduled_notification(
        &self,
        request: Request<RescheduleScheduledNotificationGatewayRequest>,
    ) -> Result<Response<Ack>, Status> {
        notifications::reschedule_scheduled_notification(self, request).await
    }

    type StreamNotificationsStream = NotificationStream;

    async fn stream_notifications(
        &self,
        request: Request<Empty>,
    ) -> Result<Response<Self::StreamNotificationsStream>, Status> {
        notifications::stream_notifications(self, request).await
    }

    async fn get_project_evaluation(
        &self,
        request: tonic::Request<super::proto::eval::GetProjectEvaluationRequest>,
    ) -> std::result::Result<tonic::Response<super::proto::eval::ProjectEvaluation>, tonic::Status>
    {
        eval::get_project_evaluation(&self.state, request).await
    }

    async fn list_project_evaluations(
        &self,
        request: tonic::Request<super::proto::eval::ListProjectEvaluationsRequest>,
    ) -> std::result::Result<
        tonic::Response<super::proto::eval::ListProjectEvaluationsResponse>,
        tonic::Status,
    > {
        eval::list_project_evaluations(&self.state, request).await
    }

    async fn create_project_evaluation(
        &self,
        request: tonic::Request<super::proto::eval::CreateProjectEvaluationRequest>,
    ) -> std::result::Result<tonic::Response<super::proto::eval::ProjectEvaluation>, tonic::Status>
    {
        eval::create_project_evaluation(&self.state, request).await
    }

    async fn update_project_evaluation(
        &self,
        request: tonic::Request<super::proto::eval::UpdateProjectEvaluationRequest>,
    ) -> std::result::Result<tonic::Response<super::proto::eval::ProjectEvaluation>, tonic::Status>
    {
        eval::update_project_evaluation(&self.state, request).await
    }

    async fn delete_project_evaluation(
        &self,
        request: tonic::Request<super::proto::eval::DeleteEvaluationRequest>,
    ) -> std::result::Result<tonic::Response<super::proto::common::Ack>, tonic::Status> {
        eval::delete_project_evaluation(&self.state, request).await
    }
}
