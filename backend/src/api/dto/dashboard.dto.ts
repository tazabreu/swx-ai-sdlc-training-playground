/**
 * Dashboard DTOs
 *
 * Dashboard response shapes per OpenAPI spec.
 */

import type { CardSummaryDTO } from './cards.dto.js';

/**
 * User info in dashboard
 */
export interface DashboardUserDTO {
  ecosystemId: string;
  email: string;
  score: number;
  tier: 'high' | 'medium' | 'low';
  status: 'active' | 'disabled';
}

/**
 * Card request summary in dashboard
 */
export interface CardRequestSummaryDTO {
  requestId: string;
  productId: string;
  status: 'pending' | 'approved' | 'rejected';
  submittedAt: string;
  estimatedReviewTime?: string | undefined;
}

/**
 * Suggested action for new users
 */
export interface SuggestedActionDTO {
  type: string;
  message: string;
  link?: string;
}

/**
 * Dashboard response
 */
export interface DashboardResponse {
  user: DashboardUserDTO;
  cards: CardSummaryDTO[];
  pendingRequests: CardRequestSummaryDTO[];
  suggestedActions?: SuggestedActionDTO[] | undefined;
  lastUpdated: string;
}
