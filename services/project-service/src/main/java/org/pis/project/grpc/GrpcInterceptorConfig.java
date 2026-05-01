package org.pis.project.grpc;

import org.pis.project.grpc.interceptors.AuthenticationInterceptor;
import org.pis.project.grpc.interceptors.LoggingInterceptor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.grpc.server.GlobalServerInterceptor;

import io.grpc.ServerInterceptor;

@Configuration
public class GrpcInterceptorConfig {

    @Bean
    @GlobalServerInterceptor
    ServerInterceptor globalLoggingInterceptor() {
        return new LoggingInterceptor();
    }

    @Bean
    @GlobalServerInterceptor
    ServerInterceptor globalAuthenticationInterceptor() {
        return new AuthenticationInterceptor();
    }
}
