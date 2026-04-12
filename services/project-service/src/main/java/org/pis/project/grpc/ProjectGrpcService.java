package org.pis.project.grpc;

import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

import org.pis.project.entities.ProjectEntity;
import org.pis.project.entities.TeamEntity;
import org.pis.project.mappers.ProjectMapper;
import org.pis.project.mappers.TeamMapper;
import org.pis.project.proto.ChangeTeamLeaderRequest;
import org.pis.project.proto.CreateProjectRequest;
import org.pis.project.proto.DeleteProjectRequest;
import org.pis.project.proto.GetProjectRequest;
import org.pis.project.proto.LeaveTeamRequest;
import org.pis.project.proto.ListProjectsRequest;
import org.pis.project.proto.ListProjectsResponse;
import org.pis.project.proto.ListTeamsByProjectRequest;
import org.pis.project.proto.ListTeamsByProjectResponse;
import org.pis.project.proto.Project;
import org.pis.project.proto.ProjectServiceGrpc;
import org.pis.project.proto.RegisterTeamRequest;
import org.pis.project.proto.Team;
import org.pis.project.proto.UpdateProjectRequest;
import org.pis.project.services.ProjectService;
import org.pis.project.services.TeamJoinRequestService;
import org.pis.project.services.TeamMemberService;
import org.pis.project.services.TeamService;
import org.springframework.stereotype.Service;

import io.grpc.stub.StreamObserver;
import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class ProjectGrpcService extends ProjectServiceGrpc.ProjectServiceImplBase {

  private final ProjectService projectService;
  private final ProjectMapper projectMapper;

  private final TeamService teamService;
  private final TeamMapper teamMapper;

  private final TeamMemberService teamMemberService;
  private final TeamJoinRequestService teamJoinRequestService;

  @Override
  public void getProject(GetProjectRequest request, StreamObserver<Project> responseObserver) {
    UUID projectId = UUID.fromString(request.getProjectId());
    ProjectEntity projectEntity = projectService.getProject(projectId);

      Project response = projectMapper.toProto(projectEntity);

      responseObserver.onNext(response);
      responseObserver.onCompleted();
  }

  @Override
  public void listProjects(ListProjectsRequest request, StreamObserver<ListProjectsResponse> responseObserver) {
    List<ProjectEntity> projectEntities = projectService.listProjects(request.getSubjectId());

    ListProjectsResponse response = ListProjectsResponse.newBuilder()
        .addAllProjects(projectEntities.stream().map(projectMapper::toProto).collect(Collectors.toList()))
        .build();

    responseObserver.onNext(response);
    responseObserver.onCompleted();
  }

  @Override
  public void createProject(CreateProjectRequest request, StreamObserver<Project> responseObserver) {
      ProjectEntity newProjectEntity = projectMapper.toEntity(request);
      ProjectEntity savedEntity = projectService.createProject(newProjectEntity);

      Project response = projectMapper.toProto(savedEntity);

      responseObserver.onNext(response);
      responseObserver.onCompleted();
  }

  @Override
  public void updateProject(UpdateProjectRequest request, StreamObserver<Project> responseObserver) {
      ProjectEntity newProjectEntity = projectMapper.toEntity(request);
      ProjectEntity savedEntity = projectService.updateProject(newProjectEntity);

      Project response = projectMapper.toProto(savedEntity);

      responseObserver.onNext(response);
      responseObserver.onCompleted();
  }

  @Override
  public void deleteProject(DeleteProjectRequest request, StreamObserver<Project> responseObserver) {
    UUID projectId = UUID.fromString(request.getProjectId());
    ProjectEntity deletedProject = projectService.deleteProject(projectId);

      Project response = projectMapper.toProto(deletedProject);

      responseObserver.onNext(response);
      responseObserver.onCompleted();

  }

  @Override
  public void registerTeam(RegisterTeamRequest request, StreamObserver<Team> responseObserver) {
    TeamEntity newTeam = teamMapper.toEntity(request);
    UUID projectId = UUID.fromString(request.getProjectId());
    TeamEntity savedTeam = teamService.createTeam(newTeam, projectId);

    Team response = teamMapper.toProto(savedTeam);

    responseObserver.onNext(response);
    responseObserver.onCompleted();
  }

  @Override
  public void listTeamsByProject(ListTeamsByProjectRequest request,
      StreamObserver<ListTeamsByProjectResponse> responseObserver) {

    UUID projectId = UUID.fromString(request.getProjectId());
    List<TeamEntity> retrievedTeams = teamService.listTeams(projectId);

    System.err.println("Retrieved " + retrievedTeams.size() + " teams for project ID: " + projectId);
    ListTeamsByProjectResponse response = ListTeamsByProjectResponse.newBuilder()
        .addAllTeams(teamMapper.toProtoList(retrievedTeams))
        .build();

    responseObserver.onNext(response);
    responseObserver.onCompleted();
  }

  @Override
  public void leaveTeam(LeaveTeamRequest request, StreamObserver<Team> responseObserver) {

    UUID teamId = UUID.fromString(request.getTeamId());
    TeamEntity abandonedTeam = teamService.leaveTeam(teamId, request.getStudentId());

    Team response = teamMapper.toProto(abandonedTeam);

    responseObserver.onNext(response);
    responseObserver.onCompleted();
  }

  @Override
  public void changeTeamLeader(ChangeTeamLeaderRequest request, StreamObserver<Team> responseObserver) {

    UUID teamId = UUID.fromString(request.getTeamId());
    String oldLeaderStudentId = request.getOldLeaderStudentId();
    String newLeaderStudentId = request.getNewLeaderStudentId();

    TeamEntity abandonedTeam = teamService.changeLeader(teamId, oldLeaderStudentId, newLeaderStudentId);

    Team response = teamMapper.toProto(abandonedTeam);

    responseObserver.onNext(response);
    responseObserver.onCompleted();
  }
}