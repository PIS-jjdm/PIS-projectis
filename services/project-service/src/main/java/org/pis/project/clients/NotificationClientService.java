package org.pis.project.clients;

import java.time.Instant;
import java.util.List;

import org.springframework.stereotype.Service;

import com.google.protobuf.Timestamp;

import io.grpc.StatusRuntimeException;
import lombok.extern.slf4j.Slf4j;
import notification.NotificationOuterClass.CreateNotificationRequest;
import notification.NotificationOuterClass.CreateNotificationResponse;
import notification.NotificationOuterClass.Notification;
import notification.NotificationServiceGrpc;

@Service
@Slf4j
public class NotificationClientService {

    private final NotificationServiceGrpc.NotificationServiceBlockingStub notificationStub;

    public NotificationClientService(NotificationServiceGrpc.NotificationServiceBlockingStub notificationStub) {
        this.notificationStub = notificationStub;
    }

    public List<Notification> createNotification(List<String> userIds, String message, String creatorId,
            Instant triggerAt) {

        CreateNotificationRequest.Builder requestBuilder = CreateNotificationRequest.newBuilder()
                .addAllUserIds(userIds)
                .setMessage(message)
                .setCreatorUserId(creatorId);

        if (triggerAt != null) {
            Timestamp timestamp = Timestamp.newBuilder()
                    .setSeconds(triggerAt.getEpochSecond())
                    .setNanos(triggerAt.getNano())
                    .build();
            requestBuilder.setTriggerAt(timestamp);
        }

        try {
            log.debug("Sending notification request to {} users", userIds.size());
            CreateNotificationResponse response = notificationStub.createNotification(requestBuilder.build());
            return response.getNotificationsList();
        } catch (StatusRuntimeException e) {
            log.error("gRPC call failed while creating notification. Status: {}, Description: {}",
                    e.getStatus().getCode(), e.getStatus().getDescription());
            throw e;
        }
    }
}
