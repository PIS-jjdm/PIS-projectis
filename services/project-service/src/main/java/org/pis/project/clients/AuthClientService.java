package org.pis.project.clients;

import org.pis.project.exceptions.ServiceCommunicationException;
import org.springframework.stereotype.Service;

import auth.Auth.GetUserRequest;
import auth.Auth.User;
import auth.AuthServiceGrpc;
import io.grpc.StatusRuntimeException;
import lombok.extern.slf4j.Slf4j;

@Service
@Slf4j
public class AuthClientService {

    private final AuthServiceGrpc.AuthServiceBlockingStub authStub;

    public AuthClientService(AuthServiceGrpc.AuthServiceBlockingStub authStub) {
        this.authStub = authStub;
    }

    public User getUser(String userId) {
        GetUserRequest.Builder requestBuilder = GetUserRequest.newBuilder()
                .setUserId(userId);
        GetUserRequest request = requestBuilder.build();

        try {
            log.debug("Calling AuthService to get user: {}", userId);
            return authStub.getUser(request);

        } catch (StatusRuntimeException e) {
            log.error("gRPC call failed while fetching user {}. Status: {}", userId,
                    e.getStatus());
            throw new ServiceCommunicationException(
                    "Failed to fetch auth detail from AuthService: " + e.getMessage());
        }
    }
}
