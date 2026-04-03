use axum::{
    extract::{Path, State},
    http::{header, StatusCode},
    response::{IntoResponse, Redirect, Response},
    routing::get,
    Router,
};

use crate::{proto::auth::GetUserAvatarRequest, AppState};

const DEFAULT_AVATAR_FILE_NAME: &str = "default.png";
const DEFAULT_AVATAR_PATH: &str = "/static/avatar/default.png";
const DEFAULT_AVATAR_PNG: &[u8] = include_bytes!("../default_avatar.png");

pub fn routes(state: AppState) -> Router {
    Router::new()
        .route("/static/avatar/{file_name}", get(get_avatar))
        .with_state(state)
}

async fn get_avatar(
    State(state): State<AppState>,
    Path(file_name): Path<String>,
) -> Result<Response, StatusCode> {
    if file_name == DEFAULT_AVATAR_FILE_NAME {
        return Ok(default_avatar_response());
    }

    let user_id = parse_avatar_file_name(&file_name)?;
    let image_data = match state
        .auth_client()
        .get_user_avatar(GetUserAvatarRequest { user_id })
        .await
    {
        Ok(response) => response.into_inner().image_png,
        Err(status) => {
            tracing::warn!(
                code = ?status.code(),
                message = status.message(),
                requested_avatar = file_name,
                "avatar lookup failed; redirecting to default avatar"
            );
            return Ok(Redirect::temporary(DEFAULT_AVATAR_PATH).into_response());
        }
    };

    let header = [
        (header::CONTENT_TYPE, "image/png"),
        (header::CACHE_CONTROL, "no-store"),
    ];

    Ok((header, image_data).into_response())
}

fn default_avatar_response() -> Response {
    let header = [
        (header::CONTENT_TYPE, "image/png"),
        (header::CACHE_CONTROL, "public, max-age=31536000, immutable"),
    ];

    (header, DEFAULT_AVATAR_PNG).into_response()
}

fn parse_avatar_file_name(file_name: &str) -> Result<String, StatusCode> {
    let Some(user_id) = file_name.strip_suffix(".png") else {
        return Err(StatusCode::NOT_FOUND);
    };

    let user_id = user_id.trim();
    if user_id.is_empty() || user_id == "default" {
        return Err(StatusCode::BAD_REQUEST);
    }

    Ok(user_id.to_owned())
}
