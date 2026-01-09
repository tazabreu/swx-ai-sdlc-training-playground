/**
 * Firestore Card Repository
 *
 * Firestore implementation for card data persistence with optimistic locking.
 */

import type { Firestore } from 'firebase-admin/firestore';
import type {
  ICardRepository,
  CardFilter,
  CardBalanceUpdate,
} from '../interfaces/card.repository.js';
import { ConcurrencyError } from '../interfaces/card.repository.js';
import type { Card, CardStatus } from '../../../domain/entities/card.entity.js';
import { CollectionPaths } from './client.js';
import { requireDate, optionalDate } from './codec.js';

/**
 * Firestore Card Repository implementation
 */
export class FirestoreCardRepository implements ICardRepository {
  constructor(private readonly db: Firestore) {}

  async findById(ecosystemId: string, cardId: string): Promise<Card | null> {
    const doc = await this.db.collection(CollectionPaths.CARDS(ecosystemId)).doc(cardId).get();

    if (!doc.exists) {
      return null;
    }

    return this.mapDocToCard(doc.id, doc.data()!);
  }

  async findByUser(ecosystemId: string, filter?: CardFilter): Promise<Card[]> {
    let query = this.db.collection(CollectionPaths.CARDS(ecosystemId));

    if (filter?.status !== undefined) {
      query = query.where('status', '==', filter.status) as typeof query;
    }

    const snapshot = await query.get();

    return snapshot.docs.map((doc) => this.mapDocToCard(doc.id, doc.data()));
  }

  async save(ecosystemId: string, card: Card): Promise<void> {
    await this.db
      .collection(CollectionPaths.CARDS(ecosystemId))
      .doc(card.cardId)
      .set(this.mapCardToDoc(card));
  }

  async updateBalance(
    ecosystemId: string,
    cardId: string,
    update: CardBalanceUpdate
  ): Promise<void> {
    const cardRef = this.db.collection(CollectionPaths.CARDS(ecosystemId)).doc(cardId);

    await this.db.runTransaction(async (transaction) => {
      const cardDoc = await transaction.get(cardRef);

      if (!cardDoc.exists) {
        throw new Error(`Card not found: ${cardId}`);
      }

      const currentVersion = cardDoc.data()!.version as number;
      const expectedVersion = update.version - 1;

      // Optimistic locking check
      if (currentVersion !== expectedVersion) {
        throw new ConcurrencyError(cardId, expectedVersion, currentVersion);
      }

      transaction.update(cardRef, {
        balance: update.balance,
        availableCredit: update.availableCredit,
        minimumPayment: update.minimumPayment,
        version: update.version,
        updatedAt: new Date(),
      });
    });
  }

  async updateStatus(ecosystemId: string, cardId: string, status: CardStatus): Promise<void> {
    const cardRef = this.db.collection(CollectionPaths.CARDS(ecosystemId)).doc(cardId);

    await this.db.runTransaction(async (transaction) => {
      const cardDoc = await transaction.get(cardRef);

      if (!cardDoc.exists) {
        throw new Error(`Card not found: ${cardId}`);
      }

      const currentVersion = cardDoc.data()!.version as number;

      transaction.update(cardRef, {
        status,
        version: currentVersion + 1,
        updatedAt: new Date(),
      });
    });
  }

  async delete(ecosystemId: string, cardId: string): Promise<void> {
    // Delete card and its transactions
    const batch = this.db.batch();
    const cardRef = this.db.collection(CollectionPaths.CARDS(ecosystemId)).doc(cardId);

    batch.delete(cardRef);

    // Delete transactions subcollection
    const txSnapshot = await this.db
      .collection(CollectionPaths.TRANSACTIONS(ecosystemId, cardId))
      .get();
    txSnapshot.docs.forEach((doc) => batch.delete(doc.ref));

    await batch.commit();
  }

  async deleteAllForUser(ecosystemId: string): Promise<number> {
    const snapshot = await this.db.collection(CollectionPaths.CARDS(ecosystemId)).get();
    const count = snapshot.size;

    // Delete each card with its transactions
    for (const doc of snapshot.docs) {
      await this.delete(ecosystemId, doc.id);
    }

    return count;
  }

  /**
   * Map Firestore document to Card entity
   */
  private mapDocToCard(cardId: string, data: Record<string, unknown>): Card {
    const card: Card = {
      cardId,
      type: 'credit-card',
      productId: data.productId as string,
      status: data.status as CardStatus,
      limit: data.limit as number,
      balance: data.balance as number,
      availableCredit: data.availableCredit as number,
      minimumPayment: data.minimumPayment as number,
      nextDueDate: requireDate(data.nextDueDate, 'nextDueDate'),
      approvedBy: data.approvedBy as 'auto' | 'admin',
      scoreAtApproval: data.scoreAtApproval as number,
      version: data.version as number,
      createdAt: requireDate(data.createdAt, 'createdAt'),
      updatedAt: requireDate(data.updatedAt, 'updatedAt'),
    };
    if (data.statusReason !== undefined) {
      card.statusReason = data.statusReason as string;
    }
    if (data.approvedByAdminId !== undefined) {
      card.approvedByAdminId = data.approvedByAdminId as string;
    }
    if (data.activatedAt !== undefined) {
      const activatedAt = optionalDate(data.activatedAt, 'activatedAt');
      if (activatedAt !== undefined) {
        card.activatedAt = activatedAt;
      }
    }
    if (data.cancelledAt !== undefined) {
      const cancelledAt = optionalDate(data.cancelledAt, 'cancelledAt');
      if (cancelledAt !== undefined) {
        card.cancelledAt = cancelledAt;
      }
    }
    return card;
  }

  /**
   * Map Card entity to Firestore document
   */
  private mapCardToDoc(card: Card): Record<string, unknown> {
    const doc: Record<string, unknown> = {
      type: card.type,
      productId: card.productId,
      status: card.status,
      limit: card.limit,
      balance: card.balance,
      availableCredit: card.availableCredit,
      minimumPayment: card.minimumPayment,
      nextDueDate: card.nextDueDate,
      approvedBy: card.approvedBy,
      scoreAtApproval: card.scoreAtApproval,
      version: card.version,
      createdAt: card.createdAt,
      updatedAt: card.updatedAt,
    };
    if (card.statusReason !== undefined) {
      doc.statusReason = card.statusReason;
    }
    if (card.approvedByAdminId !== undefined) {
      doc.approvedByAdminId = card.approvedByAdminId;
    }
    if (card.activatedAt !== undefined) {
      doc.activatedAt = card.activatedAt;
    }
    if (card.cancelledAt !== undefined) {
      doc.cancelledAt = card.cancelledAt;
    }
    return doc;
  }
}
