# Feature Specification: AWS LocalStack Infrastructure

**Feature Branch**: `004-aws-localstack-infrastructure`
**Created**: 2026-01-07
**Status**: Draft
**Input**: User description: "Add alternate AWS infrastructure (DynamoDB, Cognito, EventBridge/SQS, SSM Parameter Store) alongside existing GCP/Firebase, with LocalStack for local development via `bun run dev:aws`"

## Baseline (Current Code)

This spec is an *infrastructure swap*, not a product change. “Identical behavior” means:
- Requests/responses match the existing HTTP contracts (`specs/001-headless-financial-api/contracts/openapi.yaml`) and pass `tests/contract`.
- Domain + application logic stays unchanged; only infrastructure implementations and environment wiring change.
- The service exposes health at `GET /health/liveness` and `GET /health/readiness` (not `/health`).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Developer Runs API Against LocalStack (Priority: P1)

A developer wants to run the Financial API locally against AWS services (via LocalStack) instead of Firebase emulators, allowing them to develop and test AWS-specific infrastructure code without cloud costs or Firebase dependencies.

**Why this priority**: This is the core developer experience - without this, the entire feature has no value. Developers must be able to start LocalStack, run the API, and interact with it exactly as they would with Firebase mode.

**Independent Test**: Can be tested by running `bun run emulator:start:aws` followed by `bun run dev:aws`, then verifying `GET /health/liveness` returns 200 and a basic authenticated flow works (create user → dashboard).

**Acceptance Scenarios**:

1. **Given** LocalStack is not running, **When** developer runs `bun run emulator:start:aws`, **Then** LocalStack container starts with DynamoDB, Cognito, EventBridge, SQS, and SSM services available on port 4566
2. **Given** LocalStack is running and initialized, **When** developer runs `bun run dev:aws`, **Then** the API starts and connects to LocalStack services instead of Firebase
3. **Given** API is running in AWS mode, **When** developer calls any existing API endpoint, **Then** the endpoint behaves identically to other modes (passes `tests/contract` with no contract changes)
4. **Given** API is running in AWS mode, **When** developer stops LocalStack, **Then** API operations fail gracefully with appropriate error messages

---

### User Story 2 - Developer Tests Against LocalStack (Priority: P2)

A developer wants to run integration tests against LocalStack to verify that AWS infrastructure implementations work correctly before deploying to real AWS.

**Why this priority**: After basic API functionality works, developers need confidence that tests pass against AWS infrastructure, enabling CI/CD pipelines and code quality assurance.

**Independent Test**: Can be tested by running `bun run test:aws` and verifying all integration tests pass against LocalStack.

**Acceptance Scenarios**:

1. **Given** LocalStack is running with all resources initialized, **When** developer runs `bun run test:aws`, **Then** integration tests execute against LocalStack services
2. **Given** tests are running against LocalStack, **When** tests complete, **Then** test results show pass/fail status identical to what would occur against real AWS
3. **Given** a test creates data in DynamoDB via LocalStack, **When** the test queries for that data, **Then** the data is retrievable and correctly structured

---

### User Story 3 - Developer Resets LocalStack State (Priority: P3)

A developer wants to reset LocalStack to a clean state (recreating all tables, users, queues) to ensure reproducible test environments.

**Why this priority**: Clean state management is essential for reliable testing but is a secondary concern after basic functionality works.

**Independent Test**: Can be tested by creating data, running reset, and verifying data is cleared while infrastructure remains available.

**Acceptance Scenarios**:

1. **Given** LocalStack has data from previous test runs, **When** developer runs `bun run emulator:reset:aws`, **Then** all data is cleared and infrastructure is recreated from scratch
2. **Given** reset command completes, **When** developer runs `bun run dev:aws`, **Then** API starts successfully with empty but ready data stores

---

### User Story 4 - Seamless Mode Switching (Priority: P3)

A developer wants to switch between Firebase mode and AWS mode without code changes, using only environment variables or startup commands.

**Why this priority**: This enables the same codebase to run against either cloud provider, supporting multi-cloud strategies and gradual migration paths.

**Independent Test**: Can be tested by running the API in Firebase mode, stopping, then running in AWS mode, and verifying both work with the same API contracts.

**Acceptance Scenarios**:

1. **Given** developer has both Firebase emulator and LocalStack available, **When** they switch from `bun run dev:emulator` to `bun run dev:aws`, **Then** API connects to LocalStack without code changes
2. **Given** API runs in AWS mode, **When** developer checks the same endpoints used in Firebase mode, **Then** responses match the same API contracts

---

### Edge Cases

