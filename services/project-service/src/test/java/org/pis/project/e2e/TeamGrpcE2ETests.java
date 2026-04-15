package org.pis.project.e2e;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.containsInAnyOrder;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import java.util.stream.Collectors;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.pis.project.proto.AddTeamMemberRequest;
import org.pis.project.proto.ChangeTeamLeaderRequest;
import org.pis.project.proto.LeaveTeamRequest;
import org.pis.project.proto.ListTeam;
import org.pis.project.proto.ListTeamsByProjectRequest;
import org.pis.project.proto.ListTeamsByProjectResponse;
import org.pis.project.proto.Project;
import org.pis.project.proto.RegisterTeamRequest;
import org.pis.project.proto.RemoveTeamMemberRequest;
import org.pis.project.proto.Team;
import org.pis.project.repositories.ProjectRepository;
import org.pis.project.repositories.TeamRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

@ActiveProfiles("test")
@SpringBootTest
public class TeamGrpcE2ETests extends BaseGrpcE2ETests {

    @Autowired
    private ProjectRepository projectRepository;

    @Autowired
    private TeamRepository teamRepository; // Assuming this exists based on the entity provided

    private Project activeProject;

    @BeforeEach
    public void setup() {
        teamRepository.deleteAll();
        projectRepository.deleteAll();

        // Create a base project for the teams to attach to
        activeProject = blockingStub.createProject(createProjectRequest);
    }

    @Test
    public void testRegisterTeam_Success() {
        // Arrange
        RegisterTeamRequest req = RegisterTeamRequest.newBuilder()
                .setProjectId(activeProject.getProjectId())
                .setCreatorStudentId("student123")
                .setTeamName("Alpha Coders")
                .build();

        // Act
        Team response = blockingStub.registerTeam(req);

        // Assert
        assertNotNull(response);
        assertNotNull(response.getTeamId());
        assertEquals(activeProject.getProjectId(), response.getProjectId());
        assertEquals("Alpha Coders", response.getName());
        assertEquals("student123", response.getLeaderStudentId());
    }

    @Test
    public void testListTeamsByProject_Success() {
        // Arrange
        blockingStub.registerTeam(RegisterTeamRequest.newBuilder()
                .setProjectId(activeProject.getProjectId())
                .setCreatorStudentId("student1")
                .setTeamName("Team Alpha")
                .build());

        blockingStub.registerTeam(RegisterTeamRequest.newBuilder()
                .setProjectId(activeProject.getProjectId())
                .setCreatorStudentId("student2")
                .setTeamName("Team Beta")
                .build());

        // Act
        ListTeamsByProjectRequest listReq = ListTeamsByProjectRequest.newBuilder()
                .setProjectId(activeProject.getProjectId())
                .build();
        ListTeamsByProjectResponse listRes = blockingStub.listTeamsByProject(listReq);

        // Assert
        assertNotNull(listRes);
        assertEquals(listRes.getTeamsCount(), 2);

        List<String> teamNames = listRes.getTeamsList().stream()
                .map(ListTeam::getName)
                .collect(Collectors.toList());
        assertThat(teamNames, containsInAnyOrder("Team Alpha", "Team Beta"));

        // Assert each team has exactly 1 member
        listRes.getTeamsList().forEach(team ->
        assertEquals(1, team.getMemberCount())
);
    }

    @Test
    public void testAddTeamMember_Success() {
        // Arrange
        Team team = blockingStub.registerTeam(RegisterTeamRequest.newBuilder()
                .setProjectId(activeProject.getProjectId())
                .setCreatorStudentId("leader1")
                .setTeamName("Team Alpha")
                .build());

        // Act
        AddTeamMemberRequest addReq = AddTeamMemberRequest.newBuilder()
                .setTeamId(team.getTeamId())
                .setStudentId("newMember1")
                .build();
        Team updatedTeam = blockingStub.addTeamMember(addReq);

        // Assert
        assertNotNull(updatedTeam);
        assertTrue(updatedTeam.getStudentIdsList().contains("newMember1"));
    }

    @Test
    public void testRemoveTeamMember_Success() {
        // Arrange
        Team team = blockingStub.registerTeam(RegisterTeamRequest.newBuilder()
                .setProjectId(activeProject.getProjectId())
                .setCreatorStudentId("leader1")
                .setTeamName("Team Alpha")
                .build());

        blockingStub.addTeamMember(AddTeamMemberRequest.newBuilder()
                .setTeamId(team.getTeamId())
                .setStudentId("member1")
                .build());

        // Act
        RemoveTeamMemberRequest removeReq = RemoveTeamMemberRequest.newBuilder()
                .setTeamId(team.getTeamId())
                .setStudentId("member1")
                .build();
        Team updatedTeam = blockingStub.removeTeamMember(removeReq);

        // Assert
        assertNotNull(updatedTeam);
        assertFalse(updatedTeam.getStudentIdsList().contains("member1"));
    }

    @Test
    public void testChangeTeamLeader_Success() {
        // Arrange
        Team team = blockingStub.registerTeam(RegisterTeamRequest.newBuilder()
                .setProjectId(activeProject.getProjectId())
                .setCreatorStudentId("oldLeader")
                .setTeamName("Team Alpha")
                .build());

        blockingStub.addTeamMember(AddTeamMemberRequest.newBuilder()
                .setTeamId(team.getTeamId())
                .setStudentId("newLeader")
                .build());

        // Act
        ChangeTeamLeaderRequest changeReq = ChangeTeamLeaderRequest.newBuilder()
                .setTeamId(team.getTeamId())
                .setOldLeaderStudentId("oldLeader")
                .setNewLeaderStudentId("newLeader")
                .build();
        Team updatedTeam = blockingStub.changeTeamLeader(changeReq);

        // Assert
        assertNotNull(updatedTeam);
        assertEquals("newLeader", updatedTeam.getLeaderStudentId());
    }

    @Test
    public void testLeaveTeam_Success() {
        // Arrange
        Team team = blockingStub.registerTeam(RegisterTeamRequest.newBuilder()
                .setProjectId(activeProject.getProjectId())
                .setCreatorStudentId("leader1")
                .setTeamName("Team Alpha")
                .build());

        blockingStub.addTeamMember(AddTeamMemberRequest.newBuilder()
                .setTeamId(team.getTeamId())
                .setStudentId("memberLeaving")
                .build());

        // Act
        LeaveTeamRequest leaveReq = LeaveTeamRequest.newBuilder()
                .setTeamId(team.getTeamId())
                .setStudentId("memberLeaving")
                .build();
        Team updatedTeam = blockingStub.leaveTeam(leaveReq);

        // Assert
        assertNotNull(updatedTeam);
        assertFalse(updatedTeam.getStudentIdsList().contains("memberLeaving"));
    }
}
