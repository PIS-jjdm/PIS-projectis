package org.pis.project.grpc.interceptors;

import java.util.List;
import java.util.concurrent.TimeUnit;

import io.grpc.ForwardingServerCall;
import io.grpc.Metadata;
import io.grpc.ServerCall;
import io.grpc.ServerCallHandler;
import io.grpc.ServerInterceptor;
import io.grpc.Status;
import io.opentelemetry.api.GlobalOpenTelemetry;
import io.opentelemetry.api.common.Attributes;
import io.opentelemetry.api.metrics.DoubleHistogram;
import io.opentelemetry.api.metrics.LongCounter;
import io.opentelemetry.api.metrics.LongUpDownCounter;
import io.opentelemetry.api.metrics.Meter;

public class MetricsInterceptor implements ServerInterceptor {

    private final String serviceName;
    private final LongCounter requests;
    private final DoubleHistogram requestDuration;
    private final LongUpDownCounter activeRequests;
    private static final List<Double> GRPC_DURATION_BUCKETS_SECONDS = List.of(
            0.001,
            0.005,
            0.01,
            0.025,
            0.05,
            0.1,
            0.25,
            0.5,
            1.0,
            2.5,
            5.0);

    public MetricsInterceptor(String serviceName) {
        this.serviceName = serviceName;
        Meter meter = GlobalOpenTelemetry.getMeter(serviceName);

        this.requests = meter
                .counterBuilder("grpc_requests_total")
                .setDescription("Total number of gRPC requests")
                .build();
        this.requestDuration = meter
                .histogramBuilder("grpc_request_duration_seconds")
                .setUnit("s")
                .setDescription("Duration of gRPC requests")
                .setExplicitBucketBoundariesAdvice(GRPC_DURATION_BUCKETS_SECONDS)
                .build();
        this.activeRequests = meter
                .upDownCounterBuilder("grpc_active_requests")
                .setDescription("Current number of in-flight gRPC requests")
                .build();
    }

    @Override
    public <ReqT, RespT> ServerCall.Listener<ReqT> interceptCall(
            ServerCall<ReqT, RespT> call,
            Metadata headers,
            ServerCallHandler<ReqT, RespT> next) {

        String method = shortMethodName(call.getMethodDescriptor().getFullMethodName());
        long startedAt = System.nanoTime();
        Attributes activeAttributes = activeAttributes(method);
        activeRequests.add(1, activeAttributes);

        ServerCall<ReqT, RespT> wrappedCall = new ForwardingServerCall.SimpleForwardingServerCall<>(call) {
            @Override
            public void close(Status status, Metadata trailers) {
                Attributes requestAttributes = requestAttributes(method, status);
                activeRequests.add(-1, activeAttributes);
                requests.add(1, requestAttributes);
                requestDuration.record(elapsedSeconds(startedAt), requestAttributes);
                super.close(status, trailers);
            }
        };

        return next.startCall(wrappedCall, headers);
    }

    private Attributes activeAttributes(String method) {
        return Attributes.builder()
                .put("rpc.system", "grpc")
                .put("rpc.service", serviceName)
                .put("rpc.method", method)
                .build();
    }

    private Attributes requestAttributes(String method, Status status) {
        return Attributes.builder()
                .put("rpc.system", "grpc")
                .put("rpc.service", serviceName)
                .put("rpc.method", method)
                .put("rpc.grpc.status_code", Long.toString(status.getCode().value()))
                .build();
    }

    private static String shortMethodName(String fullMethodName) {
        int slash = fullMethodName.lastIndexOf('/');
        return slash >= 0 ? fullMethodName.substring(slash + 1) : fullMethodName;
    }

    private static double elapsedSeconds(long startedAt) {
        return (double) (System.nanoTime() - startedAt) / TimeUnit.SECONDS.toNanos(1);
    }
}
