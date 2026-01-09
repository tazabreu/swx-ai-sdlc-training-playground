# Tasks: AWS LocalStack Infrastructure

**Input**: `specs/004-aws-localstack-infrastructure/spec.md` + `specs/004-aws-localstack-infrastructure/plan.md`
**Baseline contracts**: `specs/001-headless-financial-api/contracts/openapi.yaml` (validated by `tests/contract`)
**Tooling note**: Use Bun for installs and scripts (e.g., `bun install`, `bun run dev:aws`, `bun test`).

## Milestones (Definition of Done)

- **M0 Runnable AWS mode**: `bun run emulator:start:aws` + `bun run dev:aws` works; `GET /health/liveness` returns 200.
- **M1 Persistence parity**: With `USE_AWS=true`, `bun test tests/contract` passes unchanged.
- **M2 AWS auth + external transport (optional)**: Cognito-backed `IAuthProvider` + EventBridge/SQS publishing while preserving in-process subscriptions.
- **M3 CI-grade LocalStack**: `bun run test:aws` is deterministic; `bun run emulator:reset:aws` restores clean state.

## Format: `[ID] [P?] Description`

- **[P]** = can run in parallel (different files, no shared dependencies)
- Each task MUST mention exact file paths and the interface/methods it targets.

---

## Phase 0: Make AWS Mode Runnable (M0)

- [X] T001 Add `aws` mode to `scripts/start-dev.ts` (set `USE_AWS=true`, `AWS_ENDPOINT_URL=http://localhost:4566`, and dependency health checks for port 4566).
- [X] T002 Update `package.json` scripts: `dev:aws`, `emulator:start:aws`, `emulator:stop:aws`, `emulator:logs:aws`, `emulator:reset:aws`, `test:aws`.
- [X] T003 [P] Add `docker-compose.aws.yml` with LocalStack (port 4566; enable: dynamodb, cognito-idp, events, sqs, ssm).
- [X] T004 [P] Add `scripts/localstack-init/01-create-resources.sh` to create DynamoDB tables + GSIs required by repository access patterns.
- [X] T005 Update `specs/004-aws-localstack-infrastructure/quickstart.md` so smoke checks use `GET /health/liveness` and a minimal flow (`POST /v1/users` → `GET /v1/dashboard`), and remove/replace any non-existent scripts.

**Checkpoint**: `bun run emulator:start:aws && bun run dev:aws` and `curl http://localhost:3000/health/liveness`.

---

## Phase 1: Dependencies + AWS Client Utilities

- [X] T006 Add AWS SDK v3 dependencies to `package.json` (DynamoDB, Cognito, EventBridge, SQS, SSM, `aws-jwt-verify`).
- [X] T007 Run `bun install`.
- [X] T008 Create `src/infrastructure/persistence/aws/client.ts` (DynamoDBClient + DynamoDBDocumentClient; LocalStack endpoint override; safe defaults for credentials).
- [X] T009 [P] Create `src/infrastructure/persistence/aws/table-names.ts` (table name constants).
- [X] T010 [P] Create `src/infrastructure/persistence/aws/codec.ts` (Date ↔ string helpers; cursor encoding helpers; undefined-stripping/marshalling rules).
- [X] T011 Create `src/infrastructure/persistence/aws/index.ts` (exports for AWS persistence module).

---

## Phase 2: DynamoDB Repository Implementations (M1)

**Rule**: Implement the existing interfaces exactly. Do not change domain/application/API layers.

