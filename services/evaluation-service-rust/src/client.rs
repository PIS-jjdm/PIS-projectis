use clap::{Parser, Subcommand};
use std::net::{IpAddr, SocketAddr};

use crate::eval::{
    DeleteEvaluationRequest, GetProjectEvaluationRequest, ListProjectEvaluationsRequest,
    UpdateProjectEvaluationRequest, evaluation_service_client::EvaluationServiceClient,
};

mod common {
    tonic::include_proto!("common");
}

mod auth {
    tonic::include_proto!("auth");
}

mod eval {
    tonic::include_proto!("eval");
}

#[derive(Subcommand)]
enum Command {
    #[clap(about = "Create a new project evaluation")]
    Create {
        project_id: String,
        team_id: String,
        evaluator_teacher_id: String,
        total_score: f32,
        feedback: String,
    },
    #[clap(about = "Get project evaluation by ID")]
    Get { project_id: String, team_id: String },
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

#[derive(Parser)]
struct Args {
    /// IP address to bind to
    #[arg(short('a'), long, default_value = "127.0.0.1")]
    bind: IpAddr,

    /// TCP port
    #[arg(long, default_value = "50123")]
    port: u16,

    #[clap(subcommand)]
    command: Command,
}

#[tokio::main]
async fn main() -> Result<(), anyhow::Error> {
    let args = Args::parse();
    let addr = SocketAddr::from((args.bind, args.port));
    let mut client = EvaluationServiceClient::connect(format!("http://{addr}")).await?;

    match args.command {
        Command::Create { .. } => unimplemented!(),
        Command::Get {
            project_id,
            team_id,
        } => {
            let request = tonic::Request::new(GetProjectEvaluationRequest {
                project_id,
                team_id,
                evaluator_teacher_id: None,
            });
            let res = client.get_project_evaluation(request).await?;
            println!("{res:#?}")
        }
        Command::GetAll => {
            let request = tonic::Request::new(ListProjectEvaluationsRequest {
                project_id: None,
                student_id: None,
                evaluator_teacher_id: None,
            });
            let res = client.list_project_evaluations(request).await?;
            println!("{res:#?}")
        }
        Command::Update {
            evaluation_id,
            total_score,
            feedback,
        } => {
            let request = tonic::Request::new(UpdateProjectEvaluationRequest {
                evaluation_id,
                total_score,
                feedback,
            });
            let res = client.update_project_evaluation(request).await?;
            println!("{res:#?}")
        }
        Command::Delete { evaluation_id } => {
            let request = tonic::Request::new(DeleteEvaluationRequest { evaluation_id });
            let res = client.delete_project_evaluation(request).await?;
            println!("{res:#?}")
        }
    }

    Ok(())
}
