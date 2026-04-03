use super::*;
use crate::proto::auth::{ChangePasswordRequest, ListUsersRequest, LogoutRequest};

pub(super) async fn register(
    service: &FrontendGatewayService,
    request: Request<RegisterRequest>,
) -> Result<Response<AuthResponse>, Status> {
    let response = service
        .state
        .auth_client()
        .register(request.into_inner())
        .await?
        .into_inner();

    Ok(Response::new(response))
}

pub(super) async fn create_user(
    service: &FrontendGatewayService,
    request: Request<CreateUserRequest>,
) -> Result<Response<User>, Status> {
    let current_user = FrontendGatewayService::current_user(&request)?;
    FrontendGatewayService::require_roles(&current_user, &[UserRole::Admin])?;

    let response = service
        .state
        .auth_client()
        .create_user(request.into_inner())
        .await?
        .into_inner();

    Ok(Response::new(response))
}

pub(super) async fn update_user(
    service: &FrontendGatewayService,
    request: Request<UpdateUserRequest>,
) -> Result<Response<User>, Status> {
    let current_user = FrontendGatewayService::current_user(&request)?;
    FrontendGatewayService::require_roles(&current_user, &[UserRole::Admin])?;

    let body = request.into_inner();
    FrontendGatewayService::require_non_empty(&body.user_id, "user id")?;

    let response = service
        .state
        .auth_client()
        .update_user(body)
        .await?
        .into_inner();

    Ok(Response::new(response))
}

pub(super) async fn set_user_avatar(
    service: &FrontendGatewayService,
    request: Request<SetUserAvatarRequest>,
) -> Result<Response<Ack>, Status> {
    let current_user = FrontendGatewayService::current_user(&request)?;
    let body = request.into_inner();
    FrontendGatewayService::require_non_empty(&body.user_id, "user id")?;

    if current_user.user_id != body.user_id && current_user.role != UserRole::Admin {
        return Err(Status::permission_denied(
            "user role does not have permission to access this resource",
        ));
    }

    let response = service
        .state
        .auth_client()
        .set_user_avatar(body)
        .await?
        .into_inner();

    Ok(Response::new(response))
}

pub(super) async fn login(
    service: &FrontendGatewayService,
    request: Request<LoginRequest>,
) -> Result<Response<AuthResponse>, Status> {
    let response = service
        .state
        .auth_client()
        .login(request.into_inner())
        .await?
        .into_inner();

    Ok(Response::new(response))
}

pub(super) async fn get_me(
    service: &FrontendGatewayService,
    request: Request<Empty>,
) -> Result<Response<User>, Status> {
    let current_user = FrontendGatewayService::current_user(&request)?;
    let response = service
        .state
        .auth_client()
        .get_user(GetUserRequest {
            user_id: current_user.user_id,
        })
        .await?
        .into_inner();

    Ok(Response::new(response))
}

pub(super) async fn get_user(
    service: &FrontendGatewayService,
    request: Request<GetUserRequest>,
) -> Result<Response<User>, Status> {
    let body = request.into_inner();
    FrontendGatewayService::require_non_empty(&body.user_id, "user id")?;

    let response = service
        .state
        .auth_client()
        .get_user(body)
        .await?
        .into_inner();

    Ok(Response::new(response))
}

pub(super) async fn list_users(
    service: &FrontendGatewayService,
    request: Request<Empty>,
) -> Result<Response<ListUsersResponse>, Status> {
    let current_user = FrontendGatewayService::current_user(&request)?;
    FrontendGatewayService::require_roles(&current_user, &[UserRole::Teacher, UserRole::Admin])?;

    let response = service
        .state
        .auth_client()
        .list_users(ListUsersRequest {})
        .await?
        .into_inner();

    Ok(Response::new(response))
}

pub(super) async fn logout(
    service: &FrontendGatewayService,
    request: Request<Empty>,
) -> Result<Response<Ack>, Status> {
    let access_token = FrontendGatewayService::auth_token(&request)?;
    let response = service
        .state
        .auth_client()
        .logout(LogoutRequest { access_token })
        .await?
        .into_inner();

    Ok(Response::new(response))
}

pub(super) async fn change_password(
    service: &FrontendGatewayService,
    request: Request<ChangePasswordGatewayRequest>,
) -> Result<Response<Ack>, Status> {
    let current_user = FrontendGatewayService::current_user(&request)?;
    let body = request.into_inner();
    FrontendGatewayService::require_non_empty(&body.current_password, "current password")?;
    FrontendGatewayService::require_non_empty(&body.new_password, "new password")?;

    let response = service
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
