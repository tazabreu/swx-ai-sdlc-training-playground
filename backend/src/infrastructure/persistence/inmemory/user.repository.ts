/**
 * InMemory User Repository
 *
 * In-memory implementation for fast, isolated testing.
 */

/* eslint-disable @typescript-eslint/require-await */

import type { IUserRepository } from '../interfaces/user.repository.js';
import type { User } from '../../../domain/entities/user.entity.js';
import type { Score, ScoreChangeReason } from '../../../domain/entities/score.entity.js';
import { createScore } from '../../../domain/entities/score.entity.js';
import { deriveTier } from '../../../domain/entities/user.entity.js';

/**
 * Card summary type
 */
interface CardSummary {
  activeCards: number;
  totalBalance: number;
  totalLimit: number;
}

/**
 * InMemory User Repository implementation
 */
export class InMemoryUserRepository implements IUserRepository {
  private users: Map<string, User> = new Map();
  private firebaseIndex: Map<string, string> = new Map(); // firebaseUid -> ecosystemId
  private scoreHistory: Map<string, Score[]> = new Map(); // ecosystemId -> scores

  async findById(ecosystemId: string): Promise<User | null> {
    return this.users.get(ecosystemId) ?? null;
  }

  async findByFirebaseUid(firebaseUid: string): Promise<User | null> {
    const ecosystemId = this.firebaseIndex.get(firebaseUid);
    if (ecosystemId === undefined) return null;
    return this.users.get(ecosystemId) ?? null;
  }

  async save(user: User): Promise<void> {
    this.users.set(user.ecosystemId, { ...user });
    this.firebaseIndex.set(user.firebaseUid, user.ecosystemId);
  }

  async updateScore(
    ecosystemId: string,
    newScore: number,
    reason: string,
    source: 'system' | 'admin',
    adminId?: string,
    relatedEntityType?: string,
    relatedEntityId?: string
  ): Promise<Score> {
    const user = this.users.get(ecosystemId);
    if (user === undefined) {
      throw new Error(`User not found: ${ecosystemId}`);
    }

    const previousScore = user.currentScore;
    const scoreInput: Parameters<typeof createScore>[0] = {
      newValue: newScore,
      previousValue: previousScore,
      reason: reason as ScoreChangeReason,
      source,
    };
    if (adminId !== undefined) {
      scoreInput.sourceId = adminId;
    }
    if (relatedEntityType !== undefined) {
      scoreInput.relatedEntityType = relatedEntityType;
    }
    if (relatedEntityId !== undefined) {
      scoreInput.relatedEntityId = relatedEntityId;
    }
    const score = createScore(scoreInput);

    // Update user score and tier
    const updatedUser: User = {
      ...user,
      currentScore: newScore,
      tier: deriveTier(newScore),
      updatedAt: new Date(),
    };
    this.users.set(ecosystemId, updatedUser);

    // Add to score history
    const history = this.scoreHistory.get(ecosystemId) ?? [];
    history.unshift(score);
    this.scoreHistory.set(ecosystemId, history);

    return score;
  }

  async updateCardSummary(ecosystemId: string, cardSummary: CardSummary): Promise<void> {
    const user = this.users.get(ecosystemId);
    if (user === undefined) {
      throw new Error(`User not found: ${ecosystemId}`);
    }

    const updatedUser: User = {
      ...user,
      cardSummary,
      updatedAt: new Date(),
    };
    this.users.set(ecosystemId, updatedUser);
  }

  async getScoreHistory(ecosystemId: string, limit?: number): Promise<Score[]> {
    const history = this.scoreHistory.get(ecosystemId) ?? [];
    return limit !== undefined ? history.slice(0, limit) : history;
  }

  async delete(ecosystemId: string): Promise<void> {
    const user = this.users.get(ecosystemId);
    if (user !== undefined) {
      this.firebaseIndex.delete(user.firebaseUid);
      this.users.delete(ecosystemId);
      this.scoreHistory.delete(ecosystemId);
    }
  }

  async deleteAll(): Promise<number> {
    const count = this.users.size;
    this.users.clear();
    this.firebaseIndex.clear();
    this.scoreHistory.clear();
    return count;
  }

  // Test helper methods
  clear(): void {
    this.users.clear();
    this.firebaseIndex.clear();
    this.scoreHistory.clear();
  }

  getAll(): User[] {
    return Array.from(this.users.values());
  }
}
