use tonic::{Request, Response, Status};
use tokio_stream::Stream;
use std::pin::Pin;

type DownloadStream = Pin<Box<dyn Stream<Item = Result<FileChunk, Status>> + Send>>;

use crate::proto::common::Ack;

use crate::proto::gateway::{CreateProjectGatewayRequest, ListTeamsByProjectGatewayResponse};

use crate::proto::project::{
    AddTeamMemberRequest, ChangeTeamLeaderRequest, CreateJoinRequestRequest, CreateProjectRequest,
    DeleteJoinRequestRequest, DeleteProjectRequest, GetProjectRequest, GetTeamRequest, JoinRequest,
    LeaveTeamRequest, ListJoinRequestsRequest, ListJoinRequestsResponse, ListProjectsRequest,
    ListProjectsResponse, ListTeamsByProjectRequest, Project, RegisterTeamRequest,
    RemoveTeamMemberRequest, ResolveJoinRequestRequest, Team, TeamDetail, UpdateProjectRequest,
    DeleteSubmissionRequest, SubmitProjectRequest, ProjectSubmission, DownloadSubmissionRequest,
    FileChunk,
};

use crate::gateway::{ForwardContext, FrontendGatewayService};

pub(super) async fn list_projects(
    service: &FrontendGatewayService,
    request: Request<ListProjectsRequest>,
) -> Result<Response<ListProjectsResponse>, Status> {
    let response = service
        .state
        .project_client()
        .list_projects(request)
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
        .get_project(request)
        .await?
        .into_inner();

    Ok(Response::new(response))
}

pub(super) async fn create_project(
    service: &FrontendGatewayService,
    request: Request<CreateProjectGatewayRequest>,
) -> Result<Response<Project>, Status> {
    let current_user = FrontendGatewayService::current_user(&request)?;

    let ctx = ForwardContext::from_request(&request);
    let body = request.into_inner();
    FrontendGatewayService::require_non_empty(&body.title, "project title")?;
    FrontendGatewayService::require_non_empty(&body.description, "project description")?;
    FrontendGatewayService::require_non_empty(&body.subject_id, "subject id")?;

    let response = service
        .state
        .project_client()
        .create_project(ctx.into_request(CreateProjectRequest {
            title: body.title,
            description: body.description,
            teacher_id: current_user.user_id,
            max_students_per_team: body.max_students_per_team,
            start_date: body.start_date,
            end_date: body.end_date,
            subject_id: body.subject_id,
            submission_size_limit: body.submission_size_limit,
        })?)
        .await?
        .into_inner();

    Ok(Response::new(response))
}

pub(super) async fn update_project(
    service: &FrontendGatewayService,
    request: Request<UpdateProjectRequest>,
) -> Result<Response<Project>, Status> {
    let response = service
        .state
        .project_client()
        .update_project(request)
        .await?
        .into_inner();

    Ok(Response::new(response))
}

pub(super) async fn delete_project(
    service: &FrontendGatewayService,
    request: Request<DeleteProjectRequest>,
) -> Result<Response<Ack>, Status> {
    let response = service
        .state
        .project_client()
        .delete_project(request)
        .await?
        .into_inner();

    Ok(Response::new(response))
}

pub(super) async fn register_team(
    service: &FrontendGatewayService,
    request: Request<RegisterTeamRequest>,
) -> Result<Response<Team>, Status> {
    let current_user = FrontendGatewayService::current_user(&request)?;
    let ctx = ForwardContext::from_request(&request);
    let body = request.into_inner();
    FrontendGatewayService::require_non_empty(&body.project_id, "project id")?;
    FrontendGatewayService::require_non_empty(&body.team_name, "team name")?;

    let response = service
        .state
        .project_client()
        .register_team(ctx.into_request(RegisterTeamRequest {
            project_id: body.project_id,
            creator_student_id: current_user.user_id,
            team_name: body.team_name,
        })?)
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
        .get_team(request)
        .await?
        .into_inner();

    Ok(Response::new(response))
}

