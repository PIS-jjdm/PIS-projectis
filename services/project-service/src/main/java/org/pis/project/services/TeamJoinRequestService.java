package org.pis.project.services;

import java.util.List;
import java.util.UUID;

import org.pis.project.domain.JoinRequestFilter;
import org.pis.project.entities.TeamEntity;
import org.pis.project.entities.TeamJoinRequestEntity;
import org.pis.project.entities.enums.JoinRequestStatus;
import org.pis.project.events.StudentJoinedTeamEvent;
import org.pis.project.exceptions.BusinessRuleViolationException;
import org.pis.project.exceptions.ResourceNotFoundException;
import org.pis.project.repositories.TeamJoinRequestRepository;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Service
@Slf4j
@RequiredArgsConstructor
public class TeamJoinRequestService {
    private final TeamJoinRequestRepository teamJoinRequestRepository;
    private final TeamService teamService;
    private final ApplicationEventPublisher eventPublisher;

    @Transactional
    public TeamJoinRequestEntity createJoinRequest(TeamJoinRequestEntity joinRequest, UUID teamId) {
        log.info("Student [{}] is requesting to join team [{}]", joinRequest.getRequestorStudentId(), teamId);

        TeamEntity team = teamService.getTeam(teamId);

        TeamJoinRequestEntity newJoinRequest = new TeamJoinRequestEntity();
        newJoinRequest.setTeam(team);
        newJoinRequest.setRequestorStudentId(joinRequest.getRequestorStudentId());
        newJoinRequest.setStatus(JoinRequestStatus.PENDING);
        newJoinRequest.setProjectId(team.getProject().getId());

        TeamJoinRequestEntity saved = teamJoinRequestRepository.save(newJoinRequest);
        log.info("Join request [{}] created for student [{}]", saved.getId(), saved.getRequestorStudentId());
        return saved;
    }

    @Transactional
    public TeamJoinRequestEntity deleteJoinRequest(UUID joinRequestId) {
        log.info("Attempting to delete join request [{}]", joinRequestId);

        TeamJoinRequestEntity joinRequest = teamJoinRequestRepository.findById(joinRequestId)
                .orElseThrow(() -> {
                    log.error("Delete failed: Join request [{}] not found", joinRequestId);
                    return new ResourceNotFoundException("Join request not found with id: " + joinRequestId);
                });

        teamJoinRequestRepository.deleteById(joinRequestId);
        log.info("Successfully deleted join request [{}]", joinRequestId);

        return joinRequest;
    }

    @Transactional
    public TeamJoinRequestEntity resolveToJoinRequest(UUID joinRequestId, boolean accept, String studentId) {
        log.info("Leader [{}] is resolving join request [{}] with decision: [accept={}]", studentId, joinRequestId,
                accept);

        TeamJoinRequestEntity joinRequest = teamJoinRequestRepository.findById(joinRequestId)
                .orElseThrow(() -> {
                    log.error("Resolve failed: Join request [{}] not found", joinRequestId);
                    return new ResourceNotFoundException("Join request not found with id: " + joinRequestId);
                });

        if (!joinRequest.getTeam().getLeaderStudentId().equals(studentId)) {
            log.warn("Unauthorized resolve attempt: Student [{}] is not the leader of team [{}]", studentId,
                    joinRequest.getTeam().getId());
            throw new BusinessRuleViolationException("Only the team leader can resolve join requests");
        }

        joinRequest.setStatus(accept ? JoinRequestStatus.ACCEPTED : JoinRequestStatus.REJECTED);

        eventPublisher.publishEvent(
                new StudentJoinedTeamEvent(joinRequest.getRequestorStudentId(), joinRequest.getProjectId()));

        TeamJoinRequestEntity resolvedRequest = teamJoinRequestRepository.save(joinRequest);
        log.info("Join request [{}] resolved to [{}]", joinRequestId, resolvedRequest.getStatus());
        return resolvedRequest;
    }

    @Transactional(readOnly = true)
    public List<TeamJoinRequestEntity> listJoinRequest(JoinRequestFilter filter) {
        if (filter.requestorStudentId() != null) {
            return teamJoinRequestRepository.findByRequestorStudentId(filter.requestorStudentId());
        }

        if (filter.teamId() != null) {
            UUID teamId = UUID.fromString(filter.teamId());
            return teamJoinRequestRepository.findByTeamId(teamId);
        }

        if (filter.status() != null) {
            return teamJoinRequestRepository.findByStatus(filter.status());
        }

        throw new IllegalArgumentException("Invalid filter criteria");
    }

    @EventListener
    public void handleStudentJoinedTeam(StudentJoinedTeamEvent event) {
        log.info("Handling StudentJoinedTeamEvent: Cancelling other pending requests for student [{}] in project [{}]",
                event.studentId(), event.projectId());

        teamJoinRequestRepository.cancelPendingRequestsForStudentInProject(
                event.studentId(),
                event.projectId());
    }
}
