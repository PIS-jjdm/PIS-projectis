use crate::domain::{
    Id,
    value_object::{Feedback, Score, UtcTimestamp},
};
use serde::Deserialize;

#[derive(Debug, Clone, Deserialize)]
pub struct ProjectEvaluation {
    pub id: Id,
    pub project_id: Id,
    pub team_id: Id,
    pub evaluator_teacher_id: Id,
    pub total_score: Score,
    pub feedback: Feedback,
    pub created_at_utc: UtcTimestamp,
}