pub(super) async fn list_teams_by_project(
    service: &FrontendGatewayService,
    request: Request<ListTeamsByProjectRequest>,
) -> Result<Response<ListTeamsByProjectGatewayResponse>, Status> {
    let ctx = ForwardContext::from_request(&request);
    let listing = service
        .state
        .project_client()
        .list_teams_by_project(request)
        .await?
        .into_inner();

    let mut teams = Vec::with_capacity(listing.teams.len());
    for team in listing.teams {
        let team_id = team.team_id.clone();
        match service
            .state
            .project_client()
            .get_team(ctx.clone().into_request(GetTeamRequest {
                team_id: team_id.clone(),
            })?)
            .await
        {
            Ok(response) => teams.push(team_from_detail(response.into_inner())),
            Err(status) => {
                tracing::warn!(
                    team_id = %team_id,
                    code = ?status.code(),
                    message = status.message(),
                    "get_team enrichment failed; returning basic team data"
                );
                let leader = team.leader_student_id.clone();
                let student_ids = if leader.is_empty() {
                    Vec::new()
                } else {
                    vec![leader.clone()]
                };
                teams.push(Team {
                    team_id: team.team_id,
                    project_id: team.project_id,
                    name: team.name,
                    leader_student_id: leader,
                    student_ids,
                });
            }
        }
    }

    Ok(Response::new(ListTeamsByProjectGatewayResponse { teams }))
}

fn team_from_detail(detail: TeamDetail) -> Team {
    let mut student_ids: Vec<String> =
        detail.students.into_iter().map(|user| user.id).collect();
    if !detail.leader_student_id.is_empty() && !student_ids.contains(&detail.leader_student_id) {
        student_ids.push(detail.leader_student_id.clone());
    }
    Team {
        team_id: detail.team_id,
        project_id: detail.project_id,
        name: detail.name,
        leader_student_id: detail.leader_student_id,
        student_ids,
    }
}

pub(super) async fn leave_team(
    service: &FrontendGatewayService,
    request: Request<LeaveTeamRequest>,
) -> Result<Response<Ack>, Status> {
    let current_user = FrontendGatewayService::current_user(&request)?;
    let ctx = ForwardContext::from_request(&request);
    let body = request.into_inner();

    let response = service
        .state
        .project_client()
        .leave_team(ctx.into_request(LeaveTeamRequest {
            team_id: body.team_id,
            student_id: current_user.user_id,
        })?)
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
        .change_team_leader(request)
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
        .add_team_member(request)
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
        .remove_team_member(request)
        .await?
        .into_inner();

    Ok(Response::new(response))
}

pub(super) async fn create_join_request(
    service: &FrontendGatewayService,
    request: Request<CreateJoinRequestRequest>,
) -> Result<Response<JoinRequest>, Status> {
    let current_user = FrontendGatewayService::current_user(&request)?;
    let ctx = ForwardContext::from_request(&request);
    let body = request.into_inner();

    let response = service
        .state
        .project_client()
        .create_join_request(ctx.into_request(CreateJoinRequestRequest {
            team_id: body.team_id,
            requestor_student_id: current_user.user_id,
        })?)
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
        .delete_join_request(request)
        .await?
        .into_inner();

    Ok(Response::new(response))
}

pub(super) async fn resolve_join_request(
    service: &FrontendGatewayService,
    request: Request<ResolveJoinRequestRequest>,
) -> Result<Response<JoinRequest>, Status> {
    let current_user = FrontendGatewayService::current_user(&request)?;
    let ctx = ForwardContext::from_request(&request);
    let body = request.into_inner();

    let response = service
        .state
        .project_client()
        .resolve_join_request(ctx.into_request(ResolveJoinRequestRequest {
            join_request_id: body.join_request_id,
            accept: body.accept,
            resolver_student_id: current_user.user_id,
        })?)
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
        .list_join_requests(request)
        .await?
        .into_inner();

    Ok(Response::new(response))
}

pub(super) async fn submit_project(
    service: &FrontendGatewayService,
    request: Request<SubmitProjectRequest>,
) -> Result<Response<ProjectSubmission>, Status> {
    let response = service
        .state
        .project_client()
        .submit_project(request)
        .await?
        .into_inner();

    Ok(Response::new(response))
}

pub(super) async fn delete_submission(
    service: &FrontendGatewayService,
    request: Request<DeleteSubmissionRequest>,
) -> Result<Response<Ack>, Status> {
    let response = service
        .state
        .project_client()
        .delete_submission(request)
        .await?
        .into_inner();

    Ok(Response::new(response))
}

pub(super) async fn download_submission(
    service: &FrontendGatewayService,
    request: Request<DownloadSubmissionRequest>,
) -> Result<Response<DownloadStream>, Status> {
    let stream = service
        .state
        .project_client()
        .download_submission(request)
        .await?
        .into_inner();

    Ok(Response::new(Box::pin(stream)))
}