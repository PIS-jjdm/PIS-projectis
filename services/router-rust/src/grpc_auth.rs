use std::{
    convert::Infallible,
    future::Future,
    pin::Pin,
    task::{Context, Poll},
};

use tonic::codegen::http::{header, HeaderMap, Request, Response};
use tonic::{body::Body, server::NamedService, Status};
use tower::{Layer, Service};

use crate::{
    auth_context::{AuthToken, CurrentUser},
    proto::{auth::ValidateTokenRequest, common::UserRole},
    AppState,
};

const ADMIN_ONLY: &[UserRole] = &[UserRole::Admin];
const TEACHER_OR_ADMIN: &[UserRole] = &[UserRole::Teacher, UserRole::Admin];
const STUDENT_OR_ADMIN: &[UserRole] = &[UserRole::Student, UserRole::Admin];
const STUDENT_ONLY: &[UserRole] = &[UserRole::Student];

#[derive(Clone)]
pub struct GrpcAuthLayer {
    state: AppState,
}

impl GrpcAuthLayer {
    pub fn new(state: AppState) -> Self {
        Self { state }
    }
}

impl<S> Layer<S> for GrpcAuthLayer {
    type Service = GrpcAuthService<S>;

    fn layer(&self, inner: S) -> Self::Service {
        GrpcAuthService {
            inner,
            state: self.state.clone(),
        }
    }
}

#[derive(Clone)]
pub struct GrpcAuthService<S> {
    inner: S,
    state: AppState,
}

impl<S> NamedService for GrpcAuthService<S>
where
    S: NamedService,
{
    const NAME: &'static str = S::NAME;
}

impl<S> Service<Request<Body>> for GrpcAuthService<S>
where
    S: Service<Request<Body>, Response = Response<Body>, Error = Infallible>
        + Clone
        + Send
        + 'static,
    S::Future: Send + 'static,
{
    type Response = Response<Body>;
    type Error = Infallible;
    type Future = Pin<Box<dyn Future<Output = Result<Self::Response, Self::Error>> + Send>>;

    fn poll_ready(&mut self, cx: &mut Context<'_>) -> Poll<Result<(), Self::Error>> {
        self.inner.poll_ready(cx)
    }

    fn call(&mut self, request: Request<Body>) -> Self::Future {
        let policy = route_auth_policy(request.uri().path());
        let state = self.state.clone();
        let mut inner = self.inner.clone();

        Box::pin(async move {
            let auth = match authorize_request(&state, request.headers(), policy).await {
                Ok(auth) => auth,
                Err(status) => return Ok(status.into_http()),
            };

            let mut request = request;
            if let Some((current_user, token)) = auth {
                request.extensions_mut().insert(current_user);
                request.extensions_mut().insert(AuthToken {
                    access_token: token,
                });
            }

            inner.call(request).await
        })
    }
}

#[derive(Clone, Copy)]
enum RouteAuthPolicy {
    Public,
    Authenticated,
    Roles(&'static [UserRole]),
}

fn route_auth_policy(path: &str) -> RouteAuthPolicy {
    match path {
        "/gateway.FrontendGateway/Login" => RouteAuthPolicy::Public,
        "/gateway.FrontendGateway/Register" => RouteAuthPolicy::Roles(&[UserRole::Admin]),
        "/gateway.FrontendGateway/CreateUser" => RouteAuthPolicy::Roles(&[UserRole::Admin]),
        "/gateway.FrontendGateway/UpdateUser" => RouteAuthPolicy::Roles(&[UserRole::Admin]),
        "/gateway.FrontendGateway/CreateSubject"
        | "/gateway.FrontendGateway/UpdateSubject"
        | "/gateway.FrontendGateway/DeleteSubject"
        | "/gateway.FrontendGateway/AddStudentToSubject"
        | "/gateway.FrontendGateway/RemoveStudentFromSubject"
        | "/gateway.FrontendGateway/AssignTeacherToSubject"
        | "/gateway.FrontendGateway/RemoveTeacherFromSubject" => RouteAuthPolicy::Roles(ADMIN_ONLY),
        "/gateway.FrontendGateway/CreateProject"
        | "/gateway.FrontendGateway/UpdateProject"
        | "/gateway.FrontendGateway/DeleteProject"
        | "/gateway.FrontendGateway/CreateNotification"
        | "/gateway.FrontendGateway/ListScheduledNotifications"
        | "/gateway.FrontendGateway/CancelScheduledNotification"
        | "/gateway.FrontendGateway/RescheduleScheduledNotification" => {
            RouteAuthPolicy::Roles(TEACHER_OR_ADMIN)
        }
        "/gateway.FrontendGateway/SubmitProject" => RouteAuthPolicy::Roles(STUDENT_OR_ADMIN),
        "/gateway.FrontendGateway/RegisterSubject" => RouteAuthPolicy::Roles(STUDENT_ONLY),
        _ => RouteAuthPolicy::Authenticated,
    }
}

async fn authorize_request(
    state: &AppState,
    headers: &HeaderMap,
    policy: RouteAuthPolicy,
) -> Result<Option<(CurrentUser, String)>, Status> {
    if matches!(policy, RouteAuthPolicy::Public) {
        return Ok(None);
    }

    let token = extract_bearer_token(headers)
        .inspect_err(|error| {
            tracing::warn!(message = error.message(), "authorization header rejected")
        })
        .map_err(|error| Status::unauthenticated(error.message()))?;

    let response = state
        .auth_client()
        .validate_token(ValidateTokenRequest {
            access_token: token.clone(),
        })
        .await
        .inspect_err(
            |status| tracing::warn!(code = ?status.code(), message = status.message(), "token validation call failed"),
        )?
        .into_inner();

    if !response.valid {
        tracing::warn!("invalid or expired jwt");
        return Err(Status::unauthenticated("invalid or expired jwt"));
    }

    let current_user = CurrentUser::from(response);
    if let RouteAuthPolicy::Roles(allowed_roles) = policy {
        if !allowed_roles.contains(&current_user.role) {
            tracing::warn!(
                required_roles = ?allowed_roles,
                user_role = ?current_user.role,
                "user role does not have permission to access this resource"
            );
            return Err(Status::permission_denied(
                "user role does not have permission to access this resource",
            ));
        }
    }

    Ok(Some((current_user, token)))
}

fn extract_bearer_token(headers: &HeaderMap) -> Result<String, Status> {
    let authorization = headers
        .get(header::AUTHORIZATION)
        .ok_or_else(|| Status::unauthenticated("missing authorization header"))?
        .to_str()
        .map_err(|_| Status::unauthenticated("invalid authorization header"))?;

    let token = authorization
        .strip_prefix("Bearer ")
        .or_else(|| authorization.strip_prefix("bearer "))
        .ok_or_else(|| Status::unauthenticated("authorization header must use bearer token"))?;

    if token.trim().is_empty() {
        return Err(Status::unauthenticated("authorization token is empty"));
    }

    Ok(token.to_string())
}
