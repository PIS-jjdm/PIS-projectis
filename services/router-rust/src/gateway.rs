use std::{collections::HashMap, pin::Pin};

use tokio_stream::StreamExt;
use tonic::{Request, Response, Status};

use crate::auth_context::{AuthToken, CurrentUser};
use crate::proto::{
    auth::{
        AuthResponse, ChangePasswordRequest, CreateUserRequest, GetUserRequest, ListUsersRequest,
        ListUsersResponse, LoginRequest, LogoutRequest, RegisterRequest, UpdateUserRequest, User,
    },
    common::{Ack, Empty, UserRole},
    gateway::{
        frontend_gateway_server::FrontendGateway, CancelScheduledNotificationGatewayRequest,
        ChangePasswordGatewayRequest, CreateNotificationGatewayRequest,
        CreateNotificationGatewayResponse, CreateProjectGatewayRequest,
        ListNotificationsGatewayResponse, NotificationWithSender, RegisterSubjectGatewayRequest,
        RegisterTeamGatewayRequest, RescheduleScheduledNotificationGatewayRequest,
    },
    notification::{
        CancelScheduledNotificationRequest, CreateNotificationRequest, ListNotificationsRequest,
        ListScheduledNotificationsRequest, ListScheduledNotificationsResponse, MarkAsReadRequest,
        Notification, RescheduleScheduledNotificationRequest, StreamNotificationsRequest,
    },
    project::{
        AddTeamMemberRequest, CreateProjectRequest, GetProjectRequest, ListProjectsRequest,
        ListProjectsResponse, ListTeamsByProjectRequest, ListTeamsByProjectResponse, Project,
        RegisterTeamRequest, RemoveTeamMemberRequest, Team,
    },
    subject::{
        CreateSubjectRequest, DeleteSubjectRequest, ListSubjectsRequest, ListSubjectsResponse,
        Subject, UpdateSubjectRequest, UserSubjectRequest,
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
        let response = self
            .state
            .auth_client()
            .register(request.into_inner())
            .await?
            .into_inner();

        Ok(Response::new(response))
    }

    async fn create_user(
        &self,
        request: Request<CreateUserRequest>,
    ) -> Result<Response<User>, Status> {
        let current_user = Self::current_user(&request)?;
        Self::require_roles(&current_user, &[UserRole::Admin])?;

        let response = self
            .state
            .auth_client()
            .create_user(request.into_inner())
            .await?
            .into_inner();

        Ok(Response::new(response))
    }

    async fn update_user(
        &self,
        request: Request<UpdateUserRequest>,
    ) -> Result<Response<User>, Status> {
        let current_user = Self::current_user(&request)?;
        Self::require_roles(&current_user, &[UserRole::Admin])?;

        let body = request.into_inner();
        Self::require_non_empty(&body.user_id, "user id")?;

        let response = self
            .state
            .auth_client()
            .update_user(body)
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

    async fn get_user(&self, request: Request<GetUserRequest>) -> Result<Response<User>, Status> {
        let body = request.into_inner();
        Self::require_non_empty(&body.user_id, "user id")?;

        let response = self.state.auth_client().get_user(body).await?.into_inner();

        Ok(Response::new(response))
    }

    async fn list_users(
        &self,
        request: Request<Empty>,
    ) -> Result<Response<ListUsersResponse>, Status> {
        let current_user = Self::current_user(&request)?;
        Self::require_roles(&current_user, &[UserRole::Teacher, UserRole::Admin])?;

        let response = self
            .state
            .auth_client()
            .list_users(ListUsersRequest {})
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

    async fn change_password(
        &self,
        request: Request<ChangePasswordGatewayRequest>,
    ) -> Result<Response<Ack>, Status> {
        let current_user = Self::current_user(&request)?;
        let body = request.into_inner();
        Self::require_non_empty(&body.current_password, "current password")?;
        Self::require_non_empty(&body.new_password, "new password")?;

        let response = self
            .state
            .auth_client()
            .change_password(ChangePasswordRequest {
                user_id: current_user.user_id,
                current_password: body.current_password,
                new_password: body.new_password,
            })
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
            .register_user_to_subject(UserSubjectRequest {
                subject_id: body.subject_id,
                user_id: current_user.user_id,
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

    async fn create_project(
        &self,
        request: Request<CreateProjectGatewayRequest>,
    ) -> Result<Response<Project>, Status> {
        let current_user = Self::current_user(&request)?;
        Self::require_roles(&current_user, &[UserRole::Teacher, UserRole::Admin])?;

        let body = request.into_inner();
        Self::require_non_empty(&body.title, "project title")?;
        Self::require_non_empty(&body.description, "project description")?;
        Self::require_non_empty(&body.subject_id, "subject id")?;

        let response = self
            .state
            .project_client()
            .create_project(CreateProjectRequest {
                title: body.title,
                description: body.description,
                teacher_id: current_user.user_id,
                max_students_per_team: body.max_students_per_team,
                start_date: body.start_date,
                end_date: body.end_date,
                subject_id: body.subject_id,
            })
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

    async fn list_teams_by_project(
        &self,
        request: Request<ListTeamsByProjectRequest>,
    ) -> Result<Response<ListTeamsByProjectResponse>, Status> {
        let response = self
            .state
            .project_client()
            .list_teams_by_project(request.into_inner())
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
    ) -> Result<Response<ListNotificationsGatewayResponse>, Status> {
        let current_user = Self::current_user(&request)?;
        let response = self
            .state
            .notification_client()
            .list_notifications(ListNotificationsRequest {
                user_id: current_user.user_id,
            })
            .await?
            .into_inner();

        let notifications = self.enrich_notifications(response.notifications).await;

        Ok(Response::new(ListNotificationsGatewayResponse {
            notifications,
        }))
    }

    async fn create_notification(
        &self,
        request: Request<CreateNotificationGatewayRequest>,
    ) -> Result<Response<CreateNotificationGatewayResponse>, Status> {
        let current_user = Self::current_user(&request)?;
        Self::require_roles(&current_user, &[UserRole::Teacher, UserRole::Admin])?;

        let body = request.into_inner();
        if body
            .user_ids
            .iter()
            .all(|user_id| user_id.trim().is_empty())
        {
            return Err(Status::invalid_argument(
                "at least one recipient user id is required",
            ));
        }
        Self::require_non_empty(&body.message, "notification message")?;

        let response = self
            .state
            .notification_client()
            .create_notification(CreateNotificationRequest {
                user_ids: body.user_ids,
                message: body.message,
                trigger_at: body.trigger_at,
                creator_user_id: current_user.user_id,
            })
            .await?
            .into_inner();

        let notifications = self.enrich_notifications(response.notifications).await;

        Ok(Response::new(CreateNotificationGatewayResponse {
            notifications,
        }))
    }

    async fn list_scheduled_notifications(
        &self,
        request: Request<Empty>,
    ) -> Result<Response<ListScheduledNotificationsResponse>, Status> {
        let current_user = Self::current_user(&request)?;
        Self::require_roles(&current_user, &[UserRole::Teacher, UserRole::Admin])?;

        let response = self
            .state
            .notification_client()
            .list_scheduled_notifications(ListScheduledNotificationsRequest {
                creator_user_id: current_user.user_id,
            })
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

    async fn cancel_scheduled_notification(
        &self,
        request: Request<CancelScheduledNotificationGatewayRequest>,
    ) -> Result<Response<Ack>, Status> {
        let current_user = Self::current_user(&request)?;
        Self::require_roles(&current_user, &[UserRole::Teacher, UserRole::Admin])?;

        let body = request.into_inner();
        Self::require_non_empty(&body.batch_id, "batch id")?;

        let response = self
            .state
            .notification_client()
            .cancel_scheduled_notification(CancelScheduledNotificationRequest {
                batch_id: body.batch_id,
                creator_user_id: current_user.user_id,
            })
            .await?
            .into_inner();

        Ok(Response::new(response))
    }

    async fn reschedule_scheduled_notification(
        &self,
        request: Request<RescheduleScheduledNotificationGatewayRequest>,
    ) -> Result<Response<Ack>, Status> {
        let current_user = Self::current_user(&request)?;
        Self::require_roles(&current_user, &[UserRole::Teacher, UserRole::Admin])?;

        let body = request.into_inner();
        Self::require_non_empty(&body.batch_id, "batch id")?;
        if body.trigger_at.is_none() {
            return Err(Status::invalid_argument("missing trigger timestamp"));
        }

        let response = self
            .state
            .notification_client()
            .reschedule_scheduled_notification(RescheduleScheduledNotificationRequest {
                batch_id: body.batch_id,
                creator_user_id: current_user.user_id,
                trigger_at: body.trigger_at,
            })
            .await?
            .into_inner();

        Ok(Response::new(response))
    }

    type StreamNotificationsStream =
        Pin<Box<dyn tokio_stream::Stream<Item = Result<NotificationWithSender, Status>> + Send>>;

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

        let state = self.state.clone();
        let stream = response.into_inner().then(move |item| {
            let service = FrontendGatewayService::new(state.clone());
            async move {
                let notification = item?;
                Ok(service.enrich_notification(notification).await)
            }
        });

        Ok(Response::new(Box::pin(stream)))
    }
}
