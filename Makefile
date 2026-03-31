SHELL := /usr/bin/env bash
.DEFAULT_GOAL := help

ROOT_DIR := $(abspath .)
FRONTEND_DIR := $(ROOT_DIR)/frontend
DOCKER_COMPOSE := docker compose
RUST_SERVICES := services/auth-service-rust services/notification-service-rust services/router-rust

.PHONY: \
	help \
	up up-build down restart logs ps \
	frontend-install frontend-dev frontend-build frontend-preview \
	grpc rust-check rust-test rust-fmt \
	check build pack

help: ## Show available targets
	@awk 'BEGIN {FS = ":.*## "}; /^[a-zA-Z0-9_.-]+:.*## / {printf "%-18s %s\n", $$1, $$2}' $(MAKEFILE_LIST) | sort

up: ## Start the docker compose stack
	$(DOCKER_COMPOSE) up

up-build: ## Build and start the docker compose stack
	$(DOCKER_COMPOSE) up --build

down: ## Stop the docker compose stack
	$(DOCKER_COMPOSE) down

restart: ## Restart the docker compose stack with rebuild
	$(DOCKER_COMPOSE) down
	$(DOCKER_COMPOSE) up --build

logs: ## Follow docker compose logs
	$(DOCKER_COMPOSE) logs -f

ps: ## Show docker compose service status
	$(DOCKER_COMPOSE) ps

frontend-install: ## Install frontend dependencies
	cd $(FRONTEND_DIR) && npm install

frontend-dev: ## Run the frontend Vite dev server
	cd $(FRONTEND_DIR) && npm run dev

frontend-build: ## Build the frontend production bundle
	cd $(FRONTEND_DIR) && npm run build

frontend-preview: ## Preview the frontend production build
	cd $(FRONTEND_DIR) && npm run preview

grpc: ## Generate grpc-web protobuf files for the frontend
	cd $(FRONTEND_DIR) && npm run generate:grpc

rust-check: ## Run cargo check in each Rust service
	@set -euo pipefail; \
	for dir in $(RUST_SERVICES); do \
		echo "==> cargo check in $$dir"; \
		cargo check --manifest-path $$dir/Cargo.toml; \
	done

rust-test: ## Run cargo test in each Rust service
	@set -euo pipefail; \
	for dir in $(RUST_SERVICES); do \
		echo "==> cargo test in $$dir"; \
		cargo test --manifest-path $$dir/Cargo.toml; \
	done

rust-fmt: ## Run cargo fmt in each Rust service
	@set -euo pipefail; \
	for dir in $(RUST_SERVICES); do \
		echo "==> cargo fmt in $$dir"; \
		cargo fmt --manifest-path $$dir/Cargo.toml --all; \
	done

check: grpc frontend-build rust-check ## Generate protobufs, build frontend, and check Rust services

build: up-build ## Backward-compatible alias for a full docker compose build/start

pack: ## Create a source archive from HEAD
	git archive -o ../app.zip HEAD
