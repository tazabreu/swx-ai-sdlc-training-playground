/**
 * Domain Event Factory
 *
 * Factory functions for creating domain events with proper payloads.
 */

import { createEvent, type OutboxEvent, type CreateEventInput } from '../entities/event.entity.js';
import type { User } from '../entities/user.entity.js';
import type { Card } from '../entities/card.entity.js';
import type { CardRequest, CardRequestDecision } from '../entities/card-request.entity.js';
import type { Transaction } from '../entities/transaction.entity.js';
import type {
  UserCreatedPayload,
  ScoreChangedPayload,
  CardRequestedPayload,
  CardApprovedPayload,
  CardRejectedPayload,
  CardSuspendedPayload,
  CardCancelledPayload,
  PurchasePayload,
  PaymentPayload,
  SystemCleanupPayload,
} from './types.js';
import { deriveTier } from '../entities/user.entity.js';

/**
 * Helper to create event with typed payload
 */
function createTypedEvent<T extends object>(
  input: Omit<CreateEventInput, 'payload'> & { payload: T }
): OutboxEvent {
  return createEvent({
    ...input,
    payload: input.payload as { [key: string]: unknown },
  });
}

/**
 * Create user.created event
 */
export function createUserCreatedEvent(user: User): OutboxEvent {
  const payload: UserCreatedPayload = {
    ecosystemId: user.ecosystemId,
    firebaseUid: user.firebaseUid,
    email: user.email,
    role: user.role,
    initialScore: user.currentScore,
    tier: user.tier,
  };

  return createTypedEvent({
    eventType: 'user.created',
    entityType: 'user',
    entityId: user.ecosystemId,
    ecosystemId: user.ecosystemId,
    sequenceNumber: 0,
    payload,
  });
}

/**
 * Create score.changed event
 */
export function createScoreChangedEvent(
  ecosystemId: string,
  previousScore: number,
  newScore: number,
  reason: string,
  source: 'system' | 'admin',
  adminId?: string,
  relatedEntityType?: string,
  relatedEntityId?: string
): OutboxEvent {
  const payload: ScoreChangedPayload = {
    ecosystemId,
    previousScore,
    newScore,
    delta: newScore - previousScore,
    previousTier: deriveTier(previousScore),
    newTier: deriveTier(newScore),
    reason,
    source,
  };

  // Only add optional fields if defined (Firestore rejects undefined values)
  if (adminId !== undefined) {
    payload.adminId = adminId;
  }
  if (relatedEntityType !== undefined) {
    payload.relatedEntityType = relatedEntityType;
  }
  if (relatedEntityId !== undefined) {
    payload.relatedEntityId = relatedEntityId;
  }

  return createTypedEvent({
    eventType: 'score.changed',
    entityType: 'score',
    entityId: ecosystemId,
    ecosystemId,
    sequenceNumber: 0,
    payload,
  });
}

/**
 * Create card.requested event
 */
export function createCardRequestedEvent(request: CardRequest, ecosystemId: string): OutboxEvent {
  const payload: CardRequestedPayload = {
    requestId: request.requestId,
    ecosystemId,
    productId: request.productId,
    scoreAtRequest: request.scoreAtRequest,
    tierAtRequest: request.tierAtRequest,
    idempotencyKey: request.idempotencyKey,
  };

  return createTypedEvent({
    eventType: 'card.requested',
    entityType: 'cardRequest',
    entityId: request.requestId,
    ecosystemId,
    sequenceNumber: 0,
    payload,
  });
}

/**
 * Create card.approved event
 */
export function createCardApprovedEvent(
  request: CardRequest,
  card: Card,
  ecosystemId: string,
  decision: CardRequestDecision
): OutboxEvent {
  const payload: CardApprovedPayload = {
    requestId: request.requestId,
    cardId: card.cardId,
    ecosystemId,
    productId: request.productId,
    approvedLimit: card.limit,
    source: decision.source,
    adminId: decision.adminId,
    scoreAtApproval: card.scoreAtApproval,
    tierAtApproval: deriveTier(card.scoreAtApproval),
  };

  return createTypedEvent({
    eventType: 'card.approved',
    entityType: 'card',
    entityId: card.cardId,
    ecosystemId,
    sequenceNumber: 0,
    payload,
  });
}

