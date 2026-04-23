package org.pis.project.e2e;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.containsInAnyOrder;
import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.not;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;

import java.util.List;
import java.util.stream.Collectors;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.pis.project.entities.enums.JoinRequestStatus;
import org.pis.project.proto.CreateJoinRequestRequest;
import org.pis.project.proto.DeleteJoinRequestRequest;
import org.pis.project.proto.JoinRequest;
import org.pis.project.proto.ListJoinRequestsRequest;
import org.pis.project.proto.ListJoinRequestsResponse;
import org.pis.project.proto.Project;
import org.pis.project.proto.RegisterTeamRequest;
import org.pis.project.proto.ResolveJoinRequestRequest;
import org.pis.project.proto.Team;
import org.pis.project.repositories.ProjectRepository;
import org.pis.project.repositories.TeamJoinRequestRepository;
import org.pis.project.repositories.TeamRepository;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

@SpringBootTest
public class TeamJoinRequestGrpcE2ETests extends BaseGrpcE2ETests {

    @Autowired
    private ProjectRepository projectRepository;

    @Autowired
    private TeamRepository teamRepository;

    @Autowired
    private TeamJoinRequestRepository teamJoinRequestRepository;

    private Project activeProject;
    private Team activeTeam;

    @BeforeEach
    public void setup() {
        teamJoinRequestRepository.deleteAll();
        teamRepository.deleteAll();
        projectRepository.deleteAll();

        // Create a base project
        activeProject = blockingStub.createProject(createProjectRequest);

        // Create a base team to send join requests to
        activeTeam = blockingStub.registerTeam(RegisterTeamRequest.newBuilder()
                .setProjectId(activeProject.getProjectId())
                .setCreatorStudentId("teamLeader1")
                .setTeamName("Gamma Coders")
                .build());
    }

    @Test
    public void testCreateJoinRequest_Success() {
        // Arrange
        CreateJoinRequestRequest req = CreateJoinRequestRequest.newBuilder()
                .setTeamId(activeTeam.getTeamId())
                .setRequestorStudentId("hopefulStudent1")
                .build();

        // Act
        JoinRequest response = blockingStub.createJoinRequest(req);

        // Assert
        assertNotNull(response);
        assertNotNull(response.getJoinRequestId());
        assertEquals(activeTeam.getTeamId(), response.getTeam().getTeamId());
        assertEquals("hopefulStudent1", response.getRequestorStudentId());
    }

    @Test
    public void testDeleteJoinRequest_Success() {
        // Arrange
        JoinRequest createdRequest = blockingStub.createJoinRequest(
                CreateJoinRequestRequest.newBuilder()
                        .setTeamId(activeTeam.getTeamId())
                        .setRequestorStudentId("hopefulStudent1")
                        .build());

        // Act
        blockingStub.deleteJoinRequest(
                DeleteJoinRequestRequest.newBuilder()
                        .setJoinRequestId(createdRequest.getJoinRequestId())
                        .build());

        // Assert
        ListJoinRequestsResponse list = blockingStub.listJoinRequests(
                ListJoinRequestsRequest.newBuilder()
                        .setTeamId(activeTeam.getTeamId())
                        .build());

        assertThat(
                list.getJoinRequestsList()
                        .stream()
                        .map(JoinRequest::getJoinRequestId)
                        .toList(),
                not(hasItem(createdRequest.getJoinRequestId())));
    }

    @Test
    public void testResolveJoinRequest_Accept_Success() {
        // Arrange
        JoinRequest createdRequest = blockingStub.createJoinRequest(CreateJoinRequestRequest.newBuilder()
                .setTeamId(activeTeam.getTeamId())
                .setRequestorStudentId("hopefulStudent1")
                .build());

        // Act
        ResolveJoinRequestRequest resolveReq = ResolveJoinRequestRequest.newBuilder()
                .setJoinRequestId(createdRequest.getJoinRequestId())
                .setAccept(true)
                .setResolverStudentId("teamLeader1") // Assuming the leader resolves it
                .build();

        JoinRequest response = blockingStub.resolveJoinRequest(resolveReq);

        // Assert
        assertNotNull(response);
        assertEquals(createdRequest.getJoinRequestId(), response.getJoinRequestId());
        assertEquals("hopefulStudent1", response.getRequestorStudentId());
        assertEquals(response.getStatus(), JoinRequestStatus.ACCEPTED.toString());
    }

