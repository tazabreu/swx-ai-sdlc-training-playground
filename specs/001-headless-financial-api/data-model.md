# Data Model: Headless Financial API

**Branch**: `001-headless-financial-api` | **Date**: 2026-01-04

This document defines the domain entities, their relationships, validation rules, and state machines for the financial backend.

---

## Entity Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              FIRESTORE STRUCTURE                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  users/{ecosystemId}                                                        │
│  ├── Profile data, currentScore, tier, status                               │
│  │                                                                          │
│  ├── scores/{scoreId}           ◄── Score history (audit trail)            │
│  │                                                                          │
│  ├── cards/{cardId}             ◄── Active credit cards                    │
│  │   └── transactions/{txId}    ◄── Purchases & payments on card           │
│  │                                                                          │
│  ├── cardRequests/{requestId}   ◄── Pending/processed card applications    │
│  │                                                                          │
│  └── idempotencyKeys/{keyHash}  ◄── Deduplication cache (24h TTL)          │
│                                                                             │
│  outbox/{eventId}               ◄── Event sourcing (pending → sent)        │
│                                                                             │
│  auditLogs/{logId}              ◄── Admin action audit trail               │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Core Entities

### 1. User

**Description**: A person who interacts with the financial system. Central entity that owns all other resources.

**Firestore Path**: `users/{ecosystemId}`

```typescript
interface User {
  // Identity
  ecosystemId: string;           // Primary key (stable across products)
  firebaseUid: string;           // Firebase Auth UID
  email: string;                 // From Firebase Auth

  // Role & Status
  role: 'user' | 'admin';        // Admin determined by Firebase custom claim
  status: 'active' | 'disabled';

  // Score (denormalized for fast dashboard)
  currentScore: number;          // 0-1000
  tier: 'high' | 'medium' | 'low';

  // Dashboard Summary (denormalized)
  cardSummary: {
    activeCards: number;
    totalBalance: number;        // Sum of all card balances
    totalLimit: number;          // Sum of all card limits
  };

  // Timestamps
  createdAt: Timestamp;
  updatedAt: Timestamp;
  lastLoginAt: Timestamp;
}
```

**Validation Rules**:
| Field | Rule |
|-------|------|
| ecosystemId | UUID v7, immutable after creation |
| firebaseUid | Non-empty string, unique across users |
| email | Valid email format |
| currentScore | Integer, 0 ≤ score ≤ 1000 |
| tier | Derived: ≥700 = 'high', 500-699 = 'medium', <500 = 'low' |

**Initial State**:
- `currentScore`: 500 (medium tier)
- `status`: 'active'
- `role`: 'user' (admin via Firebase custom claim)
- `cardSummary`: { activeCards: 0, totalBalance: 0, totalLimit: 0 }

---

### 2. Score

**Description**: Historical record of score changes for audit and analytics.

**Firestore Path**: `users/{ecosystemId}/scores/{scoreId}`

```typescript
interface Score {
  scoreId: string;               // Auto-generated

  // Values
  value: number;                 // New score value
  previousValue: number;         // Score before change
  delta: number;                 // value - previousValue

  // Context
  reason: ScoreChangeReason;
  source: 'system' | 'admin';
  sourceId?: string;             // Admin ecosystemId if source='admin'
  relatedEntityType?: string;    // 'payment', 'card', etc.
  relatedEntityId?: string;      // ID of related entity

  // Timestamp
  timestamp: Timestamp;
}

type ScoreChangeReason =
  | 'payment_on_time'            // +10 to +50
  | 'payment_late'               // -20 to -100
  | 'admin_adjustment'           // Manual admin change
  | 'initial_score'              // Account creation (500)
  | 'account_activity';          // Future: other activities
```

**Score Change Rules** (from spec):
| Event | Score Impact | Condition |
|-------|--------------|-----------|
| On-time minimum payment | +10 | Payment ≥ minimum, before due date |
| On-time full payment | +50 | Payment = full balance, before due date |
| Late payment (1-7 days) | -20 | |
| Late payment (8-30 days) | -50 | |
| Late payment (30+ days) | -100 | |
| Admin adjustment | Variable | Requires reason |

**Constraints**:
- Score clamped to [0, 1000]
- Score history retained indefinitely (compliance requirement)

---

### 3. Card

**Description**: A credit card owned by a user.

**Firestore Path**: `users/{ecosystemId}/cards/{cardId}`

```typescript
interface Card {
  cardId: string;                // Auto-generated

  // Product Info
  type: 'credit-card';           // Extensible for future products
  productId: string;             // References product catalog

  // Status
  status: CardStatus;
  statusReason?: string;         // Reason for rejection/suspension

  // Financial
  limit: number;                 // Credit limit in dollars
  balance: number;               // Current balance owed
  availableCredit: number;       // limit - balance (computed, stored for queries)
  minimumPayment: number;        // Minimum payment due
  nextDueDate: Timestamp;        // Payment due date

  // Concurrency Control
  version: number;               // Optimistic locking

  // Approval Context
  approvedBy: 'auto' | 'admin';
  approvedByAdminId?: string;    // If admin-approved
  scoreAtApproval: number;       // User's score when approved

  // Timestamps
  createdAt: Timestamp;
  updatedAt: Timestamp;
  activatedAt?: Timestamp;
  cancelledAt?: Timestamp;
}

type CardStatus =
  | 'active'                     // Normal use
  | 'suspended'                  // Temporarily disabled
  | 'cancelled';                 // Permanently closed
```

