/**
 * Get Offers Handler
 *
 * Handles personalized offer retrieval.
 */

import type { GetOffersQuery, OffersResult } from '../queries/get-offers.query.js';
import type { IUserRepository } from '../../infrastructure/persistence/interfaces/user.repository.js';
import type { ICardRepository } from '../../infrastructure/persistence/interfaces/card.repository.js';
import type { ICardRequestRepository } from '../../infrastructure/persistence/interfaces/card-request.repository.js';
import { generateOffers, getOfferSummary } from '../../domain/services/offers.service.js';

/**
 * Handler error
 */
export class GetOffersError extends Error {
  constructor(
    message: string,
    public readonly code: 'USER_NOT_FOUND'
  ) {
    super(message);
    this.name = 'GetOffersError';
  }
}

/**
 * Handler dependencies
 */
export interface GetOffersHandlerDeps {
  userRepository: IUserRepository;
  cardRepository: ICardRepository;
  cardRequestRepository: ICardRequestRepository;
}

/**
 * Handle get offers query
 */
export async function handleGetOffers(
  query: GetOffersQuery,
  deps: GetOffersHandlerDeps
): Promise<OffersResult> {
  // Get user
  const user = await deps.userRepository.findById(query.ecosystemId);
  if (!user) {
    throw new GetOffersError('User not found', 'USER_NOT_FOUND');
  }

  // Get cards, pending requests, and recent rejections
  const [cards, pendingRequest, rejectedRequests] = await Promise.all([
    deps.cardRepository.findByUser(query.ecosystemId),
    deps.cardRequestRepository.findPendingByUser(query.ecosystemId),
    deps.cardRequestRepository.findRejectedByUser(query.ecosystemId, 30),
  ]);

  const pendingRequests = pendingRequest ? [pendingRequest] : [];

  // Generate offers
  const offers = generateOffers(user, cards, pendingRequests, rejectedRequests);

  // Get summary
  const summary = getOfferSummary(user, cards, pendingRequests);

  return {
    offers,
    summary,
  };
}
