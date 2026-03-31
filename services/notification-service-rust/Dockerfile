FROM rust:1.93-slim AS builder
WORKDIR /app

RUN apt-get update     && apt-get install -y --no-install-recommends protobuf-compiler pkg-config libssl-dev ca-certificates     && rm -rf /var/lib/apt/lists/*

COPY proto ./proto
COPY services/notification-service-rust/Cargo.toml ./services/notification-service-rust/Cargo.toml
COPY services/notification-service-rust/Cargo.lock ./services/notification-service-rust/Cargo.lock
COPY services/notification-service-rust/build.rs ./services/notification-service-rust/build.rs

WORKDIR /app/services/notification-service-rust

# Build dependencies first so source-only changes reuse this layer.
RUN mkdir src \
    && printf 'fn main() {}\n' > src/main.rs \
    && cargo build --release --locked \
    && rm -rf src

COPY services/notification-service-rust/src ./src
RUN cargo build --release --locked

FROM debian:bookworm-slim
RUN apt-get update     && apt-get install -y --no-install-recommends ca-certificates libssl3     && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/services/notification-service-rust/target/release/notification-service-rust /usr/local/bin/app
WORKDIR /app
RUN mkdir -p /data
EXPOSE 50052
CMD ["/usr/local/bin/app"]
