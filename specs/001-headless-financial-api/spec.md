# Feature Specification: Headless Financial API

**Feature Branch**: `001-headless-financial-api`  
**Created**: 2026-01-03  
**Status**: Implemented (core API) / Spec contains non-implemented acceptance scenarios  
**Input**: User description: "Headless financial backend service with Firebase authentication, credit card management, user scoring, admin controls, event-driven architecture via message streaming, and comprehensive test coverage"

## Overview

A backend-only financial service enabling users to authenticate, view their financial dashboard, request credit cards, and manage payments. The system uses a scoring mechanism to determine card approval and credit limits. Administrators can manage user scores and reset the system. All state changes are published to a message stream for downstream consumers.

**Key Design Principles**:
- **Idempotent Operations**: All write operations are idempotent with client-provided idempotency keys
- **Eventual Consistency**: Events are guaranteed to be delivered via outbox pattern with at-least-once semantics
- **Fail-Safe Defaults**: System fails closed (denies) on authentication/authorization errors
- **Graceful Degradation**: Core operations continue even when non-critical dependencies are unavailable

## Implementation Notes (Repo Truth)

As of 2026-01-14, the repository implementation differs from some scenarios in this document:

- The API does **not** provide a "login" endpoint that returns tokens. Local development uses **mock tokens** (`mock.<base64>.sig`) and/or emulator-generated tokens (see `LOCAL_TESTING_GUIDE.md`).
- A Next.js frontend exists in `frontend/` (this spec remains focused on the backend API).
- Streaming (Kafka/Redpanda), BigQuery analytics, and OpenTelemetry are intentionally **not implemented** yet; they remain future work.

## Scope Guardrails

The following are **not** mandated by this specification and should be treated
as optional plan additions that require explicit approval:
- Customer360 analytics
- BigQuery medallion architecture
- Redpanda/Kafka event streaming
- Login UX and token issuance endpoints (expected to live in a future BFF)

---

## Roadmap: Future Spec (003) — Streaming + Observability

This feature spec (`001-headless-financial-api`) and the current implementation
are the **base** for a future specification (`003-streaming-and-observability`).

**Spec 003** is expected to cover (in this order):
1. **Streaming to BigQuery** for analytics (prefer Firebase/Google-managed options such as Firebase Extensions if viable; otherwise implement a minimal custom pipeline).
2. **Provision Redpanda** and forward/publish **domain events** to it.
3. **Add OpenTelemetry** instrumentation end-to-end to explore traces/logs/metrics in **Grafana LGTM** (Loki/Grafana/Tempo/Mimir) or Datadog.

Until Spec 003 is approved, `001` remains intentionally focused on the core
Cards-domain HTTP API + persistence + outbox guarantees + tests.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - User Authentication (Priority: P1)

A user authenticates with the system using Firebase credentials in a headless (API-only) manner. Upon successful authentication, they receive a token that grants access to protected endpoints.

**Why this priority**: Authentication is the foundation—no other functionality works without it. This is the critical path for all user interactions.

**Independent Test**: Can be fully tested by sending authentication credentials and verifying a valid token is returned. Delivers the ability to access any protected resource.

**Acceptance Scenarios**:

1. **Given** valid Firebase credentials, **When** the user authenticates via the API, **Then** they receive a valid authentication token
2. **Given** invalid Firebase credentials, **When** the user attempts to authenticate, **Then** they receive a 401 error with a generic "authentication failed" message (no credential leakage)
3. **Given** a valid token, **When** the user accesses a protected endpoint, **Then** the request is authorized
4. **Given** an expired token, **When** the user accesses a protected endpoint, **Then** they receive a 401 with "token_expired" error code
5. **Given** a malformed token, **When** the user accesses a protected endpoint, **Then** they receive a 401 with "invalid_token" error code
6. **Given** a valid token but disabled user account, **When** they access any endpoint, **Then** they receive a 403 with "account_disabled" error
7. **Given** the authentication service is unavailable, **When** a user attempts to authenticate, **Then** they receive a 503 with retry-after header
8. **Given** excessive failed login attempts from an IP, **When** another attempt is made, **Then** the request is rate-limited with 429 response

