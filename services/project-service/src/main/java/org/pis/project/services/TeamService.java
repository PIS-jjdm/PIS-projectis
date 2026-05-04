package org.pis.project.services;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import org.hibernate.Hibernate;
import org.pis.project.entities.ProjectEntity;
import org.pis.project.entities.TeamEntity;
import org.pis.project.entities.TeamMemberEntity;
import org.pis.project.events.StudentJoinedTeamEvent;
import org.pis.project.exceptions.BusinessRuleViolationException;
import org.pis.project.exceptions.ResourceNotFoundException;
import org.pis.project.repositories.ProjectRepository;
import org.pis.project.repositories.TeamMemberRepository;
import org.pis.project.repositories.TeamRepository;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Service
@Slf4j
@RequiredArgsConstructor
public class TeamService {
    private final TeamRepository teamRepository;
    private final TeamMemberRepository teamMemberRepository;
    private final ProjectRepository projectRepository;
    private final ApplicationEventPublisher eventPublisher;

    @Transactional(readOnly = true)
    public List<TeamEntity> listTeams(UUID projectId) {
        return teamRepository.findTeamsWithMemberCount(projectId)
                .stream()
                .map(row -> {
                    TeamEntity team = (TeamEntity) row[0];
                    Long count = (Long) row[1];
                    team.setMemberCount(count.intValue());
                    return team;
                })
                .toList();
    }

    @Transactional(readOnly = true)
    public TeamEntity getTeam(UUID teamId) {
        TeamEntity retrievedTeam = teamRepository.findById(teamId)
                .orElseThrow(() -> new ResourceNotFoundException("Team not found with id: " + teamId));
        Hibernate.initialize(retrievedTeam.getProject());
        Hibernate.initialize(retrievedTeam.getMembers());
        Hibernate.initialize(retrievedTeam.getProjectSubmission());
        return retrievedTeam;
    }

    @Transactional
    public TeamEntity createTeam(TeamEntity newTeam, UUID projectId) {
        log.info("Attempting to create team for leader [{}] in project [{}]", newTeam.getLeaderStudentId(), projectId);

        if (teamMemberRepository.existsByStudentIdAndProjectId(newTeam.getLeaderStudentId(), projectId)) {
            log.warn("Failed to create team: Leader [{}] already in a team for project [{}]",
                    newTeam.getLeaderStudentId(), projectId);
            throw new BusinessRuleViolationException("Student is already part of a team in this project.");
        }

        ProjectEntity project = projectRepository.findById(projectId)
                .orElseThrow(() -> {
                    log.error("Failed to create team: Project [{}] not found", projectId);
                    return new ResourceNotFoundException("Project not found with id: " + projectId);
                });

        newTeam.setProject(project);

        TeamMemberEntity leaderMember = new TeamMemberEntity();
        leaderMember.setStudentId(newTeam.getLeaderStudentId());
        leaderMember.setProjectId(projectId);
        leaderMember.setTeam(newTeam);

        newTeam.setMembers(new ArrayList<>(List.of(leaderMember)));
        newTeam.setJoinRequests(new ArrayList<>());

        eventPublisher.publishEvent(new StudentJoinedTeamEvent(newTeam.getLeaderStudentId(), projectId));

        TeamEntity savedTeam = teamRepository.save(newTeam);
        log.info("Successfully created team [{}] with leader [{}]", savedTeam.getId(), savedTeam.getLeaderStudentId());
        return savedTeam;
    }

    @Transactional
    public TeamEntity deleteTeam(UUID teamId) {
        log.info("Attempting to delete team [{}]", teamId);
        TeamEntity team = getTeam(teamId);
        teamRepository.deleteById(teamId);
        log.info("Successfully deleted team [{}]", teamId);
        return team;
    }

    @Transactional
    public TeamEntity leaveTeam(UUID teamId, String studentId) {
        log.info("Student [{}] attempting to leave team [{}]", studentId, teamId);

        TeamEntity team = getTeam(teamId);
        TeamMemberEntity member = teamMemberRepository.findByStudentIdAndTeamId(studentId, teamId)
                .orElseThrow(() -> {
                    log.warn("Failed leave operation: Student [{}] not found in team [{}]", studentId, teamId);
                    return new ResourceNotFoundException("Team Membership not found for student: " + studentId);
                });

        if (teamMemberRepository.countByTeamId(teamId) <= 1) {
            log.info("Last member [{}] leaving; deleting team [{}]", studentId, teamId);
            return deleteTeam(teamId);
        }

        String oldLeaderId = team.getLeaderStudentId();

        // leader leaving team -> new leader assigned
        if (oldLeaderId.equals(studentId)) {
            TeamMemberEntity newLeader = teamMemberRepository.findByTeamId(teamId).stream()
                    .filter(m -> !m.getStudentId().equals(studentId))
                    .findFirst().orElseThrow(
                            () -> new ResourceNotFoundException("No other team members found to assign as leader."));

            log.info("Leader leaving team [{}]; promoting student [{}] to leader", teamId, newLeader.getStudentId());
            team.setLeaderStudentId(newLeader.getStudentId());
            team = teamRepository.save(team);
        }

        team.removeMember(member);
        Hibernate.initialize(team.getMembers());

        log.info("Student [{}] successfully left team [{}]", studentId, teamId);
        return team;
    }

