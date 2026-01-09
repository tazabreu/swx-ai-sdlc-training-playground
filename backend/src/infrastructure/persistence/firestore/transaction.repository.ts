/**
 * Firestore Transaction Repository
 *
 * Firestore implementation for transaction data persistence.
 */

import type { Firestore, Query, DocumentData } from 'firebase-admin/firestore';
import type {
  ITransactionRepository,
  TransactionFilter,
  TransactionPaginationOptions,
  PaginatedTransactions,
} from '../interfaces/transaction.repository.js';
import type {
  Transaction,
  TransactionType,
  TransactionStatus,
  PaymentStatus,
} from '../../../domain/entities/transaction.entity.js';
import { CollectionPaths } from './client.js';
import { requireDate } from './codec.js';

/**
 * Firestore Transaction Repository implementation
 */
export class FirestoreTransactionRepository implements ITransactionRepository {
  constructor(private readonly db: Firestore) {}

  async findByCard(
    ecosystemId: string,
    cardId: string,
    filter?: TransactionFilter,
    pagination?: TransactionPaginationOptions
  ): Promise<PaginatedTransactions> {
    let query: Query<DocumentData> = this.db
      .collection(CollectionPaths.TRANSACTIONS(ecosystemId, cardId))
      .orderBy('timestamp', 'desc');

    if (filter?.type !== undefined) {
      query = query.where('type', '==', filter.type);
    }

    // Handle pagination with cursor
    if (pagination?.cursor !== undefined) {
      const cursorDoc = await this.db
        .collection(CollectionPaths.TRANSACTIONS(ecosystemId, cardId))
        .doc(pagination.cursor)
        .get();

      if (cursorDoc.exists) {
        query = query.startAfter(cursorDoc);
      }
    }

    const limit = pagination?.limit ?? 20;
    query = query.limit(limit + 1); // Fetch one extra to check hasMore

    const snapshot = await query.get();

    const transactions = snapshot.docs
      .slice(0, limit)
      .map((doc) => this.mapDocToTransaction(doc.id, doc.data()));

    const hasMore = snapshot.docs.length > limit;
    const nextCursor = hasMore ? transactions[transactions.length - 1]?.transactionId : undefined;

    return {
      transactions,
      nextCursor,
      hasMore,
    };
  }

  async findById(
    ecosystemId: string,
    cardId: string,
    transactionId: string
  ): Promise<Transaction | null> {
    const doc = await this.db
      .collection(CollectionPaths.TRANSACTIONS(ecosystemId, cardId))
      .doc(transactionId)
      .get();

    if (!doc.exists) {
      return null;
    }

    return this.mapDocToTransaction(doc.id, doc.data()!);
  }

  async save(ecosystemId: string, cardId: string, transaction: Transaction): Promise<void> {
    await this.db
      .collection(CollectionPaths.TRANSACTIONS(ecosystemId, cardId))
      .doc(transaction.transactionId)
      .set(this.mapTransactionToDoc(transaction));
  }

  async getRecent(ecosystemId: string, cardId: string, limit = 10): Promise<Transaction[]> {
    const snapshot = await this.db
      .collection(CollectionPaths.TRANSACTIONS(ecosystemId, cardId))
      .orderBy('timestamp', 'desc')
      .limit(limit)
      .get();

    return snapshot.docs.map((doc) => this.mapDocToTransaction(doc.id, doc.data()));
  }

  async deleteAllForCard(ecosystemId: string, cardId: string): Promise<number> {
    const snapshot = await this.db
      .collection(CollectionPaths.TRANSACTIONS(ecosystemId, cardId))
      .get();

    const count = snapshot.size;
    const batch = this.db.batch();
    snapshot.docs.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();

    return count;
  }

  async deleteAllForUser(ecosystemId: string): Promise<number> {
    // Get all cards for user
    const cardsSnapshot = await this.db.collection(CollectionPaths.CARDS(ecosystemId)).get();

    let totalCount = 0;

    // Delete transactions for each card
    for (const cardDoc of cardsSnapshot.docs) {
      const count = await this.deleteAllForCard(ecosystemId, cardDoc.id);
      totalCount += count;
    }

    return totalCount;
  }

  /**
   * Map Firestore document to Transaction entity
   */
  private mapDocToTransaction(transactionId: string, data: Record<string, unknown>): Transaction {
    const tx: Transaction = {
      transactionId,
      type: data.type as TransactionType,
      amount: data.amount as number,
      idempotencyKey: data.idempotencyKey as string,
      status: data.status as TransactionStatus,
      timestamp: requireDate(data.timestamp, 'timestamp'),
      processedAt: requireDate(data.processedAt, 'processedAt'),
    };

    if (data.merchant !== undefined) {
      tx.merchant = data.merchant as string;
    }
    if (data.paymentStatus !== undefined) {
      tx.paymentStatus = data.paymentStatus as PaymentStatus;
    }
    if (data.daysOverdue !== undefined) {
      tx.daysOverdue = data.daysOverdue as number;
    }
    if (data.scoreImpact !== undefined) {
      tx.scoreImpact = data.scoreImpact as number;
    }
    if (data.failureReason !== undefined) {
      tx.failureReason = data.failureReason as string;
    }

    return tx;
  }

  /**
   * Map Transaction entity to Firestore document
   */
  private mapTransactionToDoc(tx: Transaction): Record<string, unknown> {
    const doc: Record<string, unknown> = {
      type: tx.type,
      amount: tx.amount,
      idempotencyKey: tx.idempotencyKey,
      status: tx.status,
      timestamp: tx.timestamp,
      processedAt: tx.processedAt,
    };

    if (tx.merchant !== undefined) {
      doc.merchant = tx.merchant;
    }
    if (tx.paymentStatus !== undefined) {
      doc.paymentStatus = tx.paymentStatus;
    }
    if (tx.daysOverdue !== undefined) {
      doc.daysOverdue = tx.daysOverdue;
    }
    if (tx.scoreImpact !== undefined) {
      doc.scoreImpact = tx.scoreImpact;
    }
    if (tx.failureReason !== undefined) {
      doc.failureReason = tx.failureReason;
    }

    return doc;
  }
}
