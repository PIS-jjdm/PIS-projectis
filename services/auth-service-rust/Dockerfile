FROM rust:1.93-slim AS builder
WORKDIR /app

RUN apt-get update     && apt-get install -y --no-install-recommends protobuf-compiler pkg-config libssl-dev ca-certificates     && rm -rf /var/lib/apt/lists/*

COPY proto ./proto
COPY services/auth-service-rust/Cargo.toml ./services/auth-service-rust/Cargo.toml
COPY services/auth-service-rust/Cargo.lock ./services/auth-service-rust/Cargo.lock
COPY services/auth-service-rust/build.rs ./services/auth-service-rust/build.rs

WORKDIR /app/services/auth-service-rust

# Build dependencies first so source-only changes reuse this layer.
RUN mkdir src \
    && printf 'fn main() {}\n' > src/main.rs \
    && cargo build --release --locked \
    && rm -rf src

COPY services/auth-service-rust/src ./src
COPY services/auth-service-rust/demo_users.toml ./demo_users.toml
RUN cargo build --release --locked

FROM debian:bookworm-slim
RUN apt-get update     && apt-get install -y --no-install-recommends ca-certificates libssl3     && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/services/auth-service-rust/target/release/auth-service-rust /usr/local/bin/app
COPY --from=builder /app/services/auth-service-rust/demo_users.toml /app/demo_users.toml

WORKDIR /app
RUN mkdir -p /data
EXPOSE 50051
CMD ["/usr/local/bin/app"]
