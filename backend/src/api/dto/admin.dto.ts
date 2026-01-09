/**
 * Admin DTOs
 *
 * Admin endpoint response shapes per OpenAPI spec.
 */

import type { CardSummaryDTO } from './cards.dto.js';
import type { PaginationMeta } from './transactions.dto.js';

/**
 * Score history entry
 */
export interface ScoreHistoryEntryDTO {
  value: number;
  previousValue: number;
  delta: number;
  reason: string;
  source: 'system' | 'admin';
  timestamp: string;
}

/**
 * Admin score response
 */
export interface AdminScoreResponse {
  user: {
    ecosystemId: string;
    email: string;
    currentScore: number;
    tier: 'high' | 'medium' | 'low';
  };
  history: ScoreHistoryEntryDTO[];
}

/**
 * Score adjustment input
 */
export interface ScoreAdjustmentInput {
  score: number;
  reason: string;
}

/**
 * Admin card request
 */
export interface AdminCardRequestDTO {
  requestId: string;
  user: {
    ecosystemId: string;
    email: string;
  };
  scoreAtRequest: number;
  currentScore: number;
  tierAtRequest: 'high' | 'medium' | 'low';
  daysPending: number;
  requiresAttention: boolean;
  productId: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
}

/**
 * Admin card requests list response
 */
export interface AdminCardRequestsListResponse {
  requests: AdminCardRequestDTO[];
  pagination: PaginationMeta;
}

/**
 * Admin card request response (single)
 */
export interface AdminCardRequestResponse {
  request: AdminCardRequestDTO;
  card?: CardSummaryDTO;
}

/**
 * Card approval input
 */
export interface CardApprovalInput {
  creditLimit: number;
}

/**
 * Card rejection input
 */
export interface CardRejectionInput {
  reason: string;
}

/**
 * Cleanup input
 */
export interface CleanupInput {
  confirmationToken?: string;
}

/**
 * Cleanup response
 */
export interface CleanupResponse {
  status: 'completed';
  deletedCounts: {
    users: number;
    cards: number;
    transactions: number;
    cardRequests: number;
    events: number;
  };
  duration: string;
}
