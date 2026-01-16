# Implementation Plan: AWS LocalStack Infrastructure

**Branch**: `004-aws-localstack-infrastructure` | **Date**: 2026-01-07 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/004-aws-localstack-infrastructure/spec.md`

## Summary

Add AWS infrastructure support (DynamoDB, Cognito, EventBridge/SQS, SSM Parameter Store) alongside existing Firebase/GCP infrastructure, with LocalStack for local development. This enables running the Financial API via `bun run dev:aws` against AWS-compatible services without cloud costs, maintaining identical API contracts and behavior.

## Technical Context

**Language/Version**: TypeScript 5.x (existing codebase)
**Package Manager**: Bun (required per constitution)
**Primary Dependencies**:
- Existing: Express, Firebase Admin SDK, custom DI container (`src/infrastructure/di/container.ts`)
- New: @aws-sdk/client-dynamodb, @aws-sdk/lib-dynamodb, @aws-sdk/client-cognito-identity-provider, @aws-sdk/client-eventbridge, @aws-sdk/client-sqs, @aws-sdk/client-ssm, aws-jwt-verify
**Storage**: DynamoDB (via LocalStack) - 12 tables mirroring Firestore collections
**Testing**: Bun test (existing test suite, extended for AWS mode)
**Target Platform**: Node.js/Express (unchanged), LocalStack Docker container for AWS services
**Project Type**: Single backend API with infrastructure abstraction layer
**Performance Goals**: Identical to Firebase mode - API response times unaffected by infrastructure switch
**Constraints**: LocalStack Community Edition feature parity, Docker availability on dev machines
**Scale/Scope**: ~25–40 new files (LocalStack + AWS clients + repos + auth/events + tests), ~5–10 modified files (DI wiring + scripts)

## Baseline Architecture (As-Is, Source of Truth)

AWS mode must “look” like existing modes from the API layer down. Current shape:
- Entry point for local dev: `scripts/start-dev.ts` (modes: `in-memory`, `emulator`, `cloud`)
- Environment selection: `src/infrastructure/di/container-factory.ts#createContainer()`
- Contracts: `specs/001-headless-financial-api/contracts/openapi.yaml` (validated by `tests/contract`)
- Pluggable interfaces:
  - Auth: `src/infrastructure/auth/auth-provider.interface.ts`
  - Persistence: `src/infrastructure/persistence/interfaces/*`
  - Events: `src/infrastructure/events/event-publisher.interface.ts` + outbox repos (`src/infrastructure/persistence/*/outbox.repository.ts`)
- Important behavioral constraints to preserve:
  - Optimistic locking via `ConcurrencyError` for card balance updates
  - Idempotency TTL behavior for write endpoints
  - Outbox sequence allocation semantics (repository allocates when `sequenceNumber=0`)

## Milestones (Designed for First-Pass Success)

### Milestone 0 — “Runnable AWS Mode” (fast feedback loop)
**DoD**
- `bun run emulator:start:aws` starts LocalStack with required services.
- `bun run dev:aws` boots API and `GET /health/liveness` returns 200.
- A basic flow works end-to-end in AWS mode: `POST /v1/users` → `GET /v1/dashboard`.

### Milestone 1 — “Persistence Parity” (contract tests pass)
**DoD**
- DynamoDB repositories satisfy the existing interfaces and all `tests/contract` pass when run in AWS mode.
- Concurrency conflicts surface as `ConcurrencyError` and map to existing HTTP error behavior.
- Pagination cursors remain opaque strings (contract compatibility); encoding may be base64 JSON of DynamoDB keys where needed.

### Milestone 2 — “AWS Auth + Transport (Optional but Spec’d)”
**DoD**
- `IAuthProvider` is backed by LocalStack Cognito (with an explicitly documented LocalStack fallback if required).
- `IEventPublisher.publish()` sends to EventBridge/SQS while still triggering in-process subscriptions (WhatsApp handlers rely on `subscribe()` today).

### Milestone 3 — “CI-grade LocalStack Tests + Reset”
**DoD**
- `bun run test:aws` runs a deterministic subset (or full set) against LocalStack.
- `bun run emulator:reset:aws` recreates a clean environment.

## Parity Matrix (What Must Be Designed Up Front)

This is the minimum “design surface area” that should be explicitly mapped before coding repositories.

