/**
 * Card Repository Interface
 *
 * Contract for card data access operations.
 */

import type { Card, CardStatus } from '../../../domain/entities/card.entity.js';

/**
 * Card filter options
 */
export interface CardFilter {
  status?: CardStatus | undefined;
}

/**
 * Card balance update with optimistic locking
 */
export interface CardBalanceUpdate {
  balance: number;
  availableCredit: number;
  minimumPayment: number;
  version: number;
}

/**
 * Card repository interface
 */
export interface ICardRepository {
  /**
   * Find card by ID
   */
  findById(ecosystemId: string, cardId: string): Promise<Card | null>;

  /**
   * Find cards by user
   */
  findByUser(ecosystemId: string, filter?: CardFilter): Promise<Card[]>;

  /**
   * Save card (create or update)
   */
  save(ecosystemId: string, card: Card): Promise<void>;

  /**
   * Update card balance with optimistic locking
   * @throws ConcurrencyError if version mismatch
   */
  updateBalance(ecosystemId: string, cardId: string, update: CardBalanceUpdate): Promise<void>;

  /**
   * Update card status
   */
  updateStatus(ecosystemId: string, cardId: string, status: CardStatus): Promise<void>;

  /**
   * Delete card
   */
  delete(ecosystemId: string, cardId: string): Promise<void>;

  /**
   * Delete all cards for user
   */
  deleteAllForUser(ecosystemId: string): Promise<number>;
}

/**
 * Concurrency error for optimistic locking failures
 */
export class ConcurrencyError extends Error {
  constructor(
    public readonly cardId: string,
    public readonly expectedVersion: number,
    public readonly actualVersion: number
  ) {
    super(
      `Concurrent modification detected for card ${cardId}. ` +
        `Expected version ${expectedVersion}, got ${actualVersion}`
    );
    this.name = 'ConcurrencyError';
  }
}
