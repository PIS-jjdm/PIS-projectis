use super::*;
use crate::proto::project::{CreateProjectRequest, ListProjectsRequest, RegisterTeamRequest};

pub(super) async fn list_projects(
    service: &FrontendGatewayService,
    _request: Request<Empty>,
) -> Result<Response<ListProjectsResponse>, Status> {
    let response = service
        .state
        .project_client()
        .list_projects(ListProjectsRequest {})
        .await?
        .into_inner();

    Ok(Response::new(response))
}

pub(super) async fn get_project(
    service: &FrontendGatewayService,
    request: Request<GetProjectRequest>,
) -> Result<Response<Project>, Status> {
    let response = service
        .state
        .project_client()
        .get_project(request.into_inner())
        .await?
        .into_inner();

    Ok(Response::new(response))
}

pub(super) async fn create_project(
    service: &FrontendGatewayService,
    request: Request<CreateProjectGatewayRequest>,
) -> Result<Response<Project>, Status> {
    let current_user = FrontendGatewayService::current_user(&request)?;
    FrontendGatewayService::require_roles(&current_user, &[UserRole::Teacher, UserRole::Admin])?;

    let body = request.into_inner();
    FrontendGatewayService::require_non_empty(&body.title, "project title")?;
    FrontendGatewayService::require_non_empty(&body.description, "project description")?;
    FrontendGatewayService::require_non_empty(&body.subject_id, "subject id")?;

    let response = service
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

pub(super) async fn register_team(
    service: &FrontendGatewayService,
    request: Request<RegisterTeamGatewayRequest>,
) -> Result<Response<Team>, Status> {
    let current_user = FrontendGatewayService::current_user(&request)?;
    let body = request.into_inner();
    FrontendGatewayService::require_non_empty(&body.project_id, "project id")?;

    let response = service
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

pub(super) async fn list_teams_by_project(
    service: &FrontendGatewayService,
    request: Request<ListTeamsByProjectRequest>,
) -> Result<Response<ListTeamsByProjectResponse>, Status> {
    let response = service
        .state
        .project_client()
        .list_teams_by_project(request.into_inner())
        .await?
        .into_inner();

    Ok(Response::new(response))
}

pub(super) async fn add_team_member(
    service: &FrontendGatewayService,
    request: Request<AddTeamMemberRequest>,
) -> Result<Response<Team>, Status> {
    let response = service
        .state
        .project_client()
        .add_team_member(request.into_inner())
        .await?
        .into_inner();

    Ok(Response::new(response))
}

pub(super) async fn remove_team_member(
    service: &FrontendGatewayService,
    request: Request<RemoveTeamMemberRequest>,
) -> Result<Response<Team>, Status> {
    let response = service
        .state
        .project_client()
        .remove_team_member(request.into_inner())
        .await?
        .into_inner();

    Ok(Response::new(response))
}
