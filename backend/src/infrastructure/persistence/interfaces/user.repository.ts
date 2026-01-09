/**
 * User Repository Interface
 *
 * Contract for user data access operations.
 */

import type { User, Score } from '../../../domain/entities/index.js';

/**
 * User repository interface
 */
export interface IUserRepository {
  /**
   * Find user by ecosystem ID
   */
  findById(ecosystemId: string): Promise<User | null>;

  /**
   * Find user by Firebase UID
   */
  findByFirebaseUid(firebaseUid: string): Promise<User | null>;

  /**
   * Save user (create or update)
   */
  save(user: User): Promise<void>;

  /**
   * Update user's score
   */
  updateScore(
    ecosystemId: string,
    newScore: number,
    reason: string,
    source: 'system' | 'admin',
    adminId?: string,
    relatedEntityType?: string,
    relatedEntityId?: string
  ): Promise<Score>;

  /**
   * Update user's card summary
   */
  updateCardSummary(
    ecosystemId: string,
    cardSummary: {
      activeCards: number;
      totalBalance: number;
      totalLimit: number;
    }
  ): Promise<void>;

  /**
   * Delete user and all associated data
   */
  delete(ecosystemId: string): Promise<void>;

  /**
   * Get score history for user
   */
  getScoreHistory(ecosystemId: string, limit?: number): Promise<Score[]>;

  /**
   * Delete all users (admin cleanup)
   */
  deleteAll(): Promise<number>;
}
