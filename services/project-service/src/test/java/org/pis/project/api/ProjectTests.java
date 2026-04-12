package org.pis.project.api;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.UUID;

import io.grpc.StatusRuntimeException;
import io.grpc.stub.StreamObserver;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.pis.project.entities.ProjectEntity;
import org.pis.project.grpc.ProjectGrpcService;
import org.pis.project.mappers.ProjectMapper;
import org.pis.project.proto.GetProjectRequest;
import org.pis.project.proto.Project;
import org.pis.project.services.ProjectService;
import org.pis.project.services.TeamJoinRequestService;
import org.pis.project.services.TeamMemberService;
import org.pis.project.services.TeamService;

@ExtendWith(MockitoExtension.class)
class ProjectTests {

    @Mock
    private ProjectService projectService;
    @Mock
    private ProjectMapper projectMapper;

    // Mocked to satisfy @RequiredArgsConstructor, even if unused in current methods
    @Mock
    private TeamService teamService;
    @Mock
    private TeamMemberService teamMemberService;
    @Mock
    private TeamJoinRequestService teamJoinRequestService;

    @Mock
    private StreamObserver<Project> responseObserver;

    @InjectMocks
    private ProjectGrpcService projectGrpcService;

    @Test
    void getProject_Success() {
        // Arrange
        UUID projectId = UUID.randomUUID();
        GetProjectRequest request = GetProjectRequest.newBuilder().setProjectId(projectId.toString()).build();
        ProjectEntity mockEntity = new ProjectEntity();
        Project mockProtoResponse = Project.newBuilder().setProjectId(projectId.toString()).build();

        when(projectService.getProject(projectId)).thenReturn(mockEntity);
        when(projectMapper.toProto(mockEntity)).thenReturn(mockProtoResponse);

        // Act
        projectGrpcService.getProject(request, responseObserver);

        // Assert
        ArgumentCaptor<Project> projectCaptor = ArgumentCaptor.forClass(Project.class);

        // Verify onNext was called with our captured project
        verify(responseObserver).onNext(projectCaptor.capture());
        // Verify the call was completed successfully
        verify(responseObserver).onCompleted();

        // Check that the captured project is the one we expected
        assertEquals(projectId, projectCaptor.getValue().getProjectId());
    }

    @Test
    void getProject_ThrowsException_ReturnsErrorToObserver() {
        // 1. Arrange
        // Passing an unparseable string will trigger a NumberFormatException
        GetProjectRequest request = GetProjectRequest.newBuilder().setProjectId("invalid_id").build();

        // 2. Act
        projectGrpcService.getProject(request, responseObserver);

        // 3. Assert
        ArgumentCaptor<Throwable> errorCaptor = ArgumentCaptor.forClass(Throwable.class);

        // Verify onError was called instead of onNext/onCompleted
        verify(responseObserver).onError(errorCaptor.capture());

        Throwable capturedError = errorCaptor.getValue();
        assertTrue(capturedError instanceof StatusRuntimeException);
        assertTrue(capturedError.getMessage().contains("Could not create project")); // Note: Your code currently says
                                                                                     // "create" in the getProject catch
                                                                                     // block!
    }
}