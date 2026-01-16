# Research: Headless Financial API

**Branch**: `001-headless-financial-api` | **Date**: 2026-01-04

This document consolidates technology decisions and best practices research for the serverless financial backend.

**Scope note**: Sections on BigQuery streaming, Redpanda, and OpenTelemetry are forward-looking inputs for a future spec (`003-streaming-and-observability`) and are not required to complete Spec 001.

---

## 1. Firestore Patterns for Financial Backend

### Decision: Hierarchical Document Structure

**Rationale**: Firestore's subcollection model provides natural tenant isolation and enables efficient queries scoped to a single user's data.

**Alternatives Considered**:
- Flat collections with `ecosystemId` field (rejected: requires composite indexes for every query)
- Separate collections per entity type (rejected: no automatic ownership boundaries)

### Document Structure

```
users/{ecosystemId}
├── firebaseUid: string
├── role: "user" | "admin"
├── status: "active" | "disabled"
├── currentScore: number (denormalized for fast dashboard)
├── tier: "high" | "medium" | "low"
├── cardSummary: { activeCards, totalBalance, totalLimit } (denormalized)
├── createdAt, updatedAt: timestamp
│
├── scores/ (subcollection - history)
│   └── {scoreId}: { value, previousValue, reason, changedBy, timestamp }
│
├── cards/ (subcollection)
│   └── {cardId}
│       ├── type, status, limit, balance, minimumPayment, nextDueDate
│       ├── version: number (optimistic locking)
│       └── transactions/ (subcollection)
│           └── {txId}: { type, amount, idempotencyKey, timestamp, scoreImpact }
│
├── cardRequests/ (subcollection)
│   └── {requestId}: { status, scoreAtRequest, idempotencyKey, decision }
│
└── idempotencyKeys/ (subcollection)
    └── {hashedKey}: { operation, response, expiresAt }

outbox/ (root collection - event sourcing)
└── {eventId}: { eventType, entityId, payload, status, retryCount, nextRetryAt }

auditLogs/ (root collection - compliance)
└── {logId}: { adminId, action, target, previousValue, newValue, reason, timestamp }
```

### Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| Denormalize `currentScore` and `cardSummary` | Dashboard loads in 1 read instead of 3 |
| `version` field on cards | Optimistic locking detection for concurrent updates |
| Hash idempotency keys (SHA-256) | Prevents key length issues, improves privacy |
| Separate `outbox` collection | Global event processing without tenant-specific queries |
| 24-hour idempotency window | Balances retry safety with storage costs |

### Pessimistic Locking Strategy

**Decision**: Use Firestore server SDK transactions (PESSIMISTIC mode by default).

```typescript
// Server SDK automatically uses pessimistic locks
await db.runTransaction(async (transaction) => {
  const cardDoc = await transaction.get(cardRef);  // Acquires lock
  // Other transactions must wait until this completes
  transaction.update(cardRef, { balance: newBalance, version: card.version + 1 });
});
```

**Constraints**:
- 20-second lock timeout (transactions must complete quickly)
- Maximum 500 operations per transaction
- Reads must precede writes in transaction function

### Transactional Outbox Implementation

**Decision**: Add event to outbox within same Firestore transaction as business write.

```typescript
await db.runTransaction(async (transaction) => {
  // 1. Business write
  transaction.update(cardRef, { balance: newBalance });

  // 2. Outbox event (same transaction = atomicity)
  transaction.create(outboxRef, {
    eventType: 'payment.processed',
    entityId: cardId,
    payload: { amount, onTime },
    status: 'pending',
    retryCount: 0,
    createdAt: new Date()
  });
});
```

**Processing**: Cloud Function scheduled every 1 minute drains outbox with exponential backoff (10s → 160s) and dead-letter after 5 failures.

### Cost Optimization

| Strategy | Expected Savings |
|----------|------------------|
| Smart caching (Last-Modified/ETag) | 30-40% read reduction |
| Denormalized dashboard data | 66% read reduction |
| Pagination (20 items default) | 98% read reduction for large lists |
| Detach unused listeners | 50-70% read reduction |
| Batched writes | Same cost, improved reliability |

---

## 2. BigQuery Medallion Architecture

### Decision: Three-Layer Analytics Pipeline

**Rationale**: Separates raw event ingestion (schema-on-read) from typed analytics (schema-on-write), enabling complex Customer360 queries without impacting Firestore.

**Alternatives Considered**:
- Direct Firestore aggregation queries (rejected: limited query capabilities, expensive at scale)
- Single flat BigQuery table (rejected: schema changes require migrations)

### Bronze Layer (Raw Events)

