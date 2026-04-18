use crate::{
    adapter::{
        models,
        presenter::{Present, ProjectEvaluationPresenter},
    },
    application::{
        repository::project_evaluation::{DeleteError, GetAllError, GetError, SaveError},
        usecase::project_evaluation as uc,
    },
    domain::ProjectEvaluation,
};

pub type Result<T> = std::result::Result<T, models::Error>;

#[derive(Debug, Default)]
pub struct Presenter;

impl ProjectEvaluationPresenter for Presenter {}

impl Present<uc::CreateResult> for Presenter {
    type ViewModel = Result<ProjectEvaluation>;

    fn present(&self, t: uc::CreateResult) -> Self::ViewModel {
        t.map_err(|e| match e {
            uc::create::Error::Repo(save_error) => match save_error {
                SaveError::Connection(conn) => models::Error::Internal(conn.into()),
            },
            uc::create::Error::Invalid => models::Error::Internal(e.into()),
        })
    }
}

impl Present<uc::GetAllResult> for Presenter {
    type ViewModel = Result<Vec<ProjectEvaluation>>;

    fn present(&self, t: uc::GetAllResult) -> Self::ViewModel {
        t.map_err(|e| match e {
            uc::get_all::Error::Repo(get_all_error) => match get_all_error {
                GetAllError::Connection(conn) => models::Error::Internal(conn.into()),
            },
        })
    }
}

impl Present<uc::FindByIdResult> for Presenter {
    type ViewModel = Result<ProjectEvaluation>;

    fn present(&self, t: uc::FindByIdResult) -> Self::ViewModel {
        t.map_err(|e| match e {
            GetError::NotFound => models::Error::NotFound(e.into()),
            GetError::Connection(conn) => models::Error::Internal(conn.into()),
        })
    }
}

impl Present<uc::DeleteResult> for Presenter {
    type ViewModel = Result<ProjectEvaluation>;

    fn present(&self, t: uc::DeleteResult) -> Self::ViewModel {
        t.map_err(|e| match e {
            DeleteError::NotFound => models::Error::NotFound(e.into()),
            DeleteError::Connection(conn) => models::Error::Internal(conn.into()),
        })
    }
}

impl Present<uc::UpdateResult> for Presenter {
    type ViewModel = Result<ProjectEvaluation>;

    fn present(&self, t: uc::UpdateResult) -> Self::ViewModel {
        t.map_err(|e| match e {
            uc::update::Error::Repo(conn) => models::Error::Internal(conn.into()),
            uc::update::Error::NotFound => models::Error::NotFound(e.into()),
        })
    }
}