---

### User Story 2 - Dashboard Summary (Priority: P1)

An authenticated user retrieves their financial dashboard showing their current status: products they're signed up for, active cards, pending requests, and current score.

**Why this priority**: The dashboard is the primary entry point for users to understand their financial state and determine next actions.

**Independent Test**: Can be fully tested by authenticating a user and calling the dashboard endpoint. Delivers a complete picture of the user's financial status.

**Acceptance Scenarios**:

1. **Given** an authenticated user with products, **When** they request their dashboard, **Then** they see a summary of all their active products
2. **Given** an authenticated user with cards, **When** they request their dashboard, **Then** they see their cards with status, limits, available credit, and current balance
3. **Given** an authenticated user with pending card requests, **When** they request their dashboard, **Then** they see the pending requests with submission date and current status
4. **Given** a new authenticated user with no products, **When** they request their dashboard, **Then** they see an empty state with suggested actions
5. **Given** an authenticated user, **When** they request dashboard, **Then** response includes last-updated timestamp for cache validation
6. **Given** an authenticated user requesting dashboard, **When** the request includes If-None-Match header with current ETag, **Then** response is 304 Not Modified
7. **Given** database is temporarily unavailable, **When** user requests dashboard, **Then** cached response is returned (if available) with stale-while-revalidate header

---

### User Story 3 - Product Offers (Priority: P2)

An authenticated user retrieves personalized product offers. If the user doesn't have a credit card, they are offered one. Offers are tailored based on the user's current products and score.

**Why this priority**: Drives user engagement and product adoption. Depends on knowing user's current products (dashboard).

**Independent Test**: Can be fully tested by authenticating users with different product portfolios and verifying appropriate offers are returned.

**Acceptance Scenarios**:

1. **Given** an authenticated user without a credit card, **When** they request product offers, **Then** they see a credit card offer with terms based on their score
2. **Given** an authenticated user who already has a credit card, **When** they request product offers, **Then** credit card is not in the offers
3. **Given** an authenticated user with a high score (≥700), **When** they request product offers, **Then** offers show premium terms: higher limits ($10,000), lower rates
4. **Given** an authenticated user with a medium score (500-699), **When** they request product offers, **Then** offers show standard terms: standard limits ($5,000)
5. **Given** an authenticated user with a low score (<500), **When** they request product offers, **Then** offers indicate "subject to approval" with conservative limits ($2,000)
6. **Given** an authenticated user with score at exact boundary (500 or 700), **When** they request offers, **Then** they receive the higher tier benefits
7. **Given** an authenticated user with a rejected card request in last 30 days, **When** they request product offers, **Then** credit card offer includes note about cooldown period

---

### User Story 4 - Card Request and Approval (Priority: P2)

An authenticated user requests a credit card. The system evaluates their score to determine auto-approval eligibility. High-score users get auto-approved with higher limits; others enter a pending state for admin review.

**Why this priority**: Core business transaction that converts interest into active products. Depends on authentication and scoring.

**Independent Test**: Can be fully tested by submitting card requests for users with different scores and verifying approval outcomes.

**Acceptance Scenarios**:

