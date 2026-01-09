/**
 * Firestore User Repository
 *
 * Firestore implementation for user data persistence.
 */

import type { Firestore } from 'firebase-admin/firestore';
import type { IUserRepository } from '../interfaces/user.repository.js';
import type { User, UserTier, UserRole, UserStatus } from '../../../domain/entities/user.entity.js';
import type { Score, ScoreChangeReason } from '../../../domain/entities/score.entity.js';
import { createScore } from '../../../domain/entities/score.entity.js';
import { deriveTier } from '../../../domain/entities/user.entity.js';
import { CollectionPaths } from './client.js';
import { requireDate } from './codec.js';

/**
 * Card summary type
 */
interface CardSummary {
  activeCards: number;
  totalBalance: number;
  totalLimit: number;
}

/**
 * Firestore User Repository implementation
 */
export class FirestoreUserRepository implements IUserRepository {
  constructor(private readonly db: Firestore) {}

  async findById(ecosystemId: string): Promise<User | null> {
    const doc = await this.db.collection(CollectionPaths.USERS).doc(ecosystemId).get();

    if (!doc.exists) {
      return null;
    }

    return this.mapDocToUser(doc.id, doc.data()!);
  }

  async findByFirebaseUid(firebaseUid: string): Promise<User | null> {
    const snapshot = await this.db
      .collection(CollectionPaths.USERS)
      .where('firebaseUid', '==', firebaseUid)
      .limit(1)
      .get();

    if (snapshot.empty) {
      return null;
    }

    const doc = snapshot.docs[0]!;
    return this.mapDocToUser(doc.id, doc.data());
  }

