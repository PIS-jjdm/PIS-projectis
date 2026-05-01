package org.pis.project.grpc.interceptors;

import io.grpc.*;
import lombok.extern.slf4j.Slf4j;
import org.pis.project.utils.JwtUtils;
import org.pis.project.utils.JwtUtils.UserContext;

@Slf4j
public class AuthenticationInterceptor implements ServerInterceptor {

    public static final Context.Key<UserContext> USER_CONTEXT_KEY = Context.key("user_context");

    @Override
    public <ReqT, RespT> ServerCall.Listener<ReqT> interceptCall(
            ServerCall<ReqT, RespT> call,
            Metadata headers,
            ServerCallHandler<ReqT, RespT> next) {

        try {
            UserContext userCtx = JwtUtils.getUserContextFromMetadata(headers);

            log.debug("Authenticated user: {} with role: {}", userCtx.userId(), userCtx.role());

            Context context = Context.current().withValue(USER_CONTEXT_KEY, userCtx);
            return Contexts.interceptCall(context, call, headers, next);

        } catch (StatusRuntimeException e) {
            call.close(e.getStatus(), new Metadata());
            return new ServerCall.Listener<ReqT>() {
            };
        }
    }
}