1. **Given** a user with a high score (≥700), **When** they request a credit card, **Then** the card is auto-approved within 3 seconds with $10,000 limit
2. **Given** a user with a medium score (500-699), **When** they request a credit card, **Then** the card is auto-approved within 3 seconds with $5,000 limit
3. **Given** a user with a low score (<500), **When** they request a credit card, **Then** the request enters pending status and confirmation includes estimated review time
4. **Given** a user with an existing credit card request pending, **When** they request another credit card, **Then** request is rejected with 409 Conflict and existing request ID
5. **Given** a user with an active credit card, **When** they request another credit card, **Then** request is rejected with 409 Conflict explaining single-card policy
6. **Given** a pending card request, **When** an admin approves it with custom limit, **Then** the card becomes active with that limit
7. **Given** a pending card request, **When** an admin rejects it with reason, **Then** the request is marked rejected and reason is visible to user
8. **Given** a card request with idempotency key, **When** same request is submitted again, **Then** original response is returned without creating duplicate
9. **Given** a user whose score changed after submitting request, **When** admin reviews, **Then** both original score and current score are shown
10. **Given** a card request that has been pending for 7+ days, **When** admin views pending requests, **Then** it is flagged as "requires attention"

---

### User Story 5 - View Cards (Priority: P2)

An authenticated user retrieves their cards, optionally filtered by type. They can see card details, status, limits, and balances.

**Why this priority**: Essential for users to manage their financial products. Depends on having cards.

**Independent Test**: Can be fully tested by authenticating a user with cards and retrieving their card list with various filters.

**Acceptance Scenarios**:

1. **Given** an authenticated user with multiple cards, **When** they request their cards, **Then** they see all their cards ordered by creation date (newest first)
2. **Given** an authenticated user, **When** they request cards with filter `?type=credit-card`, **Then** they see only credit cards
3. **Given** an authenticated user, **When** they request cards with invalid type filter, **Then** they receive 400 Bad Request with valid types listed
4. **Given** an authenticated user with no cards, **When** they request their cards, **Then** they see empty array (not null) with suggestion to request a card
5. **Given** an authenticated user, **When** they request card details, **Then** they see: limit, available credit, current balance, minimum payment due, next due date, status, card type
6. **Given** an authenticated user requesting another user's card by ID, **When** the request is processed, **Then** they receive 404 Not Found (not 403, to prevent enumeration)
7. **Given** an authenticated user with a card approaching limit (>90% utilized), **When** they view cards, **Then** the card includes a "near_limit" warning flag

---

### User Story 6 - Purchase and Payment Simulation (Priority: P3)

Users can simulate purchases on their credit cards and make payments. On-time payments improve the user's score; late payments decrease it.

**Why this priority**: Demonstrates the full lifecycle of card usage and score dynamics. Depends on having active cards.

**Independent Test**: Can be fully tested by simulating purchases and payments with different timing and verifying score changes.

**Acceptance Scenarios**:

1. **Given** a user with an active credit card, **When** they simulate a purchase within available credit, **Then** the purchase is recorded, balance increases, available credit decreases
2. **Given** a user with an active credit card, **When** they simulate a purchase exceeding available credit, **Then** purchase is rejected with 402 Payment Required and available credit shown
3. **Given** a user with an active credit card, **When** they simulate purchase of exactly available credit, **Then** purchase succeeds and available credit becomes zero
4. **Given** a user with a balance and due date in future, **When** they make a payment, **Then** score increases by 10-50 points based on payment percentage
5. **Given** a user with a balance, **When** they make a payment after due date, **Then** score decreases by 20-100 points based on days overdue
6. **Given** a user with a balance, **When** they make a full payment, **Then** balance becomes zero and next statement shows $0 minimum due
7. **Given** a user with $100 balance, **When** they submit payment of $150, **Then** payment is rejected with 400 and message "payment exceeds balance"
8. **Given** a user with zero balance, **When** they submit a payment, **Then** payment is rejected with 400 "no balance to pay"
9. **Given** a user submitting payment with idempotency key, **When** same payment submitted again, **Then** original response returned (no double payment)
10. **Given** a purchase/payment in progress, **When** another request arrives for same card, **Then** second request waits or fails with 409 to prevent race conditions
11. **Given** a user makes minimum payment on time, **When** score is calculated, **Then** score increases by minimum amount (+10)
12. **Given** a user makes full payment on time, **When** score is calculated, **Then** score increases by maximum amount (+50)
13. **Given** a user's score would exceed 1000 from payment, **When** calculated, **Then** score caps at 1000
14. **Given** a user's score would drop below 0 from late payment, **When** calculated, **Then** score floors at 0

