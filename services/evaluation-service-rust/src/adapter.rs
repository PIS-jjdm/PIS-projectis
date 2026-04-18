mod api;
pub mod models;
pub mod presenter;

use crate::application::repository::project_evaluation;
pub use api::Api;

pub trait Db: project_evaluation::Repo + 'static {}
