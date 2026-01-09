/**
 * InMemory Card Repository
 *
 * In-memory implementation with optimistic locking for concurrency control.
 */

/* eslint-disable @typescript-eslint/require-await */

import type {
  ICardRepository,
  CardFilter,
  CardBalanceUpdate,
} from '../interfaces/card.repository.js';
import { ConcurrencyError } from '../interfaces/card.repository.js';
import type { Card, CardStatus } from '../../../domain/entities/card.entity.js';

/**
 * InMemory Card Repository implementation
 */
export class InMemoryCardRepository implements ICardRepository {
  // Map<ecosystemId, Map<cardId, Card>>
  private cards: Map<string, Map<string, Card>> = new Map();

  async findById(ecosystemId: string, cardId: string): Promise<Card | null> {
    const userCards = this.cards.get(ecosystemId);
    if (userCards === undefined) return null;
    return userCards.get(cardId) ?? null;
  }

  async findByUser(ecosystemId: string, filter?: CardFilter): Promise<Card[]> {
    const userCards = this.cards.get(ecosystemId);
    if (userCards === undefined) return [];

    let cards = Array.from(userCards.values());

    if (filter?.status !== undefined) {
      cards = cards.filter((card) => card.status === filter.status);
    }

    return cards;
  }

  async save(ecosystemId: string, card: Card): Promise<void> {
    let userCards = this.cards.get(ecosystemId);
    if (userCards === undefined) {
      userCards = new Map();
      this.cards.set(ecosystemId, userCards);
    }
    userCards.set(card.cardId, { ...card });
  }

  async updateBalance(
    ecosystemId: string,
    cardId: string,
    update: CardBalanceUpdate
  ): Promise<void> {
    const userCards = this.cards.get(ecosystemId);
    if (userCards === undefined) {
      throw new Error(`User not found: ${ecosystemId}`);
    }

    const card = userCards.get(cardId);
    if (card === undefined) {
      throw new Error(`Card not found: ${cardId}`);
    }

    // Optimistic locking check
    if (card.version !== update.version - 1) {
      throw new ConcurrencyError(cardId, update.version - 1, card.version);
    }

    const updatedCard: Card = {
      ...card,
      balance: update.balance,
      availableCredit: update.availableCredit,
      minimumPayment: update.minimumPayment,
      version: update.version,
      updatedAt: new Date(),
    };
    userCards.set(cardId, updatedCard);
  }

  async updateStatus(ecosystemId: string, cardId: string, status: CardStatus): Promise<void> {
    const userCards = this.cards.get(ecosystemId);
    if (userCards === undefined) {
      throw new Error(`User not found: ${ecosystemId}`);
    }

    const card = userCards.get(cardId);
    if (card === undefined) {
      throw new Error(`Card not found: ${cardId}`);
    }

    const updatedCard: Card = {
      ...card,
      status,
      version: card.version + 1,
      updatedAt: new Date(),
    };
    userCards.set(cardId, updatedCard);
  }

  async delete(ecosystemId: string, cardId: string): Promise<void> {
    const userCards = this.cards.get(ecosystemId);
    if (userCards !== undefined) {
      userCards.delete(cardId);
    }
  }

  async deleteAllForUser(ecosystemId: string): Promise<number> {
    const userCards = this.cards.get(ecosystemId);
    if (userCards === undefined) return 0;
    const count = userCards.size;
    this.cards.delete(ecosystemId);
    return count;
  }

  // Test helper methods
  clear(): void {
    this.cards.clear();
  }

  getAll(): Card[] {
    const allCards: Card[] = [];
    for (const userCards of this.cards.values()) {
      allCards.push(...userCards.values());
    }
    return allCards;
  }
}
