use crate::{
    adapter::{self, Db, presenter::cli},
    application,
    infrastructure::{db::InMemory, seeding::load_toml_seedings},
};
use clap::{Parser, Subcommand};
use std::{path::PathBuf, sync::Arc};

#[derive(Subcommand)]
pub enum Command {
    #[clap(about = "Create a new project evaluation")]
    Create {
        project_id: String,
        team_id: String,
        evaluator_teacher_id: String,
        total_score: f32,
        feedback: String,
    },
    #[clap(about = "Get project evaluation by ID")]
    Get { evaluation_id: String },
    #[clap(about = "Get all project evaluations")]
    GetAll,
    #[clap(about = "Update project evaluation")]
    Update {
        /// Id of the evaluation record to update
        evaluation_id: String,
        #[arg(short, long)]
        total_score: Option<f32>,
        #[arg(short, long)]
        feedback: Option<String>,
    },
    #[clap(about = "Delete project evaluation by ID")]
    Delete { evaluation_id: String },
}

/// Simple CLI for interaction with the evaluation service
#[derive(Parser)]
#[command(version, about, long_about = None)]
struct Args {
    #[clap(subcommand)]
    command: Command,

    /// Path to the seeds TOML file
    #[arg(short, long)]
    seeds: PathBuf,
}

pub fn run() {
    let args = Args::parse();
    let db = Arc::new(InMemory::default());
    let rt = tokio::runtime::Runtime::new().unwrap();

    if let Err(e) = rt.block_on(load_seeds(db.clone(), &args.seeds)) {
        log::error!("{e}");
        return;
    }

    rt.block_on(run_command(db, args.command));
}

pub async fn load_seeds(db: Arc<impl Db>, path: &PathBuf) -> anyhow::Result<()> {
    use application::seeding::project_evaluation::*;

    let mut seeds = load_toml_seedings(path).await?;

    let eval_seeds = SeedData {
        evaluations: seeds.project_evaluations.take().unwrap_or(vec![]),
    };

    Seeder::new(&*db).seed(eval_seeds).await?;

    Ok(())
}

pub async fn run_command(db: Arc<impl Db>, cmd: Command) {
    let app_api = adapter::Api::new(db, cli::Presenter);

    match cmd {
        Command::Create {
            project_id,
            team_id,
            evaluator_teacher_id,
            total_score,
            feedback,
        } => {
            let res = app_api
                .create_project_evaluation(
                    &project_id,
                    &team_id,
                    &evaluator_teacher_id,
                    total_score,
                    &feedback,
                )
                .await;
            println!("{res}");
        }
        Command::Get { evaluation_id } => {
            let res = app_api.get_project_evaluation(&evaluation_id).await;
            println!("{res}");
        }
        Command::GetAll => match app_api.getall_project_evaluations().await {
            Ok(vals) => vals.iter().for_each(|e| println!("{e}")),
            Err(e) => log::error!("{e}"),
        },
        Command::Update {
            evaluation_id,
            total_score,
            feedback,
        } => {
            let res = app_api
                .update_project_evaluation(&evaluation_id, total_score, &feedback)
                .await;
            println!("{res}");
        }
        Command::Delete { evaluation_id } => {
            let res = app_api.delete_project_evaluation(&evaluation_id).await;
            println!("{res}");
        }
    }
}
