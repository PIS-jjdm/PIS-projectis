FROM rust:1.94-slim AS builder
WORKDIR /app

RUN apt-get update     && apt-get install -y --no-install-recommends protobuf-compiler pkg-config libssl-dev ca-certificates     && rm -rf /var/lib/apt/lists/*

COPY proto ./proto
COPY services/evaluation-service-rust/Cargo.toml ./services/evaluation-service-rust/Cargo.toml
COPY services/evaluation-service-rust/Cargo.lock ./services/evaluation-service-rust/Cargo.lock
COPY services/evaluation-service-rust/build.rs ./services/evaluation-service-rust/build.rs

WORKDIR /app/services/evaluation-service-rust

# Build dependencies first so source-only changes reuse this layer.
RUN mkdir src \
    && printf 'fn main() {}\n' > src/main.rs \
    && printf 'fn main() {}\n' > src/client.rs \
    && cargo build --release --locked \
    && rm -rf src

COPY services/evaluation-service-rust/src ./src
COPY services/evaluation-service-rust/seeds.toml ./seeds.toml
RUN cargo build --release --locked

FROM debian:bookworm-slim
RUN apt-get update     && apt-get install -y --no-install-recommends ca-certificates libssl3     && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/services/evaluation-service-rust/target/release/server /usr/local/bin/app
COPY --from=builder /app/services/evaluation-service-rust/seeds.toml /app/seeds.toml

WORKDIR /app
RUN mkdir -p /data
EXPOSE 50055
CMD ["/usr/local/bin/app"]
