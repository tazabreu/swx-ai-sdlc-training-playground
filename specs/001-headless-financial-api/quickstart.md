# Quickstart Guide: Headless Financial API

**Branch**: `001-headless-financial-api` | **Date**: 2026-01-04

Local development + testing for the Cards-domain Financial API.

**Scope note**: BigQuery streaming, Redpanda, and OpenTelemetry are intentionally deferred to Spec 003 (`003-streaming-and-observability`).

---

## Prerequisites

- **Bun** (required)
- **Docker** (optional; used for Firestore/Auth emulators via `docker-compose.yml`)

---

## Install

```bash
bun install
```

---

## Validate (recommended)

```bash
make validate
```

---

## Run the API (local)

```bash
# InMemory providers (fast default)
USE_INMEMORY=true bun run dev
```

Change port:

```bash
PORT=3001 USE_INMEMORY=true bun run dev
```

---

## Emulators (optional)

Start Auth + Firestore emulators:

```bash
bun run emulator:start
```

Run integration tests against emulators:

```bash
bun run test:firestore
```

Stop emulators:

```bash
bun run emulator:stop
```

---

## Tests (Bun test runner)

```bash
# Full suite
bun test

# By category
bun test tests/unit
bun test tests/integration
bun test tests/contract
```

---

## Spec & Contracts

- Spec: `specs/001-headless-financial-api/spec.md`
- OpenAPI: `specs/001-headless-financial-api/contracts/openapi.yaml`
- Tasks: `specs/001-headless-financial-api/tasks.md`