**State Machine**:

```
                    ┌─────────────────┐
                    │     ACTIVE      │
                    └────────┬────────┘
                             │
              ┌──────────────┼──────────────┐
              │              │              │
              ▼              ▼              ▼
       ┌───────────┐  ┌───────────┐  ┌───────────┐
       │ SUSPENDED │  │ CANCELLED │  │  (stay)   │
       └─────┬─────┘  └───────────┘  └───────────┘
             │              ▲
             │              │
             └──────────────┘
                 (admin can
                  cancel from
                  suspended)
```

**Transitions**:
| From | To | Trigger | Conditions |
|------|-----|---------|------------|
| active | suspended | Admin action | Fraud detection, late payments |
| active | cancelled | User request / Admin | Balance must be $0 |
| suspended | active | Admin action | Issue resolved |
| suspended | cancelled | Admin action | - |

**Credit Limit by Tier**:
| Tier | Score Range | Limit |
|------|-------------|-------|
| High | ≥ 700 | $10,000 |
| Medium | 500-699 | $5,000 |
| Low | < 500 | $2,000 (admin approval required) |

**Validation Rules**:
| Field | Rule |
|-------|------|
| limit | 100 ≤ limit ≤ 10000, must match tier policy |
| balance | 0 ≤ balance ≤ limit |
| availableCredit | Must equal limit - balance |
| version | Increments on every update |

---

### 4. CardRequest

**Description**: Application for a new credit card.

**Firestore Path**: `users/{ecosystemId}/cardRequests/{requestId}`

```typescript
interface CardRequest {
  requestId: string;             // Auto-generated

  // Request Details
  productId: string;             // Requested product type
  idempotencyKey: string;        // Client-provided dedup key

  // Status
  status: CardRequestStatus;

  // Score Context
  scoreAtRequest: number;        // User's score when submitted
  tierAtRequest: 'high' | 'medium' | 'low';

  // Decision (populated when processed)
  decision?: {
    outcome: 'approved' | 'rejected';
    source: 'auto' | 'admin';
    adminId?: string;            // If admin decision
    reason?: string;             // Rejection reason
    approvedLimit?: number;      // If approved
    decidedAt: Timestamp;
  };

  // Resulting Card (if approved)
  resultingCardId?: string;

  // Timestamps
  createdAt: Timestamp;
  updatedAt: Timestamp;
  expiresAt?: Timestamp;         // For pending requests (7 days)
}

type CardRequestStatus =
  | 'pending'                    // Awaiting admin review (low score)
  | 'approved'                   // Card created
  | 'rejected';                  // Denied
```

**State Machine**:

```
                 ┌─────────────┐
  Submit Request │   PENDING   │ (score < 500)
       ──────────►             ├──────────────────┐
                 └──────┬──────┘                  │
                        │                         │
         Admin          │                         │ Admin
         Approves       │                         │ Rejects
                        ▼                         ▼
                 ┌─────────────┐          ┌─────────────┐
                 │  APPROVED   │          │  REJECTED   │
                 └─────────────┘          └─────────────┘

  Auto-Approval Path (score ≥ 500):
       ──────────► APPROVED (immediate)
```

**Auto-Approval Rules**:
| Score | Action |
|-------|--------|
| ≥ 700 | Auto-approve with $10,000 limit |
| 500-699 | Auto-approve with $5,000 limit |
| < 500 | Pending for admin review |

**Validation Rules**:
| Field | Rule |
|-------|------|
| idempotencyKey | Non-empty, max 64 chars |
| scoreAtRequest | Snapshot at submission time |
| User must not have | Active card OR pending request |

**Business Rules**:
- 30-day cooldown after rejection before new request allowed
- Pending requests flagged "requires attention" after 7 days

---

### 5. Transaction

**Description**: A purchase or payment on a card.

**Firestore Path**: `users/{ecosystemId}/cards/{cardId}/transactions/{transactionId}`

```typescript
interface Transaction {
  transactionId: string;         // Auto-generated

  // Type
  type: 'purchase' | 'payment';

  // Amount
  amount: number;                // Always positive

  // Purchase-specific
  merchant?: string;             // Merchant name for purchases

  // Payment-specific
  paymentStatus?: 'on_time' | 'late';
  daysOverdue?: number;          // If late
  scoreImpact?: number;          // Points gained/lost

  // Deduplication
  idempotencyKey: string;

  // Status
  status: 'completed' | 'failed';
  failureReason?: string;

  // Timestamps
  timestamp: Timestamp;
  processedAt: Timestamp;
}
```

