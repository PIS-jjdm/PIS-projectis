use super::*;
use crate::proto::subject::{
    GetSubjectRequest, ListSubjectsRequest, TeacherSubjectRequest, UserSubjectRequest,
};

pub(super) async fn list_subjects(
    service: &FrontendGatewayService,
    request: Request<Empty>,
) -> Result<Response<ListSubjectsResponse>, Status> {
    let ctx = ForwardContext::from_request(&request);
    let response = service
        .state
        .subject_client()
        .list_subjects(ctx.into_request(ListSubjectsRequest {})?)
        .await?
        .into_inner();

    Ok(Response::new(response))
}

pub(super) async fn get_subject(
    service: &FrontendGatewayService,
    request: Request<GetSubjectRequest>,
) -> Result<Response<Subject>, Status> {
    let ctx = ForwardContext::from_request(&request);
    let body = request.into_inner();
    FrontendGatewayService::require_non_empty(&body.subject_id, "subject id")?;

    let response = service
        .state
        .subject_client()
        .get_subject(ctx.into_request(body)?)
        .await?
        .into_inner();

    Ok(Response::new(response))
}

pub(super) async fn create_subject(
    service: &FrontendGatewayService,
    request: Request<CreateSubjectRequest>,
) -> Result<Response<Subject>, Status> {

    let response = service
        .state
        .subject_client()
        .create_subject(request)
        .await?
        .into_inner();

    Ok(Response::new(response))
}

pub(super) async fn update_subject(
    service: &FrontendGatewayService,
    request: Request<UpdateSubjectRequest>,
) -> Result<Response<Subject>, Status> {

    let response = service
        .state
        .subject_client()
        .update_subject(request)
        .await?
        .into_inner();

    Ok(Response::new(response))
}

pub(super) async fn delete_subject(
    service: &FrontendGatewayService,
    request: Request<DeleteSubjectRequest>,
) -> Result<Response<Ack>, Status> {

    let response = service
        .state
        .subject_client()
        .delete_subject(request)
        .await?
        .into_inner();

    Ok(Response::new(response))
}

pub(super) async fn add_student_to_subject(
    service: &FrontendGatewayService,
    request: Request<UserSubjectRequest>,
) -> Result<Response<Ack>, Status> {

    let ctx = ForwardContext::from_request(&request);
    let body = request.into_inner();
    FrontendGatewayService::require_non_empty(&body.subject_id, "subject id")?;
    FrontendGatewayService::require_non_empty(&body.user_id, "user id")?;
    let student = service
        .state
        .auth_client()
        .get_user(GetUserRequest {
            user_id: body.user_id.clone(),
        })
        .await?
        .into_inner();

    if UserRole::try_from(student.role).unwrap_or(UserRole::Unspecified) != UserRole::Student {
        return Err(Status::invalid_argument("user must have student role"));
    }

    let response = service
        .state
        .subject_client()
        .register_user_to_subject(ctx.into_request(body)?)
        .await?
        .into_inner();

    Ok(Response::new(response))
}

pub(super) async fn remove_student_from_subject(
    service: &FrontendGatewayService,
    request: Request<UserSubjectRequest>,
) -> Result<Response<Ack>, Status> {

    let ctx = ForwardContext::from_request(&request);
    let body = request.into_inner();
    FrontendGatewayService::require_non_empty(&body.subject_id, "subject id")?;
    FrontendGatewayService::require_non_empty(&body.user_id, "user id")?;

    let response = service
        .state
        .subject_client()
        .remove_user_from_subject(ctx.into_request(body)?)
        .await?
        .into_inner();

    Ok(Response::new(response))
}

pub(super) async fn assign_teacher_to_subject(
    service: &FrontendGatewayService,
    request: Request<TeacherSubjectRequest>,
) -> Result<Response<Subject>, Status> {

    let ctx = ForwardContext::from_request(&request);
    let body = request.into_inner();
    FrontendGatewayService::require_non_empty(&body.subject_id, "subject id")?;
    FrontendGatewayService::require_non_empty(&body.teacher_user_id, "teacher user id")?;

    let response = service
        .state
        .subject_client()
        .assign_teacher_to_subject(ctx.into_request(body)?)
        .await?
        .into_inner();

    Ok(Response::new(response))
}

pub(super) async fn remove_teacher_from_subject(
    service: &FrontendGatewayService,
    request: Request<TeacherSubjectRequest>,
) -> Result<Response<Subject>, Status> {

    let ctx = ForwardContext::from_request(&request);
    let body = request.into_inner();
    FrontendGatewayService::require_non_empty(&body.subject_id, "subject id")?;
    FrontendGatewayService::require_non_empty(&body.teacher_user_id, "teacher user id")?;

    let response = service
        .state
        .subject_client()
        .remove_teacher_from_subject(ctx.into_request(body)?)
        .await?
        .into_inner();

    Ok(Response::new(response))
}

pub(super) async fn register_subject(
    service: &FrontendGatewayService,
    request: Request<RegisterSubjectGatewayRequest>,
) -> Result<Response<Ack>, Status> {
    let current_user = FrontendGatewayService::current_user(&request)?;
    let ctx = ForwardContext::from_request(&request);
    let body = request.into_inner();
    FrontendGatewayService::require_non_empty(&body.subject_id, "subject id")?;

    let response = service
        .state
        .subject_client()
        .register_user_to_subject(ctx.into_request(UserSubjectRequest {
            subject_id: body.subject_id,
            user_id: current_user.user_id,
        })?)
        .await?
        .into_inner();

    Ok(Response::new(response))
}
