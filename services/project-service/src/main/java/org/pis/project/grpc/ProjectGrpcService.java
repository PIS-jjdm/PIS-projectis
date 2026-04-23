package org.pis.project.grpc;

import java.util.List;
import java.util.UUID;

import org.pis.project.domain.JoinRequestFilter;
import org.pis.project.entities.ProjectEntity;
import org.pis.project.entities.TeamEntity;
import org.pis.project.entities.TeamJoinRequestEntity;
import org.pis.project.mappers.ProjectMapper;
import org.pis.project.mappers.TeamJoinRequestMapper;
import org.pis.project.mappers.TeamMapper;
import org.pis.project.proto.AddTeamMemberRequest;
import org.pis.project.proto.ChangeTeamLeaderRequest;
import org.pis.project.proto.CreateJoinRequestRequest;
import org.pis.project.proto.CreateProjectRequest;
import org.pis.project.proto.DeleteJoinRequestRequest;
import org.pis.project.proto.DeleteProjectRequest;
import org.pis.project.proto.GetProjectRequest;
import org.pis.project.proto.GetTeamRequest;
import org.pis.project.proto.JoinRequest;
import org.pis.project.proto.LeaveTeamRequest;
import org.pis.project.proto.ListJoinRequestsRequest;
import org.pis.project.proto.ListJoinRequestsResponse;
import org.pis.project.proto.ListProjectsRequest;
import org.pis.project.proto.ListProjectsResponse;
import org.pis.project.proto.ListTeamsByProjectRequest;
import org.pis.project.proto.ListTeamsByProjectResponse;
import org.pis.project.proto.Project;
import org.pis.project.proto.ProjectServiceGrpc;
import org.pis.project.proto.RegisterTeamRequest;
import org.pis.project.proto.RemoveTeamMemberRequest;
import org.pis.project.proto.ResolveJoinRequestRequest;
import org.pis.project.proto.Team;
import org.pis.project.proto.UpdateProjectRequest;
import org.pis.project.services.ProjectService;
import org.pis.project.services.TeamJoinRequestService;
import org.pis.project.services.TeamService;
import org.springframework.stereotype.Service;

import common.Common.Ack;
import io.grpc.stub.StreamObserver;
import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class ProjectGrpcService extends ProjectServiceGrpc.ProjectServiceImplBase {

    private final ProjectService projectService;
    private final ProjectMapper projectMapper;

    private final TeamService teamService;
    private final TeamMapper teamMapper;

    private final TeamJoinRequestService teamJoinRequestService;
    private final TeamJoinRequestMapper teamJoinRequestMapper;

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
                .addAllProjects(projectMapper.toProtoList(projectEntities))
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
    public void deleteProject(DeleteProjectRequest request, StreamObserver<Ack> responseObserver) {
        UUID projectId = UUID.fromString(request.getProjectId());
        projectService.deleteProject(projectId);

        Ack response = Ack.newBuilder()
                .setSuccess(true)
                .setMessage("Project deleted")
                .build();

        responseObserver.onNext(response);
        responseObserver.onCompleted();

    }

    @Override
    public void getTeam(GetTeamRequest request, StreamObserver<Team> responseObserver) {
        UUID teamId = UUID.fromString(request.getTeamId());
        TeamEntity retievedTeam = teamService.getTeam(teamId);

        Team response = teamMapper.toProto(retievedTeam);

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

        ListTeamsByProjectResponse response = ListTeamsByProjectResponse.newBuilder()
                .addAllTeams(teamMapper.toListProtoList(retrievedTeams))
                .build();

        responseObserver.onNext(response);
        responseObserver.onCompleted();
    }

    @Override
    public void leaveTeam(LeaveTeamRequest request, StreamObserver<Ack> responseObserver) {

        UUID teamId = UUID.fromString(request.getTeamId());
        teamService.leaveTeam(teamId, request.getStudentId());

        Ack response = Ack.newBuilder().setSuccess(true).build();

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

    @Override
    public void addTeamMember(AddTeamMemberRequest request, StreamObserver<Team> responseObserver) {

        UUID teamId = UUID.fromString(request.getTeamId());
        String studentId = request.getStudentId();

        TeamEntity joinedTeam = teamService.addMember(teamId, studentId);

        Team response = teamMapper.toProto(joinedTeam);

        responseObserver.onNext(response);
        responseObserver.onCompleted();
    }

    @Override
    public void removeTeamMember(RemoveTeamMemberRequest request, StreamObserver<Team> responseObserver) {

        UUID teamId = UUID.fromString(request.getTeamId());
        String studentId = request.getStudentId();

        TeamEntity leftTeam = teamService.removeMember(teamId, studentId);

        Team response = teamMapper.toProto(leftTeam);

        responseObserver.onNext(response);
        responseObserver.onCompleted();
    }

    @Override
    public void createJoinRequest(CreateJoinRequestRequest request, StreamObserver<JoinRequest> responseObserver) {
        UUID teamId = UUID.fromString(request.getTeamId());

        TeamJoinRequestEntity newJoinRequest = teamJoinRequestMapper.toEntity(request);

        TeamJoinRequestEntity savedRequest = teamJoinRequestService.createJoinRequest(newJoinRequest, teamId);
        JoinRequest response = teamJoinRequestMapper.toProto(savedRequest);

        responseObserver.onNext(response);
        responseObserver.onCompleted();
    }

    @Override
    public void deleteJoinRequest(DeleteJoinRequestRequest request, StreamObserver<Ack> responseObserver) {
        UUID joinRequestId = UUID.fromString(request.getJoinRequestId());

        teamJoinRequestService.deleteJoinRequest(joinRequestId);

        Ack response = Ack.newBuilder().setSuccess(true).build();

        responseObserver.onNext(response);
        responseObserver.onCompleted();
    }

    @Override
    public void resolveJoinRequest(ResolveJoinRequestRequest request, StreamObserver<JoinRequest> responseObserver) {
        UUID joinRequestId = UUID.fromString(request.getJoinRequestId());
        boolean accept = request.getAccept();
        String resolverStudentId = request.getResolverStudentId();

        TeamJoinRequestEntity resolvedRequest = teamJoinRequestService.resolveToJoinRequest(joinRequestId, accept,
                resolverStudentId);

        JoinRequest response = teamJoinRequestMapper.toProto(resolvedRequest);

        responseObserver.onNext(response);
        responseObserver.onCompleted();
    }

    @Override
    public void listJoinRequests(ListJoinRequestsRequest request,
            StreamObserver<ListJoinRequestsResponse> responseObserver) {

        JoinRequestFilter filter = teamJoinRequestMapper.toFilter(request);
        List<TeamJoinRequestEntity> retrievedRequests = teamJoinRequestService.listJoinRequest(filter);

        ListJoinRequestsResponse response = ListJoinRequestsResponse.newBuilder()
                .addAllJoinRequests(teamJoinRequestMapper.toProtoList(retrievedRequests))
                .build();

        responseObserver.onNext(response);
        responseObserver.onCompleted();
    }
}