- [X] T012 [P] Implement `src/infrastructure/persistence/aws/user.repository.ts` (`IUserRepository`: `findById`, `findByFirebaseUid`, `save`, `updateScore`, `updateCardSummary`, `delete`, `getScoreHistory`, `deleteAll`).
- [X] T013 [P] Implement `src/infrastructure/persistence/aws/card.repository.ts` (`ICardRepository`: `findById`, `findByUser`, `save`, `updateBalance`, `updateStatus`, `delete`, `deleteAllForUser`). Ensure DynamoDB conditional failures throw `ConcurrencyError` (`src/infrastructure/persistence/interfaces/card.repository.ts`).
- [X] T014 [P] Implement `src/infrastructure/persistence/aws/card-request.repository.ts` (`ICardRequestRepository`: `findById`, `findPendingByUser`, `findAllPending`, `findRejectedByUser`, `save`, `updateStatus`, `delete`, `deleteAllForUser`, `countRequiringAttention`). Ensure pagination cursors remain opaque strings (cursor may need to encode PK+SK).
- [X] T015 [P] Implement `src/infrastructure/persistence/aws/transaction.repository.ts` (`ITransactionRepository`: `findByCard` with cursor pagination + optional type filter, `findById`, `save`, `getRecent`, `deleteAllForCard`, `deleteAllForUser`).
- [X] T016 [P] Implement `src/infrastructure/persistence/aws/idempotency.repository.ts` (`IIdempotencyRepository`: `find`, `save`, `deleteExpired`, `deleteAllForUser`). Treat TTL as eventually consistent: expired items MUST be treated as missing even if not yet deleted.
- [X] T017 [P] Implement `src/infrastructure/persistence/aws/outbox.repository.ts` (`IOutboxRepository`: `save`, `findPending`, `markSent`, `markFailed`, `markDeadLettered`, `findReadyForRetry`, `clear`). Must preserve per-entity monotonic `sequenceNumber` allocation when `sequenceNumber=0` (see Firestore/InMemory repos).
- [X] T018 [P] Implement `src/infrastructure/persistence/aws/audit-log.repository.ts` (`IAuditLogRepository`: `save`, `findByTarget`, `findByActor`, `clear`) with cursor pagination.
- [X] T019 [P] Implement `src/infrastructure/persistence/aws/whatsapp-notification.repository.ts` (`IWhatsAppNotificationRepository`: `save`, `findById`, `findByRelatedEntity`, `findPendingDelivery`, `findReadyForRetry`, `updateDeliveryStatus`, `incrementRetry`, `deleteAll`).
- [X] T020 [P] Implement `src/infrastructure/persistence/aws/whatsapp-inbound.repository.ts` (`IWhatsAppInboundRepository`: `save`, `findById`, `findByWppMessageId`, `findBySenderPhone`, `updateProcessingStatus`, `deleteAll`).
- [X] T021 [P] Implement `src/infrastructure/persistence/aws/pending-approval.repository.ts` (`IPendingApprovalRepository`: `save`, `findByRequestId`, `findPendingByRequestId`, `updateApprovalStatus`, `findExpired`, `markExpired`, `deleteAll`).

---

## Phase 3: AWS Container Wiring (M1)

- [X] T022 Export AWS repositories from `src/infrastructure/persistence/aws/index.ts` and (if needed) from `src/infrastructure/persistence/*/index.ts` aggregators.
- [X] T023 Update `src/infrastructure/di/container-factory.ts`:
  - Add an AWS container builder (e.g., `createAwsContainer()`).
  - Select it when `process.env.USE_AWS === 'true'` (precedence over other modes must be documented).
- [X] T024 Ensure `wireEventHandlers()` remains active in AWS mode (WhatsApp handlers depend on `IEventPublisher.subscribe()`).  

**Checkpoint**: `USE_AWS=true bun test tests/contract` passes unchanged.

---

## Phase 4: LocalStack Testing + Reset (M3)

- [X] T025 Implement `bun run test:aws` to run contract tests in AWS mode (and optionally a targeted integration suite).
- [X] T026 Add DynamoDB-focused integration tests for edge cases: optimistic locking conflict, idempotency expiry behavior, outbox retry/backoff semantics.
- [X] T027 Implement `bun run emulator:reset:aws` to recreate LocalStack state (tables/GSIs cleanly recreated).

---

## Phase 5: AWS Auth + Transport (Optional, M2)

- [X] T028 Implement `src/infrastructure/auth/cognito-auth-provider.ts` (satisfy `IAuthProvider` without Firebase; document any LocalStack-only fallback behavior explicitly).
- [X] T029 Implement `src/infrastructure/events/eventbridge-sqs-publisher.ts` (satisfy `IEventPublisher`: publish externally + still execute in-process subscriptions).
- [X] T030 If remote config is required in AWS mode, implement an SSM-backed config loader without changing domain/application code (defaults remain the baseline).

---

## Phase 6: Documentation

- [X] T031 Update `README.md` and `CLAUDE.md` with AWS mode commands and expectations.
- [X] T032 Ensure `specs/004-aws-localstack-infrastructure/data-model.md` matches current domain entities + repository access patterns (remove any fields/statuses that don’t exist in code today).
