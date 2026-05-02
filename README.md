# VUT FIT PIS 2026

Microservice-based university project registration system.

## Overview

The repository currently contains:

- `frontend/`: React frontend served by nginx
- `services/router-rust/`: Rust gRPC / gRPC-Web gateway for the frontend
- `services/auth-service-rust/`: Rust authentication service
- `services/notification-service-rust/`: Rust notification service
- `proto/`: shared protobuf contracts
- `services/subject-service-dotnet/`: subject-service implementation in .NET
- `services/project-service-dotnet-template/`: project-service template

The frontend talks to the router through gRPC-Web. Backend services communicate with each other over gRPC.

## Current State

Implemented and usable:

- frontend in React + Vite
- typed gRPC gateway in Rust with `tonic` and `tonic-web`
- JWT-based authentication through `auth-service`
- notification service in Rust
- Docker Compose setup for local development
- OpenTelemetry collector and Prometheus in the compose stack

Not finished yet:

- project service is still a .NET template
- some frontend flows still degrade when project-service is unavailable

In the current `docker-compose.yml`, `project-service` is still commented out. Project-related gateway calls will fail unless you provide that service yourself.

## Architecture

High-level flow:

- `frontend` -> gRPC-Web -> `router-rust`
- `router-rust` -> gRPC -> backend services
- shared contracts live in `proto/*.proto`

Current backend services:

- `auth-service-rust`
  - user registration
  - login
  - token validation
  - logout / revocation
- `notification-service-rust`
  - create notifications
  - list notifications
  - mark notifications as read
- `router-rust`
  - exposes the typed `FrontendGateway`
  - validates bearer tokens on protected RPCs
  - forwards calls to internal services

## Repository Layout

```text
.
├── frontend/
├── proto/
├── services/
│   ├── auth-service-rust/
│   ├── notification-service-rust/
│   ├── project-service-dotnet-template/
│   ├── router-rust/
│   └── subject-service-dotnet/
├── docker-compose.yml
├── grpc-web-generate.sh
├── Makefile
├── otel-collector-config.yaml
└── README.md
```

## Prerequisites

For Docker-based development:

- Docker
- Docker Compose

For local frontend / Rust development:

- Node.js 22+
- npm
- Rust toolchain
- `protoc`

## Quick Start

Start the stack with Docker:

```bash
make up-build
```

Or directly:

```bash
docker compose up --build
```

Main endpoints:

- frontend: `http://localhost:3000`
- router gRPC: `http://localhost:8081`
- auth service gRPC: `http://localhost:50051`
- notification service gRPC: `http://localhost:50052`
- Prometheus: `http://localhost:9090`
- Grafana: `http://localhost:3001` (`admin` / `admin`)
- OTLP gRPC: `http://localhost:4317`

Stop the stack:

```bash
make down
```

## Common Commands

List available tasks:

```bash
make help
```

Useful targets:

- `make up-build`: build and start the compose stack
- `make down`: stop the compose stack
- `make logs`: follow compose logs
- `make grpc`: regenerate frontend protobuf JavaScript
- `make rust-check`: run `cargo check` in all Rust services
- `make rust-test`: run `cargo test` in all Rust services
- `make rust-fmt`: run `cargo fmt` in all Rust services
- `make check`: regenerate gRPC files, build the frontend, and run Rust checks

## Frontend Development

Install dependencies:

```bash
make frontend-install
```

Run the Vite dev server:

```bash
make frontend-dev
```

Build the frontend:

```bash
make frontend-build
```

Environment variables are described in [frontend/.env.example](/home/tmokenc/workspace/vut/pis/projekt/frontend/.env.example).

The frontend uses the nginx proxy in [frontend/nginx.conf](/home/tmokenc/workspace/vut/pis/projekt/frontend/nginx.conf) to reach the router at `/grpc`.

## gRPC and Protobuf

Frontend protobuf files are generated into:

- [frontend/src/lib/grpc/generated](/home/tmokenc/workspace/vut/pis/projekt/frontend/src/lib/grpc/generated)

That directory is a local build artifact and is ignored by git. The frontend regenerates it automatically during `npm run build` and `npm run dev`.

Generation command:

```bash
make grpc
```

That runs [grpc-web-generate.sh](/home/tmokenc/workspace/vut/pis/projekt/grpc-web-generate.sh), which compiles the shared `.proto` files for the frontend grpc-web client.

## Authentication

The router expects bearer tokens in gRPC metadata:

```text
authorization: Bearer <jwt>
```

Protected gateway methods are validated through `AuthService.ValidateToken`.

Demo users are seeded by `auth-service` in local development:

- `student@example.com` / `student123`
- `teacher@example.com` / `teacher123`
- `admin@example.com` / `admin123`

## Observability

The compose stack includes:

- OpenTelemetry Collector
- Prometheus

Services are configured to export traces to the collector at `http://otel-collector:4317`.

## Notes

- The router is gRPC-only now. There is no REST API, Swagger UI, or `/health` endpoint in the router.
- The project service is not active by default in the current compose file.
- The shared service boundary is the protobuf contract in `proto/`. Services should not share internal code or storage models.
