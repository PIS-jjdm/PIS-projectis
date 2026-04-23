package org.pis.project.e2e;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.containsInAnyOrder;
import static org.hamcrest.Matchers.hasSize;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.pis.project.entities.ProjectEntity;
import org.pis.project.entities.TeamEntity;
import org.pis.project.entities.TeamJoinRequestEntity;
import org.pis.project.entities.TeamMemberEntity;
import org.pis.project.entities.enums.JoinRequestStatus;
import org.pis.project.proto.CreateProjectRequest;
import org.pis.project.proto.DeleteProjectRequest;
import org.pis.project.proto.GetProjectRequest;
import org.pis.project.proto.ListProjectsRequest;
import org.pis.project.proto.ListProjectsResponse;
import org.pis.project.proto.Project;
import org.pis.project.proto.UpdateProjectRequest;
import org.pis.project.repositories.ProjectRepository;
import org.pis.project.repositories.TeamJoinRequestRepository;
import org.pis.project.repositories.TeamMemberRepository;
import org.pis.project.repositories.TeamRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import io.grpc.Status;
import io.grpc.StatusRuntimeException;

@SpringBootTest
public class ProjectGrpcE2ETests extends BaseGrpcE2ETests {

    @Autowired
    private ProjectRepository projectRepository;

    @Autowired
    private TeamRepository teamRepository;

    @Autowired
    private TeamMemberRepository teamMemberRepository;

    @Autowired
    private TeamJoinRequestRepository teamJoinRequestRepository;

    @BeforeEach
    public void setup() {
        projectRepository.deleteAll();
    }

    @Test
    public void testCreateProject_Success() {
        // Act
        Project response = blockingStub.createProject(createProjectRequest);

        // Assert
        assertNotNull(response);
        assertNotNull(response.getProjectId());
        assertEquals("Advanced Software Engineering", response.getTitle());
        assertEquals("Final semester project", response.getDescription());
        assertEquals("teacherId", response.getTeacherId());
        assertEquals(4, response.getMaxStudentsPerTeam());
        assertEquals("SUB", response.getSubjectId());
    }

    @Test
    public void testGetProject_Success() {
        // Arrange
        Project createdProject = blockingStub.createProject(createProjectRequest);

        // Act
        GetProjectRequest getReq = GetProjectRequest.newBuilder()
                .setProjectId(createdProject.getProjectId())
                .build();
        Project fetchedProject = blockingStub.getProject(getReq);

        // Assert
        assertNotNull(fetchedProject);
        assertEquals(createdProject.getProjectId(), fetchedProject.getProjectId());
        assertEquals("Advanced Software Engineering", fetchedProject.getTitle());
    }

    @Test
    public void testCreateProject_InvalidDateRange_ThrowsBusinessRuleViolationException() {
        // Arrange
        CreateProjectRequest invalidReq = createProjectRequest.toBuilder()
                .setEndDate(createTimestamp(-1))
                .build();

        // Act & Assert: Catch the StatusRuntimeException
        StatusRuntimeException exception = assertThrows(StatusRuntimeException.class, () -> {
            blockingStub.createProject(invalidReq);
        });

        // Assert
        assertEquals(Status.Code.FAILED_PRECONDITION, exception.getStatus().getCode());
    }

    @Test
    public void testUpdateProject_Success() {
        // Arrange
        Project createdProject = blockingStub.createProject(createProjectRequest);

        // Act
        UpdateProjectRequest updateReq = UpdateProjectRequest.newBuilder()
                .setProjectId(createdProject.getProjectId())
                .setTitle("New Title")
                .setDescription("New Description")
                .setMaxStudentsPerTeam(5)
                .build();
        Project updatedProject = blockingStub.updateProject(updateReq);

        // Assert
        assertNotNull(updatedProject);
        assertEquals(createdProject.getProjectId(), updatedProject.getProjectId());
        assertEquals("New Title", updatedProject.getTitle());
        assertEquals("New Description", updatedProject.getDescription());
        assertEquals(5, updatedProject.getMaxStudentsPerTeam());

        // Verify unchanged fields carried over
        assertEquals("teacherId", updatedProject.getTeacherId());
        assertEquals("SUB", updatedProject.getSubjectId());
    }

