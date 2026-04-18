{
  description = "Evaluation service";

  inputs = {
    nixpkgs.url = "github:nixos/nixpkgs?ref=nixos-unstable";
    rust-overlay = {
      url = "github:oxalica/rust-overlay";
      inputs.nixpkgs.follows = "nixpkgs";
    };
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { nixpkgs, rust-overlay, flake-utils, ... }:
    flake-utils.lib.eachDefaultSystem(system:
      let
        packageName = "evaluation-service";   # Must match Cargo.toml

        overlays = [ (import rust-overlay) ];
        pkgs = import nixpkgs {
            inherit system overlays;
        };
        rustToolchain = pkgs.rust-bin.fromRustupToolchainFile ./rust-toolchain.toml;
        rustPlatform = pkgs.makeRustPlatform {
            cargo = rustToolchain;
            rustc = rustToolchain;
        };
        proto_path = ../../proto;
      in
      rec {
        devShells.default = pkgs.mkShell {
          buildInputs = [ rustToolchain ];
          env = {
            # For editors
            RUST_SRC_PATH = "${rustToolchain}/lib/rustlib/src/rust/library";
            RUST_LOG = "debug";
          };
        };

        # https://github.com/NixOS/nixpkgs/blob/master/doc/languages-frameworks/rust.section.md
        packages.default = rustPlatform.buildRustPackage {
          pname = packageName;
          version = "0.1.0";
          src = ./.;
          cargoLock = {
            lockFile = ./Cargo.lock;
          };
          env = {
            PROTO_PATH = "${proto_path}";
            RUST_LOG = "info";
            DATA_DIR = "data";
          };
        };

        packages.docker = pkgs.dockerTools.buildImage {
          name = packageName;
          tag = "latest";

          copyToRoot = pkgs.buildEnv {
            name = "image-root";
            paths = [ packages.default pkgs.busybox ];
            pathsToLink = [ "/bin" ];
          };

          config = {
            Cmd = [ "${packages.default}/bin/server" ];
            Env = [
              "RUST_LOG=info"
              "BIND_ADDRESS=127.0.0.1"
              "BIND_PORT=50123"
              "DATA_DIR=/data"
              # "SEEDS_PATH="
              # "OTLP_ENDPOINT="
            ];
            WorkingDir = "/";
          };
        };
      }
    );
}
