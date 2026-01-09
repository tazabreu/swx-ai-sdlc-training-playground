# Implementation Plan: Headless Financial API

**Branch**: `001-headless-financial-api` | **Date**: 2026-01-04 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-headless-financial-api/spec.md`

## Summary

A serverless financial backend service providing credit card management, user scoring, and payment simulation. Built with interface-first design enabling InMemory testing, Firestore production storage, and BigQuery analytics via medallion architecture. Firebase Functions for scale-to-zero cost optimization. Customer360 capability tracks user interactions across ecosystem products via `ecosystemId`.

## Technical Context

**Language/Version**: TypeScript 5.x (strict mode)
**Package Manager**: Bun (required per Constitution)
**Primary Dependencies**:
- Firebase Functions (serverless compute)
- Firebase Authentication (identity)
- Firestore (document storage - NO SQL)
- BigQuery (analytics/Customer360)
- Redpanda/Kafka (event streaming)
- OpenTelemetry SDK (observability)

**Storage**:
- Primary: Firestore (NoSQL document store, scales to zero)
- Analytics: BigQuery (medallion architecture: bronze → silver → gold)
- Event Stream: Redpanda (via transactional outbox pattern)

**Testing**:
- Jest (unit + integration via InMemory providers)
- Provider-agnostic tests (same suite runs against InMemory or Firestore)
- OpenTelemetry dashboards for manual validation post-Jest

**Target Platform**: Firebase Functions (GCP serverless, scale-to-zero)
**Project Type**: Single serverless backend (headless API)

**Performance Goals**:
- Authentication: <2s p99
- Dashboard: <1s p99
- Card approval: <3s p99
- Purchases/payments: <2s p99

**Constraints**:
- Scale-to-zero (minimize idle costs)
- Provider-agnostic interfaces (InMemory ↔ Firestore swap)
- NO Kubernetes deployment
- NO SQL databases (PostgreSQL/MySQL)

**Scale/Scope**:
- Initial: Sandbox/testing environment
- Design for: Multi-product ecosystem (credit-card now, others later)
- Customer360: Unified user view across all ecosystem products

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] Uses Bun for install/scripts (`bun install`, `bun run <script>`)
- [x] Backend is TypeScript + Express on Firebase Functions
- [ ] Frontend (if any) is Next.js - **N/A: Headless API only**
- [x] Event publishing uses transactional outbox to Redpanda/Kafka

**Variations from Constitution (justified):**

| Variation | Justification |
|-----------|---------------|
| No Kubernetes | User requirement: serverless scale-to-zero for cost optimization |
| Firestore instead of SQL | User requirement: NoSQL for serverless compatibility |
| BigQuery medallion | User requirement: Customer360 analytics capability |

## Project Structure

### Documentation (this feature)

```text
specs/001-headless-financial-api/
├── plan.md              # This file
├── research.md          # Phase 0: Technology decisions
├── data-model.md        # Phase 1: Entity schemas
├── quickstart.md        # Phase 1: Local dev setup
├── contracts/           # Phase 1: OpenAPI specs
│   └── openapi.yaml
└── tasks.md             # Phase 2: Implementation tasks (via /speckit.tasks)
```

### Source Code (repository root)

```text
src/
├── domain/                    # Core business logic (no external deps)
│   ├── entities/              # User, Card, Score, Payment, etc.
│   ├── services/              # Business rules (scoring, approval, etc.)
│   └── events/                # Domain events (card.approved, payment.processed)
│
├── application/               # Use cases / orchestration
│   ├── commands/              # Write operations (RequestCard, MakePayment)
│   ├── queries/               # Read operations (GetDashboard, ListCards)
│   └── handlers/              # Command/query handlers
│
├── infrastructure/            # External integrations (provider implementations)
│   ├── persistence/
│   │   ├── interfaces/        # Repository interfaces (IUserRepository, etc.)
│   │   ├── inmemory/          # InMemory implementations (testing)
│   │   └── firestore/         # Firestore implementations (production)
│   │
│   ├── messaging/
│   │   ├── interfaces/        # IEventPublisher, IOutbox
│   │   ├── inmemory/          # InMemory event bus (testing)
│   │   └── redpanda/          # Redpanda producer (production)
│   │
│   ├── analytics/
│   │   ├── interfaces/        # IAnalyticsWriter, ICustomer360
│   │   ├── inmemory/          # InMemory analytics (testing)
│   │   └── bigquery/          # BigQuery writer (medallion architecture)
│   │
│   └── auth/
│       ├── interfaces/        # IAuthProvider, ITokenValidator
│       ├── mock/              # Mock auth (testing)
│       └── firebase/          # Firebase Auth (production)
│
├── api/                       # HTTP layer (Express routes)
│   ├── routes/                # Endpoint definitions
│   ├── middleware/            # Auth, error handling, tracing
│   └── dto/                   # Request/response shapes
│
├── functions/                 # Firebase Functions entry points
│   ├── http.ts                # HTTP trigger (API gateway)
│   └── pubsub.ts              # Pub/Sub triggers (outbox processor)
│
└── config/                    # Configuration & DI
    ├── container.ts           # Dependency injection setup
    ├── providers.ts           # Provider selection (inmemory vs production)
    └── telemetry.ts           # OpenTelemetry configuration