---

### User Story 7 - Admin Score Management (Priority: P3)

Administrators can view and adjust user scores. This enables manual intervention for special cases or corrections.

**Why this priority**: Administrative capability for system governance. Depends on the scoring system being in place.

**Independent Test**: Can be fully tested by authenticating as admin and modifying user scores.

**Acceptance Scenarios**:

1. **Given** an admin user, **When** they request a user's score by slug, **Then** they see current score, score history (last 10 changes), and tier
2. **Given** an admin user, **When** they update a user's score with reason, **Then** score is changed, change is logged with admin ID, timestamp, previous value, and reason
3. **Given** a non-admin user, **When** they attempt to access admin score endpoints, **Then** they receive 403 Forbidden
4. **Given** an admin attempts to set score above 1000, **When** request is processed, **Then** request is rejected with 400 "score must be 0-1000"
5. **Given** an admin attempts to set score below 0, **When** request is processed, **Then** request is rejected with 400 "score must be 0-1000"
6. **Given** an admin sets score to exact boundary (0, 500, 700, 1000), **When** request is processed, **Then** score is accepted and tier is correctly assigned
7. **Given** an admin modifies score, **When** user next views dashboard, **Then** they see updated score and tier
8. **Given** an admin requests user by non-existent slug, **When** processed, **Then** they receive 404 Not Found
9. **Given** score modification, **When** processed, **Then** a score-changed event is published with admin context

---

### User Story 8 - Admin Card Approval (Priority: P3)

Administrators can view pending card requests and approve or reject them with specified limits.

**Why this priority**: Enables manual approval workflow for low-score users. Depends on card request system.

**Independent Test**: Can be fully tested by creating pending requests and having admin approve/reject them.

**Acceptance Scenarios**:

1. **Given** an admin user, **When** they list pending card requests, **Then** they see all pending requests with: user info, score at request time, current score, days pending, requested product
2. **Given** an admin user, **When** they list pending requests with `?sort=oldest`, **Then** requests are sorted by submission date ascending
3. **Given** a pending card request, **When** admin approves with custom limit, **Then** card is activated with that limit and user is notified
4. **Given** a pending card request, **When** admin approves with limit exceeding tier maximum, **Then** request is rejected with 400 "limit exceeds policy for user's tier"
5. **Given** a pending card request, **When** admin rejects with reason, **Then** request is rejected, reason stored, and user can see reason on dashboard
6. **Given** an already-processed request, **When** admin attempts to approve/reject, **Then** request is rejected with 409 Conflict "request already processed"
7. **Given** admin approval, **When** processed, **Then** card-approved event is published with admin context
8. **Given** pending requests exist, **When** admin lists with pagination, **Then** results support cursor-based pagination with consistent ordering

---

### User Story 9 - System Cleanup (Priority: P3)

Administrators can reset the entire system to a clean state, removing all users, cards, products, and transactions.

**Why this priority**: Essential for testing and demo environments. Independent administrative function.

**Independent Test**: Can be fully tested by populating the system and calling cleanup, then verifying empty state.

**Acceptance Scenarios**:

1. **Given** a system with users, cards, and transactions, **When** an admin triggers cleanup, **Then** all data is removed and system returns to initial state
2. **Given** a non-admin user, **When** they attempt cleanup, **Then** they receive 403 Forbidden
3. **Given** a cleanup operation, **When** it starts, **Then** system enters read-only mode for non-admin users
4. **Given** a cleanup operation, **When** it completes, **Then** a cleanup-completed event is published with item counts deleted
5. **Given** a cleanup operation in progress, **When** another cleanup is requested, **Then** second request receives 409 Conflict "cleanup in progress"
6. **Given** cleanup completes, **When** verified, **Then** event outbox is also cleared (events for deleted entities should not be sent)
7. **Given** cleanup is requested, **When** admin provides confirmation token (double-confirmation), **Then** cleanup proceeds
8. **Given** cleanup is requested without confirmation token, **When** processed, **Then** system returns 400 with "confirmation required" and provides token

