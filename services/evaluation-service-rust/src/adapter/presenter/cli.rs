use crate::{
    adapter::presenter::{Present, ProjectEvaluationPresenter},
    application::usecase::project_evaluation as uc,
};

#[derive(Debug, Default)]
pub struct Presenter;

impl ProjectEvaluationPresenter for Presenter {}

impl Present<uc::CreateResult> for Presenter {
    type ViewModel = String;

    fn present(&self, t: uc::CreateResult) -> Self::ViewModel {
        match t {
            Ok(res) => format!("Created project evaluation (Id = {})", res.evaluation_id()),
            Err(err) => format!("Failed to create project evaluation: {err}"),
        }
    }
}

impl Present<uc::GetAllResult> for Presenter {
    type ViewModel = Result<Vec<String>, String>;

    fn present(&self, t: uc::GetAllResult) -> Self::ViewModel {
        match t {
            Ok(res) => Ok(res.into_iter().map(|p| format!("{p:#?}")).collect()),
            Err(err) => Err(format!("Failed to create project evaluation: {err}")),
        }
    }
}
