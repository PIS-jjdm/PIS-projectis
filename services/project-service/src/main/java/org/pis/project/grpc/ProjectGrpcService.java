package org.pis.project.grpc;

import java.util.List;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.stream.Collectors;

import org.pis.project.clients.AuthClientService;
import org.pis.project.clients.EvaluationClientService;
import org.pis.project.clients.NotificationClientService;
import org.pis.project.clients.SubjectClientService;
import org.pis.project.domain.JoinRequestFilter;
import org.pis.project.entities.ProjectEntity;
import org.pis.project.entities.ProjectSubmissionEntity;
import org.pis.project.entities.TeamEntity;
import org.pis.project.entities.TeamJoinRequestEntity;
import org.pis.project.grpc.interceptors.AuthenticationInterceptor;
import org.pis.project.mappers.ProjectMapper;
import org.pis.project.mappers.ProjectSubmissionMapper;
import org.pis.project.mappers.TeamJoinRequestMapper;
import org.pis.project.mappers.TeamMapper;
import org.pis.project.proto.AddTeamMemberRequest;
import org.pis.project.proto.ChangeTeamLeaderRequest;
import org.pis.project.proto.CreateJoinRequestRequest;
import org.pis.project.proto.CreateProjectRequest;
import org.pis.project.proto.DeleteJoinRequestRequest;
import org.pis.project.proto.DeleteProjectRequest;
import org.pis.project.proto.DeleteSubmissionRequest;
import org.pis.project.proto.DownloadSubmissionRequest;
import org.pis.project.proto.FileChunk;
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
import org.pis.project.proto.ProjectSubmission;
import org.pis.project.proto.RegisterTeamRequest;
import org.pis.project.proto.RemoveTeamMemberRequest;
import org.pis.project.proto.ResolveJoinRequestRequest;
import org.pis.project.proto.SubmitProjectRequest;
import org.pis.project.proto.Team;
import org.pis.project.proto.TeamDetail;
import org.pis.project.proto.UpdateProjectRequest;
import org.pis.project.services.ProjectService;
import org.pis.project.services.ProjectSubmissionService;
import org.pis.project.services.TeamJoinRequestService;
import org.pis.project.services.TeamService;
import org.pis.project.utils.JwtUtils;
import org.springframework.stereotype.Service;

import com.google.protobuf.ByteString;

import auth.Auth.User;
import common.Common.Ack;
import eval.Eval.ProjectEvaluation;
import io.grpc.stub.StreamObserver;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Service
@Slf4j
@RequiredArgsConstructor
public class ProjectGrpcService extends ProjectServiceGrpc.ProjectServiceImplBase {

    private final ProjectService projectService;
    private final ProjectMapper projectMapper;

    private final TeamService teamService;
    private final TeamMapper teamMapper;

    private final TeamJoinRequestService teamJoinRequestService;
    private final TeamJoinRequestMapper teamJoinRequestMapper;

    private final ProjectSubmissionService projectSubmissionService;
    private final ProjectSubmissionMapper projectSubmissionMapper;

    private final EvaluationClientService evaluationClientService;
    private final AuthClientService authClientService;
    private final SubjectClientService subjectClientService;
    private final NotificationClientService notificationClient;

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

        // Capture data for Async
        JwtUtils.UserContext ctx = AuthenticationInterceptor.USER_CONTEXT_KEY.get();
        String currentUserId = ctx.userId();
        String subjectId = savedEntity.getSubjectId(); // Assuming ProjectEntity has subjectId
        String projectName = savedEntity.getTitle();

        Project response = projectMapper.toProto(savedEntity);
        responseObserver.onNext(response);
        responseObserver.onCompleted();

