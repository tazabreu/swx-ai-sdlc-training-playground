# Data Model: WhatsApp Admin Notifications

**Feature**: 002-whatsapp-admin-notifications
**Date**: 2026-01-04

## Overview

This feature extends the existing Financial API with WhatsApp notification capabilities. Most entities already exist; we add tracking for WhatsApp-specific state.

---

## Existing Entities (No Changes)

### CardRequest
**Location**: `src/domain/entities/card-request.entity.ts`

Already contains all fields needed for approval workflow:

| Field | Type | Description |
|-------|------|-------------|
| `requestId` | `string` | UUID v7, primary identifier |
| `ecosystemId` | `string` | Owner user ID |
| `status` | `'pending' \| 'approved' \| 'rejected'` | Current state |
| `decision` | `CardRequestDecision?` | Approval/rejection details |
| `tierAtRequest` | `UserTier` | User tier when submitted |
| `scoreAtRequest` | `number` | User score when submitted |
| `createdAt` | `Date` | Submission timestamp |

### OutboxEvent
**Location**: `src/domain/entities/event.entity.ts`

Used for event publishing; extended with new event types.

---

## New Entities

### WhatsAppNotification

Tracks outbound WhatsApp messages to admins.

```typescript
// src/domain/entities/whatsapp-notification.entity.ts

interface WhatsAppNotification {
  notificationId: string;      // UUID v7
  recipientPhone: string;      // E.164 format (e.g., "5573981112636")
  recipientName?: string;      // Display name for logging

  // Message content
  messageContent: string;      // Full message text
  notificationType: WhatsAppNotificationType;

  // Related entity
  relatedEntityType: 'cardRequest' | 'payment';
  relatedEntityId: string;     // requestId or transactionId
  ecosystemId: string;         // Owner user ID

  // Delivery tracking
  deliveryStatus: WhatsAppDeliveryStatus;
  wppMessageId?: string;       // ID returned by wpp-connect
  retryCount: number;          // 0-3
  lastError?: string;          // Error message if failed
  nextRetryAt?: Date;          // When to retry

  // Timestamps
  createdAt: Date;
  sentAt?: Date;
  deliveredAt?: Date;          // Ack from WhatsApp
}

type WhatsAppNotificationType =
  | 'card_request_approval'    // Request admin approval
  | 'payment_notification';    // Inform about payment

type WhatsAppDeliveryStatus =
  | 'pending'                  // Queued for delivery
  | 'sent'                     // Sent to wpp-connect
  | 'delivered'                // WhatsApp confirmed delivery
  | 'failed'                   // Delivery failed (may retry)
  | 'dead_letter';             // Gave up after retries
```

**Validation Rules**:
- `recipientPhone` must match E.164 pattern: `/^55\d{11}$/`
- `retryCount` max value: 3
- `messageContent` max length: 4096 characters

### WhatsAppInboundMessage

Tracks inbound WhatsApp messages from admins.

```typescript
// src/domain/entities/whatsapp-inbound.entity.ts

interface WhatsAppInboundMessage {
  messageId: string;           // UUID v7 (our ID, not wpp-connect's)
  wppMessageId?: string;       // ID from wpp-connect webhook

  // Sender info
  senderPhone: string;         // E.164 format
  senderName?: string;         // Display name if available
  isFromWhitelistedAdmin: boolean;

  // Message content
  rawBody: string;             // Original message text
  parsedCommand?: ParsedCommand;

  // Processing
  processedStatus: InboundMessageStatus;
  processedAction?: string;    // e.g., "approved_request_12345"
  processingError?: string;

  // Related entities (populated after processing)
  relatedRequestId?: string;
  relatedEcosystemId?: string;

  // Timestamps
  receivedAt: Date;
  processedAt?: Date;
}

interface ParsedCommand {
  action: 'approve' | 'reject' | 'unknown';
  requestId: string;
  rawInput: string;            // Original text that was parsed
}

type InboundMessageStatus =
  | 'received'                 // Just received
  | 'processing'               // Being processed
  | 'processed'                // Successfully handled
  | 'ignored'                  // Ignored (not whitelisted, group, etc.)
  | 'error';                   // Processing failed
```

**Validation Rules**:
- `senderPhone` must match E.164 pattern: `/^55\d{11}$/`
- `rawBody` max length: 4096 characters

### PendingApprovalTracker

Links card requests to their WhatsApp notification state.

```typescript
// src/domain/entities/pending-approval.entity.ts

interface PendingApprovalTracker {
  requestId: string;           // FK to CardRequest.requestId
  ecosystemId: string;         // FK to User.ecosystemId

  // Notification tracking
  notificationIds: string[];   // WhatsAppNotification IDs (2 admins)
  notificationsSentAt?: Date;

  // Approval state (mirrors CardRequest but for quick lookup)
  approvalStatus: 'pending' | 'approved' | 'rejected' | 'expired';

  // Response tracking
  respondingAdminPhone?: string;
  responseReceivedAt?: Date;

  // Timeout
  expiresAt: Date;             // 24 hours from creation

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}
```

**State Transitions**:
```
pending ──────┬──────────► approved (admin replies "y {id}")
              │
              ├──────────► rejected (admin replies "n {id}")
              │
              └──────────► expired (24 hours timeout)
```

---

## Entity Relationships

