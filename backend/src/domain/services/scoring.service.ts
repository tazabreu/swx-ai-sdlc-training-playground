/**
 * Scoring Service
 *
 * Pure business logic for score calculation and tier derivation.
 * No external dependencies - operates only on primitives.
 */

import { SCORE_IMPACTS } from '../entities/score.entity.js';
import type { UserTier } from '../entities/user.entity.js';

/**
 * Score bounds
 */
export const SCORE_BOUNDS = {
  MIN: 0,
  MAX: 1000,
} as const;

/**
 * Tier boundaries
 */
export const TIER_BOUNDARIES = {
  HIGH: 700, // Score >= 700
  MEDIUM: 500, // Score >= 500 and < 700
  // LOW: Score < 500
} as const;

/**
 * Derive tier from score
 *
 * - high: score >= 700
 * - medium: score >= 500 and < 700
 * - low: score < 500
 */
export function deriveTier(score: number): UserTier {
  if (score >= TIER_BOUNDARIES.HIGH) return 'high';
  if (score >= TIER_BOUNDARIES.MEDIUM) return 'medium';
  return 'low';
}

/**
 * Clamp score to valid bounds [0, 1000]
 */
export function clampScore(score: number): number {
  return Math.max(SCORE_BOUNDS.MIN, Math.min(SCORE_BOUNDS.MAX, Math.round(score)));
}

/**
 * Payment score impact calculation
 */
export interface PaymentScoreImpactResult {
  delta: number; // Positive for increase, negative for decrease
  reason: 'payment_on_time' | 'payment_late';
}

/**
 * Calculate score impact from a payment
 *
 * On-time payments:
 * - Minimum payment: +10 points
 * - Full payment: +50 points
 * - Partial: proportional between 10-50
 *
 * Late payments:
 * - 1-7 days overdue: -20 points
 * - 8-30 days overdue: -50 points
 * - 30+ days overdue: -100 points
 */
export function calculatePaymentScoreImpact(
  paymentAmount: number,
  totalBalance: number,
  isOnTime: boolean,
  daysOverdue: number = 0
): PaymentScoreImpactResult {
  if (!isOnTime) {
    // Late payment - penalty based on days overdue
    let delta: number;

    if (daysOverdue <= 7) {
      delta = SCORE_IMPACTS.PAYMENT_LATE_1_7_DAYS; // -20
    } else if (daysOverdue <= 30) {
      delta = SCORE_IMPACTS.PAYMENT_LATE_8_30_DAYS; // -50
    } else {
      delta = SCORE_IMPACTS.PAYMENT_LATE_30_PLUS_DAYS; // -100
    }

    return { delta, reason: 'payment_late' };
  }

  // On-time payment - reward based on payment percentage
  const paymentPercentage = totalBalance > 0 ? paymentAmount / totalBalance : 1;

  // Scale between MIN (+10) and MAX (+50) based on payment percentage
  const delta = Math.round(
    SCORE_IMPACTS.PAYMENT_ON_TIME_MIN +
      (SCORE_IMPACTS.PAYMENT_ON_TIME_MAX - SCORE_IMPACTS.PAYMENT_ON_TIME_MIN) * paymentPercentage
  );

  return { delta, reason: 'payment_on_time' };
}

/**
 * Apply score delta and return new clamped score
 */
export function applyScoreDelta(currentScore: number, delta: number): number {
  return clampScore(currentScore + delta);
}

/**
 * Check if score qualifies for auto-approval
 * Score >= 500 = auto-approval eligible
 */
export function isAutoApprovalEligible(score: number): boolean {
  return score >= TIER_BOUNDARIES.MEDIUM;
}

/**
 * Get tier for a given score
 */
export function getTierForScore(score: number): UserTier {
  return deriveTier(score);
}

/**
 * Validate score value
 */
export function isValidScore(score: number): boolean {
  return (
    typeof score === 'number' &&
    Number.isInteger(score) &&
    score >= SCORE_BOUNDS.MIN &&
    score <= SCORE_BOUNDS.MAX
  );
}
