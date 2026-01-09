# Research: WhatsApp Admin Notifications

**Feature**: 002-whatsapp-admin-notifications
**Date**: 2026-01-04
**Status**: Complete

## Executive Summary

This document consolidates research findings for integrating WhatsApp admin notifications into the Financial API. The research covers the deployed wpp-connect server, existing admin handlers, and event publishing patterns.

---

## 1. WPP-Connect Server Deployment

### Decision: Use Deployed GCE VM Instance
**Rationale**: Already deployed and operational at known IP address
**Alternatives Considered**: None - server is already provisioned

### Actual Deployment Values

| Property | Value |
|----------|-------|
| **External IP Address** | `35.232.155.23` |
| **WPP-Connect Port** | `21465` |
| **API Base URL** | `http://35.232.155.23:21465` |
| **Secret Key** | `QKio1tFW1ICMhUWdr6tr3O3eHcUs76QQ` |
| **Instance Name** | `tazco-platform-dev-wppconnect` |
| **Zone** | `us-central1-a` |
| **Project ID** | `tazco-platform-gcp-project-dev` |

### Authentication Flow

```
1. POST /api/{session}/{secretKey}/generate-token → { "token": "..." }
2. Use token in Authorization: Bearer <token> header
```

### Key API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/{session}/{secretKey}/generate-token` | POST | Generate bearer token |
| `/api/{session}/start-session` | POST | Initialize WhatsApp session |
| `/api/{session}/send-message` | POST | Send WhatsApp message |

### Send Message Request Format

```json
POST /api/{session}/send-message
Headers: Authorization: Bearer <token>, Content-Type: application/json
Body: {
  "phone": "5573981112636",
  "message": "Your card request #12345 has been approved!"
}
```

---

## 2. Webhook Payload Format

### Decision: Parse Standard wpp-connect Webhook Format
**Rationale**: Match existing webhook handler implementation
**Alternatives Considered**: Custom format (rejected - requires wpp-connect modification)

### Incoming Webhook Payload Structure

```typescript
interface WppConnectWebhookPayload {
  event: 'onMessage' | 'onAck' | string;
  session: string;
  data: {
    from: string;           // "5573981112636@c.us" (contact) or "@g.us" (group)
    body: string;           // Message text
    fromMe: boolean;        // Is from bot itself
    isGroupMsg?: boolean;   // Is group message
    // Alternate field names also supported:
    chatId?: string;
    text?: string;
    isFromMe?: boolean;
  };
}
```

### Sender Phone Extraction

```typescript
// Extract digits from: "5573981112636@c.us" → "5573981112636"
const senderDigits = from.split('@')[0].replace(/\D/g, '');
```

### Brazilian Phone Normalization

- Ensures country code "55"
- Mobile numbers: adds '9' if subscriber is 8 digits
- Format: `55` + `DDD (2 digits)` + `9` + `subscriber (8 digits)` = 13 digits total

---

## 3. Existing Admin Handlers

### Decision: Extend Existing Admin Handler Pattern
**Rationale**: Consistent with established CQRS architecture
**Alternatives Considered**: Direct repository calls (rejected - bypasses audit/event flow)

### AdminApproveCardHandler

**Location**: `src/application/handlers/admin-approve-card.handler.ts`

**Command Interface**:
```typescript
interface AdminApproveCardCommand {
  adminId: string;
  adminEmail: string;
  ecosystemId: string;
  requestId: string;
  limit: number;
  reason?: string;
}
```

**Dependencies** (to inject):
- `IUserRepository` - fetch user by ID
- `ICardRepository` - save approved card
- `ICardRequestRepository` - fetch and update request
- `IOutboxRepository` - queue approval event
- `IAuditLogRepository` - log admin action

**Events Emitted**: `card.approved` via outbox

### AdminRejectCardHandler

**Location**: `src/application/handlers/admin-reject-card.handler.ts`

**Command Interface**:
```typescript
interface AdminRejectCardCommand {
  adminId: string;
  adminEmail: string;
  ecosystemId: string;
  requestId: string;
  reason: string;
}
```

**Dependencies**: Same pattern as approve handler
**Events Emitted**: `card.rejected` via outbox

---

## 4. CardRequest Entity

### Decision: Extend Existing Entity Model
**Rationale**: CardRequest already has all needed fields
**Alternatives Considered**: New WhatsAppApproval entity (rejected - duplicates data)

### Existing Structure (from `src/domain/entities/card-request.entity.ts`)

```typescript
interface CardRequest {
  requestId: string;           // UUID v7
  productId: string;           // Product type
  idempotencyKey: string;      // Client dedup key
  status: 'pending' | 'approved' | 'rejected';
  scoreAtRequest: number;      // User's score (0-1000)
  tierAtRequest: UserTier;     // 'high' | 'medium' | 'low'
  decision?: CardRequestDecision;
  resultingCardId?: string;
  createdAt: Date;
  updatedAt: Date;
  expiresAt?: Date;           // 7-day expiration
}
```

### Finding Pending Requests

```typescript
// ICardRequestRepository methods:
findById(ecosystemId: string, requestId: string): Promise<CardRequest | null>;
findPendingByUser(ecosystemId: string): Promise<CardRequest | null>;
findAllPending(sort?, filter?, pagination?): Promise<PaginatedResult<CardRequest>>;
```

---

## 5. Event Publishing (Outbox Pattern)

### Decision: Subscribe to Outbox Events for Notifications
**Rationale**: Follows transactional outbox pattern per constitution
**Alternatives Considered**: Direct notification calls (rejected - not transactional)

