use crate::service::auth::User;
use crate::service::common::UserRole;
use serde::{Deserialize, Serialize};
use surrealdb::RecordId;
use tonic::Status;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserRecord {
    pub id: RecordId,
    pub firstname: String,
    pub lastname: String,
    pub email: String,
    pub password_hash: String,
    pub role: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NewUserRecord {
    pub firstname: String,
    pub lastname: String,
    pub email: String,
    pub password_hash: String,
    pub role: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RevokedTokenRecord {
    pub id: String,
    pub token: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserAvatarRecord {
    pub id: RecordId,
    pub image_png: Vec<u8>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NewUserAvatarRecord {
    pub image_png: Vec<u8>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Claims {
    pub sub: String,
    pub exp: usize,
    pub role: String,
}

#[derive(Clone)]
pub struct JwtKeys {
    pub secret: String,
}

pub fn normalize_user_id(user_id: &str) -> String {
    let trimmed = user_id.trim().trim_matches('`');
    trimmed
        .strip_prefix("user:")
        .unwrap_or(trimmed)
        .trim_matches('`')
        .to_string()
}

pub fn serialize_user_id(record_id: &RecordId) -> String {
    normalize_user_id(&record_id.to_string())
}

impl From<UserRecord> for User {
    fn from(user: UserRecord) -> Self {
        User {
            id: serialize_user_id(&user.id),
            firstname: user.firstname,
            lastname: user.lastname,
            email: user.email,
            role: role_to_proto(&user.role),
        }
    }
}

pub fn role_to_proto(role: &str) -> i32 {
    match role {
        "student" => UserRole::Student as i32,
        "teacher" => UserRole::Teacher as i32,
        "admin" => UserRole::Admin as i32,
        _ => UserRole::Unspecified as i32,
    }
}

pub fn role_from_proto(role: i32) -> Result<&'static str, Status> {
    match UserRole::try_from(role).map_err(|_| Status::invalid_argument("invalid role"))? {
        UserRole::Student => Ok("student"),
        UserRole::Teacher => Ok("teacher"),
        UserRole::Admin => Ok("admin"),
        UserRole::Unspecified => Err(Status::invalid_argument("role must be specified")),
    }
}
