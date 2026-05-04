use tonic::{Request, Response, Status};
use tokio_stream::Stream;
use std::pin::Pin;

type DownloadStream = Pin<Box<dyn Stream<Item = Result<FileChunk, Status>> + Send>>;

use std::collections::HashMap;

use crate::auth_context::CurrentUser;
use crate::proto::common::{Ack, UserRole};
use crate::proto::eval::{ListProjectEvaluationsRequest, ProjectEvaluation};

use crate::proto::gateway::{
    CreateProjectGatewayRequest, ListProjectTeamDetailsGatewayRequest,
    ListProjectTeamDetailsGatewayResponse, ListProjectsWithTeamsGatewayRequest,
    ListProjectsWithTeamsGatewayResponse, ListTeamsByProjectGatewayResponse, ProjectWithTeams,
};

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

async fn ensure_student_can_view_team(
    service: &FrontendGatewayService,
    ctx: &ForwardContext,
    current_user: &CurrentUser,
    team_id: &str,
) -> Result<TeamDetail, Status> {
    let detail = service
        .state
        .project_client()
        .get_team(ctx.clone().into_request(GetTeamRequest {
            team_id: team_id.to_string(),
        })?)
        .await?
        .into_inner();

    let belongs = detail.leader_student_id == current_user.user_id
        || detail
            .students
            .iter()
            .any(|user| user.id == current_user.user_id);

    if !belongs {
        return Err(Status::permission_denied(
            "students can only access their own team",
        ));
    }

    Ok(detail)
}

pub(super) async fn list_projects(
    service: &FrontendGatewayService,
    request: Request<ListProjectsRequest>,
) -> Result<Response<ListProjectsResponse>, Status> {
    let ctx = ForwardContext::from_request(&request);
    let body = request.into_inner();

    // Specific subject — single forwarded call.
    if !body.subject_id.trim().is_empty() {
        let response = service
            .state
            .project_client()
            .list_projects(ctx.into_request(body)?)
            .await?
            .into_inner();
        return Ok(Response::new(response));
    }

    // No subject filter — fan out per subject on the server so the browser doesn't have to.
    let subjects = service
        .state
        .subject_client()
        .list_subjects(ctx.clone().into_request(crate::proto::subject::ListSubjectsRequest {})?)
        .await?
        .into_inner()
        .subjects;

    let mut projects = Vec::new();
    for subject in subjects {
        match service
            .state
            .project_client()
            .list_projects(ctx.clone().into_request(ListProjectsRequest {
                subject_id: subject.id.clone(),
            })?)
            .await
        {
            Ok(response) => projects.extend(response.into_inner().projects),
            Err(status) => {
                tracing::warn!(
                    subject_id = %subject.id,
                    code = ?status.code(),
                    message = status.message(),
                    "list_projects fan-out: per-subject call failed; skipping"
                );
            }
        }
    }

    Ok(Response::new(ListProjectsResponse { projects }))
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

    // Enforce: a student can only create a team in a project whose subject they're
    // enrolled in. The frontend hides the button for non-enrolled students; this is the
    // belt-and-suspenders check so a determined caller can't bypass via grpcurl.
    if current_user.role == UserRole::Student {
        let project = service
            .state
            .project_client()
            .get_project(ctx.clone().into_request(GetProjectRequest {
                project_id: body.project_id.clone(),
            })?)
            .await?
            .into_inner();
        let subject = service
            .state
            .subject_client()
            .get_subject(ctx.clone().into_request(
                crate::proto::subject::GetSubjectRequest {
                    subject_id: project.subject_id.clone(),
                },
            )?)
            .await?
            .into_inner();
        if !subject.user_ids.iter().any(|id| id == &current_user.user_id) {
            return Err(Status::permission_denied(
                "register for the subject before creating a team in its project",
            ));
        }
    }

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
    let current_user = FrontendGatewayService::current_user(&request)?;
    let ctx = ForwardContext::from_request(&request);
    let body = request.into_inner();
    FrontendGatewayService::require_non_empty(&body.team_id, "team id")?;

    if current_user.role == UserRole::Student {
        let detail =
            ensure_student_can_view_team(service, &ctx, &current_user, &body.team_id).await?;
        return Ok(Response::new(detail));
    }

    let response = service
        .state
        .project_client()
        .get_team(ctx.into_request(body)?)
        .await?
        .into_inner();

    Ok(Response::new(response))
}

