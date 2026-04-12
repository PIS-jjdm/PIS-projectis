package org.pis.project.services;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import org.pis.project.entities.ProjectEntity;
import org.pis.project.entities.TeamEntity;
import org.pis.project.entities.TeamMemberEntity;
import org.pis.project.exceptions.BusinessRuleViolationException;
import org.pis.project.exceptions.ResourceNotFoundException;
import org.pis.project.repositories.ProjectRepository;
import org.pis.project.repositories.TeamMemberRepository;
import org.pis.project.repositories.TeamRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class TeamService {
  private final TeamRepository teamRepository;
  private final TeamMemberRepository teamMemberRepository;
  private final ProjectRepository projectRepository;

  @Transactional(readOnly = true)
  public List<TeamEntity> listTeams(UUID projectId) {
    return teamRepository.findByProjectId(projectId);
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

    // Create the Leader Member
    TeamMemberEntity leaderMember = new TeamMemberEntity();
    leaderMember.setStudentId(newTeam.getLeaderStudentId());
    leaderMember.setProjectId(projectId);
    leaderMember.setTeam(newTeam);

    newTeam.setMembers(new ArrayList<>(List.of(leaderMember)));
    newTeam.setJoinRequests(new ArrayList<>());

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
}
