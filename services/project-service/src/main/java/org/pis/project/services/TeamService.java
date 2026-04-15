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

@Service
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
        return teamRepository.findById(teamId)
                .orElseThrow(() -> new ResourceNotFoundException("Team not found with id: " + teamId));
    }

    @Transactional
    public TeamEntity createTeam(TeamEntity newTeam, UUID projectId) {
        if (teamMemberRepository.existsByStudentIdAndProjectId(newTeam.getLeaderStudentId(), projectId)) {
            throw new BusinessRuleViolationException("Student is already part of a team in this project.");
        }

        // Fetch the Project
        ProjectEntity project = projectRepository.findById(projectId)
                .orElseThrow(() -> new ResourceNotFoundException("Project not found with id: " + projectId));
        newTeam.setProject(project);

        // Create a team leader
        TeamMemberEntity leaderMember = new TeamMemberEntity();
        leaderMember.setStudentId(newTeam.getLeaderStudentId());
        leaderMember.setProjectId(projectId);
        leaderMember.setTeam(newTeam);

        newTeam.setMembers(new ArrayList<>(List.of(leaderMember)));
        newTeam.setJoinRequests(new ArrayList<>());

        // Cancel any pending join requests for the leader in the same project
        eventPublisher.publishEvent(new StudentJoinedTeamEvent(newTeam.getLeaderStudentId(), projectId));

        return teamRepository.save(newTeam);
    }

    @Transactional
    public TeamEntity deleteTeam(UUID teamId) {
        TeamEntity team = getTeam(teamId);
        teamRepository.deleteById(teamId);
        return team;
    }

    @Transactional
    public TeamEntity leaveTeam(UUID teamId, String studentId) {
        TeamEntity team = getTeam(teamId);
        TeamMemberEntity member = teamMemberRepository.findByStudentIdAndTeamId(studentId, teamId)
                .orElseThrow(
                        () -> new ResourceNotFoundException("Team Membership not found for student: " + studentId));

        // Last member leaving the team, delete the team as well
        if (teamMemberRepository.countByTeamId(teamId) <= 1) {
            return deleteTeam(teamId);
        }

        // If the leader is leaving, assign a new leader
        if (team.getLeaderStudentId().equals(studentId)) {
            TeamMemberEntity newLeader = teamMemberRepository.findById(teamId).stream()
                    .filter(m -> !m.getStudentId().equals(studentId))
                    .findFirst().orElseThrow(
                            () -> new ResourceNotFoundException("No other team members found to assign as leader."));

            team.setLeaderStudentId(newLeader.getStudentId());
            teamRepository.save(team);
        }

        teamMemberRepository.delete(member);
        return team;
    }

    @Transactional
    public TeamEntity changeLeader(UUID teamId, String oldLeaderStudentId, String newLeaderStudentId) {
        TeamEntity team = getTeam(teamId);

        boolean isNewLeaderPartOfTeam = teamMemberRepository.existsByStudentIdAndTeamId(newLeaderStudentId, teamId);
        boolean isFormerLeaderPartOfTeam = team.getLeaderStudentId().equals(oldLeaderStudentId);

        if (!isNewLeaderPartOfTeam) {
            throw new BusinessRuleViolationException("New leader must be a member of the team.");
        } else if (!isFormerLeaderPartOfTeam) {
            throw new BusinessRuleViolationException("Former leader must be the current leader of the team.");
        } else {
            team.setLeaderStudentId(newLeaderStudentId);
            return teamRepository.save(team);
        }
    }

    @Transactional
    public TeamEntity addMember(UUID teamId, String studentId) {

        TeamEntity team = teamRepository.findById(teamId)
                .orElseThrow(() -> new ResourceNotFoundException("Team not found with id: " + teamId));
        ProjectEntity project = team.getProject();

        // TODO: Validate Student Existence
        // userClient.validateStudentExists(studentId);

        // Check team capacity before adding a new member
        long currentMemberCount = teamMemberRepository.countByTeamId(teamId);
        if (currentMemberCount >= project.getMaxStudentsPerTeam()) {
            throw new IllegalStateException("Cannot add member. Team is already at full capacity.");
        }

        // Students can only be part of one team per project
        UUID projectId = project.getId();
        String projectName = project.getTitle();
        if (teamMemberRepository.existsByStudentIdAndProjectId(studentId, projectId)) {
            throw new BusinessRuleViolationException(
                    "Student is already a member of team in project " + projectName);
        }

        // Procceed to add the member to the team
        TeamMemberEntity teamMember = TeamMemberEntity.builder()
                .team(team)
                .studentId(studentId)
                .build();

        // cancel any pending join requests for the student in the same project
        eventPublisher.publishEvent(new StudentJoinedTeamEvent(studentId, projectId));

        team.addMember(teamMember);
        teamMemberRepository.save(teamMember);

        return team;
    }

    @Transactional
    public TeamEntity deleteMember(UUID teamId, String studentId) {
        TeamMemberEntity teamMember = teamMemberRepository.findByStudentIdAndTeamId(studentId, teamId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Team member not found for studentId: " + studentId + " and teamId: " + teamId));

        TeamEntity team = teamMember.getTeam();
        team.removeMember(teamMember);
        teamMemberRepository.delete(teamMember);

        return team;
    }
}
