use tokio_stream::StreamExt;

use super::*;
use crate::proto::notification::{
    CancelScheduledNotificationRequest, CreateNotificationRequest, ListNotificationsRequest,
    ListScheduledNotificationsRequest, RescheduleScheduledNotificationRequest,
    StreamNotificationsRequest,
};

pub(super) async fn list_notifications(
    service: &FrontendGatewayService,
    request: Request<Empty>,
) -> Result<Response<ListNotificationsGatewayResponse>, Status> {
    let current_user = FrontendGatewayService::current_user(&request)?;
    let response = service
        .state
        .notification_client()
        .list_notifications(ListNotificationsRequest {
            user_id: current_user.user_id,
        })
        .await?
        .into_inner();

    let notifications = service.enrich_notifications(response.notifications).await;

    Ok(Response::new(ListNotificationsGatewayResponse {
        notifications,
    }))
}

pub(super) async fn create_notification(
    service: &FrontendGatewayService,
    request: Request<CreateNotificationGatewayRequest>,
) -> Result<Response<CreateNotificationGatewayResponse>, Status> {
    let current_user = FrontendGatewayService::current_user(&request)?;

    let body = request.into_inner();
    if body
        .user_ids
        .iter()
        .all(|user_id| user_id.trim().is_empty())
    {
        return Err(Status::invalid_argument(
            "at least one recipient user id is required",
        ));
    }
    FrontendGatewayService::require_non_empty(&body.message, "notification message")?;

    let response = service
        .state
        .notification_client()
        .create_notification(CreateNotificationRequest {
            user_ids: body.user_ids,
            message: body.message,
            trigger_at: body.trigger_at,
            creator_user_id: current_user.user_id,
        })
        .await?
        .into_inner();

    let notifications = service.enrich_notifications(response.notifications).await;

    Ok(Response::new(CreateNotificationGatewayResponse {
        notifications,
    }))
}

pub(super) async fn list_scheduled_notifications(
    service: &FrontendGatewayService,
    request: Request<Empty>,
) -> Result<Response<ListScheduledNotificationsResponse>, Status> {
    let current_user = FrontendGatewayService::current_user(&request)?;

    let response = service
        .state
        .notification_client()
        .list_scheduled_notifications(ListScheduledNotificationsRequest {
            creator_user_id: current_user.user_id,
        })
        .await?
        .into_inner();

    Ok(Response::new(response))
}

pub(super) async fn mark_notification_read(
    service: &FrontendGatewayService,
    request: Request<MarkAsReadRequest>,
) -> Result<Response<Ack>, Status> {
    let response = service
        .state
        .notification_client()
        .mark_as_read(request.into_inner())
        .await?
        .into_inner();

    Ok(Response::new(response))
}

pub(super) async fn cancel_scheduled_notification(
    service: &FrontendGatewayService,
    request: Request<CancelScheduledNotificationGatewayRequest>,
) -> Result<Response<Ack>, Status> {
    let current_user = FrontendGatewayService::current_user(&request)?;

    let body = request.into_inner();
    FrontendGatewayService::require_non_empty(&body.batch_id, "batch id")?;

    let response = service
        .state
        .notification_client()
        .cancel_scheduled_notification(CancelScheduledNotificationRequest {
            batch_id: body.batch_id,
            creator_user_id: current_user.user_id,
        })
        .await?
        .into_inner();

    Ok(Response::new(response))
}

pub(super) async fn reschedule_scheduled_notification(
    service: &FrontendGatewayService,
    request: Request<RescheduleScheduledNotificationGatewayRequest>,
) -> Result<Response<Ack>, Status> {
    let current_user = FrontendGatewayService::current_user(&request)?;

    let body = request.into_inner();
    FrontendGatewayService::require_non_empty(&body.batch_id, "batch id")?;
    if body.trigger_at.is_none() {
        return Err(Status::invalid_argument("missing trigger timestamp"));
    }

    let response = service
        .state
        .notification_client()
        .reschedule_scheduled_notification(RescheduleScheduledNotificationRequest {
            batch_id: body.batch_id,
            creator_user_id: current_user.user_id,
            trigger_at: body.trigger_at,
        })
        .await?
        .into_inner();

    Ok(Response::new(response))
}

pub(super) async fn stream_notifications(
    service: &FrontendGatewayService,
    request: Request<Empty>,
) -> Result<Response<NotificationStream>, Status> {
    let current_user = FrontendGatewayService::current_user(&request)?;
    let response = service
        .state
        .notification_client()
        .stream_notifications(StreamNotificationsRequest {
            user_id: current_user.user_id,
        })
        .await?;

    let state = service.state.clone();
    let stream = response.into_inner().then(move |item| {
        let service = FrontendGatewayService::new(state.clone());
        async move {
            let notification = item?;
            Ok(service.enrich_notification(notification).await)
        }
    });

    Ok(Response::new(Box::pin(stream)))
}
