/**
 * Card Approval Service
 *
 * Pure business logic for card request approval decisions.
 * No external dependencies - operates only on domain types.
 */

import type { User, UserTier } from '../entities/user.entity.js';
import type { Card } from '../entities/card.entity.js';
import type { CardRequest } from '../entities/card-request.entity.js';
import { CREDIT_LIMITS } from '../entities/card.entity.js';
import { CARD_REQUEST_RULES } from '../entities/card-request.entity.js';
import { TIER_BOUNDARIES } from './scoring.service.js';

/**
 * Approval outcome from automatic decision
 */
export interface ApprovalOutcome {
  approved: boolean;
  limit: number;
  requiresReview: boolean;
  reason?: string;
}

/**
 * Determine approval outcome based on score
 *
 * - High score (≥700): Auto-approve with $10,000 limit
 * - Medium score (500-699): Auto-approve with $5,000 limit
 * - Low score (<500): Pending for admin review
 */
export function determineApprovalOutcome(score: number): ApprovalOutcome {
  if (score >= TIER_BOUNDARIES.HIGH) {
    return {
      approved: true,
      limit: CREDIT_LIMITS.HIGH,
      requiresReview: false,
    };
  }

  if (score >= TIER_BOUNDARIES.MEDIUM) {
    return {
      approved: true,
      limit: CREDIT_LIMITS.MEDIUM,
      requiresReview: false,
    };
  }

  // Low score - requires admin review
  return {
    approved: false,
    limit: CREDIT_LIMITS.LOW,
    requiresReview: true,
    reason: 'Score below auto-approval threshold',
  };
}

/**
 * Validate limit for tier
 *
 * Returns true if limit is valid for the given tier:
 * - High tier: max $10,000
 * - Medium tier: max $5,000
 * - Low tier: max $2,000
 * - Minimum for all: $100
 */
export function validateLimitForTier(limit: number, tier: UserTier): boolean {
  if (limit < CREDIT_LIMITS.MINIMUM) return false;

  switch (tier) {
    case 'high':
      return limit <= CREDIT_LIMITS.HIGH;
    case 'medium':
      return limit <= CREDIT_LIMITS.MEDIUM;
    case 'low':
      return limit <= CREDIT_LIMITS.LOW;
    default:
      return false;
  }
}

/**
 * Get maximum limit for tier
 */
export function getMaxLimitForTier(tier: UserTier): number {
  switch (tier) {
    case 'high':
      return CREDIT_LIMITS.HIGH;
    case 'medium':
      return CREDIT_LIMITS.MEDIUM;
    case 'low':
      return CREDIT_LIMITS.LOW;
  }
}

/**
 * Result of card request eligibility check
 */
export interface CardRequestEligibility {
  allowed: boolean;
  reason?: string;
}

/**
 * Check if user can request a new card
 *
 * Validation rules:
 * - User must not have an active card
 * - User must not have a pending card request
 * - User must not have been rejected within cooldown period (30 days)
 */
export function canRequestCard(
  _user: User,
  existingCards: Card[],
  pendingRequests: CardRequest[],
  recentRejections: CardRequest[]
): CardRequestEligibility {
  // Check for active card
  const hasActiveCard = existingCards.some((card) => card.status === 'active');
  if (hasActiveCard) {
    return {
      allowed: false,
      reason: 'User already has an active credit card',
    };
  }

  // Check for pending request
  const hasPendingRequest = pendingRequests.some((request) => request.status === 'pending');
  if (hasPendingRequest) {
    return {
      allowed: false,
      reason: 'User has a pending card request',
    };
  }

  // Check cooldown period after rejection
  const now = new Date();
  const cooldownMs = CARD_REQUEST_RULES.COOLDOWN_DAYS_AFTER_REJECTION * 24 * 60 * 60 * 1000;

  const recentRejection = recentRejections.find((request) => {
    if (request.status !== 'rejected' || request.decision === undefined) return false;
    const rejectionTime = request.decision.decidedAt.getTime();
    return now.getTime() - rejectionTime < cooldownMs;
  });

  if (recentRejection !== undefined) {
    const daysRemaining = Math.ceil(
      (cooldownMs - (now.getTime() - recentRejection.decision!.decidedAt.getTime())) /
        (24 * 60 * 60 * 1000)
    );
    return {
      allowed: false,
      reason: `Card request rejected recently. Please wait ${daysRemaining} days before applying again.`,
    };
  }

  return { allowed: true };
}

/**
 * Check if admin can approve with given limit
 */
export function canApproveWithLimit(
  request: CardRequest,
  limit: number,
  currentUserTier: UserTier
): CardRequestEligibility {
  // Validate limit is positive
  if (limit < CREDIT_LIMITS.MINIMUM) {
    return {
      allowed: false,
      reason: `Limit must be at least $${CREDIT_LIMITS.MINIMUM}`,
    };
  }

  // Validate limit doesn't exceed tier maximum
  const maxLimit = getMaxLimitForTier(currentUserTier);
  if (limit > maxLimit) {
    return {
      allowed: false,
      reason: `Limit exceeds policy for ${currentUserTier} tier (max: $${maxLimit})`,
    };
  }

  // Request must be pending
  if (request.status !== 'pending') {
    return {
      allowed: false,
      reason: 'Card request is not pending',
    };
  }

  return { allowed: true };
}
