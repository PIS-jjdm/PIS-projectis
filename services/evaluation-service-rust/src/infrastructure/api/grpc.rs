mod common {
    tonic::include_proto!("common");
}

mod auth {
    tonic::include_proto!("auth");
}

mod eval {
    tonic::include_proto!("eval");
}

use crate::{
    adapter::{self, Db, presenter::web},
    domain,
    infrastructure::api::grpc::{
        self,
        eval::{
            CreateProjectEvaluationRequest, DeleteEvaluationRequest, GetProjectEvaluationRequest,
            ListProjectEvaluationsRequest, ListProjectEvaluationsResponse,
            UpdateProjectEvaluationRequest,
        },
    },
};
use eval::{
    ProjectEvaluation,
    evaluation_service_server::{EvaluationService, EvaluationServiceServer},
};
use std::{net::SocketAddr, sync::Arc};
use tonic::{Code, Request, Response, Status, transport::Server};
use tracing::info;

pub async fn run(db: Arc<impl Db>, addr: SocketAddr) -> Result<(), anyhow::Error> {
    info!(addr = %addr, "Starting GRPC server");

    let evaluation_service = GrpcEvaluationService::new(db);

    Server::builder()
        .add_service(EvaluationServiceServer::new(evaluation_service))
        .serve(addr)
        .await?;

    Ok(())
}

#[derive(Debug)]
pub struct GrpcEvaluationService<D> {
    app_api: adapter::Api<D, web::Presenter>,
}

impl<D: Db> GrpcEvaluationService<D> {
    pub fn new(db: Arc<D>) -> Self {
        Self {
            app_api: adapter::Api::new(db.clone(), web::Presenter),
        }
    }
}

#[tonic::async_trait]
impl<D: Db> EvaluationService for GrpcEvaluationService<D> {
    async fn get_project_evaluation(
        &self,
        req: Request<GetProjectEvaluationRequest>,
    ) -> Result<Response<ProjectEvaluation>, Status> {
        let inner = req.into_inner();
        let res = self
            .app_api
            .get_evaluation_by_proj_team_id(&inner.project_id, &inner.team_id)
            .await
            .map(|res| Response::new(res.into()))?;
        Ok(res)
    }

    async fn list_project_evaluations(
        &self,
        req: Request<ListProjectEvaluationsRequest>,
    ) -> Result<Response<ListProjectEvaluationsResponse>, Status> {
        let res = self.app_api.getall_project_evaluations().await.map(|r| {
            Response::new(ListProjectEvaluationsResponse {
                evaluations: r.into_iter().map(grpc::ProjectEvaluation::from).collect(),
            })
        })?;

        Ok(res)
    }

    async fn create_project_evaluation(
        &self,
        req: Request<CreateProjectEvaluationRequest>,
    ) -> Result<Response<ProjectEvaluation>, Status> {
        let jwt = req
            .metadata()
            .get("authorization")
            .ok_or(Status::new(
                Code::Unauthenticated,
                "Authorization header is not present",
            ))?
            .to_str()
            .map_err(|_| {
                Status::new(Code::Unauthenticated, "Authorization header parsing failed")
            })?;
        let user_id = get_user_id(jwt)
            .map_err(|e| Status::new(Code::Unauthenticated, format!("Invalid JWT: {e}")))?;
        let req = req.into_inner();

        let created_eval = self
            .app_api
            .create_project_evaluation(
                &req.project_id,
                &req.team_id,
                &user_id,
                req.total_score,
                &req.feedback,
            )
            .await?;

        Ok(Response::new(grpc::ProjectEvaluation::from(created_eval)))
    }

    async fn update_project_evaluation(
        &self,
        req: Request<UpdateProjectEvaluationRequest>,
    ) -> Result<Response<ProjectEvaluation>, Status> {
        let req = req.into_inner();
        let updated_eval = self
            .app_api
            .update_project_evaluation(&req.evaluation_id, req.total_score, &req.feedback)
            .await?;

        Ok(Response::new(grpc::ProjectEvaluation::from(updated_eval)))
    }

    async fn delete_project_evaluation(
        &self,
        req: Request<DeleteEvaluationRequest>,
    ) -> Result<Response<common::Ack>, Status> {
        let req = req.into_inner();
        let deleted_eval = self
            .app_api
            .delete_project_evaluation(&req.evaluation_id)
            .await?;

        Ok(Response::new(common::Ack {
            success: true,
            message: format!("Deleted: {:#?}", deleted_eval),
        }))
    }
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
struct Claims {
    pub sub: String,
    pub exp: usize,
    pub role: String,
}

fn get_user_id(jwt: &str) -> Result<String, anyhow::Error> {
    let data = jsonwebtoken::dangerous::insecure_decode::<Claims>(jwt)?;
    Ok(data.claims.sub)
}

impl From<adapter::models::Error> for Status {
    fn from(value: adapter::models::Error) -> Self {
        match value {
            adapter::models::Error::InvalidArgument(error) => {
                Status::new(Code::InvalidArgument, error.to_string())
            }
            adapter::models::Error::NotFound(error) => {
                Status::new(Code::NotFound, error.to_string())
            }
            adapter::models::Error::Internal(error) => {
                Status::new(Code::Internal, error.to_string())
            }
        }
    }
}

struct Timestamp(domain::UtcTimestamp);

impl From<domain::ProjectEvaluation> for grpc::ProjectEvaluation {
    fn from(value: domain::ProjectEvaluation) -> Self {
        grpc::ProjectEvaluation {
            id: value.id,
            project_id: value.project_id,
            team_id: value.team_id,
            evaluator_teacher_id: value.evaluator_teacher_id,
            total_score: value.total_score,
            feedback: value.feedback,
            timestamp: Some(Timestamp(value.created_at_utc).into()),
        }
    }
}

impl From<Timestamp> for prost_types::Timestamp {
    fn from(value: Timestamp) -> Self {
        Self {
            seconds: value.0.timestamp(),
            nanos: value.0.timestamp_subsec_nanos() as i32,
        }
    }
}