        // Async Notification
        CompletableFuture.runAsync(() -> {
            try {
                subject.SubjectOuterClass.Subject subject = subjectClientService.getSubject(subjectId);
                notificationClient.createNotification(
                        subject.getUserIdsList(),
                        String.format("A new project '%s' has been created in subject %s.", projectName,
                                subject.getName()),
                        currentUserId, null);
            } catch (Exception e) {
                log.error("Failed to send project creation notification", e);
            }
        });
    }

    @Override
    public void updateProject(UpdateProjectRequest request, StreamObserver<Project> responseObserver) {
        ProjectEntity newProjectEntity = projectMapper.toEntity(request);
        ProjectEntity savedEntity = projectService.updateProject(newProjectEntity);

        // Capture data
        JwtUtils.UserContext ctx = AuthenticationInterceptor.USER_CONTEXT_KEY.get();
        String currentUserId = ctx.userId();
        String subjectId = savedEntity.getSubjectId();
        String projectName = savedEntity.getTitle();

        Project response = projectMapper.toProto(savedEntity);
        responseObserver.onNext(response);
        responseObserver.onCompleted();

        // Async Notification
        CompletableFuture.runAsync(() -> {
            try {
                subject.SubjectOuterClass.Subject subject = subjectClientService.getSubject(subjectId);
                notificationClient.createNotification(
                        subject.getUserIdsList(),
                        String.format("Project '%s' in subject %s has been updated.", projectName, subject.getName()),
                        currentUserId, null);
            } catch (Exception e) {
                log.error("Failed to send project update notification", e);
            }
        });
    }

    @Override
    public void deleteProject(DeleteProjectRequest request, StreamObserver<Ack> responseObserver) {
        UUID projectId = UUID.fromString(request.getProjectId());

        ProjectEntity deletedProject = projectService.deleteProject(projectId);
        String subjectId = deletedProject.getSubjectId();
        String projectName = deletedProject.getTitle();

        JwtUtils.UserContext ctx = AuthenticationInterceptor.USER_CONTEXT_KEY.get();
        String currentUserId = ctx.userId();

        Ack response = Ack.newBuilder()
                .setSuccess(true)
                .setMessage("Project deleted")
                .build();
        responseObserver.onNext(response);
        responseObserver.onCompleted();

        // Async Notification
        CompletableFuture.runAsync(() -> {
            try {
                subject.SubjectOuterClass.Subject subject = subjectClientService.getSubject(subjectId);
                notificationClient.createNotification(
                        subject.getUserIdsList(),
                        String.format("Project '%s' in subject %s has been deleted.", projectName, subject.getName()),
                        currentUserId, null);
            } catch (Exception e) {
                log.error("Failed to send project deletion notification", e);
            }
        });
    }

    @Override
    public void getTeam(GetTeamRequest request, StreamObserver<TeamDetail> responseObserver) {
        UUID teamId = UUID.fromString(request.getTeamId());
        TeamEntity retrievedTeam = teamService.getTeam(teamId);

        ProjectEvaluation evaluation = evaluationClientService
                .getEvaluationDetail(retrievedTeam.getProject().getId(), retrievedTeam.getId(), null)
                .orElse(null);

        List<User> teamMembers = retrievedTeam.getMembers().stream()
                .map(member -> authClientService.getUser(member.getStudentId())).collect(Collectors.toList());

        TeamDetail response = teamMapper.toProtoDetail(retrievedTeam, evaluation, teamMembers);

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
        TeamEntity team = teamService.leaveTeam(teamId, request.getStudentId());

        Ack response = Ack.newBuilder().setSuccess(true).build();

        JwtUtils.UserContext ctx = AuthenticationInterceptor.USER_CONTEXT_KEY.get();

        responseObserver.onNext(response);
        responseObserver.onCompleted();

        CompletableFuture.runAsync(() -> {
            try {
                var user = authClientService.getUser(request.getStudentId());
                String studentName = String.format("%s %s", user.getFirstname(), user.getLastname());
                String projectName = team.getProject().getTitle();
                subject.SubjectOuterClass.Subject subject = subjectClientService
                        .getSubject(team.getProject().getSubjectId());

                if (ctx.userId() == request.getStudentId()) {
                    notificationClient.createNotification(
                            List.of(team.getLeaderStudentId()),
                            String.format(
                                    "You have been promoted to leader in team '%s' for project '%s' in subject %s because the previous leader left.",
                                    team.getName(), projectName, subject.getName()),
                            ctx.userId(), null);
                } else {
                    notificationClient.createNotification(
                            List.of(team.getLeaderStudentId()),
                            String.format("Student %s has left your team '%s' for project '%s' in subject %s.",
                                    studentName, team.getName(), projectName, subject.getName()),
                            ctx.userId(), null);
                }
            } catch (Exception e) {
                log.error("Failed to send leave team notification", e);
            }
        });

    }

    @Override
    public void changeTeamLeader(ChangeTeamLeaderRequest request, StreamObserver<Team> responseObserver) {

        UUID teamId = UUID.fromString(request.getTeamId());
        String oldLeaderStudentId = request.getOldLeaderStudentId();
        String newLeaderStudentId = request.getNewLeaderStudentId();

        // check if user exists
        authClientService.getUser(newLeaderStudentId);

        TeamEntity abandonedTeam = teamService.changeLeader(teamId, oldLeaderStudentId, newLeaderStudentId);

        Team response = teamMapper.toProto(abandonedTeam);

        responseObserver.onNext(response);
        responseObserver.onCompleted();

        // Notify the new leader
        CompletableFuture.runAsync(() -> {
            try {
                String projectName = abandonedTeam.getProject().getTitle();
                subject.SubjectOuterClass.Subject subject = subjectClientService
                        .getSubject(abandonedTeam.getProject().getSubjectId());
                notificationClient.createNotification(
                        List.of(newLeaderStudentId),
                        String.format(
                                "You have been appointed as the new team leader of '%s' for project '%s' in subject %s.",
                                abandonedTeam.getName(), projectName, subject.getName()),
                        oldLeaderStudentId, null);

            } catch (Exception e) {
                log.error("Failed to send leave team notification", e);
            }
        });

    }

    @Override
    public void addTeamMember(AddTeamMemberRequest request, StreamObserver<Team> responseObserver) {
        UUID teamId = UUID.fromString(request.getTeamId());
        String studentId = request.getStudentId();

        // check if user exists
        authClientService.getUser(studentId);

        TeamEntity joinedTeam = teamService.addMember(teamId, studentId);

        // Capture context variables for the async thread
        JwtUtils.UserContext ctx = AuthenticationInterceptor.USER_CONTEXT_KEY.get();
        String currentUserId = ctx.userId();
        String teamName = joinedTeam.getName();
        String projectName = joinedTeam.getProject().getTitle();
        String subjectId = joinedTeam.getProject().getSubjectId();

        Team response = teamMapper.toProto(joinedTeam);
        responseObserver.onNext(response);
        responseObserver.onCompleted();

        CompletableFuture.runAsync(() -> {
            try {
                subject.SubjectOuterClass.Subject subject = subjectClientService.getSubject(subjectId);
                notificationClient.createNotification(
                        List.of(studentId),
                        String.format("You have been added to team '%s' for project '%s' in subject %s.",
                                teamName, projectName, subject.getName()),
                        currentUserId, null);
            } catch (Exception e) {
                log.error("Failed to send add-member notification for student: {}", studentId, e);
            }
        });
    }

    @Override
    public void removeTeamMember(RemoveTeamMemberRequest request, StreamObserver<Team> responseObserver) {

        UUID teamId = UUID.fromString(request.getTeamId());
        String studentId = request.getStudentId();

        TeamEntity leftTeam = teamService.removeMember(teamId, studentId);

        // Capture context variables for the async thread
        JwtUtils.UserContext ctx = AuthenticationInterceptor.USER_CONTEXT_KEY.get();
        String currentUserId = ctx.userId();
        String teamName = leftTeam.getName();
        String projectName = leftTeam.getProject().getTitle();
        String subjectId = leftTeam.getProject().getSubjectId();

        Team response = teamMapper.toProto(leftTeam);
        responseObserver.onNext(response);
        responseObserver.onCompleted();

        CompletableFuture.runAsync(() -> {
            try {
                subject.SubjectOuterClass.Subject subject = subjectClientService.getSubject(subjectId);
                notificationClient.createNotification(
                        List.of(studentId),
                        String.format("You have been removed from team '%s' for project '%s' in subject %s.",
                                teamName, projectName, subject.getName()),
                        currentUserId, null);
            } catch (Exception e) {
                log.error("Failed to send remove-member notification for student: {}", studentId, e);
            }
        });
    }

    @Override
    public void createJoinRequest(CreateJoinRequestRequest request, StreamObserver<JoinRequest> responseObserver) {
        UUID teamId = UUID.fromString(request.getTeamId());

        TeamJoinRequestEntity newJoinRequest = teamJoinRequestMapper.toEntity(request);

        TeamJoinRequestEntity savedRequest = teamJoinRequestService.createJoinRequest(newJoinRequest, teamId);

        // Capture data for Async block
        JwtUtils.UserContext ctx = AuthenticationInterceptor.USER_CONTEXT_KEY.get();
        String currentUserId = ctx.userId();
        String leaderId = savedRequest.getTeam().getLeaderStudentId();
        String teamName = savedRequest.getTeam().getName();
        String requestorId = savedRequest.getRequestorStudentId();
        String projectName = savedRequest.getTeam().getProject().getTitle();
        String subjectId = savedRequest.getTeam().getProject().getSubjectId();

        JoinRequest response = teamJoinRequestMapper.toProto(savedRequest);
        responseObserver.onNext(response);
        responseObserver.onCompleted();

        // 4. Async Notification
        CompletableFuture.runAsync(() -> {
            try {
                subject.SubjectOuterClass.Subject subject = subjectClientService.getSubject(subjectId);
                notificationClient.createNotification(
                        List.of(leaderId),
                        String.format(
                                "New join request for team '%s' (project '%s' in subject %s) from student %s",
                                teamName, projectName, subject.getName(), requestorId),
                        currentUserId, null);
            } catch (Exception e) {
                log.error("Failed to send join request notification", e);
            }
        });
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

        // Capture data for Async block
        JwtUtils.UserContext ctx = AuthenticationInterceptor.USER_CONTEXT_KEY.get();
        String currentUserId = ctx.userId();
        String targetStudentId = resolvedRequest.getRequestorStudentId();
        String teamName = resolvedRequest.getTeam().getName();
        String status = resolvedRequest.getStatus().toString();

        JoinRequest response = teamJoinRequestMapper.toProto(resolvedRequest);
        responseObserver.onNext(response);
        responseObserver.onCompleted();

        // Async Notification
        CompletableFuture.runAsync(() -> {
            try {
                notificationClient.createNotification(
                        List.of(targetStudentId),
                        String.format("Your application to team %s was %s", teamName, status),
                        currentUserId, null);
            } catch (Exception e) {
                log.error("Failed to send resolve request notification", e);
            }
        });
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

    @Override
    public void submitProject(SubmitProjectRequest request,
            StreamObserver<ProjectSubmission> responseObserver) {
        UUID teamId = UUID.fromString(request.getTeamId());
        log.info("gRPC submitProject called for team [{}]", teamId);

        ProjectSubmissionEntity saved = projectSubmissionService.submit(
                teamId,
                request.getFileData().toByteArray(),
                request.getFileName(),
                request.getContentType(),
                request.getFileSize());

        responseObserver.onNext(projectSubmissionMapper.toProto(saved));
        responseObserver.onCompleted();
    }

    @Override
    public void deleteSubmission(DeleteSubmissionRequest request,
            StreamObserver<Ack> responseObserver) {
        UUID teamId = UUID.fromString(request.getTeamId());
        log.info("gRPC deleteSubmission called for team [{}]", teamId);

        projectSubmissionService.deleteSubmission(teamId);

        responseObserver.onNext(Ack.newBuilder()
                .setSuccess(true)
                .setMessage("Submission deleted successfully")
                .build());
        responseObserver.onCompleted();
    }

    @Override
    public void downloadSubmission(DownloadSubmissionRequest request,
            StreamObserver<FileChunk> responseObserver) {
        UUID teamId = UUID.fromString(request.getTeamId());
        log.info("gRPC downloadSubmission called for team [{}]", teamId);

        ProjectSubmissionEntity submission = projectSubmissionService.getSubmission(teamId);

        int chunkSize = 1024 * 64; // 64KB chunks
        byte[] data = submission.getFileData();

        for (int offset = 0; offset < data.length; offset += chunkSize) {
            int length = Math.min(chunkSize, data.length - offset);
            FileChunk chunk = FileChunk.newBuilder()
                    .setData(ByteString.copyFrom(data, offset, length))
                    .setFileName(offset == 0 ? submission.getFileName() : "")
                    .setContentType(offset == 0 ? submission.getContentType() : "")
                    .build();
            responseObserver.onNext(chunk);
        }

        responseObserver.onCompleted();
    }
}