- What happens when LocalStack container fails to start within the expected initialization time?
- How does the system handle LocalStack being unavailable mid-operation (e.g., container crash)?
- What happens when DynamoDB conditional writes conflict (optimistic locking failure)?
- How does the system behave when Cognito token verification fails with LocalStack?
- What happens when EventBridge/SQS message publishing fails?
- How does the system handle SSM Parameter Store returning empty/missing parameters?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST support running the Financial API against LocalStack as an alternative to Firebase emulators
- **FR-002**: System MUST provide DynamoDB implementations for all existing Firestore repositories (users, cards, card-requests, transactions, scores, idempotency, outbox, audit-logs, whatsapp-notifications, whatsapp-inbound, pending-approvals)
- **FR-003**: System MUST provide an AWS-mode authentication provider that satisfies the existing `IAuthProvider` contract *without requiring Firebase emulators* (preferred: Cognito; acceptable for LocalStack-only dev: explicitly non-production verification fallback if Cognito/JWKS is unreliable)
- **FR-004**: System MUST preserve the current outbox processing behavior and in-process subscriptions (used for WhatsApp handlers) while enabling AWS transport publishing (EventBridge/SQS) as the external delivery mechanism
- **FR-005**: If configuration is fetched from a remote config source in AWS mode, it MUST be read from SSM Parameter Store (otherwise use the existing defaults/local config)
- **FR-006**: System MUST support optimistic locking for card balance updates using DynamoDB conditional writes
- **FR-007**: System MUST support atomic sequence allocation for outbox events using DynamoDB transactions
- **FR-008**: System MUST auto-initialize all LocalStack resources (tables, user pools, queues, parameters) on container startup
- **FR-009**: System MUST support cursor-based pagination consistent with existing API contracts
- **FR-010**: System MUST maintain identical API request/response contracts regardless of infrastructure mode
- **FR-011**: System MUST support TTL-based expiration for idempotency records
- **FR-012**: System MUST detect infrastructure mode via environment variables (e.g., `USE_AWS=true`, `AWS_ENDPOINT_URL=http://localhost:4566`) with clear precedence over existing mode selection

### Constitution Constraints *(mandatory)*

- **CC-001**: Package management and scripts MUST use Bun (`bun install`, `bun run <script>`)
- **CC-002**: Backend MUST remain TypeScript + Express (AWS mode is infrastructure-only, not compute change)
- **CC-003**: Events MUST continue to follow transactional outbox pattern (EventBridge/SQS replaces Kafka/Redpanda transport)
- **CC-004**: No changes to domain or application layers - only infrastructure implementations

### Key Entities *(include if feature involves data)*

- **DynamoDB Tables**: 12 tables mirroring Firestore collections (users, cards, card-requests, transactions, scores, idempotency, outbox, outbox-sequences, audit-logs, whatsapp-notifications, whatsapp-inbound, pending-approvals)
- **Cognito User Pool**: User authentication pool with custom attributes for role and ecosystemId
- **EventBridge Event Bus**: Central event routing for domain events
- **SQS Queue**: Reliable message delivery for event consumers
- **SSM Parameters**: Configuration values under /tazco/financial-api/ path

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Developers can start LocalStack and run the API against it within 2 minutes using documented commands
- **SC-002**: All existing API endpoints function identically in AWS mode (same request/response contracts pass contract tests)
- **SC-003**: All existing integration tests pass when run against LocalStack infrastructure
- **SC-004**: System correctly handles concurrent card balance updates using optimistic locking (no lost updates in concurrent scenarios)
- **SC-005**: Outbox events maintain strict ordering guarantees via atomic sequence allocation
- **SC-006**: Infrastructure mode can be switched via environment variables without code changes or recompilation
- **SC-007**: LocalStack initialization completes automatically, creating all required resources without manual intervention
- **SC-008**: Both Firebase and AWS modes can coexist in the same codebase - selecting mode requires only changing startup command

## Scope & Boundaries

### In Scope

- DynamoDB repository implementations for all existing data stores
- Cognito authentication provider implementation
- EventBridge/SQS event publisher implementation
- SSM Parameter Store config service implementation
- LocalStack Docker Compose configuration and initialization scripts
- New npm scripts for AWS mode operations
- Container factory updates for AWS mode dependency injection

### Out of Scope

- Real AWS deployment (only LocalStack for now)
- Changes to domain entities, application services, or business logic
- Changes to API routes, DTOs, or middleware contracts
- AWS Lambda or other compute changes (Express remains the compute layer)
- Migration tools or data sync between Firebase and AWS
- Production AWS infrastructure (Terraform, CloudFormation, etc.)

## Assumptions

- LocalStack Community Edition provides sufficient functionality for DynamoDB, Cognito, EventBridge, SQS, and SSM
- Docker is available on developer machines for running LocalStack
- AWS SDK v3 is compatible with LocalStack endpoints
- The existing repository interfaces are sufficiently abstract to support DynamoDB implementations
- Cognito custom attributes can map to the existing AuthTokenClaims structure
- DynamoDB Global Secondary Indexes can satisfy existing query patterns

## Dependencies

- LocalStack Docker image
- AWS SDK v3 packages (@aws-sdk/client-dynamodb, @aws-sdk/lib-dynamodb, @aws-sdk/client-cognito-identity-provider, @aws-sdk/client-eventbridge, @aws-sdk/client-sqs, @aws-sdk/client-ssm)
- aws-jwt-verify library for Cognito token validation
- Docker and Docker Compose for LocalStack orchestration
