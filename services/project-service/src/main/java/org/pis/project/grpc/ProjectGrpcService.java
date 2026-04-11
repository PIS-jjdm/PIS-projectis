package org.pis.project.grpc;

import org.pis.project.entities.ProjectEntity;
import org.pis.project.mappers.ProjectMapper;
import org.pis.project.proto.CreateProjectRequest;
import org.pis.project.proto.DeleteProjectRequest;
import org.pis.project.proto.GetProjectRequest;
import org.pis.project.proto.Project;
import org.pis.project.proto.ProjectServiceGrpc;
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
  private final TeamMemberService teamMemberService;
  private final TeamJoinRequestService teamJoinRequestService;

  @Override
  public void getProject(GetProjectRequest request, StreamObserver<Project> responseObserver) {
    try {
      ProjectEntity projectEntity = projectService.getProject(Long.parseLong(request.getProjectId()));
      Project response = projectMapper.toProto(projectEntity);

      responseObserver.onNext(response);
      responseObserver.onCompleted();

    } catch (Exception e) {
      responseObserver.onError(io.grpc.Status.INTERNAL
          .withDescription("Could not create project: " + e.getMessage())
          .asRuntimeException());
    }
  }

  @Override
  public void createProject(CreateProjectRequest request, StreamObserver<Project> responseObserver) {
    try {
      ProjectEntity newProjectEntity = projectMapper.toEntity(request);
      ProjectEntity savedEntity = projectService.createProject(newProjectEntity);
      Project response = projectMapper.toProto(savedEntity);

      responseObserver.onNext(response);
      responseObserver.onCompleted();

    } catch (Exception e) {
      responseObserver.onError(io.grpc.Status.INTERNAL
          .withDescription("Could not create project: " + e.getMessage())
          .asRuntimeException());
    }
  }

  @Override
  public void updateProject(UpdateProjectRequest request, StreamObserver<Project> responseObserver) {
    try {
      ProjectEntity newProjectEntity = projectMapper.toEntity(request);
      ProjectEntity savedEntity = projectService.updateProject(newProjectEntity);
      Project response = projectMapper.toProto(savedEntity);

      responseObserver.onNext(response);
      responseObserver.onCompleted();

    } catch (Exception e) {
      responseObserver.onError(io.grpc.Status.INTERNAL
          .withDescription("Could not update project: " + e.getMessage())
          .asRuntimeException());
    }
  }

  @Override
  public void deleteProject(DeleteProjectRequest request, StreamObserver<Project> responseObserver) {
    try {
      ProjectEntity deletedProject = projectService.deleteProject(Long.parseLong(request.getProjectId()));
      Project response = projectMapper.toProto(deletedProject);

      responseObserver.onNext(response);
      responseObserver.onCompleted();

    } catch (Exception e) {
      responseObserver.onError(io.grpc.Status.INTERNAL
          .withDescription("Could not delete project: " + e.getMessage())
          .asRuntimeException());
    }
  }
}