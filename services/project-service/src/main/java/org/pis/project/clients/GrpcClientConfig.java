package org.pis.project.clients;

import auth.AuthServiceGrpc;
import eval.EvaluationServiceGrpc;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.grpc.client.GrpcChannelFactory;

@Configuration
public class GrpcClientConfig {

    @Bean
    AuthServiceGrpc.AuthServiceBlockingStub authStub(GrpcChannelFactory channels) {
        return AuthServiceGrpc.newBlockingStub(channels.createChannel("auth"));
    }

    @Bean
    EvaluationServiceGrpc.EvaluationServiceBlockingStub evaluationStub(GrpcChannelFactory channels) {
        return EvaluationServiceGrpc.newBlockingStub(channels.createChannel("evaluation"));
    }
}
