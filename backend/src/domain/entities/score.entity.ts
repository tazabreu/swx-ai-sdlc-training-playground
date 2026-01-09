/**
 * Score Entity
 *
 * Historical record of score changes for audit and analytics.
 *
 * Firestore Path: users/{ecosystemId}/scores/{scoreId}
 */

import { v7 as uuidv7 } from 'uuid';

/**
 * Reason for score change
 */
export type ScoreChangeReason =
  | 'payment_on_time' // +10 to +50
  | 'payment_late' // -20 to -100
  | 'admin_adjustment' // Manual admin change
  | 'initial_score' // Account creation (500)
  | 'account_activity'; // Future: other activities

/**
 * Source of score change
 */
export type ScoreSource = 'system' | 'admin';

/**
 * Score entity representing a historical score change
 */
export interface Score {
  scoreId: string; // Auto-generated

  // Values
  value: number; // New score value
  previousValue: number; // Score before change
  delta: number; // value - previousValue

  // Context
  reason: ScoreChangeReason;
  source: ScoreSource;
  sourceId?: string | undefined; // Admin ecosystemId if source='admin'
  relatedEntityType?: string | undefined; // 'payment', 'card', etc.
  relatedEntityId?: string | undefined; // ID of related entity

  // Timestamp
  timestamp: Date;
}

/**
 * Input for creating a score record
 */
export interface CreateScoreInput {
  previousValue: number;
  newValue: number;
  reason: ScoreChangeReason;
  source: ScoreSource;
  sourceId?: string;
  relatedEntityType?: string;
  relatedEntityId?: string;
}

/**
 * Create a new score record
 */
export function createScore(input: CreateScoreInput): Score {
  return {
    scoreId: uuidv7(),
    value: input.newValue,
    previousValue: input.previousValue,
    delta: input.newValue - input.previousValue,
    reason: input.reason,
    source: input.source,
    sourceId: input.sourceId,
    relatedEntityType: input.relatedEntityType,
    relatedEntityId: input.relatedEntityId,
    timestamp: new Date(),
  };
}

/**
 * Type guard to check if value is a Score
 */
export function isScore(value: unknown): value is Score {
  if (typeof value !== 'object' || value === null) return false;

  const score = value as Record<string, unknown>;
  const validReasons: ScoreChangeReason[] = [
    'payment_on_time',
    'payment_late',
    'admin_adjustment',
    'initial_score',
    'account_activity',
  ];
  const validSources: ScoreSource[] = ['system', 'admin'];

  return (
    typeof score.scoreId === 'string' &&
    typeof score.value === 'number' &&
    typeof score.previousValue === 'number' &&
    typeof score.delta === 'number' &&
    validReasons.includes(score.reason as ScoreChangeReason) &&
    validSources.includes(score.source as ScoreSource) &&
    score.timestamp instanceof Date
  );
}

/**
 * Validate score record
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateScore(score: Score): ValidationResult {
  const errors: string[] = [];

  // Validate score values are within bounds
  if (score.value < 0 || score.value > 1000) {
    errors.push('value must be between 0 and 1000');
  }

  if (score.previousValue < 0 || score.previousValue > 1000) {
    errors.push('previousValue must be between 0 and 1000');
  }

  // Validate delta matches
  if (score.delta !== score.value - score.previousValue) {
    errors.push('delta must equal value - previousValue');
  }

  // Validate admin source requires sourceId
  if (score.source === 'admin' && score.sourceId === undefined) {
    errors.push('sourceId is required for admin adjustments');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Score impact ranges per spec
 */
export const SCORE_IMPACTS = {
  PAYMENT_ON_TIME_MIN: 10,
  PAYMENT_ON_TIME_MAX: 50,
  PAYMENT_LATE_1_7_DAYS: -20,
  PAYMENT_LATE_8_30_DAYS: -50,
  PAYMENT_LATE_30_PLUS_DAYS: -100,
  INITIAL_SCORE: 500,
  MIN_SCORE: 0,
  MAX_SCORE: 1000,
} as const;
