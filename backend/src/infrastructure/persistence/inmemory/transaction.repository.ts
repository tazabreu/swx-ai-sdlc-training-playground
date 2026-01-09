/**
 * InMemory Transaction Repository
 *
 * In-memory implementation for transaction storage and retrieval.
 */

/* eslint-disable @typescript-eslint/require-await */

import type {
  ITransactionRepository,
  TransactionFilter,
  TransactionPaginationOptions,
  PaginatedTransactions,
} from '../interfaces/transaction.repository.js';
import type { Transaction } from '../../../domain/entities/transaction.entity.js';

/**
 * InMemory Transaction Repository implementation
 */
export class InMemoryTransactionRepository implements ITransactionRepository {
  // Map<ecosystemId, Map<cardId, Map<transactionId, Transaction>>>
  private transactions: Map<string, Map<string, Map<string, Transaction>>> = new Map();

  async findByCard(
    ecosystemId: string,
    cardId: string,
    filter?: TransactionFilter,
    pagination?: TransactionPaginationOptions
  ): Promise<PaginatedTransactions> {
    const userTransactions = this.transactions.get(ecosystemId);
    if (userTransactions === undefined) {
      return { transactions: [], hasMore: false };
    }

    const cardTransactions = userTransactions.get(cardId);
    if (cardTransactions === undefined) {
      return { transactions: [], hasMore: false };
    }

    // Get all transactions and sort by timestamp descending (most recent first)
    let txList = Array.from(cardTransactions.values());
    txList.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    // Apply filter
    if (filter?.type !== undefined) {
      txList = txList.filter((tx) => tx.type === filter.type);
    }

    // Apply pagination
    const limit = pagination?.limit ?? 20;
    let startIndex = 0;

    if (pagination?.cursor !== undefined) {
      const cursorIndex = txList.findIndex((tx) => tx.transactionId === pagination.cursor);
      if (cursorIndex !== -1) {
        startIndex = cursorIndex + 1;
      }
    }

    const paginated = txList.slice(startIndex, startIndex + limit);
    const hasMore = startIndex + limit < txList.length;
    const nextCursor = hasMore ? paginated[paginated.length - 1]?.transactionId : undefined;

    return {
      transactions: paginated,
      nextCursor,
      hasMore,
    };
  }

  async findById(
    ecosystemId: string,
    cardId: string,
    transactionId: string
  ): Promise<Transaction | null> {
    const userTransactions = this.transactions.get(ecosystemId);
    if (userTransactions === undefined) return null;

    const cardTransactions = userTransactions.get(cardId);
    if (cardTransactions === undefined) return null;

    return cardTransactions.get(transactionId) ?? null;
  }

  async save(ecosystemId: string, cardId: string, transaction: Transaction): Promise<void> {
    let userTransactions = this.transactions.get(ecosystemId);
    if (userTransactions === undefined) {
      userTransactions = new Map();
      this.transactions.set(ecosystemId, userTransactions);
    }

    let cardTransactions = userTransactions.get(cardId);
    if (cardTransactions === undefined) {
      cardTransactions = new Map();
      userTransactions.set(cardId, cardTransactions);
    }

    cardTransactions.set(transaction.transactionId, { ...transaction });
  }

  async getRecent(ecosystemId: string, cardId: string, limit = 10): Promise<Transaction[]> {
    const result = await this.findByCard(ecosystemId, cardId, undefined, { limit });
    return result.transactions;
  }

  async deleteAllForCard(ecosystemId: string, cardId: string): Promise<number> {
    const userTransactions = this.transactions.get(ecosystemId);
    if (userTransactions === undefined) return 0;

    const cardTransactions = userTransactions.get(cardId);
    if (cardTransactions === undefined) return 0;

    const count = cardTransactions.size;
    userTransactions.delete(cardId);
    return count;
  }

  async deleteAllForUser(ecosystemId: string): Promise<number> {
    const userTransactions = this.transactions.get(ecosystemId);
    if (userTransactions === undefined) return 0;

    let count = 0;
    for (const cardTransactions of userTransactions.values()) {
      count += cardTransactions.size;
    }

    this.transactions.delete(ecosystemId);
    return count;
  }

  // Test helper methods
  clear(): void {
    this.transactions.clear();
  }

  getAll(): Transaction[] {
    const allTransactions: Transaction[] = [];
    for (const userTransactions of this.transactions.values()) {
      for (const cardTransactions of userTransactions.values()) {
        allTransactions.push(...cardTransactions.values());
      }
    }
    return allTransactions;
  }
}
