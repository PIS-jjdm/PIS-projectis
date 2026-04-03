use crate::avatar::normalize_avatar;
use crate::db::Db;
use crate::models;
use crate::models::{Claims, JwtKeys, NewUserRecord};
use chrono::{Duration, Utc};
use jsonwebtoken::{decode, encode, Algorithm, DecodingKey, EncodingKey, Header, Validation};

use bcrypt::{hash, verify, DEFAULT_COST};
use tonic::transport::Channel;
use tonic::{Request, Response, Status};

pub mod auth {
    tonic::include_proto!("auth");
}

pub mod common {
    #![allow(unused)]
    tonic::include_proto!("common");
}

pub mod notification {
    tonic::include_proto!("notification");
}

use auth::auth_service_server::AuthService;
use auth::{
    AuthResponse, ChangePasswordRequest, CreateUserRequest, GetUserAvatarRequest,
    GetUserAvatarResponse, GetUserRequest, ListUsersRequest, ListUsersResponse, LoginRequest,
    LogoutRequest, RegisterRequest, SetUserAvatarRequest, UpdateUserRequest, User,
    ValidateTokenRequest, ValidateTokenResponse,
};
use common::{Ack, UserRole};
use notification::{
    notification_service_client::NotificationServiceClient, CreateNotificationRequest,
};

#[derive(Clone)]
pub struct AuthGrpc {
    db: Db,
    jwt_keys: JwtKeys,
    notification_grpc_client: Channel,
}

impl AuthGrpc {
    pub fn new(db: Db, jwt_keys: JwtKeys, notification_grpc_client: Channel) -> Self {
        Self {
            db,
            jwt_keys,
            notification_grpc_client,
        }
    }

    async fn create_user_record(
        &self,
        firstname: String,
        lastname: String,
        email: String,
        password: String,
        role: i32,
    ) -> Result<crate::models::UserRecord, Status> {
        if self
            .db
            .find_user_by_email(&email)
            .await
            .map_err(internal)?
            .is_some()
        {
            return Err(Status::already_exists("user already exists"));
        }

        let role = models::role_from_proto(role)?.to_owned();
        let user = NewUserRecord {
            firstname,
            lastname,
            email,
            password_hash: hash(password, DEFAULT_COST).map_err(internal)?,
            role,
        };

        self.db.insert_user(&user).await.map_err(internal)
    }

    fn notification_client(&self) -> NotificationServiceClient<Channel> {
        NotificationServiceClient::new(self.notification_grpc_client.clone())
    }

    async fn send_welcome_notification(
        &self,
        user: &crate::models::UserRecord,
    ) -> Result<(), Status> {
        self.notification_client()
            .create_notification(CreateNotificationRequest {
                user_ids: vec![models::serialize_user_id(&user.id)],
                message: welcome_message(user),
                trigger_at: None,
                creator_user_id: "system".into(),
            })
            .await
            .map_err(internal)?;

        Ok(())
    }

    async fn create_user_and_notify(
        &self,
        firstname: String,
        lastname: String,
        email: String,
        password: String,
        role: i32,
    ) -> Result<crate::models::UserRecord, Status> {
        let created = self
            .create_user_record(firstname, lastname, email, password, role)
            .await?;

        if let Err(status) = self.send_welcome_notification(&created).await {
            tracing::warn!(
                user_id = %created.id,
                email = created.email,
                code = ?status.code(),
                message = status.message(),
                "failed to create welcome notification for new user"
            );
        }

        Ok(created)
    }
}

fn internal<E: std::fmt::Display>(err: E) -> Status {
    Status::internal(err.to_string())
}

fn welcome_message(user: &crate::models::UserRecord) -> String {
    let display_name = match (user.firstname.trim(), user.lastname.trim()) {
        ("", "") => "there".to_string(),
        (first, "") => first.to_string(),
        ("", last) => last.to_string(),
        (first, last) => format!("{first} {last}"),
    };

    format!(
        "Welcome\nHello {display_name}, your account for the university project registration system is ready. Use the system to manage the subjects, projects, and notifications relevant to your role.\nIf your account was created with a default password, change it as soon as possible after signing in."
    )
}

#[tonic::async_trait]
impl AuthService for AuthGrpc {
    async fn register(
        &self,
        request: Request<RegisterRequest>,
    ) -> Result<Response<AuthResponse>, Status> {
        let req = request.into_inner();
        let created = self
            .create_user_and_notify(
                req.firstname,
                req.lastname,
                req.email,
                req.password,
                req.role,
            )
            .await?;
        let token =
            create_token(&created.id, &created.role, &self.jwt_keys.secret).map_err(internal)?;

        Ok(Response::new(AuthResponse {
            access_token: token,
            user: Some(created.into()),
        }))
    }