```
┌─────────────┐       1:N       ┌──────────────────────┐
│ CardRequest │◄────────────────│ WhatsAppNotification │
└─────────────┘                 └──────────────────────┘
       │                                   │
       │ 1:1                               │
       ▼                                   │
┌──────────────────────┐                   │
│ PendingApprovalTracker│───────────────────┘
└──────────────────────┘         tracks which notifications
       │                         were sent for this request
       │
       │ 1:N (responses)
       ▼
┌──────────────────────┐
│ WhatsAppInboundMessage│
└──────────────────────┘
```

---

## Repository Interfaces

### IWhatsAppNotificationRepository

```typescript
// src/infrastructure/persistence/interfaces/whatsapp-notification.repository.ts

interface IWhatsAppNotificationRepository {
  save(notification: WhatsAppNotification): Promise<void>;
  findById(notificationId: string): Promise<WhatsAppNotification | null>;

  // Query by related entity
  findByRelatedEntity(
    entityType: 'cardRequest' | 'payment',
    entityId: string
  ): Promise<WhatsAppNotification[]>;

  // Retry queue
  findPendingDelivery(limit?: number): Promise<WhatsAppNotification[]>;
  findReadyForRetry(limit?: number): Promise<WhatsAppNotification[]>;

  // Update delivery status
  updateDeliveryStatus(
    notificationId: string,
    status: WhatsAppDeliveryStatus,
    wppMessageId?: string,
    error?: string
  ): Promise<void>;

  // Increment retry
  incrementRetry(notificationId: string, nextRetryAt: Date): Promise<void>;
}
```

### IWhatsAppInboundRepository

```typescript
// src/infrastructure/persistence/interfaces/whatsapp-inbound.repository.ts

interface IWhatsAppInboundRepository {
  save(message: WhatsAppInboundMessage): Promise<void>;
  findById(messageId: string): Promise<WhatsAppInboundMessage | null>;

  // Deduplication check
  findByWppMessageId(wppMessageId: string): Promise<WhatsAppInboundMessage | null>;

  // Find by sender
  findBySenderPhone(
    phone: string,
    since?: Date
  ): Promise<WhatsAppInboundMessage[]>;

  // Update processing status
  updateProcessingStatus(
    messageId: string,
    status: InboundMessageStatus,
    action?: string,
    error?: string
  ): Promise<void>;
}
```

### IPendingApprovalRepository

```typescript
// src/infrastructure/persistence/interfaces/pending-approval.repository.ts

interface IPendingApprovalRepository {
  save(tracker: PendingApprovalTracker): Promise<void>;
  findByRequestId(requestId: string): Promise<PendingApprovalTracker | null>;

  // Find pending approvals for admin lookup
  findPendingByRequestId(requestId: string): Promise<PendingApprovalTracker | null>;

  // Update when admin responds
  updateApprovalStatus(
    requestId: string,
    status: 'approved' | 'rejected',
    adminPhone: string
  ): Promise<void>;

  // Find expired for auto-rejection
  findExpired(): Promise<PendingApprovalTracker[]>;

  // Mark as expired
  markExpired(requestId: string): Promise<void>;
}
```

---

## Event Types (Extensions)

### New Event Types

Add to `src/domain/events/types.ts`:

```typescript
// WhatsApp-related events
type WhatsAppEventType =
  | 'whatsapp.notification.sent'      // Notification delivered to wpp-connect
  | 'whatsapp.notification.failed'    // Delivery failed
  | 'whatsapp.message.received'       // Inbound message from admin
  | 'whatsapp.approval.received'      // Admin approved via WhatsApp
  | 'whatsapp.rejection.received';    // Admin rejected via WhatsApp
```

### Event Payloads

```typescript
interface WhatsAppNotificationSentPayload {
  notificationId: string;
  recipientPhone: string;
  notificationType: WhatsAppNotificationType;
  relatedEntityId: string;
  wppMessageId?: string;
}

interface WhatsAppApprovalReceivedPayload {
  messageId: string;
  senderPhone: string;
  requestId: string;
  ecosystemId: string;
  action: 'approve' | 'reject';
  rawInput: string;
}
```

---

## Firestore Collection Structure

```
/whatsapp_notifications/{notificationId}
  - recipientPhone: string
  - notificationType: string
  - relatedEntityType: string
  - relatedEntityId: string
  - ecosystemId: string
  - deliveryStatus: string
  - retryCount: number
  - createdAt: timestamp
  - sentAt: timestamp?
  - ...

/whatsapp_inbound/{messageId}
  - senderPhone: string
  - rawBody: string
  - parsedCommand: map?
  - processedStatus: string
  - relatedRequestId: string?
  - receivedAt: timestamp
  - processedAt: timestamp?
  - ...

/pending_approvals/{requestId}
  - ecosystemId: string
  - notificationIds: array<string>
  - approvalStatus: string
  - expiresAt: timestamp
  - respondingAdminPhone: string?
  - createdAt: timestamp
  - updatedAt: timestamp
```

---

## Indexes Required

### Firestore Indexes

```
// For finding pending notifications to send
whatsapp_notifications:
  - deliveryStatus ASC, createdAt ASC

// For finding notifications ready for retry
whatsapp_notifications:
  - deliveryStatus ASC, nextRetryAt ASC

// For finding expired approvals
pending_approvals:
  - approvalStatus ASC, expiresAt ASC

// For deduplication
whatsapp_inbound:
  - wppMessageId ASC (unique)
```

---

## Migration Notes

1. **New collections only** - No changes to existing collections
2. **Feature flag** - WhatsApp notifications can be disabled via env var
3. **Backward compatible** - Existing card approval flow unchanged if WhatsApp disabled
