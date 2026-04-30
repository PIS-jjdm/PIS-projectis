package org.pis.project.utils;

import com.auth0.jwt.JWT;
import com.auth0.jwt.interfaces.DecodedJWT;
import io.grpc.Metadata;
import io.grpc.Status;

public class JwtUtils {

    private static final Metadata.Key<String> AUTH_KEY = Metadata.Key.of("authorization",
            Metadata.ASCII_STRING_MARSHALLER);

    public record UserContext(String userId, String role) {
    }

    public static UserContext getUserContextFromMetadata(Metadata metadata) {
        String authHeader = metadata.get(AUTH_KEY);

        if (authHeader == null) {
            throw Status.UNAUTHENTICATED
                    .withDescription("Authorization header is not present")
                    .asRuntimeException();
        }

        try {
            String token = authHeader.startsWith("Bearer ") ? authHeader.substring(7) : authHeader;

            DecodedJWT jwt = JWT.decode(token);

            String userId = jwt.getSubject(); // sub
            String role = jwt.getClaim("role").asString(); // role

            return new UserContext(userId, role);
        } catch (Exception e) {
            throw Status.UNAUTHENTICATED
                    .withDescription("Invalid JWT: " + e.getMessage())
                    .asRuntimeException();
        }
    }
}
