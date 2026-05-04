use thiserror::Error;

use crate::{
    application::{
        gateway::{self, *},
        repository::project_evaluation::{self as proj_eval},
        usecase::project_evaluation::ValidateResult,
    },
    domain::ProjectEvaluation,
};

pub type Request<'a> = &'a ProjectEvaluation;
pub type Response = ();

#[derive(Debug, Error)]
pub enum Error {
    #[error("Project gateway error: {0}")]
    Gateway(#[from] gateway::ProjectError),
    #[error("Evaluation points {points} are invalid: must be between 0 and {max_points}")]
    PointsInvalid { points: f32, max_points: f32 },
}

#[derive(Debug)]
pub struct Validate<'r, 'g, R, G> {
    _repo: &'r R,
    gateways: &'g G,
}

impl<'r, 'g, R, G> Validate<'r, 'g, R, G>
where
    R: proj_eval::Repo,
    G: GatewayCollection,
{
    pub fn new(repo: &'r R, gateways: &'g G) -> Self {
        Self {
            _repo: repo,
            gateways,
        }
    }

    pub async fn exec(&self, req: Request<'_>) -> ValidateResult {
        log::debug!("Validate new project evaluation: {:?}", req);

        let max_points = self.get_max_points(req).await?;

        if req.total_score > max_points {
            return Err(Error::PointsInvalid {
                points: req.total_score,
                max_points,
            });
        }

        Ok(())
    }

    async fn get_max_points(&self, record: &ProjectEvaluation) -> Result<f32, ProjectError> {
        let project = self
            .gateways
            .project()
            .get_project_info(record.project_id.clone())
            .await?;

        Ok(project.max_points)
    }
}
