# Router / API Gateway (Rust)

Typed gRPC / gRPC-Web gateway for the frontend.

Responsibilities:
- expose the `FrontendGateway` gRPC interface
- proxy calls to internal gRPC services with Tonic
- validate JWT on protected RPCs through `AuthService.ValidateToken`
- apply coarse authentication at the gateway boundary
- export OpenTelemetry traces
