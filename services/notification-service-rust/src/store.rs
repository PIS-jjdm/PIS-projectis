//! A simple notification store using the `fjall` embedded database.

use chrono::{DateTime, Utc};
use fjall::KeyspaceCreateOptions;
use fjall::{Database, Keyspace, PersistMode};
use serde::{Deserialize, Serialize};
use std::str;
use std::sync::Arc;
use tokio::sync::{broadcast, Notify};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NotificationRecord {
    pub id: String,
    pub batch_id: String,
    pub user_id: String,
    pub creator_user_id: String,
    pub message: String,
    pub trigger_at: DateTime<Utc>,
    pub delivered_at: Option<DateTime<Utc>>,
    pub cancelled_at: Option<DateTime<Utc>>,
    pub read: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScheduledNotificationBatchRecord {
    pub batch_id: String,
    pub message: String,
    pub trigger_at: DateTime<Utc>,
    pub creator_user_id: String,
    pub user_ids: Vec<String>,
    pub notification_ids: Vec<String>,
    pub delivered_at: Option<DateTime<Utc>>,
    pub cancelled_at: Option<DateTime<Utc>>,
}

impl ScheduledNotificationBatchRecord {
    fn is_pending(&self) -> bool {
        self.delivered_at.is_none() && self.cancelled_at.is_none()
    }
}

#[derive(Clone)]
pub struct NotificationStore {
    db: Database,
    notifications: Keyspace,
    user_index: Keyspace,
    scheduled_by_time: Keyspace,
    scheduled_batches: Keyspace,
    scheduled_batches_by_creator: Keyspace,
    events: broadcast::Sender<NotificationRecord>,
    scheduler: Arc<Notify>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum CancelBatchResult {
    Cancelled,
    AlreadyCancelled,
    AlreadyDelivered,
    NotFound,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum RescheduleBatchResult {
    Rescheduled,
    AlreadyCancelled,
    AlreadyDelivered,
    NotFound,
}

impl NotificationStore {
    pub fn open(path: &str) -> anyhow::Result<Self> {
        let db = Database::builder(path).open()?;
        let notifications = db.keyspace("notifications", KeyspaceCreateOptions::default)?;
        let user_index = db.keyspace("user_notifications", KeyspaceCreateOptions::default)?;
        let scheduled_by_time =
            db.keyspace("scheduled_by_time", KeyspaceCreateOptions::default)?;
        let scheduled_batches =
            db.keyspace("scheduled_batches", KeyspaceCreateOptions::default)?;
        let scheduled_batches_by_creator = db.keyspace(
            "scheduled_batches_by_creator",
            KeyspaceCreateOptions::default,
        )?;
        let (events, _) = broadcast::channel(1024);

        Ok(Self {
            db,
            notifications,
            user_index,
            scheduled_by_time,
            scheduled_batches,
            scheduled_batches_by_creator,
            events,
            scheduler: Arc::new(Notify::new()),
        })
    }

    pub fn subscribe(&self) -> broadcast::Receiver<NotificationRecord> {
        self.events.subscribe()
    }

    pub fn publish(&self, record: NotificationRecord) {
        let _ = self.events.send(record);
    }

    pub fn scheduler_notifier(&self) -> Arc<Notify> {
        Arc::clone(&self.scheduler)
    }

    fn timestamp_millis(value: DateTime<Utc>) -> u64 {
        value.timestamp_millis().max(0) as u64
    }

    fn user_index_key(user_id: &str, delivered_at: DateTime<Utc>, notification_id: &str) -> String {
        let reverse_millis = u64::MAX - Self::timestamp_millis(delivered_at);
        format!("{user_id}:{reverse_millis:020}:{notification_id}")
    }

    fn scheduled_time_key(trigger_at: DateTime<Utc>, batch_id: &str) -> String {
        format!("{:020}:{batch_id}", Self::timestamp_millis(trigger_at))
    }

    fn creator_index_key(creator_user_id: &str, trigger_at: DateTime<Utc>, batch_id: &str) -> String {
        format!(
            "{creator_user_id}:{:020}:{batch_id}",
            Self::timestamp_millis(trigger_at)
        )
    }

    fn parse_scheduled_time_key(key: &str) -> anyhow::Result<(u64, &str)> {
        let (millis, batch_id) = key
            .split_once(':')
            .ok_or_else(|| anyhow::anyhow!("invalid scheduled key"))?;
        let millis = millis.parse::<u64>()?;
        Ok((millis, batch_id))
    }

    fn write_notification(&self, record: &NotificationRecord) -> anyhow::Result<()> {
        let value = serde_json::to_vec(record)?;
        self.notifications.insert(record.id.as_bytes(), value)?;

        if let Some(delivered_at) = record.delivered_at {
            let index_key = Self::user_index_key(&record.user_id, delivered_at, &record.id);
            self.user_index
                .insert(index_key.as_bytes(), record.id.as_bytes())?;
        }

        Ok(())
    }

    fn write_batch(&self, batch: &ScheduledNotificationBatchRecord) -> anyhow::Result<()> {
        let value = serde_json::to_vec(batch)?;
        self.scheduled_batches.insert(batch.batch_id.as_bytes(), value)?;
        Ok(())
    }

    fn add_pending_batch_indexes(
        &self,
        batch: &ScheduledNotificationBatchRecord,
    ) -> anyhow::Result<()> {
        if !batch.is_pending() {
            return Ok(());
        }

        let time_key = Self::scheduled_time_key(batch.trigger_at, &batch.batch_id);
        let creator_key =
            Self::creator_index_key(&batch.creator_user_id, batch.trigger_at, &batch.batch_id);

        self.scheduled_by_time
            .insert(time_key.as_bytes(), batch.batch_id.as_bytes())?;
        self.scheduled_batches_by_creator
            .insert(creator_key.as_bytes(), batch.batch_id.as_bytes())?;

        Ok(())
    }

    fn remove_pending_batch_indexes(
        &self,
        batch: &ScheduledNotificationBatchRecord,
    ) -> anyhow::Result<()> {
        let time_key = Self::scheduled_time_key(batch.trigger_at, &batch.batch_id);
        let creator_key =
            Self::creator_index_key(&batch.creator_user_id, batch.trigger_at, &batch.batch_id);

        self.scheduled_by_time.remove(time_key.as_bytes())?;
        self.scheduled_batches_by_creator
            .remove(creator_key.as_bytes())?;

        Ok(())
    }

    pub fn save_notification_batch(
        &self,
        records: &[NotificationRecord],
        batch: Option<&ScheduledNotificationBatchRecord>,
    ) -> anyhow::Result<()> {
        for record in records {
            self.write_notification(record)?;
        }

        let should_wake_scheduler = if let Some(batch) = batch {
            self.write_batch(batch)?;
            self.add_pending_batch_indexes(batch)?;
            batch.is_pending()
        } else {
            false
        };

        self.db.persist(PersistMode::SyncAll)?;
        if should_wake_scheduler {
            self.scheduler.notify_one();
        }

        Ok(())
    }

    pub fn get_notification(&self, id: &str) -> anyhow::Result<Option<NotificationRecord>> {
        let Some(bytes) = self.notifications.get(id.as_bytes())? else {
            return Ok(None);
        };
        Ok(Some(serde_json::from_slice(&bytes)?))
    }

    pub fn get_scheduled_batch(
        &self,
        batch_id: &str,
    ) -> anyhow::Result<Option<ScheduledNotificationBatchRecord>> {
        let Some(bytes) = self.scheduled_batches.get(batch_id.as_bytes())? else {
            return Ok(None);
        };
        Ok(Some(serde_json::from_slice(&bytes)?))
    }

    pub fn list_notifications(&self, user_id: &str) -> anyhow::Result<Vec<NotificationRecord>> {
        let mut rows = Vec::new();
        let prefix = format!("{user_id}:");
        for entry in self.user_index.prefix(prefix.as_bytes()) {
            let value = entry.value()?;
            let notification_id = str::from_utf8(&value)?;
            if let Some(record) = self.get_notification(notification_id)? {
                if record.delivered_at.is_some() && record.cancelled_at.is_none() {
                    rows.push(record);
                }
            }
        }
        Ok(rows)
    }

    pub fn list_scheduled_notifications(
        &self,
        creator_user_id: &str,
    ) -> anyhow::Result<Vec<ScheduledNotificationBatchRecord>> {
        let mut rows = Vec::new();
        let prefix = format!("{creator_user_id}:");

        for entry in self.scheduled_batches_by_creator.prefix(prefix.as_bytes()) {
            let value = entry.value()?;
            let batch_id = str::from_utf8(&value)?;
            if let Some(batch) = self.get_scheduled_batch(batch_id)? {
                if batch.is_pending() {
                    rows.push(batch);
                }
            }
        }

        Ok(rows)
    }

    pub fn next_scheduled_trigger_at(&self) -> anyhow::Result<Option<DateTime<Utc>>> {
        let Some(entry) = self.scheduled_by_time.prefix(b"").next() else {
            return Ok(None);
        };

        let (key, _) = entry.into_inner()?;
        let key = str::from_utf8(&key)?;
        let (millis, _) = Self::parse_scheduled_time_key(key)?;

        Ok(DateTime::from_timestamp_millis(millis as i64))
    }

    pub fn mark_as_read(&self, notification_id: &str) -> anyhow::Result<()> {
        let Some(mut record) = self.get_notification(notification_id)? else {
            return Ok(());
        };
        record.read = true;
        self.write_notification(&record)?;
        let _ = self.events.send(record);

        self.db.persist(PersistMode::SyncAll)?;

        Ok(())
    }

    pub fn deliver_due_notifications(&self, now: DateTime<Utc>) -> anyhow::Result<Vec<NotificationRecord>> {
        let now_millis = Self::timestamp_millis(now);
        let mut due_batch_ids = Vec::new();

        for entry in self.scheduled_by_time.prefix(b"") {
            let (key, value) = entry.into_inner()?;
            let key = str::from_utf8(&key)?;
            let (trigger_millis, _) = Self::parse_scheduled_time_key(key)?;
            if trigger_millis > now_millis {
                break;
            }

            due_batch_ids.push(str::from_utf8(&value)?.to_string());
        }

        let mut delivered = Vec::new();
        let mut changed = false;

        for batch_id in due_batch_ids {
            let Some(mut batch) = self.get_scheduled_batch(&batch_id)? else {
                continue;
            };
            if !batch.is_pending() {
                continue;
            }

            self.remove_pending_batch_indexes(&batch)?;
            batch.delivered_at = Some(now);
            self.write_batch(&batch)?;
            changed = true;

            for notification_id in &batch.notification_ids {
                let Some(mut record) = self.get_notification(notification_id)? else {
                    continue;
                };
                if record.delivered_at.is_some() || record.cancelled_at.is_some() {
                    continue;
                }

                record.delivered_at = Some(now);
                self.write_notification(&record)?;
                let _ = self.events.send(record.clone());
                delivered.push(record);
            }
        }

        if changed {
            self.db.persist(PersistMode::SyncAll)?;
        }

        Ok(delivered)
    }

    pub fn cancel_scheduled_batch(
        &self,
        batch_id: &str,
        creator_user_id: &str,
    ) -> anyhow::Result<CancelBatchResult> {
        let Some(mut batch) = self.get_scheduled_batch(batch_id)? else {
            return Ok(CancelBatchResult::NotFound);
        };

        if batch.creator_user_id != creator_user_id {
            return Ok(CancelBatchResult::NotFound);
        }

        if batch.cancelled_at.is_some() {
            return Ok(CancelBatchResult::AlreadyCancelled);
        }

        if batch.delivered_at.is_some() {
            return Ok(CancelBatchResult::AlreadyDelivered);
        }

        self.remove_pending_batch_indexes(&batch)?;
        batch.cancelled_at = Some(Utc::now());
        self.write_batch(&batch)?;

        for notification_id in &batch.notification_ids {
            let Some(mut record) = self.get_notification(notification_id)? else {
                continue;
            };
            if record.cancelled_at.is_none() {
                record.cancelled_at = batch.cancelled_at;
                self.write_notification(&record)?;
            }
        }

        self.db.persist(PersistMode::SyncAll)?;
        self.scheduler.notify_one();

        Ok(CancelBatchResult::Cancelled)
    }

    pub fn reschedule_scheduled_batch(
        &self,
        batch_id: &str,
        creator_user_id: &str,
        trigger_at: DateTime<Utc>,
    ) -> anyhow::Result<RescheduleBatchResult> {
        let Some(mut batch) = self.get_scheduled_batch(batch_id)? else {
            return Ok(RescheduleBatchResult::NotFound);
        };

        if batch.creator_user_id != creator_user_id {
            return Ok(RescheduleBatchResult::NotFound);
        }

        if batch.cancelled_at.is_some() {
            return Ok(RescheduleBatchResult::AlreadyCancelled);
        }

        if batch.delivered_at.is_some() {
            return Ok(RescheduleBatchResult::AlreadyDelivered);
        }

        self.remove_pending_batch_indexes(&batch)?;
        batch.trigger_at = trigger_at;
        self.write_batch(&batch)?;
        self.add_pending_batch_indexes(&batch)?;

        for notification_id in &batch.notification_ids {
            let Some(mut record) = self.get_notification(notification_id)? else {
                continue;
            };
            if record.delivered_at.is_none() && record.cancelled_at.is_none() {
                record.trigger_at = trigger_at;
                self.write_notification(&record)?;
            }
        }

        self.db.persist(PersistMode::SyncAll)?;
        self.scheduler.notify_one();

        Ok(RescheduleBatchResult::Rescheduled)
    }
}
