package org.pis.project.grpc.interceptors;

import com.google.protobuf.Message;
import com.google.protobuf.util.JsonFormat;
import io.grpc.*;
import lombok.extern.slf4j.Slf4j;

@Slf4j
public class LoggingInterceptor implements ServerInterceptor {

    private static final JsonFormat.Printer PRINTER = JsonFormat.printer().alwaysPrintFieldsWithNoPresence();

    @Override
    public <ReqT, RespT> ServerCall.Listener<ReqT> interceptCall(
            ServerCall<ReqT, RespT> call,
            Metadata headers,
            ServerCallHandler<ReqT, RespT> next) {

        String method = call.getMethodDescriptor().getFullMethodName();
        long startTime = System.currentTimeMillis();

        ServerCall<ReqT, RespT> wrappedCall = new ForwardingServerCall.SimpleForwardingServerCall<>(call) {

            @Override
            public void close(Status status, Metadata trailers) {
                long duration = System.currentTimeMillis() - startTime;

                if (!status.isOk()) {
                    log.error("gRPC FAILED: {} status={} duration={}ms",
                            method, status, duration);
                } else {
                    log.info("gRPC OK: {} duration={}ms", method, duration);
                }

                super.close(status, trailers);
            }
        };

        ServerCall.Listener<ReqT> delegate = next.startCall(wrappedCall, headers);

        return new ForwardingServerCallListener.SimpleForwardingServerCallListener<>(delegate) {

            @Override
            public void onMessage(ReqT message) {
                log.info("gRPC request: {}\n{}", method, toJson(message));
                super.onMessage(message);
            }

            @Override
            public void onHalfClose() {
                try {
                    super.onHalfClose();
                } catch (Exception e) {
                    log.error("Exception in gRPC method: " + method);
                    log.error("Cause: " + e.getMessage());
                    throw e; // MUST rethrow so gRPC can handle it
                }
            }

            @Override
            public void onCancel() {
                log.warn("gRPC cancelled: {}", method);
                super.onCancel();
            }
        };
    }

    private String toJson(Object message) {
        if (message instanceof Message proto) {
            try {
                return PRINTER.print(proto);
            } catch (Exception e) {
                return "Failed to convert proto to JSON: " + e.getMessage();
            }
        }
        return String.valueOf(message);
    }
}