---

### User Story 10 - Event Publishing (Priority: P2)

All significant state changes (user creation, card requests, approvals, purchases, payments, score changes) are published to a message stream for downstream consumers.

**Why this priority**: Enables event-driven architecture and integration with other systems. Cross-cutting concern.

**Independent Test**: Can be fully tested by performing actions and verifying corresponding events appear in the stream.

**Acceptance Scenarios**:

1. **Given** a user authenticates for the first time, **When** their account is created, **Then** a `user.created` event is published with user ID and initial score
2. **Given** a card request is submitted, **When** it is processed, **Then** a `card.requested` event is published with request ID, user ID, and product type
3. **Given** a card is auto-approved, **When** completed, **Then** a `card.approved` event is published with decision source "auto"
4. **Given** a card is admin-approved, **When** completed, **Then** a `card.approved` event is published with decision source "admin" and admin ID
5. **Given** a payment is made, **When** processed, **Then** a `payment.processed` event is published with amount, on-time status, and score impact
6. **Given** an event fails to publish, **When** outbox processor runs, **Then** event is retried with exponential backoff (max 5 retries)
7. **Given** an event exceeds max retries, **When** final retry fails, **Then** event is moved to dead-letter queue and alert is raised
8. **Given** message stream is unavailable, **When** operations occur, **Then** operations succeed and events queue in outbox
9. **Given** multiple events for same entity in short window, **When** published, **Then** each event has monotonically increasing sequence number for ordering

---

### User Story 11 - Health and Observability (Priority: P2)

The system exposes health endpoints for monitoring, deployment checks, and operational visibility.

**Why this priority**: Critical for production operations, deployments, and incident response.

**Independent Test**: Can be fully tested by calling health endpoints and verifying accurate status reporting.

**Acceptance Scenarios**:

1. **Given** the system is running, **When** liveness endpoint is called, **Then** it returns 200 if process is alive (basic check)
2. **Given** all dependencies are healthy, **When** readiness endpoint is called, **Then** it returns 200 with dependency status
3. **Given** database is unavailable, **When** readiness endpoint is called, **Then** it returns 503 with "database: unhealthy"
4. **Given** message stream is unavailable, **When** readiness endpoint is called, **Then** it returns 503 with "message_stream: unhealthy"
5. **Given** Firebase is unavailable, **When** readiness endpoint is called, **Then** it returns 503 with "auth_provider: unhealthy"
6. **Given** outbox has events older than 5 minutes, **When** readiness is checked, **Then** warning is included "outbox_backlog: warning"
7. **Given** any API request, **When** processed, **Then** response includes request-id header for tracing
8. **Given** any API error, **When** logged, **Then** log includes request-id, user-id (if authenticated), and stack trace (for 5xx)

---

### Edge Cases (Comprehensive)

**Authentication & Authorization**
- Token expires mid-request → Request fails with 401, response includes "token_expired" code
- Token is valid but user deleted → Returns 403 "account_not_found"
- Admin token used after admin role removed → Returns 403 on admin endpoints
- Concurrent requests with same token → All requests succeed (tokens are stateless)

**Data Integrity**
- User requests card while previous request being processed → Atomic check prevents duplicates via database constraints
- Admin approves card at exact moment user cancels → First operation wins; second gets 409 Conflict
- Score changes during card request processing → Original score is recorded; decision based on score at request time
- Payment submitted while card being cancelled → Payment fails with 409 "card status changed"

