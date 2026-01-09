/**
 * Get Dashboard Handler
 *
 * Handles dashboard data retrieval.
 */

import type { GetDashboardQuery, DashboardResult } from '../queries/get-dashboard.query.js';
import { generateDashboardEtag } from '../queries/get-dashboard.query.js';
import { calculateUtilization, isNearLimit } from '../queries/list-cards.query.js';
import type { IUserRepository } from '../../infrastructure/persistence/interfaces/user.repository.js';
import type { ICardRepository } from '../../infrastructure/persistence/interfaces/card.repository.js';
import type { ICardRequestRepository } from '../../infrastructure/persistence/interfaces/card-request.repository.js';

/**
 * Handler error
 */
export class GetDashboardError extends Error {
  constructor(
    message: string,
    public readonly code: 'USER_NOT_FOUND'
  ) {
    super(message);
    this.name = 'GetDashboardError';
  }
}

/**
 * Handler dependencies
 */
export interface GetDashboardHandlerDeps {
  userRepository: IUserRepository;
  cardRepository: ICardRepository;
  cardRequestRepository: ICardRequestRepository;
}

/**
 * Handle get dashboard query
 */
export async function handleGetDashboard(
  query: GetDashboardQuery,
  deps: GetDashboardHandlerDeps
): Promise<DashboardResult> {
  // Get user
  const user = await deps.userRepository.findById(query.ecosystemId);
  if (!user) {
    throw new GetDashboardError('User not found', 'USER_NOT_FOUND');
  }

  // Get cards and pending requests
  const [cards, pendingRequest] = await Promise.all([
    deps.cardRepository.findByUser(query.ecosystemId),
    deps.cardRequestRepository.findPendingByUser(query.ecosystemId),
  ]);

  const pendingRequests = pendingRequest ? [pendingRequest] : [];

  // Generate ETag
  const etag = generateDashboardEtag(user, cards, pendingRequests);

  return {
    user: {
      ecosystemId: user.ecosystemId,
      email: user.email,
      currentScore: user.currentScore,
      tier: user.tier,
      cardSummary: user.cardSummary,
      lastLoginAt: user.lastLoginAt,
    },
    cards: cards.map((card) => ({
      cardId: card.cardId,
      status: card.status,
      limit: card.limit,
      balance: card.balance,
      availableCredit: card.availableCredit,
      utilization: calculateUtilization(card.balance, card.limit),
      nearLimit: isNearLimit(card.balance, card.limit),
    })),
    pendingRequests: pendingRequests.map((req) => ({
      requestId: req.requestId,
      status: req.status,
      createdAt: req.createdAt,
      scoreAtRequest: req.scoreAtRequest,
      tierAtRequest: req.tierAtRequest,
    })),
    etag,
  };
}
