use crate::proto::{auth::ValidateTokenResponse, common::UserRole};

#[derive(Debug, Clone)]
pub struct CurrentUser {
    pub user_id: String,
    pub role: UserRole,
}

#[derive(Debug, Clone)]
pub struct AuthToken {
    pub access_token: String,
}

impl From<ValidateTokenResponse> for CurrentUser {
    fn from(value: ValidateTokenResponse) -> Self {
        Self {
            user_id: value.user_id,
            role: UserRole::try_from(value.role).unwrap_or(UserRole::Unspecified),
        }
    }
}
