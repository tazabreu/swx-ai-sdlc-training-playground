/**
 * Make Payment Handler Unit Tests
 *
 * T061: Tests for payment handler orchestration logic including score impact.
 */

import { describe, it, expect } from 'bun:test';
import {
  handleMakePayment,
  MakePaymentError,
  type MakePaymentHandlerDeps,
} from '../../../../src/application/handlers/make-payment.handler.js';
import type { MakePaymentCommand } from '../../../../src/application/commands/make-payment.command.js';
import type { User } from '../../../../src/domain/entities/user.entity.js';
import type { Card } from '../../../../src/domain/entities/card.entity.js';
import type { Transaction } from '../../../../src/domain/entities/transaction.entity.js';
import type { IdempotencyRecord } from '../../../../src/domain/entities/idempotency-record.entity.js';
import type { Event } from '../../../../src/domain/entities/event.entity.js';

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
): MakePaymentHandlerDeps {
  const savedTransactions: Transaction[] = [];
  const savedEvents: Event[] = [];

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
          nextDueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now (on-time)
          createdAt: new Date(),
          approvedBy: 'auto' as const,
          scoreAtApproval: 700,
          version: 1,
        };

  return {
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
              currentScore: 600,
              tier: 'medium',
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
        savedTransactions.push(tx);
      },
    },
    idempotencyRepository: {
      find: async () => overrides.idempotencyRecord ?? null,
      save: async () => {},
      deleteExpired: async () => 0,
    },
    outboxRepository: {
      save: async (event: Event) => {
        savedEvents.push(event);
      },
      findPending: async () => [],
      markPublished: async () => {},
      deleteOld: async () => 0,
    },
  };
}

