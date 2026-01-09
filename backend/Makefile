# Headless Financial API - Makefile
# Sequential validation commands for testing the implementation

.PHONY: all install typecheck lint lint-fix test test-unit test-integration test-contract test-all build clean emulator-start emulator-stop dev validate

# Bun binary (supports environments where Bun isn't on PATH)
BUN ?= $(shell command -v bun 2>/dev/null || echo "$(HOME)/.bun/bin/bun")

# Default target - run full validation
all: validate

# Install dependencies using bun
install:
	@echo "==> Installing dependencies..."
	$(BUN) install

# TypeScript type checking
typecheck:
	@echo "==> Running TypeScript type check..."
	$(BUN) run typecheck

# ESLint linting
lint:
	@echo "==> Running ESLint..."
	$(BUN) run lint

# ESLint with auto-fix
lint-fix:
	@echo "==> Running ESLint with auto-fix..."
	$(BUN) run lint:fix

# Format check with Prettier
format-check:
	@echo "==> Checking code formatting..."
	$(BUN) run format:check

# Format code with Prettier
format:
	@echo "==> Formatting code..."
	$(BUN) run format

# Run all unit tests
test-unit:
	@echo "==> Running unit tests..."
	$(BUN) test tests/unit

# Run integration tests (InMemory)
test-integration:
	@echo "==> Running integration tests (InMemory)..."
	$(BUN) test tests/integration

# Run contract tests
test-contract:
	@echo "==> Running contract tests..."
	$(BUN) test tests/contract

# Run all tests
test-all: test-unit test-integration test-contract
	@echo "==> All tests completed!"

# Alias for test-all
test: test-all

# Build the project
build:
	@echo "==> Building project..."
	$(BUN) run build

# Start Firebase emulators via Docker
emulator-start:
	@echo "==> Starting Firebase emulators..."
	docker compose up -d
	@echo "==> Waiting for emulators to be ready..."
	sleep 5
	@echo "==> Emulators started!"

# Stop Firebase emulators
emulator-stop:
	@echo "==> Stopping Firebase emulators..."
	docker compose down

# Run integration tests against Firestore emulator
test-firestore: emulator-start
	@echo "==> Running Firestore integration tests..."
	FIRESTORE_EMULATOR_HOST=localhost:8080 GCLOUD_PROJECT=demo-tazco $(BUN) test tests/integration
	@echo "==> Stopping emulators..."
	$(MAKE) emulator-stop

# Start development server
dev:
	@echo "==> Starting development server..."
	$(BUN) run dev

# Clean build artifacts
clean:
	@echo "==> Cleaning build artifacts..."
	rm -rf dist/
	rm -rf node_modules/.cache/
	@echo "==> Clean complete!"

# Full validation pipeline (run this before commits)
validate: install typecheck lint test-all
	@echo ""
	@echo "=========================================="
	@echo "  VALIDATION COMPLETE - All checks passed"
	@echo "=========================================="

# Quick validation (skip install)
validate-quick: typecheck lint test-all
	@echo ""
	@echo "=========================================="
	@echo "  QUICK VALIDATION COMPLETE"
	@echo "=========================================="

# CI validation (with coverage)
validate-ci: install typecheck lint
	@echo "==> Running tests with coverage..."
	$(BUN) test --coverage
	@echo ""
	@echo "=========================================="
	@echo "  CI VALIDATION COMPLETE"
	@echo "=========================================="

# Help
help:
	@echo "Headless Financial API - Available Commands"
	@echo ""
	@echo "Setup & Build:"
	@echo "  make install        - Install dependencies"
	@echo "  make build          - Build the project"
	@echo "  make clean          - Clean build artifacts"
	@echo ""
	@echo "Code Quality:"
	@echo "  make typecheck      - Run TypeScript type checking"
	@echo "  make lint           - Run ESLint"
	@echo "  make lint-fix       - Run ESLint with auto-fix"
	@echo "  make format-check   - Check code formatting"
	@echo "  make format         - Format code with Prettier"
	@echo ""
	@echo "Testing:"
	@echo "  make test-unit      - Run unit tests"
	@echo "  make test-integration - Run integration tests (InMemory)"
	@echo "  make test-contract  - Run contract tests"
	@echo "  make test-all       - Run all tests"
	@echo "  make test           - Alias for test-all"
	@echo "  make test-firestore - Run tests against Firestore emulator"
	@echo ""
	@echo "Emulators:"
	@echo "  make emulator-start - Start Firebase emulators (Docker)"
	@echo "  make emulator-stop  - Stop Firebase emulators"
	@echo ""
	@echo "Validation:"
	@echo "  make validate       - Full validation pipeline"
	@echo "  make validate-quick - Quick validation (skip install)"
	@echo "  make validate-ci    - CI validation with coverage"
	@echo ""
	@echo "Development:"
	@echo "  make dev            - Start development server"
	@echo ""
