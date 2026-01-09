/**
 * Request Card Handler Unit Tests
 *
 * T059: Tests for card request handler orchestration logic with mocked repositories.
 */

import { describe, it, expect } from 'bun:test';
import {
  handleRequestCard,
  RequestCardError,
  type RequestCardHandlerDeps,
} from '../../../../src/application/handlers/request-card.handler.js';
import type { RequestCardCommand } from '../../../../src/application/commands/request-card.command.js';
import type { User } from '../../../../src/domain/entities/user.entity.js';
import type { Card } from '../../../../src/domain/entities/card.entity.js';
import type { CardRequest } from '../../../../src/domain/entities/card-request.entity.js';
import type { IdempotencyRecord } from '../../../../src/domain/entities/idempotency-record.entity.js';
import type { Event } from '../../../../src/domain/entities/event.entity.js';

interface MockState {
  savedCards: Card[];
  savedRequests: CardRequest[];
  savedEvents: Event[];
  savedIdempotency: IdempotencyRecord[];
}

async function expectRequestCardError(
  promise: Promise<unknown>,
  code: RequestCardError['code']
): Promise<void> {
  try {
    await promise;
    throw new Error('Expected RequestCardError to be thrown');
  } catch (error) {
    if (!(error instanceof RequestCardError)) {
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
    cards: Card[];
    pendingRequest: CardRequest | null;
    rejectedRequests: CardRequest[];
    idempotencyRecord: IdempotencyRecord | null;
  }> = {}
): { deps: RequestCardHandlerDeps; state: MockState } {
  const state: MockState = {
    savedCards: [],
    savedRequests: [],
    savedEvents: [],
    savedIdempotency: [],
  };

  const deps: RequestCardHandlerDeps = {
    userRepository: {
      findById: async () => overrides.user ?? null,
      findBySlug: async () => null,
      findByFirebaseUid: async () => null,
      save: async () => {},
      updateScore: async () => {},
      updateCardSummary: async () => {},
      deleteAll: async () => 0,
      getScoreHistory: async () => [],
    },
    cardRepository: {
      findById: async () => null,
      findByUser: async () => overrides.cards ?? [],
      save: async (_ecosystemId: string, card: Card) => {
        state.savedCards.push(card);
      },
      updateBalance: async () => {},
      updateStatus: async () => {},
    },
    cardRequestRepository: {
      findById: async () => null,
      findPendingByUser: async () => overrides.pendingRequest ?? null,
      findRejectedByUser: async () => overrides.rejectedRequests ?? [],
      findPendingForAdmin: async () => [],
      save: async (_ecosystemId: string, request: CardRequest) => {
        state.savedRequests.push(request);
      },
      updateDecision: async () => {},
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

/**
 * Create a test user
 */
function createTestUser(score: number): User {
  const tier = score >= 700 ? 'high' : score >= 500 ? 'medium' : 'low';
  return {
    ecosystemId: 'test-user-123',
    firebaseUid: 'firebase-123',
    email: 'test@example.com',
    role: 'user',
    status: 'active',
    currentScore: score,
    tier,
    cardSummary: { activeCards: 0, totalBalance: 0, totalLimit: 0 },
    createdAt: new Date(),
    updatedAt: new Date(),
    lastLoginAt: new Date(),
  };
}

describe('RequestCardHandler', () => {
  describe('validation', () => {
    it('should throw VALIDATION_ERROR for missing ecosystemId', async () => {
      const command: RequestCardCommand = {
        ecosystemId: '',
        idempotencyKey: 'key-123',
      };
      const { deps } = createMockDeps({ user: createTestUser(700) });

      await expectRequestCardError(handleRequestCard(command, deps), 'VALIDATION_ERROR');
    });

    it('should throw VALIDATION_ERROR for missing idempotencyKey', async () => {
      const command: RequestCardCommand = {
        ecosystemId: 'test-user-123',
        idempotencyKey: '',
      };
      const { deps } = createMockDeps({ user: createTestUser(700) });

      await expectRequestCardError(handleRequestCard(command, deps), 'VALIDATION_ERROR');
    });
  });

  describe('user lookup', () => {
    it('should throw USER_NOT_FOUND when user does not exist', async () => {
      const command: RequestCardCommand = {
        ecosystemId: 'non-existent-user',
        idempotencyKey: 'key-123',
      };
      const { deps } = createMockDeps({ user: null });

      await expectRequestCardError(handleRequestCard(command, deps), 'USER_NOT_FOUND');
    });
  });

  describe('eligibility checks', () => {
    it('should throw NOT_ELIGIBLE when user has existing active card', async () => {
      const user = createTestUser(700);
      const existingCard: Card = {
        cardId: 'existing-card',
        type: 'standard',
        status: 'active',
        limit: 5000,
        balance: 0,
        availableCredit: 5000,
        minimumPayment: 0,
        createdAt: new Date(),
        approvedBy: 'auto',
        scoreAtApproval: 700,
        version: 1,
      };

      const command: RequestCardCommand = {
        ecosystemId: 'test-user-123',
        idempotencyKey: 'key-123',
      };
      const { deps } = createMockDeps({ user, cards: [existingCard] });

      await expectRequestCardError(handleRequestCard(command, deps), 'NOT_ELIGIBLE');
    });

    it('should throw NOT_ELIGIBLE when user has pending request', async () => {
      const user = createTestUser(700);
      const pendingRequest: CardRequest = {
        requestId: 'pending-req',
        status: 'pending',
        idempotencyKey: 'old-key',
        scoreAtRequest: 700,
        tierAtRequest: 'high',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const command: RequestCardCommand = {
        ecosystemId: 'test-user-123',
        idempotencyKey: 'key-123',
      };
      const { deps } = createMockDeps({ user, pendingRequest });

      await expectRequestCardError(handleRequestCard(command, deps), 'NOT_ELIGIBLE');
    });
  });

  describe('auto-approval flow (high score)', () => {
    it('should auto-approve for high score user (>=700)', async () => {
      const user = createTestUser(750);
      const command: RequestCardCommand = {
        ecosystemId: 'test-user-123',
        idempotencyKey: 'key-123',
      };
      const { deps, state } = createMockDeps({ user, cards: [] });

      const result = await handleRequestCard(command, deps);

      expect(result.success).toBe(true);
      expect(result.status).toBe('approved');
      expect(result.cardId).toBeDefined();
      expect(result.limit).toBe(10000); // High tier limit
      expect(result.message).toContain('approved');
      expect(state.savedCards).toHaveLength(1);
      expect(state.savedRequests).toHaveLength(1);
      expect(state.savedEvents).toHaveLength(1);
      expect(state.savedEvents[0]?.eventType).toBe('card.approved');
      expect(state.savedIdempotency).toHaveLength(1);
    });

    it('should auto-approve for medium score user (500-699)', async () => {
      const user = createTestUser(600);
      const command: RequestCardCommand = {
        ecosystemId: 'test-user-123',
        idempotencyKey: 'key-456',
      };
      const { deps, state } = createMockDeps({ user, cards: [] });

      const result = await handleRequestCard(command, deps);

      expect(result.success).toBe(true);
      expect(result.status).toBe('approved');
      expect(result.cardId).toBeDefined();
      expect(result.limit).toBe(5000); // Medium tier limit
      expect(state.savedCards).toHaveLength(1);
      expect(state.savedRequests).toHaveLength(1);
      expect(state.savedEvents).toHaveLength(1);
      expect(state.savedEvents[0]?.eventType).toBe('card.approved');
      expect(state.savedIdempotency).toHaveLength(1);
    });
  });

  describe('pending flow (low score)', () => {
    it('should create pending request for low score user (<500)', async () => {
      const user = createTestUser(400);
      const command: RequestCardCommand = {
        ecosystemId: 'test-user-123',
        idempotencyKey: 'key-789',
      };
      const { deps, state } = createMockDeps({ user, cards: [] });

      const result = await handleRequestCard(command, deps);

      expect(result.success).toBe(true);
      expect(result.status).toBe('pending');
      expect(result.requestId).toBeDefined();
      expect(result.cardId).toBeUndefined();
      expect(result.message).toBeDefined();
      expect(state.savedCards).toHaveLength(0);
      expect(state.savedRequests).toHaveLength(1);
      expect(state.savedRequests[0]?.status).toBe('pending');
      expect(state.savedEvents).toHaveLength(1);
      expect(state.savedEvents[0]?.eventType).toBe('card.requested');
      expect(state.savedIdempotency).toHaveLength(1);
    });
  });

  describe('idempotency handling', () => {
    it('should return cached response for duplicate request', async () => {
      const user = createTestUser(700);
      const existingRecord: IdempotencyRecord = {
        key: 'key-123',
        keyHash: 'hash-123',
        operation: 'request-card',
        statusCode: 200,
        response: {
          status: 'approved',
          requestId: 'cached-request-id',
          limit: 10000,
          cardId: 'cached-card-id',
        },
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 86400000), // 24 hours from now
      };

      const command: RequestCardCommand = {
        ecosystemId: 'test-user-123',
        idempotencyKey: 'key-123',
      };
      const { deps, state } = createMockDeps({ user, idempotencyRecord: existingRecord });

      const result = await handleRequestCard(command, deps);

      expect(result.success).toBe(true);
      expect(result.fromIdempotency).toBe(true);
      expect(result.requestId).toBe('cached-request-id');
      expect(result.cardId).toBe('cached-card-id');
      expect(state.savedCards).toHaveLength(0);
      expect(state.savedRequests).toHaveLength(0);
      expect(state.savedEvents).toHaveLength(0);
      expect(state.savedIdempotency).toHaveLength(0);
    });

    it('should throw IDEMPOTENCY_MISMATCH for key used with different operation', async () => {
      const user = createTestUser(700);
      const existingRecord: IdempotencyRecord = {
        key: 'key-123',
        keyHash: 'hash-123',
        operation: 'make-purchase', // Different operation
        statusCode: 200,
        response: {},
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 86400000),
      };

      const command: RequestCardCommand = {
        ecosystemId: 'test-user-123',
        idempotencyKey: 'key-123',
      };
      const { deps } = createMockDeps({ user, idempotencyRecord: existingRecord });

      await expectRequestCardError(handleRequestCard(command, deps), 'IDEMPOTENCY_MISMATCH');
    });
  });
});
