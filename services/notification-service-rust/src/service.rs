use crate::{
    service::notification::StreamNotificationsRequest,
    store::{NotificationRecord, NotificationStore},
};
use async_stream::stream;
use chrono::Utc;
use prost_types::Timestamp;
use std::pin::Pin;
use std::sync::Arc;
use tonic::{Request, Response, Status};

pub mod common {
    #![allow(unused)]
    tonic::include_proto!("common");
}
pub mod notification {
    tonic::include_proto!("notification");
}

use common::Ack;
use notification::{
    notification_service_server::NotificationService, CreateNotificationRequest,
    ListNotificationsRequest, ListNotificationsResponse, MarkAsReadRequest, Notification,
};

impl From<NotificationRecord> for Notification {
    fn from(rec: NotificationRecord) -> Self {
        Notification {
            id: rec.id,
            user_id: rec.user_id,
            message: rec.message,
            date: Some(Timestamp {
                seconds: rec.date.timestamp(),
                nanos: rec.date.timestamp_subsec_nanos() as i32,
            }),
            read: rec.read,
        }
    }
}

#[derive(Clone)]
pub struct NotificationGrpc {
    store: Arc<NotificationStore>,
}

impl NotificationGrpc {
    pub fn new(store: Arc<NotificationStore>) -> Self {
        Self { store }
    }
}

fn internal<E: std::fmt::Display>(err: E) -> Status {
    Status::internal(err.to_string())
}

#[tonic::async_trait]
impl NotificationService for NotificationGrpc {
    type StreamNotificationsStream =
        Pin<Box<dyn tokio_stream::Stream<Item = Result<Notification, Status>> + Send + 'static>>;

    async fn create_notification(
        &self,
        request: Request<CreateNotificationRequest>,
    ) -> Result<Response<Notification>, Status> {
        let req = request.into_inner();
        let record = NotificationRecord {
            id: uuid::Uuid::new_v4().to_string(),
            user_id: req.user_id,
            message: req.message,
            date: Utc::now(),
            read: false,
        };

        self.store.save_notification(&record).map_err(internal)?;
        Ok(Response::new(record.into()))
    }

    async fn list_notifications(
        &self,
        request: Request<ListNotificationsRequest>,
    ) -> Result<Response<ListNotificationsResponse>, Status> {
        let rows = self
            .store
            .list_notifications(&request.into_inner().user_id)
            .map_err(internal)?;

        Ok(Response::new(ListNotificationsResponse {
            notifications: rows.into_iter().map(Notification::from).collect(),
        }))
    }

    async fn mark_as_read(
        &self,
        request: Request<MarkAsReadRequest>,
    ) -> Result<Response<Ack>, Status> {
        self.store
            .mark_as_read(&request.into_inner().notification_id)
            .map_err(internal)?;

        Ok(Response::new(Ack {
            success: true,
            message: "notification marked as read".into(),
        }))
    }

    async fn stream_notifications(
        &self,
        request: Request<StreamNotificationsRequest>,
    ) -> Result<Response<Self::StreamNotificationsStream>, Status> {
        let user_id = request.into_inner().user_id;
        let mut receiver = self.store.subscribe();

        let output = stream! {
            loop {
                match receiver.recv().await {
                    Ok(rec) if rec.user_id == user_id => yield Ok(rec.into()),
                    Ok(_) => continue, // Not for this user, ignore
                    Err(tokio::sync::broadcast::error::RecvError::Closed) => {
                        break;
                    }
                    Err(e) => {
                        yield Err(Status::internal(format!("Stream error: {}", e)));
                        continue;
                    }
                }
            }
        };

        Ok(Response::new(
            Box::pin(output) as Self::StreamNotificationsStream
        ))
    }
}
