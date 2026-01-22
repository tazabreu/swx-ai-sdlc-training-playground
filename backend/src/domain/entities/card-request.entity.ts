/**
 * CardRequest Entity
 *
 * Application for a new credit card.
 *
 * Firestore Path: users/{ecosystemId}/cardRequests/{requestId}
 */

import { v7 as uuidv7 } from 'uuid';
import type { UserTier } from './user.entity.js';

/**
 * Card request status
 * - pending: Awaiting admin review (low score)
 * - approved: Card created
 * - rejected: Denied
 */
export type CardRequestStatus = 'pending' | 'approved' | 'rejected';

/**
 * Decision source
 */
export type DecisionSource = 'auto' | 'admin';

/**
 * Decision details (populated when processed)
 */
export interface CardRequestDecision {
  outcome: 'approved' | 'rejected';
  source: DecisionSource;
  adminId?: string; // If admin decision
  reason?: string; // Rejection reason
  approvedLimit?: number; // If approved
  decidedAt: Date;
}

/**
 * CardRequest entity representing a card application
 */
export interface CardRequest {
  requestId: string; // Auto-generated

  // Request Details
  productId: string; // Requested product type
  idempotencyKey: string; // Client-provided dedup key

  // Status
  status: CardRequestStatus;

  // Score Context
  scoreAtRequest: number; // User's score when submitted
  tierAtRequest: UserTier;

  // Decision (populated when processed)
  decision?: CardRequestDecision;

  // Resulting Card (if approved)
  resultingCardId?: string;

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
  expiresAt?: Date; // For pending requests (7 days)
}

/**
 * Input for creating a card request
 */
export interface CreateCardRequestInput {
  productId?: string;
  idempotencyKey: string;
  scoreAtRequest: number;
  tierAtRequest: UserTier;
}

/**
 * Create a new card request
 */
export function createCardRequest(input: CreateCardRequestInput): CardRequest {
  const now = new Date();

  // Calculate expiration (7 days for pending requests)
  const expiresAt = new Date(now);
  expiresAt.setDate(expiresAt.getDate() + 7);

  return {
    requestId: uuidv7(),
    productId: input.productId ?? 'default-credit-card',
    idempotencyKey: input.idempotencyKey,
    status: 'pending',
    scoreAtRequest: input.scoreAtRequest,
    tierAtRequest: input.tierAtRequest,
    createdAt: now,
    updatedAt: now,
    expiresAt,
  };
}

/**
 * Type guard to check if value is a CardRequest
 */
export function isCardRequest(value: unknown): value is CardRequest {
  if (typeof value !== 'object' || value === null) return false;

  const request = value as Record<string, unknown>;
  const validStatuses: CardRequestStatus[] = ['pending', 'approved', 'rejected'];
  const validTiers: UserTier[] = ['high', 'medium', 'low'];

  return (
    typeof request.requestId === 'string' &&
    typeof request.productId === 'string' &&
    typeof request.idempotencyKey === 'string' &&
    validStatuses.includes(request.status as CardRequestStatus) &&
    typeof request.scoreAtRequest === 'number' &&
    validTiers.includes(request.tierAtRequest as UserTier) &&
    request.createdAt instanceof Date &&
    request.updatedAt instanceof Date
  );
}

/**
 * Validate card request data
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateCardRequest(request: CardRequest): ValidationResult {
  const errors: string[] = [];

  // Validate idempotencyKey
  if (request.idempotencyKey.length === 0) {
    errors.push('idempotencyKey is required');
  }
  if (request.idempotencyKey.length > 64) {
    errors.push('idempotencyKey must be at most 64 characters');
  }

  // Validate scoreAtRequest
  if (request.scoreAtRequest < 0 || request.scoreAtRequest > 1000) {
    errors.push('scoreAtRequest must be between 0 and 1000');
  }

  // Validate decision consistency
  if (request.status !== 'pending' && request.decision === undefined) {
    errors.push('decision is required for non-pending requests');
  }

  if (request.decision !== undefined) {
    if (request.status === 'approved' && request.decision.outcome !== 'approved') {
      errors.push('decision outcome must match status');
    }
    if (request.status === 'rejected' && request.decision.outcome !== 'rejected') {
      errors.push('decision outcome must match status');
    }
    if (request.decision.source === 'admin' && request.decision.adminId === undefined) {
      errors.push('adminId is required for admin decisions');
    }
  }

  // Validate resultingCardId
  if (request.status === 'approved' && request.resultingCardId === undefined) {
    errors.push('resultingCardId is required for approved requests');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Check if request is flagged as requiring attention (older than 7 days)
 */
export function requiresAttention(request: CardRequest): boolean {
  if (request.status !== 'pending') return false;

  const now = new Date();
  const daysSincePending = Math.floor(
    (now.getTime() - request.createdAt.getTime()) / (1000 * 60 * 60 * 24)
  );

  return daysSincePending >= 7;
}

/**
 * Business rules constants
 * Note: COOLDOWN_DAYS_AFTER_REJECTION is intentionally enforced in all environments.
 */
export const CARD_REQUEST_RULES = {
  COOLDOWN_DAYS_AFTER_REJECTION: 30,
  PENDING_ATTENTION_THRESHOLD_DAYS: 7,
  IDEMPOTENCY_KEY_MAX_LENGTH: 64,
} as const;
