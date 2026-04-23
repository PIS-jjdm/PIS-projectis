package org.pis.project.grpc;

import io.grpc.Metadata;
import io.grpc.Status;
import io.grpc.StatusException;
import lombok.extern.slf4j.Slf4j;

import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.grpc.server.exception.GrpcExceptionHandler;
import org.springframework.stereotype.Component;

import org.pis.project.exceptions.BusinessRuleViolationException;
import org.pis.project.exceptions.ResourceNotFoundException;

@Component
@Slf4j
public class GlobalGrpcExceptionHandler implements GrpcExceptionHandler {

    @Override
    public StatusException handleException(Throwable exception) {

        return switch (exception) {

            case IllegalArgumentException e -> Status.INVALID_ARGUMENT
                    .withDescription(e.getMessage())
                    .withCause(e)
                    .asException();

            case ResourceNotFoundException e -> handleResourceNotFound(e);

            case BusinessRuleViolationException e -> Status.FAILED_PRECONDITION
                    .withDescription(e.getMessage())
                    .withCause(e)
                    .asException();

            case DataIntegrityViolationException e -> Status.INVALID_ARGUMENT
                    .withDescription(e.getMessage())
                    .withCause(e)
                    .asException();

            case null, default -> {
                // This prints the full stack trace to your Spring Boot console
                log.error("Unhandled internal exception caught by gRPC Exception Handler", exception);

                String errorMessage = exception != null ? exception.getMessage() : "Unknown error";

                yield Status.INTERNAL
                        .withDescription("An unexpected internal error occurred: " + errorMessage)
                        .withCause(exception)
                        .asException();
            }
        };
    }

    private StatusException handleResourceNotFound(ResourceNotFoundException e) {
        Status status = Status.NOT_FOUND
                .withDescription(e.getMessage())
                .withCause(e);

        Metadata metadata = new Metadata();
        Metadata.Key<String> errorTypeKey = Metadata.Key.of("error-type", Metadata.ASCII_STRING_MARSHALLER);
        Metadata.Key<String> timestampKey = Metadata.Key.of("timestamp", Metadata.ASCII_STRING_MARSHALLER);

        metadata.put(errorTypeKey, "RESOURCE_MISSING");
        metadata.put(timestampKey, String.valueOf(System.currentTimeMillis()));

        return status.asException(metadata);
    }
}
