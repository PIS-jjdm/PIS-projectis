use tonic::{Request, Response, Status};
use tokio_stream::Stream;
use std::pin::Pin;

type DownloadStream = Pin<Box<dyn Stream<Item = Result<FileChunk, Status>> + Send>>;

use crate::proto::common::{Ack, UserRole};

use crate::proto::gateway::{CreateProjectGatewayRequest};

use crate::proto::project::{
    AddTeamMemberRequest, ChangeTeamLeaderRequest, CreateJoinRequestRequest, CreateProjectRequest,
    DeleteJoinRequestRequest, DeleteProjectRequest, GetProjectRequest, GetTeamRequest, JoinRequest,
    LeaveTeamRequest, ListJoinRequestsRequest, ListJoinRequestsResponse, ListProjectsRequest,
    ListProjectsResponse, ListTeamsByProjectRequest, ListTeamsByProjectResponse, Project,
    RegisterTeamRequest, RemoveTeamMemberRequest, ResolveJoinRequestRequest, Team, TeamDetail,
    UpdateProjectRequest, DeleteSubmissionRequest, SubmitProjectRequest, ProjectSubmission,
    DownloadSubmissionRequest, FileChunk
};

use crate::gateway::FrontendGatewayService;

pub(super) async fn list_projects(
    service: &FrontendGatewayService,
    request: Request<ListProjectsRequest>,
) -> Result<Response<ListProjectsResponse>, Status> {
    let response = service
        .state
        .project_client()
        .list_projects(request.into_inner())
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
            submission_size_limit: body.submission_size_limit,
        })
        .await?
        .into_inner();

    Ok(Response::new(response))
}

pub(super) async fn update_project(
    service: &FrontendGatewayService,
    request: Request<UpdateProjectRequest>,
) -> Result<Response<Project>, Status> {
    let current_user = FrontendGatewayService::current_user(&request)?;
    FrontendGatewayService::require_roles(&current_user, &[UserRole::Teacher, UserRole::Admin])?;

    let response = service
        .state
        .project_client()
        .update_project(request.into_inner())
        .await?
        .into_inner();

    Ok(Response::new(response))
}

pub(super) async fn delete_project(
    service: &FrontendGatewayService,
    request: Request<DeleteProjectRequest>,
) -> Result<Response<Ack>, Status> {
    let current_user = FrontendGatewayService::current_user(&request)?;
    FrontendGatewayService::require_roles(&current_user, &[UserRole::Teacher, UserRole::Admin])?;

    let response = service
        .state
        .project_client()
        .delete_project(request.into_inner())
        .await?
        .into_inner();

    Ok(Response::new(response))
}

pub(super) async fn register_team(
    service: &FrontendGatewayService,
    request: Request<RegisterTeamRequest>,
) -> Result<Response<Team>, Status> {
    let current_user = FrontendGatewayService::current_user(&request)?;
    let body = request.into_inner();
    FrontendGatewayService::require_non_empty(&body.project_id, "project id")?;
    FrontendGatewayService::require_non_empty(&body.team_name, "team name")?;

    let response = service
        .state
        .project_client()
        .register_team(RegisterTeamRequest {
            project_id: body.project_id,
            creator_student_id: current_user.user_id,
            team_name: body.team_name,
        })
        .await?
        .into_inner();

    Ok(Response::new(response))
}

