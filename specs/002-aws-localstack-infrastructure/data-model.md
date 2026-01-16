# Data Model: AWS LocalStack Infrastructure (Aligned to Current Code)

**Feature**: 002-aws-localstack-infrastructure
**Date**: 2026-01-07
**Purpose**: DynamoDB table schemas + GSIs to satisfy the existing repository interfaces without changing domain/application code.

## Source of Truth

This data model mirrors what the code currently persists:
- Domain entities: `src/domain/entities/*`
- Persistence interfaces: `src/infrastructure/persistence/interfaces/*`
- Current Firestore structure is the reference behavior: `src/infrastructure/persistence/firestore/*`

## Conventions

- **Dates**: store as ISO 8601 strings (e.g., `createdAt`, `updatedAt`) unless TTL requires epoch seconds.
- **TTL**: store epoch seconds in a dedicated attribute (e.g., `expiresAtEpochSeconds`) and enable DynamoDB TTL on it.
- **Cursors**: API cursors are opaque strings. DynamoDB repositories may base64-encode the JSON `ExclusiveStartKey`.
- **Undefined**: DynamoDB DocumentClient can remove undefined values; keep behavior consistent with Firestore codec constraints.

---

## Table Definitions (12)

### 1) `tazco-users`

**Key schema**
- PK: `ecosystemId` (S)

**Attributes (aligned to `User`)**
- `firebaseUid` (S)
- `email` (S)
- `role` (S: `user|admin`)
- `status` (S: `active|disabled`)
- `currentScore` (N)
- `tier` (S: `low|medium|high`)
- `cardSummary` (M: `{ activeCards, totalBalance, totalLimit }`)
- `createdAt` (S), `updatedAt` (S), `lastLoginAt` (S)

**GSI**
- `UserByFirebaseUid`: PK=`firebaseUid` (S), projection ALL

**Access patterns**
- `findById` → GetItem(PK)
- `findByFirebaseUid` → Query(GSI)

---

### 2) `tazco-scores`

**Key schema**
- PK: `ecosystemId` (S)
- SK: `timestampScoreId` (S) = `${timestampIso}#${scoreId}` (time-ordered)

**Attributes (aligned to `Score`)**
- `scoreId` (S)
- `value` (N), `previousValue` (N), `delta` (N)
- `reason` (S), `source` (S: `system|admin`)
- `sourceId` (S, optional)
- `relatedEntityType` (S, optional), `relatedEntityId` (S, optional)
- `timestamp` (S)

**Access patterns**
- `getScoreHistory` → Query(PK, SK desc, Limit)

---

### 3) `tazco-cards`

**Key schema**
- PK: `ecosystemId` (S)
- SK: `cardId` (S)

**Attributes (aligned to `Card`)**
- `type` (S: `credit-card`)
- `productId` (S)
- `status` (S: `active|suspended|cancelled`)
- `statusReason` (S, optional)
- `limit` (N), `balance` (N), `availableCredit` (N), `minimumPayment` (N)
- `nextDueDate` (S)
- `version` (N)
- `approvedBy` (S: `auto|admin`)
- `approvedByAdminId` (S, optional)
- `scoreAtApproval` (N)
- `createdAt` (S), `updatedAt` (S), `activatedAt` (S, optional), `cancelledAt` (S, optional)

**Optional GSI (only if needed)**
- `CardsByStatus`: PK=`ecosystemId`, SK=`status#cardId`

**Access patterns**
- `findById` → GetItem(PK+SK)
- `findByUser` → Query(PK), optional filter by `status`
- `updateBalance` → UpdateItem with `ConditionExpression` on `version`

---

### 4) `tazco-card-requests`

**Key schema**
- PK: `ecosystemId` (S)
- SK: `requestId` (S)

**Attributes (aligned to `CardRequest`)**
- `productId` (S)
- `idempotencyKey` (S)
- `status` (S: `pending|approved|rejected`)
- `scoreAtRequest` (N)
- `tierAtRequest` (S: `low|medium|high`)
- `decision` (M, optional) (aligned to `CardRequestDecision`)
- `resultingCardId` (S, optional)
- `createdAt` (S), `updatedAt` (S)
- `expiresAt` (S, optional)

**GSI (admin listing + attention count)**
- `RequestsByStatusCreatedAt`: PK=`status` (S), SK=`createdAt#requestId` (S), projection ALL

**Optional GSI (tier filtering)**
- `RequestsByTierCreatedAt`: PK=`tierAtRequest` (S), SK=`createdAt#requestId` (S), projection ALL

**Access patterns**
- `findPendingByUser` → Query(PK) + filter `status=pending` (limit 1)
- `findAllPending` → Query(GSI `RequestsByStatusCreatedAt` where `status=pending`)
- `countRequiringAttention` → Query(GSI `RequestsByStatusCreatedAt` with `createdAt <= sevenDaysAgo` (prefix/range))

---

### 5) `tazco-transactions`

**Key schema**
- PK: `ecosystemIdCardId` (S) = `${ecosystemId}#${cardId}`
- SK: `transactionId` (S) (UUIDv7 is time-sortable and can support desc listing)

**Attributes (aligned to `Transaction`)**
- `type` (S: `purchase|payment`)
- `amount` (N)
- `merchant` (S, optional)
- `paymentStatus` (S, optional), `daysOverdue` (N, optional), `scoreImpact` (N, optional)
- `idempotencyKey` (S)
- `status` (S: `completed|failed`)
- `failureReason` (S, optional)
- `timestamp` (S), `processedAt` (S)

**Access patterns**
- `findByCard` → Query(PK, SK desc) with optional in-memory filter by `type` + opaque cursor
- `findById` → GetItem(PK+SK)
- `getRecent` → Query(PK, SK desc, Limit)