    async fn create_user(
        &self,
        request: Request<CreateUserRequest>,
    ) -> Result<Response<User>, Status> {
        let req = request.into_inner();
        let created = self
            .create_user_and_notify(
                req.firstname,
                req.lastname,
                req.email,
                req.password,
                req.role,
            )
            .await?;

        Ok(Response::new(created.into()))
    }

    async fn update_user(
        &self,
        request: Request<UpdateUserRequest>,
    ) -> Result<Response<User>, Status> {
        let req = request.into_inner();
        if req.user_id.trim().is_empty() {
            return Err(Status::invalid_argument("user id is required"));
        }

        let firstname = req.firstname.trim();
        let lastname = req.lastname.trim();
        let email = req.email.trim();
        if firstname.is_empty() {
            return Err(Status::invalid_argument("first name is required"));
        }
        if lastname.is_empty() {
            return Err(Status::invalid_argument("last name is required"));
        }
        if email.is_empty() {
            return Err(Status::invalid_argument("email is required"));
        }

        let role = models::role_from_proto(req.role)?.to_owned();
        let existing = self
            .db
            .find_user_by_id(&req.user_id)
            .await
            .map_err(internal)?
            .ok_or_else(|| Status::not_found("user not found"))?;

        if existing.role == "admin"
            && role != "admin"
            && !self
                .db
                .has_other_admin(&req.user_id)
                .await
                .map_err(internal)?
        {
            return Err(Status::failed_precondition(
                "cannot remove the last remaining admin",
            ));
        }

        if self
            .db
            .email_belongs_to_other_user(&req.user_id, email)
            .await
            .map_err(internal)?
        {
            return Err(Status::already_exists("user already exists"));
        }

        let updated = self
            .db
            .update_user(&req.user_id, firstname, lastname, email, &role)
            .await
            .map_err(internal)?
            .ok_or_else(|| Status::not_found("user not found"))?;

        Ok(Response::new(updated.into()))
    }

    async fn get_user_avatar(
        &self,
        request: Request<GetUserAvatarRequest>,
    ) -> Result<Response<GetUserAvatarResponse>, Status> {
        let user_id = request.into_inner().user_id;
        if user_id.trim().is_empty() {
            return Err(Status::invalid_argument("user id is required"));
        }

        let image_png = self
            .db
            .get_user_avatar(&user_id)
            .await
            .map_err(internal)?
            .map(|record| record.image_png)
            .ok_or_else(|| Status::not_found("avatar not found"))?;

        Ok(Response::new(GetUserAvatarResponse { image_png }))
    }

    async fn set_user_avatar(
        &self,
        request: Request<SetUserAvatarRequest>,
    ) -> Result<Response<Ack>, Status> {
        let req = request.into_inner();
        if req.user_id.trim().is_empty() {
            return Err(Status::invalid_argument("user id is required"));
        }

        self.db
            .find_user_by_id(&req.user_id)
            .await
            .map_err(internal)?
            .ok_or_else(|| Status::not_found("user not found"))?;

        if req.image_data.is_empty() {
            self.db
                .delete_user_avatar(&req.user_id)
                .await
                .map_err(internal)?;

            return Ok(Response::new(Ack {
                success: true,
                message: "avatar reset to default".into(),
            }));
        }

        let image_png = normalize_avatar(&req.image_data)?;
        self.db
            .set_user_avatar(&req.user_id, image_png)
            .await
            .map_err(internal)?;

        Ok(Response::new(Ack {
            success: true,
            message: "avatar updated".into(),
        }))
    }

    async fn login(
        &self,
        request: Request<LoginRequest>,
    ) -> Result<Response<AuthResponse>, Status> {
        let req = request.into_inner();
        let user = self
            .db
            .find_user_by_email(&req.email)
            .await
            .map_err(internal)?
            .ok_or_else(|| Status::unauthenticated("invalid credentials"))?;

        if !verify(req.password, &user.password_hash).map_err(internal)? {
            return Err(Status::unauthenticated("invalid credentials"));
        }

        let token = create_token(&user.id, &user.role, &self.jwt_keys.secret).map_err(internal)?;

        Ok(Response::new(AuthResponse {
            access_token: token,
            user: Some(user.into()),
        }))
    }