pub(super) async fn get_team(
    service: &FrontendGatewayService,
    request: Request<GetTeamRequest>,
) -> Result<Response<TeamDetail>, Status> {
    let response = service
        .state
        .project_client()
        .get_team(request.into_inner())
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

pub(super) async fn leave_team(
    service: &FrontendGatewayService,
    request: Request<LeaveTeamRequest>,
) -> Result<Response<Ack>, Status> {
    let current_user = FrontendGatewayService::current_user(&request)?;
    let body = request.into_inner();

    let response = service
        .state
        .project_client()
        .leave_team(LeaveTeamRequest {
            team_id: body.team_id,
            student_id: current_user.user_id,
        })
        .await?
        .into_inner();

    Ok(Response::new(response))
}

pub(super) async fn change_team_leader(
    service: &FrontendGatewayService,
    request: Request<ChangeTeamLeaderRequest>,
) -> Result<Response<Team>, Status> {
    let response = service
        .state
        .project_client()
        .change_team_leader(request.into_inner())
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

pub(super) async fn create_join_request(
    service: &FrontendGatewayService,
    request: Request<CreateJoinRequestRequest>,
) -> Result<Response<JoinRequest>, Status> {
    let current_user = FrontendGatewayService::current_user(&request)?;
    let body = request.into_inner();

    let response = service
        .state
        .project_client()
        .create_join_request(CreateJoinRequestRequest {
            team_id: body.team_id,
            requestor_student_id: current_user.user_id,
        })
        .await?
        .into_inner();

    Ok(Response::new(response))
}

pub(super) async fn delete_join_request(
    service: &FrontendGatewayService,
    request: Request<DeleteJoinRequestRequest>,
) -> Result<Response<Ack>, Status> {
    let response = service
        .state
        .project_client()
        .delete_join_request(request.into_inner())
        .await?
        .into_inner();

    Ok(Response::new(response))
}

pub(super) async fn resolve_join_request(
    service: &FrontendGatewayService,
    request: Request<ResolveJoinRequestRequest>,
) -> Result<Response<JoinRequest>, Status> {
    let current_user = FrontendGatewayService::current_user(&request)?;
    let body = request.into_inner();

    let response = service
        .state
        .project_client()
        .resolve_join_request(ResolveJoinRequestRequest {
            join_request_id: body.join_request_id,
            accept: body.accept,
            resolver_student_id: current_user.user_id,
        })
        .await?
        .into_inner();

    Ok(Response::new(response))
}

pub(super) async fn list_join_requests(
    service: &FrontendGatewayService,
    request: Request<ListJoinRequestsRequest>,
) -> Result<Response<ListJoinRequestsResponse>, Status> {
    let response = service
        .state
        .project_client()
        .list_join_requests(request.into_inner())
        .await?
        .into_inner();

    Ok(Response::new(response))
}

pub(super) async fn submit_project(
    service: &FrontendGatewayService,
    request: Request<SubmitProjectRequest>,
) -> Result<Response<ProjectSubmission>, Status> {
    let current_user = FrontendGatewayService::current_user(&request)?;
    FrontendGatewayService::require_roles(&current_user, &[UserRole::Student, UserRole::Admin])?;

    let response = service
        .state
        .project_client()
        .submit_project(request.into_inner())
        .await?
        .into_inner();

    Ok(Response::new(response))
}

pub(super) async fn delete_submission(
    service: &FrontendGatewayService,
    request: Request<DeleteSubmissionRequest>,
) -> Result<Response<Ack>, Status> {
    let current_user = FrontendGatewayService::current_user(&request)?;
    FrontendGatewayService::require_roles(&current_user, &[UserRole::Student, UserRole::Teacher, UserRole::Admin])?;

    let response = service
        .state
        .project_client()
        .delete_submission(request.into_inner())
        .await?
        .into_inner();

    Ok(Response::new(response))
}

pub(super) async fn download_submission(
    service: &FrontendGatewayService,
    request: Request<DownloadSubmissionRequest>,
) -> Result<Response<DownloadStream>, Status> {
    let current_user = FrontendGatewayService::current_user(&request)?;
    FrontendGatewayService::require_roles(&current_user, &[UserRole::Student, UserRole::Teacher, UserRole::Admin])?;

    let stream = service
        .state
        .project_client()
        .download_submission(request.into_inner())
        .await?
        .into_inner();

    Ok(Response::new(Box::pin(stream)))
}