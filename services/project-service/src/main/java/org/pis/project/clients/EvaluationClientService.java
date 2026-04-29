package org.pis.project.clients;

import java.util.Optional;
import java.util.UUID;

import org.springframework.stereotype.Service;

import io.grpc.Status;

import eval.Eval.GetProjectEvaluationRequest;
import eval.Eval.ProjectEvaluation;
import eval.EvaluationServiceGrpc;
import io.grpc.StatusRuntimeException;
import lombok.extern.slf4j.Slf4j;

@Service
@Slf4j
public class EvaluationClientService {

    private final EvaluationServiceGrpc.EvaluationServiceBlockingStub evaluationStub;

    public EvaluationClientService(EvaluationServiceGrpc.EvaluationServiceBlockingStub evaluationStub) {
        this.evaluationStub = evaluationStub;
    }

    public Optional<ProjectEvaluation> getEvaluationDetail(UUID projectId, UUID teamId, String evaluatorTeacherId) {
        GetProjectEvaluationRequest.Builder requestBuilder = GetProjectEvaluationRequest.newBuilder()
                .setProjectId(projectId.toString())
                .setTeamId(teamId.toString());

        if (evaluatorTeacherId != null && !evaluatorTeacherId.trim().isEmpty()) {
            requestBuilder.setEvaluatorTeacherId(evaluatorTeacherId);
        }

        GetProjectEvaluationRequest request = requestBuilder.build();

        try {
            log.debug("Calling EvaluationService to get evaluation for project: {}", projectId);
            return Optional.of(evaluationStub.getProjectEvaluation(request));
        } catch (StatusRuntimeException e) {
            if (e.getStatus().getCode() == Status.Code.NOT_FOUND) {
                log.info("No evaluation for team [{}]", teamId);
                return Optional.empty();
            } else {
                log.error("gRPC call failed while fetching evaluation for project {}. Status: {}", projectId,
                        e.getStatus());
                throw e;
            }
        }
    }
}