    @Transactional
    public TeamEntity changeLeader(UUID teamId, String oldLeaderStudentId, String newLeaderStudentId) {
        log.info("Attempting to change leader of team [{}] from [{}] to [{}]", teamId, oldLeaderStudentId,
                newLeaderStudentId);

        TeamEntity team = getTeam(teamId);

        boolean isNewLeaderPartOfTeam = teamMemberRepository.existsByStudentIdAndTeamId(newLeaderStudentId, teamId);
        boolean isFormerLeaderPartOfTeam = team.getLeaderStudentId().equals(oldLeaderStudentId);

        if (!isNewLeaderPartOfTeam) {
            log.warn("Leader change failed: New leader [{}] is not in team [{}]", newLeaderStudentId, teamId);
            throw new BusinessRuleViolationException("New leader must be a member of the team.");
        } else if (!isFormerLeaderPartOfTeam) {
            log.warn("Leader change failed: [{}] is not the current leader of team [{}]", oldLeaderStudentId, teamId);
            throw new BusinessRuleViolationException("Former leader must be the current leader of the team.");
        }

        team.setLeaderStudentId(newLeaderStudentId);
        TeamEntity updatedEntity = teamRepository.save(team);
        Hibernate.initialize(updatedEntity.getMembers());

        log.info("Successfully changed leader of team [{}] to [{}]", teamId, newLeaderStudentId);
        return updatedEntity;
    }

    @Transactional
    public TeamEntity addMember(UUID teamId, String studentId) {
        log.info("Attempting to add student [{}] to team [{}]", studentId, teamId);

        TeamEntity team = teamRepository.findById(teamId)
                .orElseThrow(() -> {
                    log.error("Failed to add member: Team [{}] not found", teamId);
                    return new ResourceNotFoundException("Team not found with id: " + teamId);
                });
        ProjectEntity project = team.getProject();

        long currentMemberCount = teamMemberRepository.countByTeamId(teamId);
        if (currentMemberCount >= project.getMaxStudentsPerTeam()) {
            log.warn("Failed to add student [{}]: Team [{}] has reached max capacity of {}",
                    studentId, teamId, project.getMaxStudentsPerTeam());
            throw new IllegalStateException("Cannot add member. Team is already at full capacity.");
        }

        UUID projectId = project.getId();
        if (teamMemberRepository.existsByStudentIdAndProjectId(studentId, projectId)) {
            log.warn("Failed to add student [{}]: Already in a team for project [{}]", studentId, projectId);
            throw new BusinessRuleViolationException(
                    "Student is already a member of team in project " + project.getTitle());
        }

        TeamMemberEntity teamMember = TeamMemberEntity.builder()
                .team(team)
                .studentId(studentId)
                .projectId(projectId)
                .build();

        eventPublisher.publishEvent(new StudentJoinedTeamEvent(studentId, projectId));

        team.addMember(teamMember);
        teamMemberRepository.save(teamMember);

        log.info("Successfully added student [{}] to team [{}]", studentId, teamId);

        Hibernate.initialize(team.getMembers());
        return team;
    }

    @Transactional
    public TeamEntity removeMember(UUID teamId, String studentId) {
        log.info("Attempting to remove student [{}] from team [{}]", studentId, teamId);

        TeamMemberEntity teamMember = teamMemberRepository.findByStudentIdAndTeamId(studentId, teamId)
                .orElseThrow(() -> {
                    log.warn("Failed to remove member: Student [{}] not found in team [{}]", studentId, teamId);
                    return new ResourceNotFoundException(
                            "Team member not found for studentId: " + studentId + " and teamId: " + teamId);
                });

        TeamEntity team = teamMember.getTeam();
        team.removeMember(teamMember);

        Hibernate.initialize(team.getProject());
        Hibernate.initialize(team.getMembers());
        log.info("Successfully removed student [{}] from team [{}]", studentId, teamId);
        return team;
    }
}
