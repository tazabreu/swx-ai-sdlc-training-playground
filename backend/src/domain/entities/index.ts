/**
 * Domain Entities - Re-exports
 *
 * Central export point for all domain entities.
 */

// User
export {
  type User,
  type UserRole,
  type UserStatus,
  type UserTier,
  type CardSummary,
  type CreateUserInput,
  createUser,
  isUser,
  validateUser,
  deriveTier,
} from './user.entity.js';

// Score
export {
  type Score,
  type ScoreChangeReason,
  type ScoreSource,
  type CreateScoreInput,
  createScore,
  isScore,
  validateScore,
  SCORE_IMPACTS,
} from './score.entity.js';

// Card
export {
  type Card,
  type CardStatus,
  type ApprovalSource,
  type CreateCardInput,
  type StateTransitionResult,
  createCard,
  isCard,
  validateCard,
  canTransitionTo,
  CREDIT_LIMITS,
} from './card.entity.js';

// CardRequest
export {
  type CardRequest,
  type CardRequestStatus,
  type DecisionSource,
  type CardRequestDecision,
  type CreateCardRequestInput,
  createCardRequest,
  isCardRequest,
  validateCardRequest,
  requiresAttention,
  CARD_REQUEST_RULES,
} from './card-request.entity.js';

// Transaction
export {
  type Transaction,
  type TransactionType,
  type PaymentStatus,
  type TransactionStatus,
  type CreatePurchaseInput,
  type CreatePaymentInput,
  createPurchase,
  createPayment,
  createFailedTransaction,
  isTransaction,
  validateTransaction,
} from './transaction.entity.js';

// Event
export {
  type OutboxEvent,
  type EventType,
  type EventStatus,
  type CreateEventInput,
  createEvent,
  isOutboxEvent,
  calculateNextRetryTime,
  shouldDeadLetter,
  EVENT_PROCESSING_RULES,
} from './event.entity.js';

// AuditLog
export {
  type AuditLog,
  type AuditAction,
  type CreateAuditLogInput,
  createAuditLog,
  isAuditLog,
  validateAuditLog,
  AUDIT_RULES,
} from './audit-log.entity.js';

// IdempotencyRecord
export {
  type IdempotencyRecord,
  type CreateIdempotencyRecordInput,
  createIdempotencyRecord,
  hashIdempotencyKey,
  isIdempotencyRecord,
  isExpired,
  validateIdempotencyRecord,
  checkOperationMismatch,
  IDEMPOTENCY_RULES,
} from './idempotency-record.entity.js';

// Common validation result type
export type { ValidationResult } from './user.entity.js';

// WhatsApp Notification
export {
  type WhatsAppNotification,
  type CreateWhatsAppNotificationInput,
  type WhatsAppNotificationValidationResult,
  createWhatsAppNotification,
  validateWhatsAppNotification,
  canRetry,
  calculateNextRetryTime as calculateNotificationRetryTime,
  isWhatsAppNotification,
  MAX_RETRY_COUNT,
  MAX_MESSAGE_LENGTH,
} from './whatsapp-notification.entity.js';

// WhatsApp Inbound Message
export {
  type WhatsAppInboundMessage,
  type CreateWhatsAppInboundInput,
  type WhatsAppInboundValidationResult,
  createWhatsAppInboundMessage,
  validateWhatsAppInboundMessage,
  markAsProcessing,
  markAsProcessed,
  markAsIgnored,
  markAsError,
  isWhatsAppInboundMessage,
  MAX_BODY_LENGTH,
} from './whatsapp-inbound.entity.js';

// Pending Approval Tracker
export {
  type PendingApprovalTracker,
  type CreatePendingApprovalInput,
  type PendingApprovalValidationResult,
  createPendingApprovalTracker,
  validatePendingApprovalTracker,
  isPending,
  isExpired as isPendingApprovalExpired,
  canProcess,
  markAsApproved,
  markAsRejected,
  markTrackerAsExpired,
  addNotificationIds,
  isPendingApprovalTracker,
  DEFAULT_EXPIRATION_MS,
} from './pending-approval.entity.js';
