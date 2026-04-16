use super::*;
use crate::proto::subject::{ListSubjectsRequest, TeacherSubjectRequest, UserSubjectRequest};

pub(super) async fn list_subjects(
    service: &FrontendGatewayService,
    _request: Request<Empty>,
) -> Result<Response<ListSubjectsResponse>, Status> {
    let response = service
        .state
        .subject_client()
        .list_subjects(ListSubjectsRequest {})
        .await?
        .into_inner();

    Ok(Response::new(response))
}

pub(super) async fn create_subject(
    service: &FrontendGatewayService,
    request: Request<CreateSubjectRequest>,
) -> Result<Response<Subject>, Status> {
    let current_user = FrontendGatewayService::current_user(&request)?;
    FrontendGatewayService::require_roles(&current_user, &[UserRole::Admin])?;

    let response = service
        .state
        .subject_client()
        .create_subject(request.into_inner())
        .await?
        .into_inner();

    Ok(Response::new(response))
}

pub(super) async fn update_subject(
    service: &FrontendGatewayService,
    request: Request<UpdateSubjectRequest>,
) -> Result<Response<Subject>, Status> {
    let current_user = FrontendGatewayService::current_user(&request)?;
    FrontendGatewayService::require_roles(&current_user, &[UserRole::Admin])?;

    let response = service
        .state
        .subject_client()
        .update_subject(request.into_inner())
        .await?
        .into_inner();

    Ok(Response::new(response))
}

pub(super) async fn delete_subject(
    service: &FrontendGatewayService,
    request: Request<DeleteSubjectRequest>,
) -> Result<Response<Ack>, Status> {
    let current_user = FrontendGatewayService::current_user(&request)?;
    FrontendGatewayService::require_roles(&current_user, &[UserRole::Admin])?;

    let response = service
        .state
        .subject_client()
        .delete_subject(request.into_inner())
        .await?
        .into_inner();

    Ok(Response::new(response))
}

pub(super) async fn assign_teacher_to_subject(
    service: &FrontendGatewayService,
    request: Request<TeacherSubjectRequest>,
) -> Result<Response<Subject>, Status> {
    let current_user = FrontendGatewayService::current_user(&request)?;
    FrontendGatewayService::require_roles(&current_user, &[UserRole::Admin])?;

    let body = request.into_inner();
    FrontendGatewayService::require_non_empty(&body.subject_id, "subject id")?;
    FrontendGatewayService::require_non_empty(&body.teacher_user_id, "teacher user id")?;

    let response = service
        .state
        .subject_client()
        .assign_teacher_to_subject(body)
        .await?
        .into_inner();

    Ok(Response::new(response))
}

pub(super) async fn remove_teacher_from_subject(
    service: &FrontendGatewayService,
    request: Request<TeacherSubjectRequest>,
) -> Result<Response<Subject>, Status> {
    let current_user = FrontendGatewayService::current_user(&request)?;
    FrontendGatewayService::require_roles(&current_user, &[UserRole::Admin])?;

    let body = request.into_inner();
    FrontendGatewayService::require_non_empty(&body.subject_id, "subject id")?;
    FrontendGatewayService::require_non_empty(&body.teacher_user_id, "teacher user id")?;

    let response = service
        .state
        .subject_client()
        .remove_teacher_from_subject(body)
        .await?
        .into_inner();

    Ok(Response::new(response))
}

pub(super) async fn register_subject(
    service: &FrontendGatewayService,
    request: Request<RegisterSubjectGatewayRequest>,
) -> Result<Response<Ack>, Status> {
    let current_user = FrontendGatewayService::current_user(&request)?;
    FrontendGatewayService::require_roles(&current_user, &[UserRole::Student])?;

    let body = request.into_inner();
    FrontendGatewayService::require_non_empty(&body.subject_id, "subject id")?;

    let response = service
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