/**
 * Create card.rejected event
 */
export function createCardRejectedEvent(
  request: CardRequest,
  ecosystemId: string,
  decision: CardRequestDecision
): OutboxEvent {
  const payload: CardRejectedPayload = {
    requestId: request.requestId,
    ecosystemId,
    productId: request.productId,
    reason: decision.reason ?? 'Request rejected',
    source: decision.source,
    adminId: decision.adminId,
    scoreAtRequest: request.scoreAtRequest,
  };

  return createTypedEvent({
    eventType: 'card.rejected',
    entityType: 'cardRequest',
    entityId: request.requestId,
    ecosystemId,
    sequenceNumber: 0,
    payload,
  });
}

/**
 * Create card.suspended event
 */
export function createCardSuspendedEvent(
  card: Card,
  ecosystemId: string,
  reason: string,
  adminId: string,
  previousStatus: 'active' | 'suspended' | 'cancelled'
): OutboxEvent {
  const payload: CardSuspendedPayload = {
    cardId: card.cardId,
    ecosystemId,
    reason,
    adminId,
    previousStatus,
  };

  return createTypedEvent({
    eventType: 'card.suspended',
    entityType: 'card',
    entityId: card.cardId,
    ecosystemId,
    sequenceNumber: 0,
    payload,
  });
}

/**
 * Create card.cancelled event
 */
export function createCardCancelledEvent(
  card: Card,
  ecosystemId: string,
  reason: string,
  requestedBy: 'user' | 'admin',
  adminId?: string
): OutboxEvent {
  const payload: CardCancelledPayload = {
    cardId: card.cardId,
    ecosystemId,
    reason,
    requestedBy,
    adminId,
    finalBalance: card.balance,
  };

  return createTypedEvent({
    eventType: 'card.cancelled',
    entityType: 'card',
    entityId: card.cardId,
    ecosystemId,
    sequenceNumber: 0,
    payload,
  });
}

/**
 * Create transaction.purchase event
 */
export function createPurchaseEvent(
  transaction: Transaction,
  cardId: string,
  ecosystemId: string,
  newBalance: number,
  newAvailableCredit: number
): OutboxEvent {
  const payload: PurchasePayload = {
    transactionId: transaction.transactionId,
    cardId,
    ecosystemId,
    amount: transaction.amount,
    merchant: transaction.merchant ?? 'Unknown',
    newBalance,
    newAvailableCredit,
    idempotencyKey: transaction.idempotencyKey,
  };

  return createTypedEvent({
    eventType: 'transaction.purchase',
    entityType: 'transaction',
    entityId: transaction.transactionId,
    ecosystemId,
    sequenceNumber: 0,
    payload,
  });
}

/**
 * Create transaction.payment event
 */
export function createPaymentEvent(
  transaction: Transaction,
  cardId: string,
  ecosystemId: string,
  newBalance: number,
  newAvailableCredit: number,
  newScore: number
): OutboxEvent {
  const payload: PaymentPayload = {
    transactionId: transaction.transactionId,
    cardId,
    ecosystemId,
    amount: transaction.amount,
    paymentStatus: transaction.paymentStatus ?? 'on_time',
    daysOverdue: transaction.daysOverdue,
    scoreImpact: transaction.scoreImpact ?? 0,
    newBalance,
    newAvailableCredit,
    newScore,
    newTier: deriveTier(newScore),
    idempotencyKey: transaction.idempotencyKey,
  };

  return createTypedEvent({
    eventType: 'transaction.payment',
    entityType: 'transaction',
    entityId: transaction.transactionId,
    ecosystemId,
    sequenceNumber: 0,
    payload,
  });
}

/**
 * Create system.cleanup event
 */
export function createSystemCleanupEvent(
  adminId: string,
  adminEmail: string,
  deletedCounts: SystemCleanupPayload['deletedCounts']
): OutboxEvent {
  const payload: SystemCleanupPayload = {
    adminId,
    adminEmail,
    deletedCounts,
    timestamp: new Date().toISOString(),
  };

  return createTypedEvent({
    eventType: 'system.cleanup',
    entityType: 'system',
    entityId: 'cleanup',
    ecosystemId: 'system',
    sequenceNumber: 0,
    payload,
  });
}