| Interface | Methods to support | DynamoDB design notes (required) |
|---|---|---|
| `IUserRepository` | `findById`, `findByFirebaseUid`, `save`, `updateScore`, `updateCardSummary`, `getScoreHistory`, `delete`, `deleteAll` | Users table PK=`ecosystemId`; GSI on `firebaseUid`; scores as separate table PK=`ecosystemId` + time-ordered SK |
| `ICardRepository` | `findById`, `findByUser`, `save`, `updateBalance`, `updateStatus`, `delete`, `deleteAllForUser` | Cards table PK=`ecosystemId` + SK=`cardId`; conditional writes for `version`; consider transactional delete of card+transactions |
| `ICardRequestRepository` | `findById`, `findPendingByUser`, `findAllPending`, `findRejectedByUser`, `save`, `updateStatus`, `delete`, `deleteAllForUser`, `countRequiringAttention` | Pending listing needs GSI by `status` + sortable key; tier filter can be GSI or in-memory; attention count can be query by `createdAt<=sevenDaysAgo` |
| `ITransactionRepository` | `findByCard`, `findById`, `save`, `getRecent`, `deleteAllForCard`, `deleteAllForUser` | Transactions table key must support time-ordered listing (timestamp-based SK); cursor likely encodes PK+SK |
| `IIdempotencyRepository` | `find`, `save`, `deleteExpired`, `deleteAllForUser` | TTL is not immediate; treat expired as missing even if item still present |
| `IOutboxRepository` | `save`, `findPending`, `markSent`, `markFailed`, `markDeadLettered`, `findReadyForRetry`, `clear` | Needs per-entity monotonic sequences and retry queries; choose a sequence strategy that does not rely on “transaction returns updated counter” |
| WhatsApp + Pending | per respective interfaces | Keep in-process subscription behavior working in AWS mode |

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] Uses Bun for install/scripts (`bun install`, `bun run <script>`)
- [x] Backend (if any) is TypeScript + Express on Firebase Functions *(Note: Express remains unchanged, only infrastructure layer swapped)*
- [ ] Frontend (if any) is Next.js, bootstrapped via Bun docs, commands recorded *(N/A - no frontend changes)*
- [x] Event publishing (if any) uses transactional outbox to Redpanda/Kafka *(EventBridge/SQS replaces transport but outbox pattern preserved per CC-003)*

**Constitution Compliance Notes**:
- CC-001: All new scripts use `bun run` prefix
- CC-002: Express compute layer unchanged - only infrastructure implementations added
- CC-003: Transactional outbox pattern preserved; EventBridge/SQS is transport layer only
- CC-004: No domain or application layer changes - pure infrastructure addition

## Project Structure

### Documentation (this feature)

```text
specs/004-aws-localstack-infrastructure/
├── plan.md              # This file
├── research.md          # Phase 0: Technology decisions and patterns
├── data-model.md        # Phase 1: DynamoDB table schemas and GSIs
├── quickstart.md        # Phase 1: AWS mode setup guide
├── contracts/           # Phase 1: Preserved API contracts (no changes)
└── tasks.md             # Phase 2: Implementation tasks (/speckit.tasks)
```

### Source Code (repository root)

```text
src/
├── api/                          # Unchanged - Express routes, middleware
├── application/                  # Unchanged - CQRS commands and queries
├── domain/                       # Unchanged - Entities, services, value objects
├── functions/                    # Unchanged - Firebase Functions entry points
└── infrastructure/
    ├── auth/
    │   ├── index.ts              # Modified - export CognitoAuthProvider
    │   ├── auth-provider.interface.ts  # Unchanged
    │   ├── firebase-auth-provider.ts   # Unchanged
    │   ├── mock-auth-provider.ts       # Unchanged
    │   └── cognito-auth-provider.ts    # NEW - Cognito implementation
    ├── config/
    │   ├── remote-config.service.ts    # Unchanged
    │   ├── remote-config.types.ts      # Unchanged
    │   └── ssm-config.service.ts       # NEW - SSM Parameter Store implementation
    ├── di/
    │   └── container-factory.ts        # Modified - add createAWSContainer(), createLocalStackContainer()
    ├── events/
    │   ├── index.ts                    # Modified - export EventBridgeSQSPublisher
    │   ├── event-publisher.interface.ts    # Unchanged
    │   ├── inmemory-event-publisher.ts     # Unchanged
    │   └── eventbridge-sqs-publisher.ts    # NEW - EventBridge/SQS implementation
    └── persistence/
        ├── index.ts                    # Modified - export AWS repositories
        ├── interfaces/                 # Unchanged - repository interfaces
        ├── firestore/                  # Unchanged - Firestore implementations
        ├── inmemory/                   # Unchanged - InMemory implementations
        └── aws/                        # NEW - DynamoDB implementations
            ├── index.ts
            ├── client.ts               # DynamoDB client initialization
            ├── table-names.ts          # Table name constants
            ├── codec.ts                # Date/type conversion utilities
            ├── user.repository.ts
            ├── card.repository.ts
            ├── card-request.repository.ts
            ├── transaction.repository.ts
            ├── idempotency.repository.ts
            ├── outbox.repository.ts
            ├── audit-log.repository.ts
            ├── whatsapp-notification.repository.ts
            ├── whatsapp-inbound.repository.ts
            └── pending-approval.repository.ts

scripts/
├── start-dev.ts                    # Modified - add 'aws' mode
└── localstack-init/
    └── 01-create-resources.sh      # NEW - LocalStack initialization

docker-compose.aws.yml              # NEW - LocalStack services

tests/
├── contract/                       # Run with AWS mode for contract verification
├── integration/                    # Run with AWS mode for integration testing
└── unit/                           # Unchanged - uses InMemory repositories
```

**Structure Decision**: Extends existing single-project structure with new `src/infrastructure/persistence/aws/` directory for DynamoDB repositories, paralleling the existing `firestore/` and `inmemory/` directories. No architectural changes to existing structure.

## Complexity Tracking

> No constitution violations requiring justification. AWS infrastructure is additive and follows existing patterns.

| Pattern | Rationale | Alternative Considered |
|---------|-----------|------------------------|
| 10 repository files | Each mirrors existing Firestore repository, maintaining 1:1 parity | Single mega-repository rejected for maintainability |
| LocalStack Docker | Provides AWS service emulation without cloud costs | Direct AWS Sandbox rejected for cost and complexity |
| Environment-based mode switching | Container factory pattern already established | Build-time configuration rejected for flexibility |
