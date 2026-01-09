/**
 * Admin List Pending Requests Handler
 *
 * Handles pending card request listing for admins.
 */

import type {
  AdminListPendingRequestsQuery,
  AdminListPendingRequestsResult,
  PendingRequestListItem,
} from '../queries/admin-list-pending-requests.query.js';
import {
  calculateDaysPending,
  requestRequiresAttention,
} from '../queries/admin-list-pending-requests.query.js';
import { normalizePageSize } from '../queries/list-transactions.query.js';
import type { IUserRepository } from '../../infrastructure/persistence/interfaces/user.repository.js';
import type { ICardRequestRepository } from '../../infrastructure/persistence/interfaces/card-request.repository.js';
import { deriveTier } from '../../domain/entities/user.entity.js';

/**
 * Handler dependencies
 */
export interface AdminListPendingRequestsHandlerDeps {
  userRepository: IUserRepository;
  cardRequestRepository: ICardRequestRepository;
}

/**
 * Handle admin list pending requests query
 */
export async function handleAdminListPendingRequests(
  query: AdminListPendingRequestsQuery,
  deps: AdminListPendingRequestsHandlerDeps
): Promise<AdminListPendingRequestsResult> {
  // Get pending requests with filtering and pagination
  const result = await deps.cardRequestRepository.findAllPending(
    query.sortBy
      ? {
          field: query.sortBy,
          order: query.sortOrder ?? 'desc',
        }
      : undefined,
    {
      tier: query.tier,
      minDaysPending: query.minDaysPending,
    },
    {
      cursor: query.cursor,
      limit: normalizePageSize(query.limit),
    }
  );

  // Enrich with user data and calculated fields
  const enrichedRequests: PendingRequestListItem[] = await Promise.all(
    result.requests.map(async (request) => {
      // Get user for current score
      const user = await deps.userRepository.findById(request.ecosystemId);

      const daysPending = calculateDaysPending(request.createdAt);
      const requiresAttention = requestRequiresAttention(request.createdAt);

      return {
        requestId: request.requestId,
        ecosystemId: request.ecosystemId,
        userEmail: user?.email ?? 'Unknown',
        productId: request.productId,
        scoreAtRequest: request.scoreAtRequest,
        currentScore: user?.currentScore ?? request.scoreAtRequest,
        tierAtRequest: request.tierAtRequest,
        currentTier: user ? deriveTier(user.currentScore) : request.tierAtRequest,
        createdAt: request.createdAt,
        daysPending,
        requiresAttention,
      };
    })
  );

  // Count those requiring attention
  const attentionCount = await deps.cardRequestRepository.countRequiringAttention();

  return {
    requests: enrichedRequests,
    totalCount: result.totalCount,
    attentionCount,
    nextCursor: result.nextCursor,
    hasMore: result.hasMore,
  };
}