pub(super) async fn list_project_team_details(
    service: &FrontendGatewayService,
    request: Request<ListProjectTeamDetailsGatewayRequest>,
) -> Result<Response<ListProjectTeamDetailsGatewayResponse>, Status> {
    let current_user = FrontendGatewayService::current_user(&request)?;
    let ctx = ForwardContext::from_request(&request);
    let body = request.into_inner();
    FrontendGatewayService::require_non_empty(&body.project_id, "project id")?;

    let project_id = body.project_id.clone();
    let listing = service
        .state
        .project_client()
        .list_teams_by_project(ctx.clone().into_request(ListTeamsByProjectRequest {
            project_id: project_id.clone(),
        })?)
        .await?
        .into_inner();

    // Fetch all evaluations for the project in one shot from eval-service so we can merge them
    // into each TeamDetail directly. We do this in the router rather than relying on the
    // project-service's per-team eval pass-through (which sometimes returns empty), so the
    // teacher's submissions list always sees scores and feedback as soon as they exist.
    let evaluations_by_team: HashMap<String, ProjectEvaluation> = match service
        .state
        .eval_client()
        .list_project_evaluations(Request::new(ListProjectEvaluationsRequest {
            project_id: Some(project_id.clone()),
            student_id: None,
            evaluator_teacher_id: None,
        }))
        .await
    {
        Ok(response) => response
            .into_inner()
            .evaluations
            .into_iter()
            .map(|evaluation| (evaluation.team_id.clone(), evaluation))
            .collect(),
        Err(status) => {
            tracing::warn!(
                project_id = %project_id,
                code = ?status.code(),
                message = status.message(),
                "list_project_evaluations failed during list_project_team_details; \
                 evaluations will be missing from the response"
            );
            HashMap::new()
        }
    };

    let is_student = current_user.role == UserRole::Student;
    let mut teams = Vec::with_capacity(listing.teams.len());
    for team in listing.teams {
        match service
            .state
            .project_client()
            .get_team(ctx.clone().into_request(GetTeamRequest {
                team_id: team.team_id.clone(),
            })?)
            .await
        {
            Ok(response) => {
                let mut detail = response.into_inner();
                let belongs = is_student
                    && (detail.leader_student_id == current_user.user_id
                        || detail
                            .students
                            .iter()
                            .any(|user| user.id == current_user.user_id));
                if is_student && !belongs {
                    // Students still need to see other teams (to know who's on them and to
                    // request joining), but they must not see those teams' submission file or
                    // grade. Strip the private fields and keep the rest.
                    detail.submission = None;
                    detail.evaluation = None;
                } else if let Some(evaluation) = evaluations_by_team.get(&detail.team_id) {
                    detail.evaluation = Some(evaluation.clone());
                }
                teams.push(detail);
            }
            Err(status) => {
                tracing::warn!(
                    team_id = %team.team_id,
                    code = ?status.code(),
                    message = status.message(),
                    "get_team failed during list_project_team_details; skipping"
                );
            }
        }
    }

    Ok(Response::new(ListProjectTeamDetailsGatewayResponse { teams }))
}