**Concurrency & Race Conditions**
- Two purchases submitted simultaneously for same card → Pessimistic locking ensures balance consistency
- Two payments submitted simultaneously → Only first succeeds; second gets 409 with idempotency key mismatch
- Admin modifies score while payment processing → Payment uses score snapshot at start of transaction

**Infrastructure Failures**
- Message stream unavailable → Operations succeed; events queue in outbox with timestamp
- Database read replica lag → Dashboard may show stale data; writes always go to primary
- Redis cache failure → System continues without caching; increased database load accepted

**Boundary Values**
- Score at exact tier boundary (500, 700) → User gets benefits of higher tier
- Payment that would make score exactly 0 or 1000 → Allowed; capped at bounds
- Purchase for exactly $0.00 → Rejected with 400 "amount must be positive"
- Purchase with negative amount → Rejected with 400 "amount must be positive"
- Card limit of $0 → Not allowed; minimum limit is $100

**Resource Limits**
- User with 1000+ transactions requests dashboard → Dashboard returns summary only; transactions paginated
- Admin lists all pending requests (10,000+) → Results are paginated with max 100 per page
- Cleanup with millions of records → Executes in batches; progress reported via events

---

## Requirements *(mandatory)*

### Functional Requirements

**Authentication**
- **FR-001**: System MUST authenticate users via Firebase Authentication tokens
- **FR-002**: System MUST validate tokens on every protected endpoint request
- **FR-003**: System MUST return appropriate error codes for invalid or expired tokens
- **FR-004**: System MUST rate-limit authentication attempts (max 10/minute per IP)
- **FR-005**: System MUST reject tokens for disabled accounts with 403

**Dashboard**
- **FR-006**: System MUST provide an endpoint to retrieve user dashboard summary
- **FR-007**: Dashboard MUST include active products, cards with balances, pending requests, current score, and tier
- **FR-008**: Dashboard MUST include cache headers (ETag, Last-Modified) for optimization
- **FR-009**: Dashboard MUST return stale data with warning header if database is temporarily unavailable

**Product Offers**
- **FR-010**: System MUST provide an endpoint to retrieve personalized product offers
- **FR-011**: System MUST offer credit cards to users who don't have one and haven't been rejected in last 30 days
- **FR-012**: Offers MUST be tailored based on user's score tier with specific terms per tier
- **FR-013**: Offers for low-score users MUST indicate "subject to approval"

**Cards Management**
- **FR-014**: System MUST provide an endpoint to list user's cards with optional type filter
- **FR-015**: System MUST provide an endpoint to request a new card with idempotency key support
- **FR-016**: System MUST auto-approve card requests for users with score ≥ 500
- **FR-017**: System MUST set card limits based on user score tiers (High: $10k, Medium: $5k, Low: $2k)
- **FR-018**: Card requests for users with score < 500 MUST enter pending status for admin review
- **FR-019**: System MUST reject card requests if user has pending request or active card
- **FR-020**: System MUST prevent duplicate requests via idempotency key within 24-hour window

**Transactions**
- **FR-021**: System MUST provide an endpoint to simulate purchases on cards with idempotency key
- **FR-022**: System MUST reject purchases that exceed available credit (limit - balance)
- **FR-023**: System MUST reject purchases on inactive, cancelled, or suspended cards
- **FR-024**: System MUST provide an endpoint to record payments with idempotency key
- **FR-025**: On-time payments MUST increase user score by 10-50 points based on payment percentage
- **FR-026**: Late payments MUST decrease user score by 20-100 points based on days overdue
- **FR-027**: System MUST prevent payments exceeding outstanding balance
- **FR-028**: System MUST use pessimistic locking to prevent race conditions on balance updates