```sql
CREATE TABLE bronze_raw_events (
  event_id STRING NOT NULL,
  event_type STRING NOT NULL,
  event_timestamp TIMESTAMP NOT NULL,
  ingestion_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP(),
  ecosystem_id STRING,
  firebase_uid STRING,
  entity_type STRING,
  entity_id STRING,
  event_payload JSON NOT NULL,  -- Schema-on-read flexibility
  idempotency_key STRING,
  _event_date DATE NOT NULL
)
PARTITION BY _event_date
CLUSTER BY event_type, ecosystem_id, event_timestamp;
```

### Silver Layer (Cleaned/Typed)

```sql
CREATE TABLE silver_events_cleaned (
  event_id STRING NOT NULL,
  event_type STRING NOT NULL,
  event_timestamp TIMESTAMP NOT NULL,
  ecosystem_id STRING NOT NULL,
  -- Strongly typed columns parsed from JSON
  user_score INT64,
  user_tier STRING,
  card_limit NUMERIC(12,2),
  card_balance NUMERIC(12,2),
  transaction_amount NUMERIC(12,2),
  payment_on_time BOOL,
  is_duplicate BOOL DEFAULT FALSE,
  dedup_hash STRING,
  _event_date DATE NOT NULL
)
PARTITION BY _event_date
CLUSTER BY ecosystem_id, event_type;
```

**Transformations**:
- Deduplication via ROW_NUMBER() on idempotency_key
- Type casting from JSON to strongly typed columns
- Data quality filtering (null ecosystem_id removal)

### Gold Layer (Customer360)

```sql
CREATE TABLE gold_customer360 (
  ecosystem_id STRING NOT NULL,
  current_score INT64,
  current_tier STRING,
  active_products ARRAY<STRUCT<product_type STRING, product_id STRING>>,
  total_credit_limit NUMERIC(12,2),
  total_credit_used NUMERIC(12,2),
  credit_utilization_pct NUMERIC(5,2),
  total_purchases INT64,
  total_payments INT64,
  on_time_payment_rate NUMERIC(5,2),
  days_since_last_payment INT64,
  first_seen_date DATE,
  last_activity_date DATE,
  snapshot_date DATE NOT NULL
)
PARTITION BY snapshot_date
CLUSTER BY ecosystem_id, current_tier;
```

### Streaming Strategy

**Decision**: Firebase Extension for Firestore → BigQuery streaming with custom batching.

**Alternatives Considered**:
- Redpanda Kafka Connect (better for high volume, more complex setup)
- Custom Firebase Function with batching (recommended for control)

**Cost-Effective Scheduling**:
- Bronze → Silver: Daily scheduled query (FREE batch processing)
- Silver → Gold: Hourly materialized view refresh
- Estimated cost: ~$1/day for 1M events (vs $50/day for continuous queries)

---

## 3. OpenTelemetry for Firebase Functions

### Decision: Hybrid Auto-Instrumentation + Manual Spans

**Rationale**: Auto-instrumentation for HTTP layer provides broad coverage with minimal code; manual spans for critical business logic ensure complete visibility into financial operations.

**Alternatives Considered**:
- Auto-instrumentation only (rejected: +100-150ms cold start, captures unnecessary spans)
- Manual spans only (rejected: misses HTTP layer details)

### Configuration

```typescript
// src/config/telemetry.ts
import { NodeSDK } from '@opentelemetry/sdk-node';
import { TraceExporter } from '@google-cloud/opentelemetry-cloud-trace-exporter';
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-base';

const sdk = new NodeSDK({
  resource: new Resource({
    [SEMRESATTRS_SERVICE_NAME]: 'acme-financial-api',
    'cloud.platform': 'firebase-functions',
  }),
  spanProcessor: new BatchSpanProcessor(new TraceExporter(), {
    maxQueueSize: 100,        // Minimize memory for serverless
    maxExportBatchSize: 10,
    scheduledDelayMillis: 2000,
  }),
  sampler: new ParentBasedSampler({
    root: new TraceIdRatioBasedSampler(0.1),  // 10% sampling in prod
  }),
});
```

### Sampling Strategy

| Environment | Sampling Rate | Rationale |
|-------------|---------------|-----------|
| Development | 100% | Debug everything |
| Staging | 50% | Catch issues before prod |
| Production | 10% | Cost-effective (GCP free tier: 2.5M spans/month) |

**Critical Operations**: Always sample (100%) for:
- `card.request.process`
- `payment.process`
- `auth.login`
- Any error response (status >= 400)

### Request Correlation

```typescript
// Middleware to correlate Firebase request ID with OpenTelemetry
app.use((req, res, next) => {
  const span = trace.getActiveSpan();
  if (span) {
    const requestId = req.headers['function-execution-id'] || randomUUID();
    span.setAttribute('request.id', requestId);
    span.setAttribute('faas.execution_id', requestId);
    res.setHeader('X-Request-ID', requestId);
  }
  next();
});
```

### Event Propagation (Redpanda)

