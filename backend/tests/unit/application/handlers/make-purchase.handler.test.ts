/**
 * Make Purchase Handler Unit Tests
 *
 * T060: Tests for purchase handler orchestration logic with mocked repositories.
 */

import { describe, it, expect } from 'bun:test';
import {
  handleMakePurchase,
  MakePurchaseError,
  type MakePurchaseHandlerDeps,
} from '../../../../src/application/handlers/make-purchase.handler.js';
import type { MakePurchaseCommand } from '../../../../src/application/commands/make-purchase.command.js';
import type { User } from '../../../../src/domain/entities/user.entity.js';
import type { Card } from '../../../../src/domain/entities/card.entity.js';
import type { Transaction } from '../../../../src/domain/entities/transaction.entity.js';
import type { IdempotencyRecord } from '../../../../src/domain/entities/idempotency-record.entity.js';
import type { Event } from '../../../../src/domain/entities/event.entity.js';

interface MockState {
  savedTransactions: Transaction[];
  savedEvents: Event[];
  savedIdempotency: IdempotencyRecord[];
}

async function expectMakePurchaseError(
  promise: Promise<unknown>,
  code: MakePurchaseError['code']
): Promise<void> {
  try {
    await promise;
    throw new Error('Expected MakePurchaseError to be thrown');
  } catch (error) {
    if (!(error instanceof MakePurchaseError)) {
      throw error;
    }
    expect(error.code).toBe(code);
  }
}

/**
 * Create mock repositories for testing
 */
function createMockDeps(
  overrides: Partial<{
    user: User | null;
    card: Card | null;
    cards: Card[];
    idempotencyRecord: IdempotencyRecord | null;
  }> = {}
): { deps: MakePurchaseHandlerDeps; state: MockState } {
  const state: MockState = {
    savedTransactions: [],
    savedEvents: [],
    savedIdempotency: [],
  };

  const defaultCard =
    overrides.card !== undefined
      ? overrides.card
      : {
          cardId: 'card-123',
          type: 'standard',
          status: 'active' as const,
          limit: 5000,
          balance: 1000,
          availableCredit: 4000,
          minimumPayment: 25,
          createdAt: new Date(),
          approvedBy: 'auto' as const,
          scoreAtApproval: 700,
          version: 1,
        };

  const deps: MakePurchaseHandlerDeps = {
    userRepository: {
      findById: async () =>
        'user' in overrides
          ? overrides.user
          : {
              ecosystemId: 'test-user-123',
              firebaseUid: 'firebase-123',
              email: 'test@example.com',
              role: 'user',
              status: 'active',
              currentScore: 700,
              tier: 'high',
              cardSummary: { activeCards: 1, totalBalance: 1000, totalLimit: 5000 },
              createdAt: new Date(),
              updatedAt: new Date(),
              lastLoginAt: new Date(),
            },
      findBySlug: async () => null,
      findByFirebaseUid: async () => null,
      save: async () => {},
      updateScore: async () => {},
      updateCardSummary: async () => {},
      delete: async () => {},
      getScoreHistory: async () => [],
      deleteAll: async () => 0,
    },
    cardRepository: {
      findById: async () => defaultCard,
      findByUser: async () => overrides.cards ?? (defaultCard ? [defaultCard] : []),
      save: async () => {},
      updateBalance: async () => {},
      updateStatus: async () => {},
    },
    transactionRepository: {
      findByCard: async () => ({ transactions: [], nextCursor: null, hasMore: false }),
      save: async (_ecosystemId: string, _cardId: string, tx: Transaction) => {
        state.savedTransactions.push(tx);
      },
    },
    idempotencyRepository: {
      find: async () => overrides.idempotencyRecord ?? null,
      save: async (_ecosystemId: string, record: IdempotencyRecord) => {
        state.savedIdempotency.push(record);
      },
      deleteExpired: async () => 0,
    },
    outboxRepository: {
      save: async (event: Event) => {
        state.savedEvents.push(event);
      },
      findPending: async () => [],
      markPublished: async () => {},
      deleteOld: async () => 0,
    },
  };

  return { deps, state };
}

