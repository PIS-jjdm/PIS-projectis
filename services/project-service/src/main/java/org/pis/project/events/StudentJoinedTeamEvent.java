package org.pis.project.events;

import java.util.UUID;

public record StudentJoinedTeamEvent(
        String studentId,
        UUID projectId) {
}
