/**
 * Card Request Repository Interface
 *
 * Contract for card request data access operations.
 */

import type {
  CardRequest,
  CardRequestStatus,
  CardRequestDecision,
} from '../../../domain/entities/card-request.entity.js';
import type { UserTier } from '../../../domain/entities/user.entity.js';

/**
 * Pagination options
 */
export interface PaginationOptions {
  cursor?: string | undefined;
  limit?: number | undefined;
}

/**
 * Sort options for pending requests
 */
export interface PendingRequestSortOptions {
  field: 'createdAt' | 'score' | 'tier';
  order: 'asc' | 'desc';
}

/**
 * Filter options for pending requests
 */
export interface PendingRequestFilter {
  tier?: UserTier | undefined;
  minDaysPending?: number | undefined;
  status?: 'pending' | 'approved' | 'rejected' | undefined;
}

/**
 * Card request with ecosystemId (for admin queries)
 */
export interface CardRequestWithOwner extends CardRequest {
  ecosystemId: string;
}

/**
 * Paginated result
 */
export interface PaginatedCardRequests {
  requests: CardRequestWithOwner[];
  nextCursor?: string | undefined;
  hasMore: boolean;
  totalCount: number;
}

/**
 * Card request repository interface
 */
export interface ICardRequestRepository {
  /**
   * Find request by ID
   */
  findById(ecosystemId: string, requestId: string): Promise<CardRequest | null>;

  /**
   * Find pending request for user
   */
  findPendingByUser(ecosystemId: string): Promise<CardRequest | null>;

  /**
   * Find all pending requests (admin)
   */
  findAllPending(
    sort?: PendingRequestSortOptions,
    filter?: PendingRequestFilter,
    pagination?: PaginationOptions
  ): Promise<PaginatedCardRequests>;

  /**
   * Find rejected requests for user (for cooldown check)
   */
  findRejectedByUser(ecosystemId: string, withinDays?: number): Promise<CardRequest[]>;

  /**
   * Save request (create or update)
   */
  save(ecosystemId: string, request: CardRequest): Promise<void>;

  /**
   * Update request status with decision
   */
  updateStatus(
    ecosystemId: string,
    requestId: string,
    status: CardRequestStatus,
    decision: CardRequestDecision,
    resultingCardId?: string
  ): Promise<void>;

  /**
   * Delete request
   */
  delete(ecosystemId: string, requestId: string): Promise<void>;

  /**
   * Delete all requests for user
   */
  deleteAllForUser(ecosystemId: string): Promise<number>;

  /**
   * Count pending requests requiring attention (>7 days)
   */
  countRequiringAttention(): Promise<number>;
}
