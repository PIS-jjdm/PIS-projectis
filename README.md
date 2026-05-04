# VUT FIT PIS 2026

Microservice-based university project registration system.

## Services

- `frontend/` — React + Vite, served by nginx, talks to the router via gRPC-Web.
- `services/router-rust/` — typed gRPC + gRPC-Web gateway (tonic).
- `services/auth-service-rust/` — login, JWT issuance, user / avatar management.
- `services/notification-service-rust/` — notifications (immediate + scheduled, streaming).
- `services/subject-service-dotnet/` — subjects, enrollment, teacher assignment.
- `services/project-service/` — projects, teams, submissions, join requests (Spring Boot).
- `services/evaluation-service-rust/` — project evaluations.
- `proto/` — shared protobuf contracts.

The frontend reaches the router over gRPC-Web; backend services talk to each other over gRPC. The router validates the JWT and forwards the original `Authorization` header on every downstream call so internal services can identify the caller without round-tripping to auth-service.

## Prerequisites

- Docker + Docker Compose (everything else lives in containers).

For local builds (optional): Node 22+, Rust toolchain, `protoc`, Java 25 + Maven, .NET 8 SDK.

## Quick Start

Build and start the full stack:

```bash
docker compose up --build
```

Stop:

```bash
docker compose down
```

Follow logs:

```bash
docker compose logs -f
```

Endpoints:

- frontend: <http://localhost:3000>
- router gRPC / gRPC-Web: <http://localhost:8081>
- Prometheus: <http://localhost:9090>
- Grafana: <http://localhost:3001> (`admin` / `admin`)

Internal gRPC ports: auth `50051`, notification `50052`, subject `50053`, project `50054`, evaluation `50055`.

Demo users seeded by `auth-service`:

- `student@example.com` / `student123`
- `teacher@example.com` / `teacher123`
- `admin@example.com` / `admin123`

## Local development

Frontend (Vite dev server, proxies to a running router):

```bash
cd frontend
npm install
npm run dev
```

Production build of the frontend:

```bash
cd frontend
npm run build
```

Regenerate the frontend protobuf bindings (auto-runs on `npm run build` / `npm run dev`):

```bash
bash grpc-web-generate.sh
```

Per-service Rust checks (run inside each `services/*-rust/` directory):

```bash
cargo check
cargo test
cargo fmt
```

Project-service (Java / Spring Boot):

```bash
cd services/project-service
./mvnw -DskipTests package
```

Subject-service (.NET):

```bash
cd services/subject-service-dotnet
dotnet build
```

## Authentication

The router expects bearer tokens in gRPC metadata:

```
authorization: Bearer <jwt>
```

Protected gateway methods are validated via `AuthService.ValidateToken`. JWT claims include `sub` (user id) and `role` (`student` / `teacher` / `admin`). The router attaches the same header on every downstream call so internal services can decode the JWT directly.

## File uploads

Submissions are capped at 10 MB. The transport chain (nginx → axum → tonic → Spring gRPC) is configured for 12 MiB to leave protobuf framing headroom.

## Observability

Compose includes OpenTelemetry Collector, Prometheus, Grafana, and Loki + Alloy. Services export traces and metrics to `otel-collector:4317`; logs are pushed via Alloy to Loki.

## Notes

- The router is gRPC / gRPC-Web only — no REST. Health probe at `/health` on the router HTTP port.