Inject trace context into event headers for end-to-end tracing:

```typescript
const carrier: Record<string, string> = {};
propagation.inject(context.active(), carrier);

await producer.send({
  messages: [{
    value: JSON.stringify(event),
    headers: { ...carrier, 'event.id': event.id },
  }],
});
```

### Performance Impact

| Configuration | Cold Start | Runtime | Memory |
|---------------|------------|---------|--------|
| Manual spans only | +10-20ms | <1ms/span | ~5MB |
| HTTP auto-instrumentation | +50-80ms | 2-5ms/request | ~15MB |
| Full auto-instrumentation | +100-150ms | 5-10ms/request | ~30MB |

**Recommendation**: Start with manual spans for critical operations. Add HTTP auto-instrumentation only after validating cold start impact.

---

## 4. Interface-First Design Pattern

### Decision: Repository/Provider Interfaces with Swappable Implementations

**Rationale**: Enables provider-agnostic tests that run against InMemory (fast, isolated) or Firestore emulator (realistic) without mocking.

### Interface Example

```typescript
// infrastructure/persistence/interfaces/user-repository.ts
export interface IUserRepository {
  findById(ecosystemId: string): Promise<User | null>;
  findByFirebaseUid(uid: string): Promise<User | null>;
  save(user: User): Promise<void>;
  updateScore(ecosystemId: string, score: number, reason: string): Promise<void>;
}

// infrastructure/persistence/inmemory/user-repository.ts
export class InMemoryUserRepository implements IUserRepository {
  private users: Map<string, User> = new Map();
  // Implementation using Map
}

// infrastructure/persistence/firestore/user-repository.ts
export class FirestoreUserRepository implements IUserRepository {
  constructor(private firestore: Firestore) {}
  // Implementation using Firestore SDK
}
```

### Provider Selection

```typescript
// config/providers.ts
export function createUserRepository(): IUserRepository {
  if (process.env.USE_INMEMORY === 'true') {
    return new InMemoryUserRepository();
  }
  return new FirestoreUserRepository(getFirestore());
}
```

### Testing Strategy

```typescript
// tests/integration/card-request.test.ts
describe('Card Request', () => {
  let userRepo: IUserRepository;
  let cardService: CardService;

  beforeEach(() => {
    // Same tests run with InMemory or Firestore
    userRepo = process.env.USE_FIRESTORE
      ? new FirestoreUserRepository(getEmulator())
      : new InMemoryUserRepository();
    cardService = new CardService(userRepo);
  });

  test('approves high-score user', async () => {
    // Test logic identical regardless of provider
  });
});
```

---

## 5. EcosystemId for Customer360

### Decision: Stable Cross-Product Identifier

**Rationale**: Enables unified user view across all ACME products (credit card now, loans/savings later).

```typescript
interface User {
  ecosystemId: string;      // Stable ID (UUID, generated on first product signup)
  firebaseUid: string;      // Firebase Auth identifier (may change if user re-registers)
  products: ProductRef[];   // All products across ecosystem
}
```

### ID Generation

```typescript
// On first product signup
const ecosystemId = await getOrCreateEcosystemId(firebaseUid);

async function getOrCreateEcosystemId(firebaseUid: string): Promise<string> {
  // Check if user exists with this firebaseUid
  const existing = await userRepo.findByFirebaseUid(firebaseUid);
  if (existing) return existing.ecosystemId;

  // Generate new stable ID
  return uuidv7();  // Time-sortable UUID
}
```

### Customer360 Joins

All analytics tables join on `ecosystem_id`:

```sql
SELECT
  u.ecosystem_id,
  cc.total_credit_used,
  l.total_loan_balance,  -- Future: loans product
  s.savings_balance       -- Future: savings product
FROM gold_customer360 u
LEFT JOIN gold_credit_cards cc USING (ecosystem_id)
LEFT JOIN gold_loans l USING (ecosystem_id)
LEFT JOIN gold_savings s USING (ecosystem_id);
```

---

## Summary of Technology Decisions

| Area | Decision | Key Benefit |
|------|----------|-------------|
| **Storage** | Firestore with hierarchical subcollections | Natural tenant isolation, 1-read dashboard |
| **Locking** | Server SDK pessimistic transactions | Prevents race conditions on balance updates |
| **Events** | Transactional outbox pattern | At-least-once delivery, atomic with business writes |
| **Analytics** | BigQuery medallion (bronze/silver/gold) | Schema evolution, Customer360 without Firestore impact |
| **Streaming** | Firebase Extension + scheduled queries | Cost-effective ($1/day vs $50/day) |
| **Observability** | OpenTelemetry with 10% sampling | Traces without cost explosion |
| **Testing** | Interface-first with InMemory providers | Fast tests, no mocking required |
| **Identity** | ecosystemId (stable cross-product) | Unified Customer360 view |
