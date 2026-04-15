package org.pis.project.e2e;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.containsInAnyOrder;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.empty;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;

import java.util.List;
import java.util.stream.Collectors;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.pis.project.proto.DeleteProjectRequest;
import org.pis.project.proto.GetProjectRequest;
import org.pis.project.proto.ListProjectsRequest;
import org.pis.project.proto.ListProjectsResponse;
import org.pis.project.proto.Project;
import org.pis.project.proto.UpdateProjectRequest;
import org.pis.project.repositories.ProjectRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

@ActiveProfiles("test")
@SpringBootTest
public class ProjectGrpcE2ETests extends BaseGrpcE2ETests {

    @Autowired
    private ProjectRepository projectRepository;

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
        Project deletedProject = blockingStub.deleteProject(delReq);

        // Assert: Ensure the response contains the deleted project info
        assertNotNull(deletedProject);
        assertEquals(createdProject.getProjectId(), deletedProject.getProjectId());

        // Verify it was actually removed by trying to list it
        ListProjectsResponse listRes = blockingStub.listProjects(ListProjectsRequest.newBuilder()
                .setSubjectId("SUB-DEL")
                .build());
        assertThat(listRes.getProjectsList(), empty());
    }
}
