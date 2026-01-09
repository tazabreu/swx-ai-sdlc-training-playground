/**
 * List Transactions Query
 *
 * Query to retrieve transactions for a card.
 */

import type {
  TransactionType,
  TransactionStatus,
  PaymentStatus,
} from '../../domain/entities/transaction.entity.js';

/**
 * Query to list transactions
 */
export interface ListTransactionsQuery {
  /** User's ecosystem ID */
  ecosystemId: string;
  /** Card ID */
  cardId: string;
  /** Pagination cursor */
  cursor?: string | undefined;
  /** Page size (default 20, max 100) */
  limit?: number | undefined;
  /** Filter by transaction type */
  type?: TransactionType | undefined;
}

/**
 * Transaction list item
 */
export interface TransactionListItem {
  transactionId: string;
  type: TransactionType;
  amount: number;
  status: TransactionStatus;
  merchant?: string;
  category?: string;
  paymentStatus?: PaymentStatus;
  daysOverdue?: number;
  scoreImpact?: number;
  createdAt: Date;
}

/**
 * Transactions list response
 */
export interface ListTransactionsResult {
  /** Transactions */
  transactions: TransactionListItem[];
  /** Next cursor for pagination */
  nextCursor?: string;
  /** Whether there are more results */
  hasMore: boolean;
}

/**
 * Create a list transactions query
 */
export function createListTransactionsQuery(
  ecosystemId: string,
  cardId: string,
  options?: {
    cursor?: string;
    limit?: number;
    type?: TransactionType;
  }
): ListTransactionsQuery {
  return {
    ecosystemId,
    cardId,
    cursor: options?.cursor,
    limit: options?.limit,
    type: options?.type,
  };
}

/**
 * Default page size
 */
export const DEFAULT_PAGE_SIZE = 20;

/**
 * Maximum page size
 */
export const MAX_PAGE_SIZE = 100;

/**
 * Normalize page size
 */
export function normalizePageSize(limit?: number): number {
  if (limit === undefined || limit === null || limit < 1) return DEFAULT_PAGE_SIZE;
  if (limit > MAX_PAGE_SIZE) return MAX_PAGE_SIZE;
  return limit;
}
