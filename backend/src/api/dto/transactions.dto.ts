/**
 * Transactions DTOs
 *
 * Transaction response shapes per OpenAPI spec.
 */

import type { CardSummaryDTO } from './cards.dto.js';

/**
 * Pagination metadata
 */
export interface PaginationMeta {
  nextCursor: string | null;
  hasMore: boolean;
  totalCount?: number;
}

/**
 * Transaction
 */
export interface TransactionDTO {
  transactionId: string;
  type: 'purchase' | 'payment';
  amount: number;
  merchant?: string | undefined;
  status: 'completed' | 'failed';
  timestamp: string;
  paymentStatus?: 'on_time' | 'late' | undefined;
  scoreImpact?: number | undefined;
}

/**
 * Purchase input
 */
export interface PurchaseInput {
  amount: number;
  merchant?: string;
}

/**
 * Payment input
 */
export interface PaymentInput {
  amount: number;
}

/**
 * Score impact info
 */
export interface ScoreImpactDTO {
  previousScore: number;
  newScore: number;
  delta: number;
  reason: 'on_time' | 'late';
}

/**
 * Transaction response (for purchase)
 */
export interface TransactionResponse {
  transaction: TransactionDTO;
  card: CardSummaryDTO;
}

/**
 * Payment response (extends transaction response with score impact)
 */
export interface PaymentResponse extends TransactionResponse {
  scoreImpact?: ScoreImpactDTO;
}

/**
 * Transactions list response
 */
export interface TransactionsListResponse {
  transactions: TransactionDTO[];
  pagination: PaginationMeta;
}
