/**
 * Domain Event Payload Types
 *
 * Strongly typed payloads for all domain events.
 */

import type { UserTier, UserRole } from '../entities/user.entity.js';
import type { CardStatus } from '../entities/card.entity.js';
import type { DecisionSource } from '../entities/card-request.entity.js';
import type { PaymentStatus } from '../entities/transaction.entity.js';

/**
 * User created event payload
 */
export interface UserCreatedPayload {
  ecosystemId: string;
  firebaseUid: string;
  email: string;
  role: UserRole;
  initialScore: number;
  tier: UserTier;
}

/**
 * User updated event payload
 */
export interface UserUpdatedPayload {
  ecosystemId: string;
  changes: {
    field: string;
    oldValue: unknown;
    newValue: unknown;
  }[];
}

/**
 * Score changed event payload
 */
export interface ScoreChangedPayload {
  ecosystemId: string;
  previousScore: number;
  newScore: number;
  delta: number;
  previousTier: UserTier;
  newTier: UserTier;
  reason: string;
  source: 'system' | 'admin';
  adminId?: string | undefined;
  relatedEntityType?: string | undefined;
  relatedEntityId?: string | undefined;
}

/**
 * Card requested event payload
 */
export interface CardRequestedPayload {
  requestId: string;
  ecosystemId: string;
  productId: string;
  scoreAtRequest: number;
  tierAtRequest: UserTier;
  idempotencyKey: string;
}

/**
 * Card approved event payload
 */
export interface CardApprovedPayload {
  requestId: string;
  cardId: string;
  ecosystemId: string;
  productId: string;
  approvedLimit: number;
  source: DecisionSource;
  adminId?: string | undefined;
  scoreAtApproval: number;
  tierAtApproval: UserTier;
}

/**
 * Card rejected event payload
 */
export interface CardRejectedPayload {
  requestId: string;
  ecosystemId: string;
  productId: string;
  reason: string;
  source: DecisionSource;
  adminId?: string | undefined;
  scoreAtRequest: number;
}

/**
 * Card activated event payload
 */
export interface CardActivatedPayload {
  cardId: string;
  ecosystemId: string;
  productId: string;
  limit: number;
}

/**
 * Card suspended event payload
 */
export interface CardSuspendedPayload {
  cardId: string;
  ecosystemId: string;
  reason: string;
  adminId: string;
  previousStatus: CardStatus;
}

/**
 * Card cancelled event payload
 */
export interface CardCancelledPayload {
  cardId: string;
  ecosystemId: string;
  reason: string;
  requestedBy: 'user' | 'admin';
  adminId?: string | undefined;
  finalBalance: number;
}

/**
 * Purchase transaction event payload
 */
export interface PurchasePayload {
  transactionId: string;
  cardId: string;
  ecosystemId: string;
  amount: number;
  merchant: string;
  newBalance: number;
  newAvailableCredit: number;
  idempotencyKey: string;
}

/**
 * Payment transaction event payload
 */
export interface PaymentPayload {
  transactionId: string;
  cardId: string;
  ecosystemId: string;
  amount: number;
  paymentStatus: PaymentStatus;
  daysOverdue?: number | undefined;
  scoreImpact: number;
  newBalance: number;
  newAvailableCredit: number;
  newScore: number;
  newTier: UserTier;
  idempotencyKey: string;
}

/**
 * System cleanup event payload
 */
export interface SystemCleanupPayload {
  adminId: string;
  adminEmail: string;
  deletedCounts: {
    users: number;
    cards: number;
    cardRequests: number;
    transactions: number;
    scores: number;
    auditLogs: number;
    outboxEvents: number;
  };
  timestamp: string;
}

/**
 * WhatsApp notification sent event payload
 */
export interface WhatsAppNotificationSentPayload {
  notificationId: string;
  recipientPhone: string;
  notificationType: 'card_request_approval' | 'payment_notification';
  relatedEntityId: string;
  wppMessageId?: string;
}

/**
 * WhatsApp notification failed event payload
 */
export interface WhatsAppNotificationFailedPayload {
  notificationId: string;
  recipientPhone: string;
  notificationType: 'card_request_approval' | 'payment_notification';
  relatedEntityId: string;
  error: string;
  retryCount: number;
}

/**
 * WhatsApp message received event payload
 */
export interface WhatsAppMessageReceivedPayload {
  messageId: string;
  senderPhone: string;
  rawBody: string;
  isFromWhitelistedAdmin: boolean;
}

/**
 * WhatsApp approval received event payload
 */
export interface WhatsAppApprovalReceivedPayload {
  messageId: string;
  senderPhone: string;
  requestId: string;
  ecosystemId: string;
  action: 'approve' | 'reject';
  rawInput: string;
}

/**
 * Union type of all event payloads
 */
export type EventPayload =
  | UserCreatedPayload
  | UserUpdatedPayload
  | ScoreChangedPayload
  | CardRequestedPayload
  | CardApprovedPayload
  | CardRejectedPayload
  | CardActivatedPayload
  | CardSuspendedPayload
  | CardCancelledPayload
  | PurchasePayload
  | PaymentPayload
  | SystemCleanupPayload
  | WhatsAppNotificationSentPayload
  | WhatsAppNotificationFailedPayload
  | WhatsAppMessageReceivedPayload
  | WhatsAppApprovalReceivedPayload;