**Validation Rules**:
| Field | Rule |
|-------|------|
| amount | > 0 |
| For purchases | amount ≤ availableCredit |
| For payments | amount ≤ balance |
| idempotencyKey | Non-empty, unique per card within 24h |

**Concurrency**:
- Pessimistic locking via Firestore transaction
- Second request for same card during processing gets 409 Conflict

---

### 6. Event (Outbox)

**Description**: Domain events queued for publishing to message stream.

**Firestore Path**: `outbox/{eventId}`

```typescript
interface OutboxEvent {
  eventId: string;               // Auto-generated (UUID v7)

  // Event Metadata
  eventType: EventType;
  entityType: string;            // 'user', 'card', 'payment', etc.
  entityId: string;
  ecosystemId: string;           // For routing/filtering
  sequenceNumber: number;        // Monotonically increasing per entity

  // Payload
  payload: Record<string, any>;

  // Processing State
  status: 'pending' | 'sent' | 'failed' | 'dead_letter';
  retryCount: number;
  lastError?: string;
  nextRetryAt: Timestamp;

  // Timestamps
  createdAt: Timestamp;
  sentAt?: Timestamp;
}

type EventType =
  | 'user.created'
  | 'user.updated'
  | 'score.changed'
  | 'card.requested'
  | 'card.approved'
  | 'card.rejected'
  | 'card.activated'
  | 'card.suspended'
  | 'card.cancelled'
  | 'transaction.purchase'
  | 'transaction.payment'
  | 'system.cleanup';
```

**Processing Rules**:
- Events processed every 1 minute by scheduled function
- Exponential backoff: 10s, 20s, 40s, 80s, 160s
- Dead-letter after 5 failures
- Alert raised on dead-letter

---

### 7. AuditLog

**Description**: Record of admin actions for compliance.

**Firestore Path**: `auditLogs/{logId}`

```typescript
interface AuditLog {
  logId: string;                 // Auto-generated

  // Actor
  adminEcosystemId: string;      // Admin who performed action
  adminEmail: string;            // For readability

  // Action
  action: AuditAction;
  targetType: string;            // 'user', 'card', 'cardRequest', etc.
  targetId: string;
  targetEcosystemId?: string;    // If action on another user

  // Change Details
  previousValue?: any;           // State before change
  newValue?: any;                // State after change
  reason: string;                // Required justification

  // Context
  requestId: string;             // Correlation ID
  ipAddress?: string;
  userAgent?: string;

  // Timestamp
  timestamp: Timestamp;
}

type AuditAction =
  | 'score.adjusted'
  | 'card_request.approved'
  | 'card_request.rejected'
  | 'card.suspended'
  | 'card.cancelled'
  | 'card.reactivated'
  | 'user.disabled'
  | 'user.enabled'
  | 'system.cleanup';
```

**Retention**: 7 years (financial compliance requirement)

---

### 8. IdempotencyRecord

**Description**: Cached responses for idempotent operations.

**Firestore Path**: `users/{ecosystemId}/idempotencyKeys/{keyHash}`

```typescript
interface IdempotencyRecord {
  keyHash: string;               // SHA-256 hash of idempotency key

  // Operation Context
  operation: string;             // 'request-card', 'make-payment', etc.

  // Cached Response
  response: any;                 // Stored response to return
  statusCode: number;            // HTTP status code

  // TTL
  expiresAt: Timestamp;          // 24 hours from creation
  createdAt: Timestamp;
}
```

**Rules**:
- Same key for different operation = error
- Expired keys allow new operation
- Only successful responses cached (errors allow retry)

---

## Computed Fields

| Entity | Field | Computation |
|--------|-------|-------------|
| User | tier | score ≥ 700 → 'high', 500-699 → 'medium', < 500 → 'low' |
| User | cardSummary | Aggregated from active cards |
| Card | availableCredit | limit - balance |
| CardRequest | expiresAt | createdAt + 7 days (for pending) |

---

## Indexes

### Firestore Indexes

```json
{
  "indexes": [
    {
      "collectionGroup": "cardRequests",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "status", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "cards",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "status", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "transactions",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "type", "order": "ASCENDING" },
        { "fieldPath": "timestamp", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "outbox",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "status", "order": "ASCENDING" },
        { "fieldPath": "nextRetryAt", "order": "ASCENDING" }
      ]
    }
  ]
}
```

---

## TypeScript Type Definitions

All entities should be defined in `src/domain/entities/`:

```
src/domain/entities/
├── user.ts
├── score.ts
├── card.ts
├── card-request.ts
├── transaction.ts
├── event.ts
├── audit-log.ts
├── idempotency-record.ts
└── index.ts          # Re-exports all entities
```

Each file exports:
1. Interface definition
2. Type guards (e.g., `isUser()`)
3. Factory functions (e.g., `createUser()`)
4. Validation functions (e.g., `validateUser()`)
