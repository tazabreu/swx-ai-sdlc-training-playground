/**
 * Admin List Pending Requests Query
 *
 * Query for admin to list pending card requests.
 */

import type { UserTier } from '../../domain/entities/user.entity.js';

/**
 * Sort options for pending requests
 */
export type PendingRequestSortField = 'createdAt' | 'score' | 'tier';
export type SortOrder = 'asc' | 'desc';

/**
 * Query to list pending requests
 */
export interface AdminListPendingRequestsQuery {
  /** Admin's ecosystem ID (for audit) */
  adminId: string;
  /** Sort field */
  sortBy?: PendingRequestSortField | undefined;
  /** Sort order */
  sortOrder?: SortOrder | undefined;
  /** Pagination cursor */
  cursor?: string | undefined;
  /** Page size (default 20, max 100) */
  limit?: number | undefined;
  /** Filter by tier */
  tier?: UserTier | undefined;
  /** Only show requests older than X days */
  minDaysPending?: number | undefined;
}

/**
 * Pending request list item
 */
export interface PendingRequestListItem {
  requestId: string;
  ecosystemId: string;
  userEmail: string;
  productId: string;
  scoreAtRequest: number;
  currentScore: number;
  tierAtRequest: UserTier;
  currentTier: UserTier;
  createdAt: Date;
  daysPending: number;
  requiresAttention: boolean;
}

/**
 * Pending requests list response
 */
export interface AdminListPendingRequestsResult {
  /** Pending requests */
  requests: PendingRequestListItem[];
  /** Total count of pending requests */
  totalCount: number;
  /** Count requiring attention (>7 days) */
  attentionCount: number;
  /** Next cursor for pagination */
  nextCursor?: string | undefined;
  /** Whether there are more results */
  hasMore: boolean;
}

/**
 * Create an admin list pending requests query
 */
export function createAdminListPendingRequestsQuery(
  adminId: string,
  options?: {
    sortBy?: PendingRequestSortField;
    sortOrder?: SortOrder;
    cursor?: string;
    limit?: number;
    tier?: UserTier;
    minDaysPending?: number;
  }
): AdminListPendingRequestsQuery {
  return {
    adminId,
    sortBy: options?.sortBy,
    sortOrder: options?.sortOrder,
    cursor: options?.cursor,
    limit: options?.limit,
    tier: options?.tier,
    minDaysPending: options?.minDaysPending,
  };
}

/**
 * Calculate days pending
 */
export function calculateDaysPending(createdAt: Date): number {
  const now = new Date();
  const diffMs = now.getTime() - createdAt.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Check if request requires attention (>7 days pending)
 */
export function requestRequiresAttention(createdAt: Date): boolean {
  return calculateDaysPending(createdAt) >= 7;
}