describe('MakePurchaseHandler', () => {
  describe('validation', () => {
    it('should throw VALIDATION_ERROR for missing ecosystemId', async () => {
      const command: MakePurchaseCommand = {
        ecosystemId: '',
        cardId: 'card-123',
        idempotencyKey: 'key-123',
        amount: 100,
        merchant: 'Test Store',
      };
      const { deps } = createMockDeps();

      await expectMakePurchaseError(handleMakePurchase(command, deps), 'VALIDATION_ERROR');
    });

    it('should throw VALIDATION_ERROR for zero amount', async () => {
      const command: MakePurchaseCommand = {
        ecosystemId: 'test-user-123',
        cardId: 'card-123',
        idempotencyKey: 'key-123',
        amount: 0,
        merchant: 'Test Store',
      };
      const { deps } = createMockDeps();

      await expectMakePurchaseError(handleMakePurchase(command, deps), 'VALIDATION_ERROR');
    });

    it('should throw VALIDATION_ERROR for negative amount', async () => {
      const command: MakePurchaseCommand = {
        ecosystemId: 'test-user-123',
        cardId: 'card-123',
        idempotencyKey: 'key-123',
        amount: -100,
        merchant: 'Test Store',
      };
      const { deps } = createMockDeps();

      await expectMakePurchaseError(handleMakePurchase(command, deps), 'VALIDATION_ERROR');
    });
  });

  describe('user and card lookup', () => {
    it('should throw USER_NOT_FOUND when user does not exist', async () => {
      const command: MakePurchaseCommand = {
        ecosystemId: 'non-existent',
        cardId: 'card-123',
        idempotencyKey: 'key-123',
        amount: 100,
        merchant: 'Test Store',
      };
      const { deps } = createMockDeps({ user: null });

      await expectMakePurchaseError(handleMakePurchase(command, deps), 'USER_NOT_FOUND');
    });

    it('should throw CARD_NOT_FOUND when card does not exist', async () => {
      const command: MakePurchaseCommand = {
        ecosystemId: 'test-user-123',
        cardId: 'non-existent-card',
        idempotencyKey: 'key-123',
        amount: 100,
        merchant: 'Test Store',
      };
      const { deps } = createMockDeps({ card: null });

      await expectMakePurchaseError(handleMakePurchase(command, deps), 'CARD_NOT_FOUND');
    });
  });

  describe('purchase validation', () => {
    it('should throw CARD_NOT_ACTIVE when card is suspended', async () => {
      const suspendedCard: Card = {
        cardId: 'card-123',
        type: 'standard',
        status: 'suspended',
        limit: 5000,
        balance: 1000,
        availableCredit: 4000,
        minimumPayment: 25,
        createdAt: new Date(),
        approvedBy: 'auto',
        scoreAtApproval: 700,
        version: 1,
      };

      const command: MakePurchaseCommand = {
        ecosystemId: 'test-user-123',
        cardId: 'card-123',
        idempotencyKey: 'key-123',
        amount: 100,
        merchant: 'Test Store',
      };
      const { deps } = createMockDeps({ card: suspendedCard });

      await expectMakePurchaseError(handleMakePurchase(command, deps), 'CARD_NOT_ACTIVE');
    });

    it('should throw INSUFFICIENT_CREDIT when purchase exceeds available credit', async () => {
      const lowCreditCard: Card = {
        cardId: 'card-123',
        type: 'standard',
        status: 'active',
        limit: 5000,
        balance: 4900,
        availableCredit: 100, // Only $100 available
        minimumPayment: 100,
        createdAt: new Date(),
        approvedBy: 'auto',
        scoreAtApproval: 700,
        version: 1,
      };

      const command: MakePurchaseCommand = {
        ecosystemId: 'test-user-123',
        cardId: 'card-123',
        idempotencyKey: 'key-123',
        amount: 500, // Trying to spend $500
        merchant: 'Test Store',
      };
      const { deps } = createMockDeps({ card: lowCreditCard });

      await expectMakePurchaseError(handleMakePurchase(command, deps), 'INSUFFICIENT_CREDIT');
    });
  });

  describe('successful purchase', () => {
    it('should process purchase and update balance', async () => {
      const command: MakePurchaseCommand = {
        ecosystemId: 'test-user-123',
        cardId: 'card-123',
        idempotencyKey: 'key-123',
        amount: 100,
        merchant: 'Test Store',
      };
      const { deps, state } = createMockDeps();

      const result = await handleMakePurchase(command, deps);

      expect(result.success).toBe(true);
      expect(result.transactionId).toBeDefined();
      expect(result.newBalance).toBe(1100); // 1000 + 100
      expect(result.newAvailableCredit).toBe(3900); // 4000 - 100
      expect(result.message).toContain('100');
      expect(state.savedTransactions).toHaveLength(1);
      expect(state.savedEvents).toHaveLength(1);
      expect(state.savedEvents[0]?.eventType).toBe('transaction.purchase');
      expect(state.savedIdempotency).toHaveLength(1);
    });
  });

  describe('idempotency handling', () => {
    it('should return cached response for duplicate request', async () => {
      const existingRecord: IdempotencyRecord = {
        key: 'key-123',
        keyHash: 'hash-123',
        operation: 'make-purchase',
        statusCode: 200,
        response: {
          success: true,
          transactionId: 'cached-tx-id',
          newBalance: 1100,
          newAvailableCredit: 3900,
          message: 'Cached purchase',
        },
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 86400000),
      };

      const command: MakePurchaseCommand = {
        ecosystemId: 'test-user-123',
        cardId: 'card-123',
        idempotencyKey: 'key-123',
        amount: 100,
        merchant: 'Test Store',
      };
      const { deps, state } = createMockDeps({ idempotencyRecord: existingRecord });

      const result = await handleMakePurchase(command, deps);

      expect(result.success).toBe(true);
      expect(result.fromIdempotency).toBe(true);
      expect(result.transactionId).toBe('cached-tx-id');
      expect(state.savedTransactions).toHaveLength(0);
      expect(state.savedEvents).toHaveLength(0);
      expect(state.savedIdempotency).toHaveLength(0);
    });

    it('should throw IDEMPOTENCY_MISMATCH for key used with different operation', async () => {
      const existingRecord: IdempotencyRecord = {
        key: 'key-123',
        keyHash: 'hash-123',
        operation: 'request-card', // Different operation
        statusCode: 200,
        response: {},
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 86400000),
      };

      const command: MakePurchaseCommand = {
        ecosystemId: 'test-user-123',
        cardId: 'card-123',
        idempotencyKey: 'key-123',
        amount: 100,
        merchant: 'Test Store',
      };
      const { deps } = createMockDeps({ idempotencyRecord: existingRecord });

      await expectMakePurchaseError(handleMakePurchase(command, deps), 'IDEMPOTENCY_MISMATCH');
    });
  });
});
