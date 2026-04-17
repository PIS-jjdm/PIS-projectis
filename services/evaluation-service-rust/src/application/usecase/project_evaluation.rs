pub mod create;
pub mod delete;
pub mod find_by_id;
pub mod get_all;
pub mod update;

pub type CreateResult = Result<create::Response, create::Error>;
pub type GetAllResult = Result<get_all::Response, get_all::Error>;

pub use create::Create;
pub use get_all::GetAll;
