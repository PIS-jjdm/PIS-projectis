use crate::{
    service::notification::StreamNotificationsRequest,
    store::{
        CancelBatchResult, NotificationRecord, NotificationStore,
        RescheduleBatchResult, ScheduledNotificationBatchRecord,
    },
};
use async_stream::stream;
use chrono::{DateTime, Utc};
use prost_types::Timestamp;
use std::collections::HashSet;
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
    notification_service_server::NotificationService, CancelScheduledNotificationRequest,
    CreateNotificationRequest, CreateNotificationResponse, ListNotificationsRequest,
    ListNotificationsResponse, ListScheduledNotificationsRequest,
    ListScheduledNotificationsResponse, MarkAsReadRequest, Notification,
    RescheduleScheduledNotificationRequest, ScheduledNotificationBatch,
};

impl From<NotificationRecord> for Notification {
    fn from(rec: NotificationRecord) -> Self {
        Notification {
            id: rec.id,
            user_id: rec.user_id,
            message: rec.message,
            date: rec.delivered_at.map(datetime_to_timestamp),
            read: rec.read,
            trigger_at: Some(datetime_to_timestamp(rec.trigger_at)),
            creator_user_id: rec.creator_user_id,
            batch_id: rec.batch_id,
        }
    }
}

impl From<ScheduledNotificationBatchRecord> for ScheduledNotificationBatch {
    fn from(rec: ScheduledNotificationBatchRecord) -> Self {
        ScheduledNotificationBatch {
            batch_id: rec.batch_id,
            message: rec.message,
            trigger_at: Some(datetime_to_timestamp(rec.trigger_at)),
            creator_user_id: rec.creator_user_id,
            user_ids: rec.user_ids,
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

fn datetime_to_timestamp(value: DateTime<Utc>) -> Timestamp {
    Timestamp {
        seconds: value.timestamp(),
        nanos: value.timestamp_subsec_nanos() as i32,
    }
}

fn timestamp_to_datetime(value: Option<Timestamp>) -> Result<Option<DateTime<Utc>>, Status> {
    let Some(timestamp) = value else {
        return Ok(None);
    };

    DateTime::from_timestamp(timestamp.seconds, timestamp.nanos as u32)
        .map(Some)
        .ok_or_else(|| Status::invalid_argument("invalid timestamp"))
}

fn normalize_user_ids(user_ids: Vec<String>) -> Vec<String> {
    let mut seen = HashSet::new();
    let mut normalized = Vec::new();

    for user_id in user_ids {
        let trimmed = user_id.trim();
        if trimmed.is_empty() {
            continue;
        }

        let owned = trimmed.to_string();
        if seen.insert(owned.clone()) {
            normalized.push(owned);
        }
    }

    normalized
}

#[tonic::async_trait]
impl NotificationService for NotificationGrpc {
    type StreamNotificationsStream =
        Pin<Box<dyn tokio_stream::Stream<Item = Result<Notification, Status>> + Send + 'static>>;

    async fn create_notification(
        &self,
        request: Request<CreateNotificationRequest>,
    ) -> Result<Response<CreateNotificationResponse>, Status> {
        let req = request.into_inner();
        let user_ids = normalize_user_ids(req.user_ids);
        if user_ids.is_empty() {
            return Err(Status::invalid_argument(
                "at least one recipient user id is required",
            ));
        }

        let message = req.message.trim();
        if message.is_empty() {
            return Err(Status::invalid_argument("notification message is required"));
        }

        let creator_user_id = req.creator_user_id.trim();
        if creator_user_id.is_empty() {
            return Err(Status::invalid_argument("creator user id is required"));
        }

        let trigger_at = timestamp_to_datetime(req.trigger_at)?.unwrap_or_else(Utc::now);
        let now = Utc::now();
        let delivered_now = trigger_at <= now;
        let delivered_at = delivered_now.then_some(now);

        let batch_id = uuid::Uuid::new_v4().to_string();
        let mut notifications = Vec::with_capacity(user_ids.len());
        for user_id in user_ids {
            notifications.push(NotificationRecord {
                id: uuid::Uuid::new_v4().to_string(),
                batch_id: batch_id.clone(),
                user_id,
                creator_user_id: creator_user_id.to_string(),
                message: message.to_string(),
                trigger_at,
                delivered_at,
                cancelled_at: None,
                read: false,
            });
        }

        let scheduled_batch = (!delivered_now).then(|| ScheduledNotificationBatchRecord {
            batch_id: batch_id.clone(),
            message: message.to_string(),
            trigger_at,
            creator_user_id: creator_user_id.to_string(),
            user_ids: notifications.iter().map(|record| record.user_id.clone()).collect(),
            notification_ids: notifications
                .iter()
                .map(|record| record.id.clone())
                .collect(),
            delivered_at: None,
            cancelled_at: None,
        });

        self.store
            .save_notification_batch(&notifications, scheduled_batch.as_ref())
            .map_err(internal)?;

        if delivered_now {
            for record in &notifications {
                self.store.publish(record.clone());
            }
        }

        Ok(Response::new(CreateNotificationResponse {
            notifications: notifications.into_iter().map(Notification::from).collect(),
        }))
    }

    async fn list_notifications(
        &self,
        request: Request<ListNotificationsRequest>,
    ) -> Result<Response<ListNotificationsResponse>, Status> {
        self.store
            .deliver_due_notifications(Utc::now())
            .map_err(internal)?;

        let rows = self
            .store
            .list_notifications(&request.into_inner().user_id)
            .map_err(internal)?;

        Ok(Response::new(ListNotificationsResponse {
            notifications: rows.into_iter().map(Notification::from).collect(),
        }))
    }

    async fn list_scheduled_notifications(
        &self,
        request: Request<ListScheduledNotificationsRequest>,
    ) -> Result<Response<ListScheduledNotificationsResponse>, Status> {
        self.store
            .deliver_due_notifications(Utc::now())
            .map_err(internal)?;

        let creator_user_id = request.into_inner().creator_user_id;
        if creator_user_id.trim().is_empty() {
            return Err(Status::invalid_argument("creator user id is required"));
        }

        let rows = self
            .store
            .list_scheduled_notifications(&creator_user_id)
            .map_err(internal)?;

        Ok(Response::new(ListScheduledNotificationsResponse {
            batches: rows.into_iter().map(ScheduledNotificationBatch::from).collect(),
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

    async fn cancel_scheduled_notification(
        &self,
        request: Request<CancelScheduledNotificationRequest>,
    ) -> Result<Response<Ack>, Status> {
        let req = request.into_inner();
        let creator_user_id = req.creator_user_id.trim();
        if creator_user_id.is_empty() {
            return Err(Status::invalid_argument("creator user id is required"));
        }
        if req.batch_id.trim().is_empty() {
            return Err(Status::invalid_argument("batch id is required"));
        }
        match self
            .store
            .cancel_scheduled_batch(&req.batch_id, creator_user_id)
            .map_err(internal)?
        {
            CancelBatchResult::Cancelled => Ok(Response::new(Ack {
                success: true,
                message: "scheduled notification batch cancelled".into(),
            })),
            CancelBatchResult::AlreadyCancelled => Ok(Response::new(Ack {
                success: true,
                message: "notification batch was already cancelled".into(),
            })),
            CancelBatchResult::AlreadyDelivered => Err(Status::failed_precondition(
                "notification batch has already been delivered",
            )),
            CancelBatchResult::NotFound => Err(Status::not_found("notification batch not found")),
        }
    }

    async fn stream_notifications(
        &self,
        request: Request<StreamNotificationsRequest>,
    ) -> Result<Response<Self::StreamNotificationsStream>, Status> {
        self.store
            .deliver_due_notifications(Utc::now())
            .map_err(internal)?;

        let user_id = request.into_inner().user_id;
        let mut receiver = self.store.subscribe();

        let output = stream! {
            loop {
                match receiver.recv().await {
                    Ok(rec) if rec.user_id == user_id => yield Ok(rec.into()),
                    Ok(_) => continue,
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

    async fn reschedule_scheduled_notification(
        &self,
        request: Request<RescheduleScheduledNotificationRequest>,
    ) -> Result<Response<Ack>, Status> {
        let req = request.into_inner();
        let creator_user_id = req.creator_user_id.trim();
        if creator_user_id.is_empty() {
            return Err(Status::invalid_argument("creator user id is required"));
        }
        if req.batch_id.trim().is_empty() {
            return Err(Status::invalid_argument("batch id is required"));
        }

        let Some(trigger_at) = timestamp_to_datetime(req.trigger_at)? else {
            return Err(Status::invalid_argument("trigger timestamp is required"));
        };

        match self
            .store
            .reschedule_scheduled_batch(&req.batch_id, creator_user_id, trigger_at)
            .map_err(internal)?
        {
            RescheduleBatchResult::Rescheduled => Ok(Response::new(Ack {
                success: true,
                message: "scheduled notification batch rescheduled".into(),
            })),
            RescheduleBatchResult::AlreadyCancelled => Err(Status::failed_precondition(
                "notification batch has already been cancelled",
            )),
            RescheduleBatchResult::AlreadyDelivered => Err(Status::failed_precondition(
                "notification batch has already been delivered",
            )),
            RescheduleBatchResult::NotFound => {
                Err(Status::not_found("notification batch not found"))
            }
        }
    }
}
