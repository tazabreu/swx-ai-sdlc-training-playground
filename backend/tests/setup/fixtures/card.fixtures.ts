/**
 * Card Test Fixtures
 *
 * Provides consistent card data for testing across all backends.
 */

import { v4 as uuidv4 } from 'uuid';
import {
  createCard,
  type Card,
  type ApprovalSource,
  type CardStatus,
} from '../../../src/domain/entities/card.entity.js';

export interface CardFixtureOptions {
  cardId?: string;
  productId?: string;
  status?: CardStatus;
  statusReason?: string;
  limit?: number;
  balance?: number;
  approvedBy?: ApprovalSource;
  approvedByAdminId?: string;
  scoreAtApproval?: number;
}

/**
 * Create a test card with sensible defaults
 */
export function createTestCard(options: CardFixtureOptions = {}): Card {
  const limit = options.limit ?? 5000;
  const balance = options.balance ?? 0;

  const card = createCard({
    productId: options.productId ?? 'default-credit-card',
    limit,
    approvedBy: options.approvedBy ?? 'auto',
    approvedByAdminId: options.approvedByAdminId,
    scoreAtApproval: options.scoreAtApproval ?? 600,
  });

  // Override generated cardId if provided
  if (options.cardId !== undefined) {
    card.cardId = options.cardId;
  }

  // Override status if provided
  if (options.status !== undefined) {
    card.status = options.status;
    if (options.statusReason !== undefined) {
      card.statusReason = options.statusReason;
    }
    if (options.status === 'cancelled') {
      card.cancelledAt = new Date();
    }
  }

  // Override balance and recalculate availableCredit
  if (options.balance !== undefined) {
    card.balance = balance;
    card.availableCredit = card.limit - balance;
  }

  return card;
}

/**
 * Pre-built card fixture variants for common test scenarios
 */
export const cardFixtures = {
  /** Active card with auto-approval (high score user) */
  autoApprovedCard: (overrides?: Partial<CardFixtureOptions>) =>
    createTestCard({
      approvedBy: 'auto',
      scoreAtApproval: 750,
      limit: 10000,
      ...overrides,
    }),

  /** Active card with admin approval (low score user) */
  adminApprovedCard: (overrides?: Partial<CardFixtureOptions>) =>
    createTestCard({
      approvedBy: 'admin',
      approvedByAdminId: `admin-${uuidv4().slice(0, 8)}`,
      scoreAtApproval: 400,
      limit: 2000,
      ...overrides,
    }),

  /** Card with existing balance */
  cardWithBalance: (overrides?: Partial<CardFixtureOptions>) =>
    createTestCard({
      limit: 5000,
      balance: 2500,
      ...overrides,
    }),

  /** Card at credit limit */
  maxedOutCard: (overrides?: Partial<CardFixtureOptions>) =>
    createTestCard({
      limit: 5000,
      balance: 5000,
      ...overrides,
    }),

  /** Suspended card */
  suspendedCard: (overrides?: Partial<CardFixtureOptions>) =>
    createTestCard({
      status: 'suspended',
      statusReason: 'Suspicious activity detected',
      ...overrides,
    }),

  /** Cancelled card */
  cancelledCard: (overrides?: Partial<CardFixtureOptions>) =>
    createTestCard({
      status: 'cancelled',
      statusReason: 'User requested cancellation',
      balance: 0,
      ...overrides,
    }),

  /** High limit card */
  highLimitCard: (overrides?: Partial<CardFixtureOptions>) =>
    createTestCard({
      limit: 10000,
      scoreAtApproval: 800,
      ...overrides,
    }),

  /** Low limit card */
  lowLimitCard: (overrides?: Partial<CardFixtureOptions>) =>
    createTestCard({
      limit: 2000,
      scoreAtApproval: 400,
      approvedBy: 'admin',
      approvedByAdminId: 'admin-001',
      ...overrides,
    }),
};