pub(super) async fn list_projects_with_teams(
    service: &FrontendGatewayService,
    request: Request<ListProjectsWithTeamsGatewayRequest>,
) -> Result<Response<ListProjectsWithTeamsGatewayResponse>, Status> {
    let ctx = ForwardContext::from_request(&request);
    let body = request.into_inner();
    let subject_filter = body.subject_id.trim().to_string();

    // Collect target projects. With a subject filter we hit project-service once;
    // without, we fan out across every subject server-side.
    let mut all_projects: Vec<Project> = Vec::new();
    if !subject_filter.is_empty() {
        let response = service
            .state
            .project_client()
            .list_projects(ctx.clone().into_request(ListProjectsRequest {
                subject_id: subject_filter,
            })?)
            .await?
            .into_inner();
        all_projects.extend(response.projects);
    } else {
        let subjects = service
            .state
            .subject_client()
            .list_subjects(
                ctx.clone()
                    .into_request(crate::proto::subject::ListSubjectsRequest {})?,
            )
            .await?
            .into_inner()
            .subjects;
        for subject in subjects {
            match service
                .state
                .project_client()
                .list_projects(ctx.clone().into_request(ListProjectsRequest {
                    subject_id: subject.id.clone(),
                })?)
                .await
            {
                Ok(response) => all_projects.extend(response.into_inner().projects),
                Err(status) => {
                    tracing::warn!(
                        subject_id = %subject.id,
                        code = ?status.code(),
                        message = status.message(),
                        "list_projects_with_teams: per-subject project fetch failed; skipping"
                    );
                }
            }
        }
    }

    // For each project enrich teams with student_ids (matches list_teams_by_project's shape).
    let mut entries = Vec::with_capacity(all_projects.len());
    for project in all_projects {
        let project_id = project.project_id.clone();
        let teams = match service
            .state
            .project_client()
            .list_teams_by_project(ctx.clone().into_request(ListTeamsByProjectRequest {
                project_id: project_id.clone(),
            })?)
            .await
        {
            Ok(response) => {
                let listing = response.into_inner();
                let mut teams = Vec::with_capacity(listing.teams.len());
                for team in listing.teams {
                    match service
                        .state
                        .project_client()
                        .get_team(ctx.clone().into_request(GetTeamRequest {
                            team_id: team.team_id.clone(),
                        })?)
                        .await
                    {
                        Ok(detail_response) => {
                            teams.push(team_from_detail(detail_response.into_inner()));
                        }
                        Err(status) => {
                            tracing::warn!(
                                team_id = %team.team_id,
                                code = ?status.code(),
                                message = status.message(),
                                "list_projects_with_teams: get_team enrichment failed; \
                                 falling back to leader-only student_ids"
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
                teams
            }
            Err(status) => {
                tracing::warn!(
                    project_id = %project_id,
                    code = ?status.code(),
                    message = status.message(),
                    "list_projects_with_teams: list_teams_by_project failed; \
                     returning project with no teams"
                );
                Vec::new()
            }
        };

        entries.push(ProjectWithTeams {
            project: Some(project),
            teams,
        });
    }

    Ok(Response::new(ListProjectsWithTeamsGatewayResponse {
        projects: entries,
    }))
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
    let current_user = FrontendGatewayService::current_user(&request)?;
    let ctx = ForwardContext::from_request(&request);
    let body = request.into_inner();
    FrontendGatewayService::require_non_empty(&body.team_id, "team id")?;

    if current_user.role == UserRole::Student {
        ensure_student_can_view_team(service, &ctx, &current_user, &body.team_id).await?;
    }

    let response = service
        .state
        .project_client()
        .submit_project(ctx.into_request(body)?)
        .await?
        .into_inner();

    Ok(Response::new(response))
}

pub(super) async fn delete_submission(
    service: &FrontendGatewayService,
    request: Request<DeleteSubmissionRequest>,
) -> Result<Response<Ack>, Status> {
    let current_user = FrontendGatewayService::current_user(&request)?;
    let ctx = ForwardContext::from_request(&request);
    let body = request.into_inner();
    FrontendGatewayService::require_non_empty(&body.team_id, "team id")?;

    if current_user.role == UserRole::Student {
        ensure_student_can_view_team(service, &ctx, &current_user, &body.team_id).await?;
    }

    let response = service
        .state
        .project_client()
        .delete_submission(ctx.into_request(body)?)
        .await?
        .into_inner();

    Ok(Response::new(response))
}

pub(super) async fn download_submission(
    service: &FrontendGatewayService,
    request: Request<DownloadSubmissionRequest>,
) -> Result<Response<DownloadStream>, Status> {
    let current_user = FrontendGatewayService::current_user(&request)?;
    let ctx = ForwardContext::from_request(&request);
    let body = request.into_inner();
    FrontendGatewayService::require_non_empty(&body.team_id, "team id")?;

    if current_user.role == UserRole::Student {
        ensure_student_can_view_team(service, &ctx, &current_user, &body.team_id).await?;
    }

    let stream = service
        .state
        .project_client()
        .download_submission(ctx.into_request(body)?)
        .await?
        .into_inner();

    Ok(Response::new(Box::pin(stream)))
}