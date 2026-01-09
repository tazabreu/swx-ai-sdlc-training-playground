/**
 * Admin Get User Score Query
 *
 * Query for admin to retrieve a user's score and history.
 */

import type { ScoreChangeReason, ScoreSource } from '../../domain/entities/score.entity.js';
import type { UserTier } from '../../domain/entities/user.entity.js';

/**
 * Query to get user score
 */
export interface AdminGetUserScoreQuery {
  /** Admin's ecosystem ID (for audit) */
  adminId: string;
  /** User's ecosystem ID */
  ecosystemId: string;
}

/**
 * Score history entry
 */
export interface ScoreHistoryEntry {
  scoreId: string;
  previousScore: number;
  newScore: number;
  delta: number;
  reason: ScoreChangeReason;
  source: ScoreSource;
  adminId?: string | undefined;
  relatedEntityType?: string | undefined;
  relatedEntityId?: string | undefined;
  createdAt: Date;
}

/**
 * User score response
 */
export interface AdminUserScoreResult {
  ecosystemId: string;
  email: string;
  currentScore: number;
  tier: UserTier;
  scoreHistory: ScoreHistoryEntry[];
  statistics: {
    averageScore: number;
    highestScore: number;
    lowestScore: number;
    totalChanges: number;
    positiveChanges: number;
    negativeChanges: number;
  };
}

/**
 * Create an admin get user score query
 */
export function createAdminGetUserScoreQuery(
  adminId: string,
  ecosystemId: string
): AdminGetUserScoreQuery {
  return {
    adminId,
    ecosystemId,
  };
}

/**
 * Calculate score statistics from history
 */
export function calculateScoreStatistics(
  currentScore: number,
  history: ScoreHistoryEntry[]
): AdminUserScoreResult['statistics'] {
  if (history.length === 0) {
    return {
      averageScore: currentScore,
      highestScore: currentScore,
      lowestScore: currentScore,
      totalChanges: 0,
      positiveChanges: 0,
      negativeChanges: 0,
    };
  }

  const scores = [currentScore, ...history.map((h) => h.previousScore)];
  const sum = scores.reduce((a, b) => a + b, 0);

  return {
    averageScore: Math.round(sum / scores.length),
    highestScore: Math.max(...scores),
    lowestScore: Math.min(...scores),
    totalChanges: history.length,
    positiveChanges: history.filter((h) => h.delta > 0).length,
    negativeChanges: history.filter((h) => h.delta < 0).length,
  };
}
