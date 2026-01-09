/**
 * Transaction Repository Interface
 *
 * Contract for transaction data access operations.
 */

import type { Transaction, TransactionType } from '../../../domain/entities/transaction.entity.js';

/**
 * Transaction filter options
 */
export interface TransactionFilter {
  type?: TransactionType | undefined;
}

/**
 * Transaction pagination options
 */
export interface TransactionPaginationOptions {
  cursor?: string | undefined;
  limit?: number | undefined;
}

/**
 * Paginated transactions result
 */
export interface PaginatedTransactions {
  transactions: Transaction[];
  nextCursor?: string | undefined;
  hasMore: boolean;
}

/**
 * Transaction repository interface
 */
export interface ITransactionRepository {
  /**
   * Find transactions for a card
   */
  findByCard(
    ecosystemId: string,
    cardId: string,
    filter?: TransactionFilter,
    pagination?: TransactionPaginationOptions
  ): Promise<PaginatedTransactions>;

  /**
   * Find transaction by ID
   */
  findById(ecosystemId: string, cardId: string, transactionId: string): Promise<Transaction | null>;

  /**
   * Save transaction
   */
  save(ecosystemId: string, cardId: string, transaction: Transaction): Promise<void>;

  /**
   * Get recent transactions (for dashboard)
   */
  getRecent(ecosystemId: string, cardId: string, limit?: number): Promise<Transaction[]>;

  /**
   * Delete all transactions for a card
   */
  deleteAllForCard(ecosystemId: string, cardId: string): Promise<number>;

  /**
   * Delete all transactions for a user
   */
  deleteAllForUser(ecosystemId: string): Promise<number>;
}
