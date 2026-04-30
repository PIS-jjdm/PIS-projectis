use crate::{
    proto::{common, eval as grpc},
    AppState,
};
use tonic::{Request, Response, Status};

pub(super) async fn get_project_evaluation(
    state: &AppState,
    req: Request<grpc::GetProjectEvaluationRequest>,
) -> Result<Response<grpc::ProjectEvaluation>, Status> {
    let res = state
        .eval_client()
        .get_project_evaluation(req)
        .await?
        .into_inner();
    Ok(res.into())
}

pub(super) async fn list_project_evaluations(
    state: &AppState,
    req: Request<grpc::ListProjectEvaluationsRequest>,
) -> Result<Response<grpc::ListProjectEvaluationsResponse>, Status> {
    let res = state
        .eval_client()
        .list_project_evaluations(req)
        .await?
        .into_inner();
    Ok(res.into())
}

pub(super) async fn create_project_evaluation(
    state: &AppState,
    req: Request<grpc::CreateProjectEvaluationRequest>,
) -> Result<Response<grpc::ProjectEvaluation>, Status> {
    let res = state
        .eval_client()
        .create_project_evaluation(req)
        .await?
        .into_inner();
    Ok(res.into())
}

pub(super) async fn update_project_evaluation(
    state: &AppState,
    req: Request<grpc::UpdateProjectEvaluationRequest>,
) -> Result<Response<grpc::ProjectEvaluation>, Status> {
    let res = state
        .eval_client()
        .update_project_evaluation(req)
        .await?
        .into_inner();
    Ok(res.into())
}

pub(super) async fn delete_project_evaluation(
    state: &AppState,
    req: Request<grpc::DeleteEvaluationRequest>,
) -> Result<Response<common::Ack>, Status> {
    let res = state
        .eval_client()
        .delete_project_evaluation(req)
        .await?
        .into_inner();
    Ok(res.into())
}