  async save(user: User): Promise<void> {
    await this.db
      .collection(CollectionPaths.USERS)
      .doc(user.ecosystemId)
      .set(this.mapUserToDoc(user));
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
    const userRef = this.db.collection(CollectionPaths.USERS).doc(ecosystemId);
    const scoresRef = this.db.collection(CollectionPaths.SCORES(ecosystemId));

    let score: Score;

    await this.db.runTransaction(async (transaction) => {
      const userDoc = await transaction.get(userRef);
      if (!userDoc.exists) {
        throw new Error(`User not found: ${ecosystemId}`);
      }

      const userData = userDoc.data()!;
      const previousValue = userData.currentScore as number;

      const scoreInput: Parameters<typeof createScore>[0] = {
        newValue: newScore,
        previousValue,
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

      score = createScore(scoreInput);

      // Update user with new score and tier
      transaction.update(userRef, {
        currentScore: newScore,
        tier: deriveTier(newScore),
        updatedAt: new Date(),
      });

      // Add score to history
      const scoreDoc = scoresRef.doc(score.scoreId);
      transaction.set(scoreDoc, this.mapScoreToDoc(score));
    });

    return score!;
  }

  async updateCardSummary(ecosystemId: string, cardSummary: CardSummary): Promise<void> {
    await this.db.collection(CollectionPaths.USERS).doc(ecosystemId).update({
      cardSummary,
      updatedAt: new Date(),
    });
  }

  async getScoreHistory(ecosystemId: string, limit?: number): Promise<Score[]> {
    let query = this.db
      .collection(CollectionPaths.SCORES(ecosystemId))
      .orderBy('timestamp', 'desc');

    if (limit !== undefined) {
      query = query.limit(limit);
    }

    const snapshot = await query.get();

    return snapshot.docs.map((doc) => this.mapDocToScore(doc.data()));
  }

  async delete(ecosystemId: string): Promise<void> {
    // Delete all subcollections first (Firestore doesn't cascade deletes)

    // 1. Delete transactions for each card, then delete cards
    const cardsSnapshot = await this.db.collection(CollectionPaths.CARDS(ecosystemId)).get();
    for (const cardDoc of cardsSnapshot.docs) {
      const transactionsSnapshot = await this.db
        .collection(CollectionPaths.TRANSACTIONS(ecosystemId, cardDoc.id))
        .get();
      await this.deleteBatch(transactionsSnapshot.docs.map((doc) => doc.ref));
      await cardDoc.ref.delete();
    }

    // 2. Delete card requests
    const requestsSnapshot = await this.db
      .collection(CollectionPaths.CARD_REQUESTS(ecosystemId))
      .get();
    await this.deleteBatch(requestsSnapshot.docs.map((doc) => doc.ref));

    // 3. Delete scores
    const scoresSnapshot = await this.db.collection(CollectionPaths.SCORES(ecosystemId)).get();
    await this.deleteBatch(scoresSnapshot.docs.map((doc) => doc.ref));

    // 4. Delete idempotency keys
    const idempotencySnapshot = await this.db
      .collection(CollectionPaths.IDEMPOTENCY_KEYS(ecosystemId))
      .get();
    await this.deleteBatch(idempotencySnapshot.docs.map((doc) => doc.ref));

    // 5. Finally delete the user document
    await this.db.collection(CollectionPaths.USERS).doc(ecosystemId).delete();
  }

  /**
   * Delete documents in batches (Firestore limit is 500 per batch)
   */
  private async deleteBatch(refs: FirebaseFirestore.DocumentReference[]): Promise<void> {
    const batchSize = 500;
    for (let i = 0; i < refs.length; i += batchSize) {
      const batch = this.db.batch();
      const chunk = refs.slice(i, i + batchSize);
      chunk.forEach((ref) => batch.delete(ref));
      await batch.commit();
    }
  }

  async deleteAll(): Promise<number> {
    const usersSnapshot = await this.db.collection(CollectionPaths.USERS).get();
    const count = usersSnapshot.size;

    // Delete each user (with subcollections)
    for (const userDoc of usersSnapshot.docs) {
      await this.delete(userDoc.id);
    }

    return count;
  }

  /**
   * Map Firestore document to User entity
   */
  private mapDocToUser(ecosystemId: string, data: Record<string, unknown>): User {
    return {
      ecosystemId,
      firebaseUid: data.firebaseUid as string,
      email: data.email as string,
      role: data.role as UserRole,
      status: data.status as UserStatus,
      currentScore: data.currentScore as number,
      tier: data.tier as UserTier,
      cardSummary: data.cardSummary as {
        activeCards: number;
        totalBalance: number;
        totalLimit: number;
      },
      createdAt: requireDate(data.createdAt, 'createdAt'),
      updatedAt: requireDate(data.updatedAt, 'updatedAt'),
      lastLoginAt: requireDate(data.lastLoginAt, 'lastLoginAt'),
    };
  }

  /**
   * Map User entity to Firestore document
   */
  private mapUserToDoc(user: User): Record<string, unknown> {
    return {
      firebaseUid: user.firebaseUid,
      email: user.email,
      role: user.role,
      status: user.status,
      currentScore: user.currentScore,
      tier: user.tier,
      cardSummary: user.cardSummary,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      lastLoginAt: user.lastLoginAt,
    };
  }

  /**
   * Map Score entity to Firestore document
   */
  private mapScoreToDoc(score: Score): Record<string, unknown> {
    const doc: Record<string, unknown> = {
      value: score.value,
      previousValue: score.previousValue,
      delta: score.delta,
      reason: score.reason,
      source: score.source,
      timestamp: score.timestamp,
    };
    if (score.sourceId !== undefined) {
      doc.sourceId = score.sourceId;
    }
    if (score.relatedEntityType !== undefined) {
      doc.relatedEntityType = score.relatedEntityType;
    }
    if (score.relatedEntityId !== undefined) {
      doc.relatedEntityId = score.relatedEntityId;
    }
    return doc;
  }

  /**
   * Map Firestore document to Score entity
   */
  private mapDocToScore(data: Record<string, unknown>): Score {
    const score: Score = {
      scoreId: data.scoreId as string,
      value: data.value as number,
      previousValue: data.previousValue as number,
      delta: data.delta as number,
      reason: data.reason as ScoreChangeReason,
      source: data.source as 'system' | 'admin',
      timestamp: requireDate(data.timestamp, 'timestamp'),
    };
    if (data.sourceId !== undefined) {
      score.sourceId = data.sourceId as string;
    }
    if (data.relatedEntityType !== undefined) {
      score.relatedEntityType = data.relatedEntityType as string;
    }
    if (data.relatedEntityId !== undefined) {
      score.relatedEntityId = data.relatedEntityId as string;
    }
    return score;
  }
}
