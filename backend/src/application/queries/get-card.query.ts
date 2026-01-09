/**
 * Get Card Query
 *
 * Query to retrieve a specific credit card.
 */

import type { CardStatus } from '../../domain/entities/card.entity.js';

/**
 * Query to get a card
 */
export interface GetCardQuery {
  /** User's ecosystem ID */
  ecosystemId: string;
  /** Card ID */
  cardId: string;
}

/**
 * Card detail response
 */
export interface CardDetailResult {
  cardId: string;
  status: CardStatus;
  limit: number;
  balance: number;
  availableCredit: number;
  minimumPayment: number;
  dueDate: Date | null;
  utilization: number;
  nearLimit: boolean;
  scoreAtApproval: number;
  approvedBy: 'auto' | 'admin';
  createdAt: Date;
  updatedAt: Date;
  recentTransactions: Array<{
    transactionId: string;
    type: 'purchase' | 'payment';
    amount: number;
    status: string;
    createdAt: Date;
    merchant?: string;
  }>;
}

/**
 * Create a get card query
 */
export function createGetCardQuery(ecosystemId: string, cardId: string): GetCardQuery {
  return {
    ecosystemId,
    cardId,
  };
}