**Administration**
- **FR-029**: System MUST provide admin-only endpoint to view user scores with history
- **FR-030**: System MUST provide admin-only endpoint to modify user scores with required reason
- **FR-031**: System MUST provide admin-only endpoint to list pending card requests with pagination
- **FR-032**: System MUST provide admin-only endpoint to approve/reject card requests
- **FR-033**: System MUST prevent approval with limits exceeding tier policy
- **FR-034**: System MUST provide admin-only endpoint to reset all system data with double-confirmation
- **FR-035**: Admin endpoints MUST be protected and accessible only to admin-role users
- **FR-036**: All admin actions MUST be audit-logged with admin ID, timestamp, action, and target

**Event Publishing**
- **FR-037**: System MUST publish events for all significant state changes to outbox
- **FR-038**: System MUST use outbox pattern with at-least-once delivery guarantee
- **FR-039**: Events MUST be published to message stream within 5 seconds under normal conditions
- **FR-040**: Events MUST include: event type, timestamp, entity ID, sequence number, and payload
- **FR-041**: Failed events MUST be retried with exponential backoff (5 max retries)
- **FR-042**: Events exceeding max retries MUST be moved to dead-letter queue with alert

**Health & Observability**
- **FR-043**: System MUST provide liveness endpoint for container orchestration
- **FR-044**: System MUST provide readiness endpoint checking all critical dependencies
- **FR-045**: All API responses MUST include request-id header for tracing
- **FR-046**: All errors MUST be logged with request-id, user-id (if available), and context

**Testing**
- **FR-047**: System MUST have comprehensive test coverage via automated test suite
- **FR-048**: Tests MUST be human-readable with descriptive names explaining the tested behavior
- **FR-049**: Tests MUST be precise, testing only the specific behavior under test
- **FR-050**: Tests MUST cover all edge cases documented in this specification

---

### Key Entities

- **User**: A person who interacts with the system. Has identity (via Firebase), a score (0-1000), tier (derived from score), role (user/admin), status (active/disabled), and owns products and cards.

- **Score**: A numeric value (0-1000) representing user creditworthiness. Has history of changes with timestamps, reasons, and actors. Tiers: High (≥700), Medium (500-699), Low (<500).

- **Card**: A financial product owned by a user. Has: type, status (pending/active/rejected/cancelled/suspended), limit, balance, available credit (computed), minimum payment, next due date, created/updated timestamps.

- **CardRequest**: A request from a user to obtain a new card. Has: status (pending/approved/rejected), score at request time, idempotency key, decision metadata (admin/auto, reason, timestamp).

- **Product**: A financial product a user is signed up for. Cards are a type of product. Has: type, status, associated entity reference.

- **Transaction**: A purchase made using a card. Has: amount, merchant, timestamp, card reference, idempotency key, status.

- **Payment**: A payment made toward a card balance. Has: amount, date, on-time flag, score impact, idempotency key, status.

- **Event**: A record of a significant state change. Has: event type, entity type, entity ID, sequence number, timestamp, payload, status (pending/sent/failed/dead-letter), retry count.

- **AuditLog**: A record of admin actions. Has: admin ID, action type, target entity, previous value, new value, reason, timestamp.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

**Performance**
- **SC-001**: Users can complete authentication in under 2 seconds (p99)
- **SC-002**: Dashboard endpoint returns complete user status in under 1 second (p99)
- **SC-003**: Card request decisions (auto-approval) are made in under 3 seconds (p99)
- **SC-004**: Purchases and payments complete in under 2 seconds (p99)

**Reliability**
- **SC-005**: 100% of state changes result in published events (verified via test suite)
- **SC-006**: System maintains 99.9% availability for core operations
- **SC-007**: Event delivery to message stream succeeds within 5 minutes (p99) under degraded conditions
- **SC-008**: Zero data loss during planned maintenance or infrastructure failures

**Quality**
- **SC-009**: All API endpoints return appropriate error responses with actionable messages
- **SC-010**: Test suite achieves meaningful coverage of all functional requirements and edge cases
- **SC-011**: Test names clearly describe the behavior being tested in plain English
- **SC-012**: Zero duplicate operations from retry attempts (idempotency verified)

