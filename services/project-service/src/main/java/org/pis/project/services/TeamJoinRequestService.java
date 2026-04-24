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

@Service
@RequiredArgsConstructor
public class TeamJoinRequestService {
    private final TeamJoinRequestRepository teamJoinRequestRepository;
    private final TeamService teamService;
    private final ApplicationEventPublisher eventPublisher;

    @Transactional
    public TeamJoinRequestEntity createJoinRequest(TeamJoinRequestEntity joinRequest, UUID teamId) {
        TeamEntity team = teamService.getTeam(teamId);

        TeamJoinRequestEntity newJoinRequest = new TeamJoinRequestEntity();
        newJoinRequest.setTeam(team);
        newJoinRequest.setRequestorStudentId(joinRequest.getRequestorStudentId());
        newJoinRequest.setStatus(JoinRequestStatus.PENDING);

        newJoinRequest.setProjectId(team.getProject().getId());

        TeamJoinRequestEntity save = teamJoinRequestRepository.save(newJoinRequest);
        return save;
    }

    @Transactional
    public TeamJoinRequestEntity deleteJoinRequest(UUID joinRequestId) {
        TeamJoinRequestEntity joinRequest = teamJoinRequestRepository.findById(joinRequestId)
                .orElseThrow(() -> new RuntimeException("Join request not found with id: " + joinRequestId));

        teamJoinRequestRepository.deleteById(joinRequestId);

        return joinRequest;
    }

    @Transactional
    public TeamJoinRequestEntity resolveToJoinRequest(UUID joinRequestId, boolean accept, String studentId) {
        TeamJoinRequestEntity joinRequest = teamJoinRequestRepository.findById(joinRequestId)
                .orElseThrow(() -> new ResourceNotFoundException("Join request not found with id: " + joinRequestId));

        if (!joinRequest.getTeam().getLeaderStudentId().equals(studentId)) {
            throw new BusinessRuleViolationException("Only the team leader can resolve join requests");
        }

        joinRequest.setStatus(accept ? JoinRequestStatus.ACCEPTED : JoinRequestStatus.REJECTED);

        eventPublisher.publishEvent(
                new StudentJoinedTeamEvent(joinRequest.getRequestorStudentId(), joinRequest.getProjectId()));

        TeamJoinRequestEntity resolvedRequest = teamJoinRequestRepository.save(joinRequest);
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
        teamJoinRequestRepository.cancelPendingRequestsForStudentInProject(
                event.studentId(),
                event.projectId());
    }
}