---

### 6) `tazco-idempotency`

**Key schema**
- PK: `ecosystemId` (S)
- SK: `keyHash` (S)

**Attributes (aligned to `IdempotencyRecord`)**
- `operation` (S)
- `response` (M)
- `statusCode` (N)
- `createdAt` (S)
- `expiresAtEpochSeconds` (N) (TTL attribute)

**TTL**
- Enable DynamoDB TTL on `expiresAtEpochSeconds`.

---

### 7) `tazco-outbox`

**Key schema**
- PK: `eventId` (S)

**Attributes (aligned to `OutboxEvent`)**
- `eventType` (S)
- `entityType` (S), `entityId` (S), `ecosystemId` (S)
- `sequenceNumber` (N)
- `payload` (M)
- `status` (S: `pending|sent|failed|dead_letter`)
- `retryCount` (N)
- `lastError` (S, optional)
- `nextRetryAt` (S)
- `createdAt` (S)
- `sentAt` (S, optional)

**GSIs**
- `OutboxByStatusCreatedAt`: PK=`status`, SK=`createdAt#eventId`
- `OutboxByStatusNextRetryAt`: PK=`status`, SK=`nextRetryAt#eventId`

**Access patterns**
- `findPending` → Query(GSI `OutboxByStatusCreatedAt` where `status=pending`)
- `findReadyForRetry` → Query(GSI `OutboxByStatusNextRetryAt` where `status=failed` and `nextRetryAt <= now`)

---

### 8) `tazco-outbox-sequences`

**Key schema**
- PK: `sequenceId` (S) (hash of entity key, e.g., `${ecosystemId}:${entityType}:${entityId}`)

**Attributes**
- `entityKey` (S)
- `current` (N)
- `updatedAt` (S)

**Access patterns**
- Atomic increment of `current` for per-entity monotonic sequence allocation.

---

### 9) `tazco-audit-logs`

**Key schema**
- PK: `targetKey` (S) = `${targetType}#${targetId}`
- SK: `timestampLogId` (S) = `${timestampIso}#${logId}`

**Attributes (aligned to `AuditLog`)**
- `logId` (S)
- `adminEcosystemId` (S), `adminEmail` (S)
- `action` (S)
- `targetType` (S), `targetId` (S), `targetEcosystemId` (S, optional)
- `previousValue` (M, optional), `newValue` (M, optional)
- `reason` (S), `requestId` (S)
- `ipAddress` (S, optional), `userAgent` (S, optional)
- `timestamp` (S)

**GSI**
- `AuditLogsByActor`: PK=`adminEcosystemId`, SK=`timestampLogId`

---

### 10) `tazco-whatsapp-notifications`

**Key schema**
- PK: `notificationId` (S)

**Attributes (aligned to `WhatsAppNotification`)**
- `recipientPhone` (S)
- `recipientName` (S, optional)
- `messageContent` (S)
- `notificationType` (S)
- `relatedEntityType` (S: `cardRequest|payment`)
- `relatedEntityId` (S)
- `ecosystemId` (S)
- `deliveryStatus` (S)
- `wppMessageId` (S, optional)
- `retryCount` (N)
- `lastError` (S, optional)
- `nextRetryAt` (S, optional)
- `createdAt` (S)
- `sentAt` (S, optional)
- `deliveredAt` (S, optional)

**GSIs**
- `NotificationsByRelatedEntity`: PK=`relatedEntityType#relatedEntityId`, SK=`createdAt#notificationId`
- `NotificationsByDeliveryStatusCreatedAt`: PK=`deliveryStatus`, SK=`createdAt#notificationId`
- `NotificationsByDeliveryStatusNextRetryAt`: PK=`deliveryStatus`, SK=`nextRetryAt#notificationId`

---

### 11) `tazco-whatsapp-inbound`

**Key schema**
- PK: `messageId` (S)

**Attributes (aligned to `WhatsAppInboundMessage`)**
- `wppMessageId` (S, optional)
- `senderPhone` (S)
- `senderName` (S, optional)
- `isFromWhitelistedAdmin` (BOOL)
- `rawBody` (S)
- `parsedCommand` (M, optional)
- `processedStatus` (S)
- `processedAction` (S, optional)
- `processingError` (S, optional)
- `relatedRequestId` (S, optional)
- `relatedEcosystemId` (S, optional)
- `receivedAt` (S)
- `processedAt` (S, optional)

**GSIs**
- `InboundByWppMessageId`: PK=`wppMessageId`
- `InboundBySenderPhoneReceivedAt`: PK=`senderPhone`, SK=`receivedAt#messageId`

---

### 12) `tazco-pending-approvals`

**Key schema**
- PK: `requestId` (S)

**Attributes (aligned to `PendingApprovalTracker`)**
- `ecosystemId` (S)
- `notificationIds` (L of S)
- `notificationsSentAt` (S, optional)
- `approvalStatus` (S: `pending|approved|rejected|expired`)
- `respondingAdminPhone` (S, optional)
- `responseReceivedAt` (S, optional)
- `expiresAt` (S)
- `createdAt` (S), `updatedAt` (S)

**GSI (expiry scan)**
- `PendingApprovalsByStatusExpiresAt`: PK=`approvalStatus`, SK=`expiresAt#requestId`

**Access patterns**
- `findExpired` → Query(GSI) where `approvalStatus=pending` and `expiresAt <= now`

---

## LocalStack Init Script Notes

The init script (`scripts/localstack-init/01-create-resources.sh`) should create all tables and GSIs above. Use PAY_PER_REQUEST billing mode for local dev and keep definitions minimal (only attributes required by keys + indexes).
