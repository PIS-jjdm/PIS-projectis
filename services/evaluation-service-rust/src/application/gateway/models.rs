#[derive(Debug)]
pub struct Team {
    pub name: String,
    pub members: Vec<String>,
}

#[derive(Debug)]
pub struct Project {
    pub name: String,
    pub subject_id: String,
    pub max_points: f32,
}

#[derive(Debug)]
pub struct Subject {
    pub name: String,
    pub abbreviation: String,
}