    @Test
    public void testListProjects_Success() {
        // Arrange
        String targetSubject = "SUB-LIST";

        // Create 2 projects for the target subject
        blockingStub.createProject(createProjectRequest.toBuilder()
                .setTitle("Project Alpha")
                .setSubjectId(targetSubject)
                .build());
        blockingStub.createProject(createProjectRequest.toBuilder()
                .setTitle("Project Beta")
                .setSubjectId(targetSubject)
                .build());

        // Create 1 project for a different subject (should be filtered out)
        blockingStub.createProject(createProjectRequest.toBuilder()
                .setTitle("Project Gamma")
                .setSubjectId("SUB-OTHER")
                .build());

        // Act
        ListProjectsRequest listReq = ListProjectsRequest.newBuilder()
                .setSubjectId(targetSubject)
                .build();
        ListProjectsResponse listRes = blockingStub.listProjects(listReq);

        // Assert
        assertNotNull(listRes);
        assertEquals(2, listRes.getProjectsList().size());
        assertThat(listRes.getProjectsList(), hasSize(2));

        List<String> titles = listRes.getProjectsList().stream()
                .map(Project::getTitle) // or .map(Project::title) for proto
                .collect(Collectors.toList());
        assertThat(titles, containsInAnyOrder("Project Alpha", "Project Beta"));
    }

    @Test
    public void testDeleteProject_Success() {
        // Arrange
        Project createdProject = blockingStub.createProject(createProjectRequest);

        // Act
        DeleteProjectRequest delReq = DeleteProjectRequest.newBuilder()
                .setProjectId(createdProject.getProjectId())
                .build();

        blockingStub.deleteProject(delReq);

        StatusRuntimeException ex = assertThrows(StatusRuntimeException.class, () -> {
            blockingStub.getProject(
                    GetProjectRequest.newBuilder()
                            .setProjectId(createdProject.getProjectId())
                            .build());
        });

        assertEquals(Status.Code.NOT_FOUND, ex.getStatus().getCode());
    }

    @Test
    public void testDeleteProject_CascadesToTeamsMembersAndJoinRequests() {
        // Arrange: 1. Create the Project via gRPC
        Project createdProjectProto = blockingStub.createProject(createProjectRequest);
        UUID projectId = UUID.fromString(createdProjectProto.getProjectId());

        // Fetch the created ProjectEntity to establish JPA relationships
        ProjectEntity projectEntity = projectRepository.findById(projectId).orElseThrow(
                () -> new RuntimeException("Project not found in DB after creation"));

        // Arrange: 2. Insert Team using Repository
        TeamEntity team = TeamEntity.builder()
                .name("Cascade Test Team")
                .leaderStudentId("leader1")
                .project(projectEntity)
                .build();
        team = teamRepository.save(team);

        // Arrange: 3. Insert TeamMember using Repository
        TeamMemberEntity member = TeamMemberEntity.builder()
                .studentId("student1")
                .projectId(projectId)
                .team(team)
                .build();
        teamMemberRepository.save(member);

        // Arrange: 4. Insert TeamJoinRequest using Repository
        TeamJoinRequestEntity joinRequest = TeamJoinRequestEntity.builder()
                .status(JoinRequestStatus.PENDING) // Adjust based on your actual enum
                .requestorStudentId("hopeful1")
                .projectId(projectId)
                .team(team)
                .build();
        teamJoinRequestRepository.save(joinRequest);

        // Pre-Assert: Verify database is populated correctly before deletion
        assertEquals(1, projectRepository.count());
        assertEquals(1, teamRepository.count());
        assertEquals(1, teamMemberRepository.count());
        assertEquals(1, teamJoinRequestRepository.count());

        // Act: Delete the Project via gRPC
        DeleteProjectRequest delReq = DeleteProjectRequest.newBuilder()
                .setProjectId(createdProjectProto.getProjectId())
                .build();
        blockingStub.deleteProject(delReq);

        // Assert: Verify cascading deletes using Repositories
        assertEquals(0, projectRepository.count(), "Project should be deleted");
        assertEquals(0, teamRepository.count(), "Teams should be cascade deleted");
        assertEquals(0, teamMemberRepository.count(), "Team members should be cascade deleted");
        assertEquals(0, teamJoinRequestRepository.count(), "Team join requests should be cascade deleted");
    }
}
