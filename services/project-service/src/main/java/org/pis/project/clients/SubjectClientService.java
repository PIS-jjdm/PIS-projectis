package org.pis.project.clients;

import org.pis.project.exceptions.ServiceCommunicationException;
import org.springframework.stereotype.Service;

import io.grpc.StatusRuntimeException;
import lombok.extern.slf4j.Slf4j;
import subject.SubjectOuterClass.GetSubjectRequest;
import subject.SubjectOuterClass.Subject;
import subject.SubjectServiceGrpc;

@Service
@Slf4j
public class SubjectClientService {

    private final SubjectServiceGrpc.SubjectServiceBlockingStub subjectStub;

    public SubjectClientService(SubjectServiceGrpc.SubjectServiceBlockingStub subjectStub) {
        this.subjectStub = subjectStub;
    }

    public Subject getSubject(String subjectId) {

        GetSubjectRequest request = GetSubjectRequest.newBuilder()
                .setSubjectId(subjectId).build();

        try {
            log.debug("Calling SubjectService to get subject: {}", subjectId);
            return subjectStub.getSubject(request);
        } catch (StatusRuntimeException e) {
            log.error("gRPC call failed while fetching subject {}. Status: {}", subjectId,
                    e.getStatus());
            throw new ServiceCommunicationException(
                    "Failed to fetch subject detail from subject sevice: " + e.getMessage());

        }
    }
}
