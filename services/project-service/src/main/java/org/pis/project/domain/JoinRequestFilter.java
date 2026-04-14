package org.pis.project.domain;

import org.pis.project.entities.enums.JoinRequestStatus;

public record JoinRequestFilter(
        String requestorStudentId,
        String teamId,
        JoinRequestStatus status) {
}