### Event Types to Monitor

| Event Type | When Emitted | Use Case |
|------------|--------------|----------|
| `card.requested` | Low-score user submits request | Send approval request to admins |
| `card.approved` | Admin approves request | N/A (confirmation) |
| `card.rejected` | Admin rejects request | N/A (confirmation) |
| `transaction.payment` | Payment processed | Send payment notification to admins |

### OutboxEvent Structure

```typescript
interface OutboxEvent {
  eventId: string;
  eventType: EventType;        // 'card.requested', 'transaction.payment'
  entityType: string;          // 'cardRequest', 'transaction'
  entityId: string;
  ecosystemId: string;
  payload: Record<string, unknown>;
  status: 'pending' | 'sent' | 'failed' | 'dead_letter';
  createdAt: Date;
}
```

### Key Integration Point

Events are queued via `outboxRepository.save(event)` - we need to:
1. Poll outbox for `card.requested` and `transaction.payment` events
2. Extract payload and send WhatsApp notification
3. Mark event as processed (separate status field needed)

---

## 6. API Routes Structure

### Decision: Add New Webhook Route for wpp-connect Callbacks
**Rationale**: Keep separate from admin routes (different auth model)
**Alternatives Considered**: Add to admin routes (rejected - webhook auth differs)

### Current Route Organization

```
src/api/routes/
├── admin.ts          # POST /v1/admin/card-requests/:requestId/approve
├── cards.ts          # POST /v1/cards/requests (triggers CardRequested)
├── dashboard.ts
├── offers.ts
└── transactions.ts   # POST /v1/cards/:cardId/transactions/payments
```

### New Routes Needed

```
src/api/routes/
└── webhooks.ts       # POST /webhooks/wpp-connect (incoming admin replies)
```

### Authentication Pattern

- **Admin Routes**: Firebase token auth via middleware
- **Webhook Route**: Shared secret token via X-Webhook-Secret header

---

## 7. Required Environment Variables

### Decision: Configure via Environment Variables
**Rationale**: Standard pattern for external service config
**Alternatives Considered**: Database config (rejected - adds complexity)

```bash
# WPP-Connect Server
WPP_BASE_URL="http://35.232.155.23:21465"
WPP_SECRET_KEY="QKio1tFW1ICMhUWdr6tr3O3eHcUs76QQ"
WPP_SESSION_NAME="tazco-financial-api"

# Admin Phone Numbers (E.164 format)
ADMIN_PHONE_1="5573981112636"
ADMIN_PHONE_2="5548998589532"

# Webhook Authentication
WEBHOOK_SECRET="<generate-secure-random-token>"
```

---

## 8. Implementation Architecture

### Decision: Event-Driven with Polling
**Rationale**: Follows existing outbox pattern
**Alternatives Considered**: Direct function calls (rejected - not event-sourced)

### Component Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                        Financial API                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  [Card Request Handler]                                          │
│         │                                                        │
│         ▼ emit CardRequestCreated (for low-score)               │
│  [Outbox Repository] ──────────────────┐                        │
│         │                               │                        │
│         ▼                               ▼                        │
│  [Payment Handler]              [WhatsApp Notification Service]  │
│         │                               │                        │
│         ▼ emit PaymentCompleted         ▼                        │
│  [Outbox Repository] ───────────► Send to wpp-connect           │
│                                         │                        │
│                                         ▼                        │
│                              ┌──────────────────┐               │
│                              │  wpp-connect     │               │
│                              │  Server          │               │
│                              │  (35.232.155.23) │               │
│                              └────────┬─────────┘               │
│                                       │                          │
│                                       ▼ Admin WhatsApp reply     │
│  [Webhook Endpoint] ◄─────────────────┘                         │
│         │                                                        │
│         ▼ Parse "y 12345" or "n 12345"                          │
│  [Admin Approve/Reject Handler]                                  │
│         │                                                        │
│         ▼                                                        │
│  [CardRequest Updated] → Status: approved/rejected              │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 9. Test Strategy

### Decision: Follow Existing Test Patterns
**Rationale**: Consistency with codebase standards
**Alternatives Considered**: E2E only (rejected - insufficient coverage)

### Unit Tests

- WhatsApp client mock (don't call real API)
- Message parser tests (y/yes/n/no variations)
- Admin phone normalization tests

### Contract Tests

- Webhook endpoint response codes
- Payload validation
- Auth header verification

### Integration Tests

- Full flow with mock wpp-connect server
- Event-to-notification flow

---

## 10. Security Considerations

### Webhook Authentication

**Implementation**:
```typescript
function validateWebhookSecret(req: Request): boolean {
  const secret = req.headers['x-webhook-secret'];
  return secret === process.env.WEBHOOK_SECRET;
}
```

**Deferred for Production**:
- IP allowlisting (ephemeral IPs in sandbox)
- HMAC signature validation
- Rate limiting

---

## Summary of Key Decisions

| Area | Decision | Rationale |
|------|----------|-----------|
| Architecture | Event-driven with outbox polling | Constitution compliance |
| Webhook auth | Shared secret token | Simple, sandbox-appropriate |
| Message correlation | ID in message body | Clear, user-friendly |
| Admin handler | Extend existing pattern | Code consistency |
| Phone format | Brazilian E.164 (13 digits) | Match wpp-connect |
| Notification trigger | Card request (low-score) + payments | Spec requirements |

---

## Unresolved Items

None - all clarifications resolved in spec.md