    @Test
    public void testListJoinRequests_ByTeam_Success() {
        // Arrange
        blockingStub.createJoinRequest(CreateJoinRequestRequest.newBuilder()
                .setTeamId(activeTeam.getTeamId())
                .setRequestorStudentId("studentA")
                .build());

        blockingStub.createJoinRequest(CreateJoinRequestRequest.newBuilder()
                .setTeamId(activeTeam.getTeamId())
                .setRequestorStudentId("studentB")
                .build());

        // Act - utilizing the oneof context_filter field mapped to setTeamId
        ListJoinRequestsRequest listReq = ListJoinRequestsRequest.newBuilder()
                .setTeamId(activeTeam.getTeamId())
                .build();

        ListJoinRequestsResponse listRes = blockingStub.listJoinRequests(listReq);

        // Assert
        assertNotNull(listRes);
        assertEquals(2, listRes.getJoinRequestsCount());

        List<String> requestors = listRes.getJoinRequestsList().stream()
                .map(JoinRequest::getRequestorStudentId)
                .collect(Collectors.toList());

        assertThat(requestors, containsInAnyOrder("studentA", "studentB"));
    }

    @Test
    public void testListJoinRequests_ByRequestor_Success() {
        // Arrange
        blockingStub.createJoinRequest(CreateJoinRequestRequest.newBuilder()
                .setTeamId(activeTeam.getTeamId())
                .setRequestorStudentId("targetStudent")
                .build());

        // Act - utilizing the oneof context_filter field mapped to
        // setRequestorStudentId
        ListJoinRequestsRequest listReq = ListJoinRequestsRequest.newBuilder()
                .setRequestorStudentId("targetStudent")
                .build();

        ListJoinRequestsResponse listRes = blockingStub.listJoinRequests(listReq);

        // Assert
        assertNotNull(listRes);
        assertEquals(1, listRes.getJoinRequestsCount());
        assertEquals("targetStudent", listRes.getJoinRequestsList().get(0).getRequestorStudentId());
    }

    @Test
    public void testAcceptingJoinRequest_CancelsOtherPendingRequestsForSameStudent() {
        // Arrange: Create a second team in the same project
        Team secondTeam = blockingStub.registerTeam(RegisterTeamRequest.newBuilder()
                .setProjectId(activeProject.getProjectId())
                .setCreatorStudentId("teamLeader2")
                .setTeamName("Delta Developers")
                .build());

        String studentId = "busyStudent1";

        // Create pending requests for the same student to BOTH teams
        JoinRequest requestToTeam1 = blockingStub.createJoinRequest(CreateJoinRequestRequest.newBuilder()
                .setTeamId(activeTeam.getTeamId())
                .setRequestorStudentId(studentId)
                .build());

        JoinRequest requestToTeam2 = blockingStub.createJoinRequest(CreateJoinRequestRequest.newBuilder()
                .setTeamId(secondTeam.getTeamId())
                .setRequestorStudentId(studentId)
                .build());

        // Act: Resolve (Accept) the request for Team 1
        blockingStub.resolveJoinRequest(ResolveJoinRequestRequest.newBuilder()
                .setJoinRequestId(requestToTeam1.getJoinRequestId())
                .setAccept(true)
                .setResolverStudentId("teamLeader1")
                .build());

        // Assert: Check the status of both requests
        ListJoinRequestsResponse studentRequests = blockingStub.listJoinRequests(
                ListJoinRequestsRequest.newBuilder()
                        .setRequestorStudentId(studentId)
                        .build());

        List<JoinRequest> requests = studentRequests.getJoinRequestsList();

        // Find the specific requests in the list
        JoinRequest updatedReq1 = requests.stream()
                .filter(r -> r.getJoinRequestId().equals(requestToTeam1.getJoinRequestId()))
                .findFirst().orElseThrow();

        JoinRequest updatedReq2 = requests.stream()
                .filter(r -> r.getJoinRequestId().equals(requestToTeam2.getJoinRequestId()))
                .findFirst().orElseThrow();

        // The accepted one should be ACCEPTED
        assertEquals(JoinRequestStatus.ACCEPTED.toString(), updatedReq1.getStatus(),
                "The primary request should be accepted.");

        // The other one should have been cancelled by the EventListener
        assertEquals(JoinRequestStatus.CANCELED.toString(), updatedReq2.getStatus(),
                "The other pending request should have been automatically cancelled.");
    }
}