**Operations**
- **SC-013**: System can be completely reset via admin cleanup in under 2 minutes (for test data volumes)
- **SC-014**: Score changes from payments are reflected on dashboard within 1 second
- **SC-015**: All admin operations are traceable via audit log
- **SC-016**: Health endpoints accurately report system status within 10 seconds of state change

---

## Assumptions

1. **Firebase Project**: A Firebase project is already configured and available for authentication
2. **Initial Score**: New users start with a default score of 500 (middle tier)
3. **Score Tiers**: 
   - High: ≥700 (premium limits, guaranteed auto-approval)
   - Medium: 500-699 (standard limits, auto-approval)
   - Low: <500 (requires admin review)
4. **Score Changes**:
   - On-time payment: +10 (minimum) to +50 (full payment) points
   - Late payment: -20 (1-7 days) to -100 (30+ days) points
   - Score bounded to 0-1000 range
5. **Card Limits by Tier**:
   - High score: $10,000
   - Medium score: $5,000
   - Low score (admin approved): Up to $2,000
   - Minimum limit: $100
6. **Due Date**: Payments are considered "on time" if made within 30 days of the statement date
7. **Single Credit Card**: Users can have at most one active credit card at a time
8. **Admin Role**: Admin status is determined by a custom claim in the Firebase token (`admin: true`)
9. **Event Delivery**: Outbox pattern ensures at-least-once delivery; consumers must be idempotent
10. **Deployment**: Infrastructure provisioning (message stream) is handled via OpenTofu and GitHub Actions
11. **Cooldown Period**: Users cannot request a new card for 30 days after rejection
12. **Idempotency Window**: Idempotency keys are valid for 24 hours
13. **Rate Limits**: 10 auth attempts/minute per IP, 100 API calls/minute per user
14. **Pagination**: Default page size is 20, maximum is 100
15. **Audit Retention**: Audit logs are retained for 7 years (financial compliance)

---

## Non-Functional Considerations

- **Reliability**: Outbox pattern ensures events are never lost, even during infrastructure failures. Pessimistic locking prevents data corruption from race conditions.
- **Testability**: All functionality is accessible via API, enabling comprehensive automated testing. Idempotency enables safe test retries.
- **Observability**: Events provide a complete audit trail of system state changes. Request IDs enable end-to-end tracing.
- **Security**: All sensitive operations require authentication; admin operations require elevated privileges. Tokens are validated on every request. Error messages don't leak sensitive information.
- **Maintainability**: Clean separation between authentication, business logic, and event publishing. Comprehensive documentation of edge cases.
- **Resilience**: Graceful degradation when non-critical dependencies fail. Automatic retry with backoff for transient failures.
- **Consistency**: Strong consistency for financial operations (payments, balance updates). Eventual consistency acceptable for analytics/events.

---

## Patch Notes (2026-01-04)

**Discussed by Taz and Codex at 2026-01-04 13:27:19 -03.**

**Auth Boundary Clarification**:
- Firebase issues **client-facing tokens** only for ecosystem users.
- **M2M communication** uses service accounts; user token may be forwarded as
  origination context (for grants-at-time-of-command auditing).

**API Path Convention**:
- Prefer plural resource naming for card requests:
  `/v1/cards/requests` and `/v1/cards/requests/{requestId}`.

**Rate Limiting Scope**:
- Rate limiting is intentionally **deferred** to the final phase to preserve
  KISS/YAGNI in early delivery.

**Outbox Latency Target**:
- Outbox delivery target adjusted to **5–10 seconds** under normal conditions.

**Service Boundaries**:
- This spec covers the **Cards domain API** only.
- A **future BFF** (frontend-facing) may handle login UX and Customer360
  aggregation without expanding this API's scope.
