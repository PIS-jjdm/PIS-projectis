use std::sync::Arc;

use crate::application::usecase::{self as uc, project_evaluation as peuc};
use crate::{
    adapter::{
        Db,
        presenter::{self, Present},
    },
    application::gateway::GatewayCollection,
};

#[derive(Debug)]
pub struct Api<D, P, G> {
    db: Arc<D>,
    gateways: Arc<G>,
    presenter: P,
}

impl<D, P, G> Clone for Api<D, P, G>
where
    D: Db,
    P: Clone,
    G: GatewayCollection,
{
    fn clone(&self) -> Self {
        Self {
            db: Arc::clone(&self.db),
            presenter: self.presenter.clone(),
            gateways: Arc::clone(&self.gateways),
        }
    }
}

impl<D, P, G> Api<D, P, G>
where
    D: Db,
    P: presenter::ProjectEvaluationPresenter,
    G: GatewayCollection,
{
    pub fn new(db: Arc<D>, presenter: P, gateways: Arc<G>) -> Self {
        Self {
            db,
            presenter,
            gateways,
        }
    }

    pub async fn create_project_evaluation(
        &self,
        project_id: &str,
        team_id: &str,
        evaluator_teacher_id: &str,
        total_score: f32,
        feedback: &str,
    ) -> <P as Present<peuc::CreateResult>>::ViewModel {
        let req = peuc::create::Request {
            project_id: project_id.to_owned(),
            team_id: team_id.to_owned(),
            evaluator_teacher_id: evaluator_teacher_id.to_owned(),
            total_score,
            feedback: feedback.to_owned(),
        };

        let interceptor = uc::project_evaluation::Create::new(&*self.db, &*self.gateways);
        let res = interceptor.exec(req).await;

        self.presenter.present(res)
    }

    pub async fn getall_project_evaluations(
        &self,
    ) -> <P as Present<peuc::GetAllResult>>::ViewModel {
        let interceptor = uc::project_evaluation::GetAll::new(&*self.db);
        let res = interceptor.exec().await;

        self.presenter.present(res)
    }

    pub async fn get_project_evaluation(
        &self,
        evaluation_id: &str,
    ) -> <P as Present<peuc::FindByIdResult>>::ViewModel {
        let interceptor = uc::project_evaluation::FindById::new(&*self.db);
        let res = interceptor.exec(evaluation_id.to_owned()).await;

        self.presenter.present(res)
    }

    pub async fn get_evaluation_by_proj_team_id(
        &self,
        project_id: &str,
        team_id: &str,
    ) -> <P as Present<peuc::FindByIdResult>>::ViewModel {
        let interceptor = uc::project_evaluation::FindById::new(&*self.db);
        let res = interceptor
            .by_proj_team_id(project_id.to_owned(), team_id.to_owned())
            .await;

        self.presenter.present(res)
    }

    pub async fn delete_project_evaluation(
        &self,
        evaluation_id: &str,
    ) -> <P as Present<peuc::DeleteResult>>::ViewModel {
        let interceptor = uc::project_evaluation::Delete::new(&*self.db, &*self.gateways);
        let res = interceptor.exec(evaluation_id.to_owned()).await;

        self.presenter.present(res)
    }

    pub async fn update_project_evaluation(
        &self,
        evaluation_id: &str,
        total_score: Option<f32>,
        feedback: &Option<String>,
    ) -> <P as Present<peuc::UpdateResult>>::ViewModel {
        let req = uc::project_evaluation::update::Request {
            evaluation_id: evaluation_id.to_owned(),
            total_score,
            feedback: feedback.clone(),
        };

        let interceptor = uc::project_evaluation::Update::new(&*self.db, &*self.gateways);
        let res = interceptor.exec(req).await;

        self.presenter.present(res)
    }
}
