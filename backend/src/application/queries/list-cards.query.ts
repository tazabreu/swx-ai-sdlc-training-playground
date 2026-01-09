/**
 * List Cards Query
 *
 * Query to retrieve user's credit cards.
 */

import type { CardStatus } from '../../domain/entities/card.entity.js';

/**
 * Query to list cards
 */
export interface ListCardsQuery {
  /** User's ecosystem ID */
  ecosystemId: string;
  /** Optional status filter */
  status?: CardStatus | undefined;
}

/**
 * Card list item
 */
export interface CardListItem {
  cardId: string;
  status: CardStatus;
  limit: number;
  balance: number;
  availableCredit: number;
  minimumPayment: number;
  dueDate: Date | null;
  utilization: number;
  nearLimit: boolean;
  createdAt: Date;
}

/**
 * Cards list response
 */
export interface ListCardsResult {
  /** Cards */
  cards: CardListItem[];
  /** Total count */
  total: number;
}

/**
 * Create a list cards query
 */
export function createListCardsQuery(ecosystemId: string, status?: CardStatus): ListCardsQuery {
  return {
    ecosystemId,
    status,
  };
}

/**
 * Calculate utilization percentage
 */
export function calculateUtilization(balance: number, limit: number): number {
  if (limit === 0) return 0;
  return Math.round((balance / limit) * 100);
}

/**
 * Determine if card is near limit (>90% utilization)
 */
export function isNearLimit(balance: number, limit: number): boolean {
  return calculateUtilization(balance, limit) >= 90;
}
