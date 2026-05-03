use super::grpc_models::eval::{
    self as grpc,
    evaluation_service_server::{EvaluationService, EvaluationServiceServer},
};
use crate::infrastructure::api::{SERVICE_NAME, grpc_models::common, observe, shutdown_signal};
use crate::{
    adapter::{self, Db, presenter::web},
    domain,
    infrastructure::gateway::GrpcGatewayCollection,
};
use std::{net::SocketAddr, sync::Arc};
use tonic::{Code, Request, Response, Status, transport::Server};
use tracing::{info, instrument};

pub async fn run<D: Db>(
    db: Arc<D>,
    gateways: Arc<GrpcGatewayCollection>,
    addr: SocketAddr,
) -> Result<(), anyhow::Error> {
    info!(addr = %addr, "Starting GRPC server");
    let evaluation_service = GrpcEvaluationService::new(db, gateways);

    let (health_reporter, health_service) = tonic_health::server::health_reporter();
    health_reporter
        .set_serving::<EvaluationServiceServer<GrpcEvaluationService<D>>>()
        .await;

    Server::builder()
        .add_service(health_service)
        .add_service(EvaluationServiceServer::new(evaluation_service))
        .serve_with_shutdown(addr, shutdown_signal())
        .await?;

    Ok(())
}

pub struct GrpcEvaluationService<D> {
    app_api: adapter::Api<D, web::Presenter, GrpcGatewayCollection>,
    metrics: observe::Metrics,
}

impl<D: Db> GrpcEvaluationService<D> {
    pub fn new(db: Arc<D>, gateways: Arc<GrpcGatewayCollection>) -> Self {
        Self {
            app_api: adapter::Api::new(db.clone(), web::Presenter, gateways),
            metrics: observe::Metrics::new(SERVICE_NAME),
        }
    }
}

macro_rules! with_metrics {
    ($metrics:expr, $method:expr, $body:block) => {
        $metrics
            .record_grpc_call($method, async move || $body)
            .await
    };
}

#[tonic::async_trait]
impl<D: Db> EvaluationService for GrpcEvaluationService<D> {
    #[instrument(skip_all)]
    async fn get_project_evaluation(
        &self,
        req: Request<grpc::GetProjectEvaluationRequest>,
    ) -> Result<Response<grpc::ProjectEvaluation>, Status> {
        with_metrics!(self.metrics, "get_project_evaluation", {
            let inner = req.into_inner();
            let res = self
                .app_api
                .get_evaluation_by_proj_team_id(&inner.project_id, &inner.team_id)
                .await
                .map(|res| Response::new(res.into()))?;

            Ok(res)
        })
    }

    #[instrument(skip_all)]
    async fn list_project_evaluations(
        &self,
        _req: Request<grpc::ListProjectEvaluationsRequest>,
    ) -> Result<Response<grpc::ListProjectEvaluationsResponse>, Status> {
        with_metrics!(self.metrics, "list_project_evaluations", {
            let res = self.app_api.getall_project_evaluations().await.map(|r| {
                Response::new(grpc::ListProjectEvaluationsResponse {
                    evaluations: r.into_iter().map(grpc::ProjectEvaluation::from).collect(),
                })
            })?;

            Ok(res)
        })
    }

    #[instrument(skip_all)]
    async fn create_project_evaluation(
        &self,
        req: Request<grpc::CreateProjectEvaluationRequest>,
    ) -> Result<Response<grpc::ProjectEvaluation>, Status> {
        with_metrics!(self.metrics, "create_project_evaluation", {
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
        })
    }

    #[instrument(skip_all)]
    async fn update_project_evaluation(
        &self,
        req: Request<grpc::UpdateProjectEvaluationRequest>,
    ) -> Result<Response<grpc::ProjectEvaluation>, Status> {
        with_metrics!(self.metrics, "update_project_evaluation", {
            let req = req.into_inner();
            let updated_eval = self
                .app_api
                .update_project_evaluation(&req.evaluation_id, req.total_score, &req.feedback)
                .await?;

            Ok(Response::new(grpc::ProjectEvaluation::from(updated_eval)))
        })
    }

    #[instrument(skip_all)]
    async fn delete_project_evaluation(
        &self,
        req: Request<grpc::DeleteEvaluationRequest>,
    ) -> Result<Response<common::Ack>, Status> {
        with_metrics!(self.metrics, "delete_project_evaluation", {
            let req = req.into_inner();
            let deleted_eval = self
                .app_api
                .delete_project_evaluation(&req.evaluation_id)
                .await?;

            Ok(Response::new(common::Ack {
                success: true,
                message: format!("Deleted: {:#?}", deleted_eval),
            }))
        })
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
