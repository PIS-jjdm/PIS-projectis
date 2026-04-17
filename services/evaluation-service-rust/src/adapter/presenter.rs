pub mod cli;

use crate::application::usecase::project_evaluation as peuc;

pub trait ProjectEvaluationPresenter:
    Present<peuc::CreateResult> + Present<peuc::GetAllResult>
{
}

pub trait Present<T> {
    type ViewModel;

    fn present(&self, t: T) -> Self::ViewModel;
}
