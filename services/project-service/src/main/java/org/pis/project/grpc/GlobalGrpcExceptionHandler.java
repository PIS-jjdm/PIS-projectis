package org.pis.project.grpc;

import io.grpc.Metadata;
import io.grpc.Status;
import io.grpc.StatusException;
import org.springframework.grpc.server.exception.GrpcExceptionHandler;
import org.springframework.stereotype.Component;

import org.pis.project.exceptions.BusinessRuleViolationException;
import org.pis.project.exceptions.ResourceNotFoundException;

@Component
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

      case null, default -> Status.INTERNAL
          .withDescription("An unexpected internal error occurred.")
          .withCause(exception)
          .asException();
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