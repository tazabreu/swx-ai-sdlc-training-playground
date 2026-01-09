/**
 * Get Dashboard Query
 *
 * Query to retrieve user's dashboard data.
 */

import type { User, Card, CardRequest } from '../../domain/entities/index.js';

/**
 * Query to get user dashboard
 */
export interface GetDashboardQuery {
  /** User's ecosystem ID */
  ecosystemId: string;
}

/**
 * Dashboard response
 */
export interface DashboardResult {
  /** User information */
  user: {
    ecosystemId: string;
    email: string;
    currentScore: number;
    tier: string;
    cardSummary: {
      activeCards: number;
      totalBalance: number;
      totalLimit: number;
    };
    lastLoginAt: Date;
  };
  /** Active cards */
  cards: Array<{
    cardId: string;
    status: string;
    limit: number;
    balance: number;
    availableCredit: number;
    utilization: number;
    nearLimit: boolean;
  }>;
  /** Pending card requests */
  pendingRequests: Array<{
    requestId: string;
    status: string;
    createdAt: Date;
    scoreAtRequest: number;
    tierAtRequest: string;
  }>;
  /** ETag for caching */
  etag: string;
}

/**
 * Create a get dashboard query
 */
export function createGetDashboardQuery(ecosystemId: string): GetDashboardQuery {
  return { ecosystemId };
}

/**
 * Generate ETag from user data
 */
export function generateDashboardEtag(user: User, cards: Card[], requests: CardRequest[]): string {
  const data = {
    userId: user.ecosystemId,
    updatedAt: user.updatedAt.getTime(),
    cardCount: cards.length,
    requestCount: requests.length,
    totalBalance: cards.reduce((sum, c) => sum + c.balance, 0),
  };
  // Simple hash for ETag
  const str = JSON.stringify(data);
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return `"${Math.abs(hash).toString(16)}"`;
}
