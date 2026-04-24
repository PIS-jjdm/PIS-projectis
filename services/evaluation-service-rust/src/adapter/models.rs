use thiserror::Error;

#[derive(Debug, Error)]
pub enum Error {
    #[error("Invalid argument error: {0}")]
    InvalidArgument(anyhow::Error),
    #[error("Not found error: {0}")]
    NotFound(anyhow::Error),
    #[error("Internal error: {0}")]
    Internal(anyhow::Error),
}