describe('MakePaymentHandler', () => {
  describe('validation', () => {
    it('should throw VALIDATION_ERROR for missing ecosystemId', async () => {
      const command: MakePaymentCommand = {
        ecosystemId: '',
        cardId: 'card-123',
        idempotencyKey: 'key-123',
        amount: 100,
      };
      const deps = createMockDeps();

      try {
        await handleMakePayment(command, deps);
        expect(true).toBe(false); // Should not reach here
      } catch (error) {
        expect((error as MakePaymentError).code).toBe('VALIDATION_ERROR');
      }
    });

    it('should throw VALIDATION_ERROR for zero amount', async () => {
      const command: MakePaymentCommand = {
        ecosystemId: 'test-user-123',
        cardId: 'card-123',
        idempotencyKey: 'key-123',
        amount: 0,
      };
      const deps = createMockDeps();

      try {
        await handleMakePayment(command, deps);
        expect(true).toBe(false);
      } catch (error) {
        expect((error as MakePaymentError).code).toBe('VALIDATION_ERROR');
      }
    });
  });

  describe('user and card lookup', () => {
    it('should throw USER_NOT_FOUND when user does not exist', async () => {
      const command: MakePaymentCommand = {
        ecosystemId: 'non-existent',
        cardId: 'card-123',
        idempotencyKey: 'key-123',
        amount: 100,
      };
      const deps = createMockDeps({ user: null });

      try {
        await handleMakePayment(command, deps);
        expect(true).toBe(false);
      } catch (error) {
        expect((error as MakePaymentError).code).toBe('USER_NOT_FOUND');
      }
    });

    it('should throw CARD_NOT_FOUND when card does not exist', async () => {
      const command: MakePaymentCommand = {
        ecosystemId: 'test-user-123',
        cardId: 'non-existent-card',
        idempotencyKey: 'key-123',
        amount: 100,
      };
      const deps = createMockDeps({ card: null });

      try {
        await handleMakePayment(command, deps);
        expect(true).toBe(false);
      } catch (error) {
        expect((error as MakePaymentError).code).toBe('CARD_NOT_FOUND');
      }
    });
  });

  describe('payment validation', () => {
    it('should throw INVALID_AMOUNT when payment exceeds balance', async () => {
      const command: MakePaymentCommand = {
        ecosystemId: 'test-user-123',
        cardId: 'card-123',
        idempotencyKey: 'key-123',
        amount: 2000, // Balance is 1000
      };
      const deps = createMockDeps();

      try {
        await handleMakePayment(command, deps);
        expect(true).toBe(false);
      } catch (error) {
        expect((error as MakePaymentError).code).toBe('INVALID_AMOUNT');
      }
    });
  });

  describe('on-time payment flow', () => {
    it('should process on-time payment and increase score', async () => {
      const card: Card = {
        cardId: 'card-123',
        type: 'standard',
        status: 'active',
        limit: 5000,
        balance: 1000,
        availableCredit: 4000,
        minimumPayment: 25,
        nextDueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // Due in 7 days
        createdAt: new Date(),
        approvedBy: 'auto',
        scoreAtApproval: 700,
        version: 1,
      };

      const command: MakePaymentCommand = {
        ecosystemId: 'test-user-123',
        cardId: 'card-123',
        idempotencyKey: 'key-123',
        amount: 100, // Minimum payment
      };
      const deps = createMockDeps({ card });

      const result = await handleMakePayment(command, deps);

      expect(result.success).toBe(true);
      expect(result.paymentStatus).toBe('on_time');
      expect(result.scoreImpact).toBeGreaterThanOrEqual(0); // On-time payment increases score
      expect(result.newBalance).toBe(900); // 1000 - 100
      expect(result.newAvailableCredit).toBe(4100); // 4000 + 100
    });

    it('should give higher score bonus for full payment', async () => {
      const card: Card = {
        cardId: 'card-123',
        type: 'standard',
        status: 'active',
        limit: 5000,
        balance: 500,
        availableCredit: 4500,
        minimumPayment: 25,
        nextDueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        createdAt: new Date(),
        approvedBy: 'auto',
        scoreAtApproval: 700,
        version: 1,
      };

      const command: MakePaymentCommand = {
        ecosystemId: 'test-user-123',
        cardId: 'card-123',
        idempotencyKey: 'key-full',
        amount: 500, // Full payment
      };
      const deps = createMockDeps({ card });

      const result = await handleMakePayment(command, deps);

      expect(result.success).toBe(true);
      expect(result.paymentStatus).toBe('on_time');
      expect(result.scoreImpact).toBe(50); // Full payment = +50
      expect(result.newBalance).toBe(0);
    });
  });

  describe('late payment flow', () => {
    it('should process late payment and decrease score', async () => {
      const card: Card = {
        cardId: 'card-123',
        type: 'standard',
        status: 'active',
        limit: 5000,
        balance: 1000,
        availableCredit: 4000,
        minimumPayment: 25,
        nextDueDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // Due 5 days ago
        createdAt: new Date(),
        approvedBy: 'auto',
        scoreAtApproval: 700,
        version: 1,
      };

      const command: MakePaymentCommand = {
        ecosystemId: 'test-user-123',
        cardId: 'card-123',
        idempotencyKey: 'key-late',
        amount: 100,
      };
      const deps = createMockDeps({ card });

      const result = await handleMakePayment(command, deps);

      expect(result.success).toBe(true);
      expect(result.paymentStatus).toBe('late');
      expect(result.scoreImpact).toBeLessThan(0); // Late payment decreases score
    });

    it('should apply severe penalty for very late payment (30+ days)', async () => {
      const card: Card = {
        cardId: 'card-123',
        type: 'standard',
        status: 'active',
        limit: 5000,
        balance: 1000,
        availableCredit: 4000,
        minimumPayment: 25,
        nextDueDate: new Date(Date.now() - 35 * 24 * 60 * 60 * 1000), // Due 35 days ago
        createdAt: new Date(),
        approvedBy: 'auto',
        scoreAtApproval: 700,
        version: 1,
      };

      const command: MakePaymentCommand = {
        ecosystemId: 'test-user-123',
        cardId: 'card-123',
        idempotencyKey: 'key-very-late',
        amount: 100,
      };
      const deps = createMockDeps({ card });

      const result = await handleMakePayment(command, deps);

      expect(result.success).toBe(true);
      expect(result.paymentStatus).toBe('late');
      expect(result.scoreImpact).toBe(-100); // 30+ days = -100
    });
  });

  describe('idempotency handling', () => {
    it('should return cached response for duplicate request', async () => {
      const existingRecord: IdempotencyRecord = {
        key: 'key-123',
        keyHash: 'hash-123',
        operation: 'make-payment',
        statusCode: 200,
        response: {
          success: true,
          transactionId: 'cached-tx-id',
          newBalance: 900,
          newAvailableCredit: 4100,
          newScore: 610,
          scoreImpact: 10,
          paymentStatus: 'on_time',
          message: 'Cached payment',
        },
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 86400000),
      };

      const command: MakePaymentCommand = {
        ecosystemId: 'test-user-123',
        cardId: 'card-123',
        idempotencyKey: 'key-123',
        amount: 100,
      };
      const deps = createMockDeps({ idempotencyRecord: existingRecord });

      const result = await handleMakePayment(command, deps);

      expect(result.success).toBe(true);
      expect(result.fromIdempotency).toBe(true);
      expect(result.transactionId).toBe('cached-tx-id');
      expect(result.paymentStatus).toBe('on_time');
    });
  });

  describe('score clamping', () => {
    it('should not let score go above 1000', async () => {
      const user: User = {
        ecosystemId: 'test-user-123',
        firebaseUid: 'firebase-123',
        email: 'test@example.com',
        role: 'user',
        status: 'active',
        currentScore: 990, // Almost max
        tier: 'high',
        cardSummary: { activeCards: 1, totalBalance: 500, totalLimit: 5000 },
        createdAt: new Date(),
        updatedAt: new Date(),
        lastLoginAt: new Date(),
      };

      const card: Card = {
        cardId: 'card-123',
        type: 'standard',
        status: 'active',
        limit: 5000,
        balance: 500,
        availableCredit: 4500,
        minimumPayment: 25,
        nextDueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        createdAt: new Date(),
        approvedBy: 'auto',
        scoreAtApproval: 700,
        version: 1,
      };

      const command: MakePaymentCommand = {
        ecosystemId: 'test-user-123',
        cardId: 'card-123',
        idempotencyKey: 'key-max',
        amount: 500, // Full payment = +50
      };
      const deps = createMockDeps({ user, card });

      const result = await handleMakePayment(command, deps);

      expect(result.success).toBe(true);
      expect(result.newScore).toBeLessThanOrEqual(1000);
    });
  });
});
