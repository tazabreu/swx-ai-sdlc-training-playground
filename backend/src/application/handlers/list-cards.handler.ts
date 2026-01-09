/**
 * List Cards Handler
 *
 * Handles card list retrieval.
 */

import type { ListCardsQuery, ListCardsResult, CardListItem } from '../queries/list-cards.query.js';
import { calculateUtilization, isNearLimit } from '../queries/list-cards.query.js';
import type { IUserRepository } from '../../infrastructure/persistence/interfaces/user.repository.js';
import type { ICardRepository } from '../../infrastructure/persistence/interfaces/card.repository.js';

/**
 * Handler error
 */
export class ListCardsError extends Error {
  constructor(
    message: string,
    public readonly code: 'USER_NOT_FOUND'
  ) {
    super(message);
    this.name = 'ListCardsError';
  }
}

/**
 * Handler dependencies
 */
export interface ListCardsHandlerDeps {
  userRepository: IUserRepository;
  cardRepository: ICardRepository;
}

/**
 * Handle list cards query
 */
export async function handleListCards(
  query: ListCardsQuery,
  deps: ListCardsHandlerDeps
): Promise<ListCardsResult> {
  // Verify user exists
  const user = await deps.userRepository.findById(query.ecosystemId);
  if (!user) {
    throw new ListCardsError('User not found', 'USER_NOT_FOUND');
  }

  // Get cards with optional filter
  const cards = await deps.cardRepository.findByUser(query.ecosystemId, {
    status: query.status,
  });

  // Map to result format
  const cardItems: CardListItem[] = cards.map((card) => ({
    cardId: card.cardId,
    status: card.status,
    limit: card.limit,
    balance: card.balance,
    availableCredit: card.availableCredit,
    minimumPayment: card.minimumPayment,
    dueDate: card.nextDueDate,
    utilization: calculateUtilization(card.balance, card.limit),
    nearLimit: isNearLimit(card.balance, card.limit),
    createdAt: card.createdAt,
  }));

  return {
    cards: cardItems,
    total: cardItems.length,
  };
}
