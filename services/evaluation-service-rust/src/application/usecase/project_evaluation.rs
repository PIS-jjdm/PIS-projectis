pub mod create;
pub mod delete;
pub mod find_by_id;
pub mod get_all;
pub mod update;
pub mod validate;

pub type CreateResult = Result<create::Response, create::Error>;
pub type GetAllResult = Result<get_all::Response, get_all::Error>;
pub type FindByIdResult = Result<find_by_id::Response, find_by_id::Error>;
pub type DeleteResult = Result<delete::Response, delete::Error>;
pub type UpdateResult = Result<update::Response, update::Error>;
pub type ValidateResult = Result<validate::Response, validate::Error>;

pub use create::Create;
pub use delete::Delete;
pub use find_by_id::FindById;
pub use get_all::GetAll;
pub use update::Update;
pub use validate::Validate;
