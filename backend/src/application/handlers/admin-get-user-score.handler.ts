/**
 * Admin Get User Score Handler
 *
 * Handles user score and history retrieval for admins.
 */

import type {
  AdminGetUserScoreQuery,
  AdminUserScoreResult,
  ScoreHistoryEntry,
} from '../queries/admin-get-user-score.query.js';
import { calculateScoreStatistics } from '../queries/admin-get-user-score.query.js';
import type { IUserRepository } from '../../infrastructure/persistence/interfaces/user.repository.js';

/**
 * Handler error
 */
export class AdminGetUserScoreError extends Error {
  constructor(
    message: string,
    public readonly code: 'USER_NOT_FOUND'
  ) {
    super(message);
    this.name = 'AdminGetUserScoreError';
  }
}

/**
 * Handler dependencies
 */
export interface AdminGetUserScoreHandlerDeps {
  userRepository: IUserRepository;
}

/**
 * Handle admin get user score query
 */
export async function handleAdminGetUserScore(
  query: AdminGetUserScoreQuery,
  deps: AdminGetUserScoreHandlerDeps
): Promise<AdminUserScoreResult> {
  // Get user
  const user = await deps.userRepository.findById(query.ecosystemId);
  if (!user) {
    throw new AdminGetUserScoreError('User not found', 'USER_NOT_FOUND');
  }

  // Get score history (last 10 entries)
  const scoreHistory = await deps.userRepository.getScoreHistory(query.ecosystemId, 10);

  // Map to result format (Score entity uses value/previousValue/timestamp)
  const historyEntries: ScoreHistoryEntry[] = scoreHistory.map((score) => ({
    scoreId: score.scoreId,
    previousScore: score.previousValue,
    newScore: score.value,
    delta: score.delta,
    reason: score.reason,
    source: score.source,
    adminId: score.sourceId,
    relatedEntityType: score.relatedEntityType,
    relatedEntityId: score.relatedEntityId,
    createdAt: score.timestamp,
  }));

  // Calculate statistics
  const statistics = calculateScoreStatistics(user.currentScore, historyEntries);

  return {
    ecosystemId: user.ecosystemId,
    email: user.email,
    currentScore: user.currentScore,
    tier: user.tier,
    scoreHistory: historyEntries,
    statistics,
  };
}
