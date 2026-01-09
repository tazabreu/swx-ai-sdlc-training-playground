/**
 * CardRequest Test Fixtures
 *
 * Provides consistent card request data for testing across all backends.
 */

import { v4 as uuidv4 } from 'uuid';
import {
  createCardRequest,
  type CardRequest,
  type CardRequestStatus,
  type CardRequestDecision,
} from '../../../src/domain/entities/card-request.entity.js';
import type { UserTier } from '../../../src/domain/entities/user.entity.js';

export interface CardRequestFixtureOptions {
  requestId?: string;
  productId?: string;
  idempotencyKey?: string;
  status?: CardRequestStatus;
  scoreAtRequest?: number;
  tierAtRequest?: UserTier;
  decision?: CardRequestDecision;
  resultingCardId?: string;
}

/**
 * Create a test card request with sensible defaults
 */
export function createTestCardRequest(options: CardRequestFixtureOptions = {}): CardRequest {
  const score = options.scoreAtRequest ?? 550;
  const tier = options.tierAtRequest ?? deriveTierFromScore(score);

  const request = createCardRequest({
    productId: options.productId ?? 'default-credit-card',
    idempotencyKey: options.idempotencyKey ?? `idem-${uuidv4().slice(0, 8)}`,
    scoreAtRequest: score,
    tierAtRequest: tier,
  });

  // Override generated requestId if provided
  if (options.requestId !== undefined) {
    request.requestId = options.requestId;
  }

  // Override status and add decision if applicable
  if (options.status !== undefined && options.status !== 'pending') {
    request.status = options.status;
    request.updatedAt = new Date();

    if (options.decision !== undefined) {
      request.decision = options.decision;
    } else if (options.status === 'approved') {
      request.decision = {
        outcome: 'approved',
        source: 'auto',
        approvedLimit: 5000,
        decidedAt: new Date(),
      };
    } else if (options.status === 'rejected') {
      request.decision = {
        outcome: 'rejected',
        source: 'admin',
        adminId: 'admin-001',
        reason: 'Insufficient documentation',
        decidedAt: new Date(),
      };
    }
  }

  // Add resulting card ID if approved
  if (options.resultingCardId !== undefined) {
    request.resultingCardId = options.resultingCardId;
  } else if (request.status === 'approved') {
    request.resultingCardId = `card-${uuidv4().slice(0, 8)}`;
  }

  return request;
}

function deriveTierFromScore(score: number): UserTier {
  if (score >= 700) return 'high';
  if (score >= 500) return 'medium';
  return 'low';
}

/**
 * Pre-built card request fixture variants for common test scenarios
 */
export const cardRequestFixtures = {
  /** Pending request from high-tier user (should auto-approve) */
  pendingHighTier: (overrides?: Partial<CardRequestFixtureOptions>) =>
    createTestCardRequest({
      scoreAtRequest: 750,
      tierAtRequest: 'high',
      ...overrides,
    }),

  /** Pending request from medium-tier user (should auto-approve) */
  pendingMediumTier: (overrides?: Partial<CardRequestFixtureOptions>) =>
    createTestCardRequest({
      scoreAtRequest: 550,
      tierAtRequest: 'medium',
      ...overrides,
    }),

  /** Pending request from low-tier user (needs manual review) */
  pendingLowTier: (overrides?: Partial<CardRequestFixtureOptions>) =>
    createTestCardRequest({
      scoreAtRequest: 400,
      tierAtRequest: 'low',
      ...overrides,
    }),

  /** Auto-approved request */
  autoApproved: (overrides?: Partial<CardRequestFixtureOptions>) =>
    createTestCardRequest({
      status: 'approved',
      scoreAtRequest: 750,
      tierAtRequest: 'high',
      decision: {
        outcome: 'approved',
        source: 'auto',
        approvedLimit: 10000,
        decidedAt: new Date(),
      },
      ...overrides,
    }),

  /** Admin-approved request */
  adminApproved: (overrides?: Partial<CardRequestFixtureOptions>) =>
    createTestCardRequest({
      status: 'approved',
      scoreAtRequest: 400,
      tierAtRequest: 'low',
      decision: {
        outcome: 'approved',
        source: 'admin',
        adminId: 'admin-001',
        approvedLimit: 2000,
        decidedAt: new Date(),
      },
      ...overrides,
    }),

  /** Rejected request */
  rejected: (overrides?: Partial<CardRequestFixtureOptions>) =>
    createTestCardRequest({
      status: 'rejected',
      scoreAtRequest: 300,
      tierAtRequest: 'low',
      decision: {
        outcome: 'rejected',
        source: 'admin',
        adminId: 'admin-001',
        reason: 'Insufficient documentation',
        decidedAt: new Date(),
      },
      ...overrides,
    }),

  /** Expired pending request (older than 7 days) */
  expiredPending: (overrides?: Partial<CardRequestFixtureOptions>) => {
    const request = createTestCardRequest({
      scoreAtRequest: 400,
      tierAtRequest: 'low',
      ...overrides,
    });
    // Set createdAt to 8 days ago
    const eightDaysAgo = new Date();
    eightDaysAgo.setDate(eightDaysAgo.getDate() - 8);
    request.createdAt = eightDaysAgo;
    return request;
  },
};
