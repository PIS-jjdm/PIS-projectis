FROM rust:1.93-slim AS builder
WORKDIR /app

RUN apt-get update     && apt-get install -y --no-install-recommends protobuf-compiler pkg-config libssl-dev ca-certificates     && rm -rf /var/lib/apt/lists/*

COPY proto ./proto
COPY services/router-rust/Cargo.toml ./services/router/Cargo.toml
COPY services/router-rust/Cargo.lock ./services/router/Cargo.lock
COPY services/router-rust/build.rs ./services/router/build.rs

WORKDIR /app/services/router

# Build dependencies first so source-only changes reuse this layer.
RUN mkdir src \
    && printf 'fn main() {}\n' > src/main.rs \
    && cargo build --release --locked \
    && rm -rf src

COPY services/router-rust/src ./src
RUN cargo build --release --locked

FROM debian:bookworm-slim
RUN apt-get update     && apt-get install -y --no-install-recommends ca-certificates libssl3     && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/services/router/target/release/router-rust /usr/local/bin/app
WORKDIR /app
EXPOSE 8081
CMD ["/usr/local/bin/app"]
