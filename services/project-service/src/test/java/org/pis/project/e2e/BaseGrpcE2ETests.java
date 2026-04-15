package org.pis.project.e2e;

import java.time.Instant;
import java.time.temporal.ChronoUnit;

import org.pis.project.proto.CreateProjectRequest;
import org.pis.project.proto.ProjectServiceGrpc.ProjectServiceBlockingStub;
import org.pis.project.proto.RegisterTeamRequest;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.grpc.test.autoconfigure.AutoConfigureInProcessTransport;
import org.springframework.test.context.TestPropertySource;

import com.google.protobuf.Timestamp;

@AutoConfigureInProcessTransport // Replaces network channels with in-process memory channels
@TestPropertySource(properties = {
        "spring.grpc.client.default-channel.address=localhost:9090"
})
public abstract class BaseGrpcE2ETests {

    @Autowired
    protected ProjectServiceBlockingStub blockingStub;

    // Helper method to generate gRPC Timestamps
    protected Timestamp createTimestamp(int daysToAdd) {
        Instant instant = Instant.now().plus(daysToAdd, ChronoUnit.DAYS);
        long millis = instant.toEpochMilli();
        return Timestamp.newBuilder()
                .setSeconds(millis / 1000)
                .setNanos((int) ((millis % 1000) * 1000000))
                .build();
    }

    protected CreateProjectRequest createProjectRequest = CreateProjectRequest.newBuilder()
            .setTitle("Advanced Software Engineering")
            .setDescription("Final semester project")
            .setTeacherId("teacherId")
            .setMaxStudentsPerTeam(4)
            .setStartDate(createTimestamp(0))
            .setEndDate(createTimestamp(7))
            .setSubjectId("SUB")
            .build();

    // protected TeamJoinRequestEntity createJoinRequestEntity(UUID projectId, UUID teamId, UUID joinRequestId) {
    //     TeamJoinRequestEntity r = new TeamJoinRequestEntity();
    //     r.setId(joinRequestId);
    //     r.setRequestorStudentId("test student");
    //     r.setTeam(createTeamEntity(teamId, projectId));
    //     return r;
    // }

}
