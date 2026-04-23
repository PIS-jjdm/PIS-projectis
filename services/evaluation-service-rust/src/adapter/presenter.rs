pub mod cli;
pub mod web;

use crate::application::usecase::project_evaluation as peuc;

pub trait ProjectEvaluationPresenter:
    Present<peuc::CreateResult>
    + Present<peuc::GetAllResult>
    + Present<peuc::FindByIdResult>
    + Present<peuc::DeleteResult>
    + Present<peuc::UpdateResult>
{
}

pub trait Present<T> {
    type ViewModel;

    fn present(&self, t: T) -> Self::ViewModel;
}