    async fn validate_token(
        &self,
        request: Request<ValidateTokenRequest>,
    ) -> Result<Response<ValidateTokenResponse>, Status> {
        let req = request.into_inner();
        if self
            .db
            .is_token_revoked(&req.access_token)
            .await
            .map_err(internal)?
        {
            return Ok(Response::new(ValidateTokenResponse {
                valid: false,
                user_id: String::new(),
                email: String::new(),
                role: UserRole::Unspecified as i32,
            }));
        }

        match decode_token(&req.access_token, &self.jwt_keys.secret) {
            Ok(claims) => {
                // double check
                let user = self
                    .db
                    .find_user_by_id(&claims.sub)
                    .await
                    .map_err(internal)?
                    .ok_or_else(|| Status::unauthenticated("invalid token: user does not exist"))?;

                Ok(Response::new(ValidateTokenResponse {
                    valid: true,
                    user_id: models::serialize_user_id(&user.id),
                    email: user.email,
                    role: models::role_to_proto(&user.role),
                }))
            }
            Err(_) => Ok(Response::new(ValidateTokenResponse {
                valid: false,
                user_id: String::new(),
                email: String::new(),
                role: UserRole::Unspecified as i32,
            })),
        }
    }

    async fn get_user(&self, request: Request<GetUserRequest>) -> Result<Response<User>, Status> {
        let req = request.into_inner();
        let user = self
            .db
            .find_user_by_id(&req.user_id)
            .await
            .map_err(internal)?
            .ok_or_else(|| Status::not_found("user not found"))?;

        Ok(Response::new(user.into()))
    }

    async fn list_users(
        &self,
        _request: Request<ListUsersRequest>,
    ) -> Result<Response<ListUsersResponse>, Status> {
        let users = self.db.list_users().await.map_err(internal)?;

        Ok(Response::new(ListUsersResponse {
            users: users.into_iter().map(User::from).collect(),
        }))
    }

    async fn change_password(
        &self,
        request: Request<ChangePasswordRequest>,
    ) -> Result<Response<Ack>, Status> {
        let req = request.into_inner();
        if req.user_id.trim().is_empty() {
            return Err(Status::invalid_argument("user id is required"));
        }
        if req.current_password.is_empty() {
            return Err(Status::invalid_argument("current password is required"));
        }
        if req.new_password.is_empty() {
            return Err(Status::invalid_argument("new password is required"));
        }
        if req.current_password == req.new_password {
            return Err(Status::invalid_argument(
                "new password must be different from current password",
            ));
        }

        let user = self
            .db
            .find_user_by_id(&req.user_id)
            .await
            .map_err(internal)?
            .ok_or_else(|| Status::not_found("user not found"))?;

        if !verify(req.current_password, &user.password_hash).map_err(internal)? {
            return Err(Status::permission_denied("current password is incorrect"));
        }

        let password_hash = hash(req.new_password, DEFAULT_COST).map_err(internal)?;
        self.db
            .update_user_password(&req.user_id, &password_hash)
            .await
            .map_err(internal)?
            .ok_or_else(|| Status::not_found("user not found"))?;

        Ok(Response::new(Ack {
            success: true,
            message: "password updated".into(),
        }))
    }

    async fn logout(&self, request: Request<LogoutRequest>) -> Result<Response<Ack>, Status> {
        let _ = self
            .db
            .revoke_token(&request.into_inner().access_token)
            .await
            .map_err(internal)?;

        Ok(Response::new(Ack {
            success: true,
            message: "token revoked".into(),
        }))
    }
}

// ====== Helper functions ======

fn create_token(
    record_id: &surrealdb::RecordId,
    role: &str,
    jwt_secret: &str,
) -> Result<String, jsonwebtoken::errors::Error> {
    let claims = Claims {
        sub: models::serialize_user_id(record_id),
        role: role.to_string(),
        exp: (Utc::now() + Duration::hours(12)).timestamp() as usize,
    };

    let mut header = Header::new(Algorithm::HS256);
    header.typ = Some("JWT".into());

    encode(
        &header,
        &claims,
        &EncodingKey::from_secret(jwt_secret.as_bytes()),
    )
}

fn decode_token(token: &str, jwt_secret: &str) -> Result<Claims, jsonwebtoken::errors::Error> {
    let decoded = decode::<Claims>(
        token,
        &DecodingKey::from_secret(jwt_secret.as_bytes()),
        &Validation::new(Algorithm::HS256),
    )?;
    Ok(decoded.claims)
}