tests/
├── unit/                      # Domain logic tests (no I/O)
│   ├── domain/
│   └── application/
│
├── integration/               # Provider-agnostic integration tests
│   ├── inmemory/              # Tests with InMemory providers
│   └── firestore/             # Tests with Firestore emulator
│
└── contract/                  # API contract tests
    └── api/
```

### Analytics Structure (BigQuery Medallion)

```text
bigquery/
├── schemas/
│   ├── bronze/                # Raw events (as received)
│   │   └── events.json
│   ├── silver/                # Cleaned/normalized events
│   │   └── transactions.json
│   └── gold/                  # Business aggregates
│       └── customer360.json   # Unified user view
│
└── pipelines/
    ├── bronze_to_silver.sql   # Data cleaning transformations
    └── silver_to_gold.sql     # Customer360 aggregation
```

**Structure Decision**: Single serverless project with clean architecture layers. Domain logic is pure (no external dependencies). Infrastructure layer implements provider interfaces with swappable implementations (InMemory for testing, Firestore/Redpanda/BigQuery for production). This enables provider-agnostic tests that run identically regardless of underlying storage.

## Key Design Decisions

### 1. Interface-First Design

All external integrations (storage, messaging, analytics) are accessed through interfaces:

```typescript
// Example: Repository interface
interface IUserRepository {
  findById(ecosystemId: string): Promise<User | null>;
  save(user: User): Promise<void>;
  findByFirebaseUid(uid: string): Promise<User | null>;
}

// InMemory implementation (testing)
class InMemoryUserRepository implements IUserRepository { ... }

// Firestore implementation (production)
class FirestoreUserRepository implements IUserRepository { ... }
```

**Benefit**: Same test suite runs against InMemory (fast, isolated) and Firestore emulator (realistic). No mocking required.

### 2. EcosystemId for Customer360

Every user has a stable `ecosystemId` that persists across all Tazco products:

```typescript
interface User {
  ecosystemId: string;      // Stable ID across all products
  firebaseUid: string;      // Firebase-specific identifier
  products: ProductRef[];   // Cards, loans, etc. (expandable)
  // ...
}
```

**Benefit**: When new products are added (loans, savings, etc.), Customer360 view automatically includes all interactions via `ecosystemId` joins.

### 3. Medallion Architecture for Analytics

Events flow through three BigQuery layers:

1. **Bronze**: Raw events as received (schema-on-read)
2. **Silver**: Cleaned, typed, deduplicated events
3. **Gold**: Business aggregates (Customer360, scoring trends, etc.)

**Benefit**: Enables complex analytics queries without impacting transactional Firestore. Customer360 is a gold-layer view.

### 4. Serverless Scale-to-Zero

Firebase Functions automatically scale:
- Zero instances when idle (no cost)
- Auto-scale up under load
- No Kubernetes management overhead

**Trade-off**: Cold starts (mitigated by function instance minimums if needed).

## Complexity Tracking

> No Constitution violations requiring justification. All variations are user-mandated requirements that align with Constitution principles (Bun, TypeScript, Firebase Functions, Outbox pattern).

| Decision | Why Made | Alternative Rejected |
|----------|----------|---------------------|
| Firestore over PostgreSQL | User requirement: serverless, scale-to-zero | PostgreSQL requires always-on server |
| BigQuery for analytics | User requirement: Customer360, medallion | Firestore aggregation queries are limited |
| InMemory providers | User requirement: provider-agnostic tests | Mocking creates false confidence |
| No Kubernetes | User requirement: minimize ops cost | K8s has minimum node costs |

---

## Patch Section (2026-01-04)

**Discussed by Taz and Codex at 2026-01-04 13:27:19 -03.**

**Auth & M2M Boundary**:
- Firebase issues tokens for **ecosystem users** only.
- **Service accounts** handle M2M calls; user tokens may be forwarded as
  origination context to capture grants-at-time-of-command.

**API Naming**:
- Standardize on plural card request paths:
  `/v1/cards/requests` and `/v1/cards/requests/{requestId}`.

**Rate Limiting Deferment**:
- Treat rate limiting as **late-phase** work to preserve KISS/YAGNI.

**Outbox Latency Target**:
- Outbox processor cadence targeted at **5–10 seconds** (near real-time).

**Service Separation**:
- This plan covers the **Cards domain API**.
- A future **BFF** can handle login UX and Customer360 aggregation without
  expanding the current API scope.

---

## Patch Section (2026-01-04)

**Discussed by Taz and Codex at 2026-01-04 20:46:01 -0300.**

**Scope Clarification: Spec 001 vs Spec 003**
- `001-headless-financial-api` is the **base** (core Cards-domain API + tests).
- **BigQuery streaming**, **Redpanda**, and **OpenTelemetry** are explicitly
  deferred to a future spec (`003-streaming-and-observability`).

**Interpretation Rule (to prevent spec→plan drift)**
- Any mention in this document of BigQuery/Customer360/Redpanda/OTel is to be
  treated as **future roadmap context**, not a mandate for `001` tasks or code.

**Testing Runner**
- The implementation uses Bun’s test runner (`bun test` / `bun:test`).
- Any mentions of “Jest” in earlier sections are legacy wording.
