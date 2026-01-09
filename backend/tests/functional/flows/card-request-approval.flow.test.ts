/**
 * Card Request Approval Flow - Functional Test
 *
 * Tests the complete end-to-end flow of card request and approval using
 * the actual handlers with in-memory repositories.
 */

import { describe, it, expect, beforeEach } from 'bun:test';
import {
  handleRequestCard,
  type RequestCardHandlerDeps,
} from '../../../src/application/handlers/request-card.handler';
import type { User, UserTier } from '../../../src/domain/entities/user.entity';
import type { Card } from '../../../src/domain/entities/card.entity';
import type { CardRequest } from '../../../src/domain/entities/card-request.entity';
import type { Event } from '../../../src/domain/entities/event.entity';
import type { IdempotencyRecord } from '../../../src/domain/entities/idempotency-record.entity';

interface FlowStore {
  users: Map<string, User>;
  cards: Map<string, Card>;
  cardRequests: Map<string, CardRequest>;
  events: Event[];
  idempotency: Map<string, IdempotencyRecord>;
}

function createFlowStore(): FlowStore {
  return {
    users: new Map(),
    cards: new Map(),
    cardRequests: new Map(),
    events: [],
    idempotency: new Map(),
  };
}

function createTestUser(ecosystemId: string, score: number): User {
  const tier: UserTier = score >= 700 ? 'high' : score >= 500 ? 'medium' : 'low';
  return {
    ecosystemId,
    firebaseUid: `firebase-${ecosystemId}`,
    email: `${ecosystemId}@example.com`,
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

describe('Card Request Approval Flow', () => {
  let store: FlowStore;

  beforeEach(() => {
    store = createFlowStore();
  });

  function createRequestCardDeps(userId: string): RequestCardHandlerDeps {
    return {
      userRepository: {
        findById: async (id) => store.users.get(id) ?? null,
        findBySlug: async () => null,
        findByFirebaseUid: async () => null,
        save: async () => {},
        updateScore: async () => {},
        updateCardSummary: async (id, summary) => {
          const u = store.users.get(id);
          if (u) u.cardSummary = summary;
        },
        deleteAll: async () => 0,
      },
      cardRepository: {
        findById: async () => null,
        findByUser: async (id) =>
          Array.from(store.cards.values()).filter(
            (c) => (c as Card & { ecosystemId?: string }).ecosystemId === id
          ),
        save: async (ecosystemId, card) => {
          store.cards.set(card.cardId, { ...card, ecosystemId } as Card & {
            ecosystemId: string;
          });
        },
        updateBalance: async () => {},
        updateStatus: async () => {},
      },
      cardRequestRepository: {
        findById: async (_ecosystemId, requestId) => store.cardRequests.get(requestId) ?? null,
        findPendingByUser: async (uid) =>
          Array.from(store.cardRequests.values()).find(
            (r) => r.status === 'pending' && uid === userId
          ) ?? null,
        findRejectedByUser: async () => [],
        findPendingForAdmin: async () => [],
        findAllPending: async () => ({ requests: [], nextCursor: null, hasMore: false }),
        save: async (_ecosystemId, req) => {
          store.cardRequests.set(req.requestId, req);
        },
        updateStatus: async () => {},
        updateDecision: async () => {},
      },
      idempotencyRepository: {
        find: async (uid, keyHash) => {
          const key = `${uid}:${keyHash}`;
          return store.idempotency.get(key) ?? null;
        },
        save: async (uid, record) => {
          const key = `${uid}:${record.keyHash}`;
          store.idempotency.set(key, record);
        },
        cleanup: async () => 0,
      },
      outboxRepository: {
        save: async (event) => {
          store.events.push(event);
        },
        findPending: async () => [],
        markPublished: async () => {},
        deleteOld: async () => 0,
      },
    };
  }

  describe('Low Tier User Flow (Pending)', () => {
    it('should create pending request for low-tier user (score 400 < 700 threshold)', async () => {
      const user = createTestUser('user-low-tier', 400);
      store.users.set(user.ecosystemId, user);

      const requestResult = await handleRequestCard(
        {
          ecosystemId: user.ecosystemId,
          idempotencyKey: 'req-001',
        },
        createRequestCardDeps(user.ecosystemId)
      );

      expect(requestResult.success).toBe(true);
      expect(requestResult.status).toBe('pending');
      expect(requestResult.requestId).toBeDefined();

      // Verify request was stored
      const storedRequest = store.cardRequests.get(requestResult.requestId!);
      expect(storedRequest).toBeDefined();
      expect(storedRequest?.status).toBe('pending');
      expect(storedRequest?.tierAtRequest).toBe('low');

      // Verify card was NOT created (pending)
      expect(store.cards.size).toBe(0);
    });

    it('should emit card.requested event for pending request', async () => {
      const user = createTestUser('user-event', 400);
      store.users.set(user.ecosystemId, user);

      await handleRequestCard(
        {
          ecosystemId: user.ecosystemId,
          idempotencyKey: 'req-event',
        },
        createRequestCardDeps(user.ecosystemId)
      );

      // Verify event was emitted
      expect(store.events.length).toBe(1);
      expect(store.events[0].eventType).toBe('card.requested');
    });
  });

  describe('High Tier User Flow (Auto-Approval)', () => {
    it('should auto-approve for high-tier user (score 750 >= 700 threshold)', async () => {
      const user = createTestUser('user-high-tier', 750);
      store.users.set(user.ecosystemId, user);

      const requestResult = await handleRequestCard(
        {
          ecosystemId: user.ecosystemId,
          idempotencyKey: 'req-auto-001',
        },
        createRequestCardDeps(user.ecosystemId)
      );

      expect(requestResult.success).toBe(true);
      expect(requestResult.status).toBe('approved');
      expect(requestResult.cardId).toBeDefined();
      expect(requestResult.limit).toBeDefined();

      // Verify card was created immediately
      expect(store.cards.size).toBe(1);
      const card = Array.from(store.cards.values())[0];
      expect(card.status).toBe('active');
    });

    it('should emit card.approved event for auto-approval', async () => {
      const user = createTestUser('user-auto-event', 750);
      store.users.set(user.ecosystemId, user);

      await handleRequestCard(
        {
          ecosystemId: user.ecosystemId,
          idempotencyKey: 'req-auto-event',
        },
        createRequestCardDeps(user.ecosystemId)
      );

      // Verify event was emitted
      expect(store.events.length).toBe(1);
      expect(store.events[0].eventType).toBe('card.approved');
    });
  });

  describe('Idempotency', () => {
    it('should return cached result for duplicate requests', async () => {
      const user = createTestUser('user-idem', 750);
      store.users.set(user.ecosystemId, user);

      const deps = createRequestCardDeps(user.ecosystemId);

      // First request
      const result1 = await handleRequestCard(
        { ecosystemId: user.ecosystemId, idempotencyKey: 'same-key' },
        deps
      );
      expect(result1.success).toBe(true);
      expect(result1.fromIdempotency).toBeUndefined();

      // Second request with same key - should return cached
      const result2 = await handleRequestCard(
        { ecosystemId: user.ecosystemId, idempotencyKey: 'same-key' },
        deps
      );
      expect(result2.success).toBe(true);
      expect(result2.fromIdempotency).toBe(true);
      expect(result2.requestId).toBe(result1.requestId);
    });

    it('should block second request while first is pending', async () => {
      const user = createTestUser('user-block', 400);
      store.users.set(user.ecosystemId, user);

      const deps = createRequestCardDeps(user.ecosystemId);

      // First request - pending
      const result1 = await handleRequestCard(
        { ecosystemId: user.ecosystemId, idempotencyKey: 'key-1' },
        deps
      );
      expect(result1.success).toBe(true);
      expect(result1.status).toBe('pending');

      // Second request with different key - should be blocked
      try {
        await handleRequestCard({ ecosystemId: user.ecosystemId, idempotencyKey: 'key-2' }, deps);
        expect(true).toBe(false);
      } catch (error) {
        expect((error as Error).message).toContain('pending');
      }
    });
  });

  describe('Score Tier Boundaries', () => {
    it('should pending for score 499 (below 500 threshold)', async () => {
      const user = createTestUser('user-499', 499);
      store.users.set(user.ecosystemId, user);

      const result = await handleRequestCard(
        { ecosystemId: user.ecosystemId, idempotencyKey: 'key-499' },
        createRequestCardDeps(user.ecosystemId)
      );

      expect(result.success).toBe(true);
      expect(result.status).toBe('pending');
    });

    it('should auto-approve for score 500 (exactly at medium threshold)', async () => {
      const user = createTestUser('user-500', 500);
      store.users.set(user.ecosystemId, user);

      const result = await handleRequestCard(
        { ecosystemId: user.ecosystemId, idempotencyKey: 'key-500' },
        createRequestCardDeps(user.ecosystemId)
      );

      expect(result.success).toBe(true);
      expect(result.status).toBe('approved');
    });

    it('should auto-approve for score 700 (high tier threshold)', async () => {
      const user = createTestUser('user-700', 700);
      store.users.set(user.ecosystemId, user);

      const result = await handleRequestCard(
        { ecosystemId: user.ecosystemId, idempotencyKey: 'key-700' },
        createRequestCardDeps(user.ecosystemId)
      );

      expect(result.success).toBe(true);
      expect(result.status).toBe('approved');
    });
  });
});
