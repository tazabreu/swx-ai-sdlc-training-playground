/**
 * Cards Endpoints Tests
 *
 * T133: Contract tests for /v1/cards
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'bun:test';
import type { Server } from 'http';
import { createApp } from '../../src/api/app.js';
import {
  createMockContainer,
  createTestUser,
  createTestCard,
  getUserRepo,
  getCardRepo,
  resetMockContainer,
} from './mock-container.js';
import {
  startTestServer,
  stopTestServer,
  createMockAuthHeader,
  generateIdempotencyKey,
} from './test-utils.js';
import type { Container } from '../../src/infrastructure/di/container.js';

describe('Cards Endpoints Contract', () => {
  let server: Server;
  let baseUrl: string;
  let container: Container;

  beforeAll(async () => {
    container = createMockContainer();
    const app = createApp(container);
    const result = await startTestServer(app);
    server = result.server;
    baseUrl = result.baseUrl;
  });

  afterAll(async () => {
    await stopTestServer(server);
  });

  describe('GET /v1/cards', () => {
    const testEcosystemId = 'cards-list-user';

    beforeEach(async () => {
      resetMockContainer(container);
      const userRepo = getUserRepo(container);
      const cardRepo = getCardRepo(container);

      await userRepo.save(
        createTestUser({
          ecosystemId: testEcosystemId,
          cardSummary: { activeCards: 2, totalBalance: 1500, totalLimit: 10000 },
        })
      );

      await cardRepo.save(testEcosystemId, createTestCard({ cardId: 'card-1' }));
      await cardRepo.save(testEcosystemId, createTestCard({ cardId: 'card-2', balance: 500 }));
    });

    it('should return 401 without auth', async () => {
      const response = await fetch(`${baseUrl}/v1/cards`);
      expect(response.status).toBe(401);
    });

    it('should return list of cards', async () => {
      const response = await fetch(`${baseUrl}/v1/cards`, {
        headers: {
          Authorization: createMockAuthHeader(testEcosystemId),
        },
      });

      expect(response.status).toBe(200);

      const body = await response.json();
      expect(body.cards).toBeDefined();
      expect(Array.isArray(body.cards)).toBe(true);
      expect(body.cards.length).toBe(2);
    });

    it('should return cards with required summary fields', async () => {
      const response = await fetch(`${baseUrl}/v1/cards`, {
        headers: {
          Authorization: createMockAuthHeader(testEcosystemId),
        },
      });

      const body = await response.json();
      const card = body.cards[0];

      expect(card.cardId).toBeDefined();
      expect(card.type).toBeDefined();
      expect(card.status).toBeDefined();
      expect(typeof card.limit).toBe('number');
      expect(typeof card.balance).toBe('number');
      expect(typeof card.availableCredit).toBe('number');
      expect(typeof card.minimumPayment).toBe('number');
      expect(typeof card.nearLimit).toBe('boolean');
    });

    it('should return suggestion when no cards exist', async () => {
      const noCardsUserId = 'no-cards-user';
      const userRepo = getUserRepo(container);
      await userRepo.save(createTestUser({ ecosystemId: noCardsUserId }));

      const response = await fetch(`${baseUrl}/v1/cards`, {
        headers: {
          Authorization: createMockAuthHeader(noCardsUserId),
        },
      });

      const body = await response.json();
      expect(body.cards).toHaveLength(0);
      expect(body.suggestion).toBeDefined();
      expect(body.suggestion).toContain('/v1/offers');
    });
  });

  describe('GET /v1/cards/:cardId', () => {
    const testEcosystemId = 'cards-detail-user';
    const testCardId = 'detail-card-123';

    beforeEach(async () => {
      resetMockContainer(container);
      const userRepo = getUserRepo(container);
      const cardRepo = getCardRepo(container);

      await userRepo.save(createTestUser({ ecosystemId: testEcosystemId }));
      await cardRepo.save(
        testEcosystemId,
        createTestCard({
          cardId: testCardId,
          scoreAtApproval: 700,
          approvedBy: 'auto',
        })
      );
    });

    it('should return 401 without auth', async () => {
      const response = await fetch(`${baseUrl}/v1/cards/${testCardId}`);
      expect(response.status).toBe(401);
    });

    it('should return card details', async () => {
      const response = await fetch(`${baseUrl}/v1/cards/${testCardId}`, {
        headers: {
          Authorization: createMockAuthHeader(testEcosystemId),
        },
      });

      expect(response.status).toBe(200);

      const body = await response.json();
      expect(body.card).toBeDefined();
      expect(body.card.cardId).toBe(testCardId);
    });

    it('should include detail-specific fields', async () => {
      const response = await fetch(`${baseUrl}/v1/cards/${testCardId}`, {
        headers: {
          Authorization: createMockAuthHeader(testEcosystemId),
        },
      });

      const body = await response.json();
      const card = body.card;

      // Detail-specific fields not in summary
      expect(card.createdAt).toBeDefined();
      expect(card.approvedBy).toBeDefined();
      expect(typeof card.scoreAtApproval).toBe('number');
    });

    it('should return 404 for non-existent card', async () => {
      const response = await fetch(`${baseUrl}/v1/cards/non-existent-card`, {
        headers: {
          Authorization: createMockAuthHeader(testEcosystemId),
        },
      });

      expect(response.status).toBe(404);

      const body = await response.json();
      expect(body.error.code).toBe('NOT_FOUND');
    });
  });

  describe('POST /v1/cards/requests', () => {
    const testEcosystemId = 'cards-request-user';

    beforeEach(async () => {
      resetMockContainer(container);
      const userRepo = getUserRepo(container);
      await userRepo.save(
        createTestUser({
          ecosystemId: testEcosystemId,
          currentScore: 720,
          tier: 'high',
        })
      );
    });

    it('should return 401 without auth', async () => {
      const response = await fetch(`${baseUrl}/v1/cards/requests`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': generateIdempotencyKey(),
        },
        body: JSON.stringify({ productId: 'prod-standard' }),
      });

      expect(response.status).toBe(401);
    });

    it('should return 400 without idempotency key', async () => {
      const response = await fetch(`${baseUrl}/v1/cards/requests`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: createMockAuthHeader(testEcosystemId),
        },
        body: JSON.stringify({ productId: 'prod-standard' }),
      });

      expect(response.status).toBe(400);

      const body = await response.json();
      expect(body.error.message).toContain('Idempotency-Key');
    });

    it('should return 400 without productId', async () => {
      const response = await fetch(`${baseUrl}/v1/cards/requests`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: createMockAuthHeader(testEcosystemId),
          'Idempotency-Key': generateIdempotencyKey(),
        },
        body: JSON.stringify({}),
      });

      expect(response.status).toBe(400);

      const body = await response.json();
      expect(body.error.message).toContain('productId');
    });

    it('should create card request with valid input', async () => {
      const response = await fetch(`${baseUrl}/v1/cards/requests`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: createMockAuthHeader(testEcosystemId),
          'Idempotency-Key': generateIdempotencyKey(),
        },
        body: JSON.stringify({ productId: 'prod-standard' }),
      });

      expect(response.status).toBe(201);

      const body = await response.json();
      expect(body.request).toBeDefined();
      expect(body.request.requestId).toBeDefined();
      expect(body.request.status).toMatch(/^(pending|approved)$/);
      expect(typeof body.request.scoreAtRequest).toBe('number');
    });

    it('should auto-approve for high score users', async () => {
      const response = await fetch(`${baseUrl}/v1/cards/requests`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: createMockAuthHeader(testEcosystemId),
          'Idempotency-Key': generateIdempotencyKey(),
        },
        body: JSON.stringify({ productId: 'prod-standard' }),
      });

      const body = await response.json();

      // Score 720 should get auto-approved
      expect(body.request.status).toBe('approved');
      expect(body.request.decision).toBeDefined();
      expect(body.request.decision.source).toBe('auto');
      expect(body.request.card).toBeDefined();
    });

    it('should handle idempotent requests', async () => {
      const idempotencyKey = generateIdempotencyKey();

      // First request
      const response1 = await fetch(`${baseUrl}/v1/cards/requests`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: createMockAuthHeader(testEcosystemId),
          'Idempotency-Key': idempotencyKey,
        },
        body: JSON.stringify({ productId: 'prod-standard' }),
      });

      // Second request with same key
      const response2 = await fetch(`${baseUrl}/v1/cards/requests`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: createMockAuthHeader(testEcosystemId),
          'Idempotency-Key': idempotencyKey,
        },
        body: JSON.stringify({ productId: 'prod-standard' }),
      });

      const body1 = await response1.json();
      const body2 = await response2.json();

      // Should return same response
      expect(body1.request.requestId).toBe(body2.request.requestId);
    });
  });

  describe('GET /v1/cards/requests/:requestId', () => {
    const testEcosystemId = 'get-request-user';

    beforeEach(async () => {
      resetMockContainer(container);
      const userRepo = getUserRepo(container);
      await userRepo.save(
        createTestUser({
          ecosystemId: testEcosystemId,
          currentScore: 720,
          tier: 'high',
        })
      );
    });

    it('should return 401 without auth', async () => {
      const response = await fetch(`${baseUrl}/v1/cards/requests/some-request-id`);
      expect(response.status).toBe(401);
    });

    it('should return 404 for non-existent request', async () => {
      const response = await fetch(`${baseUrl}/v1/cards/requests/non-existent-id`, {
        headers: {
          Authorization: createMockAuthHeader(testEcosystemId),
        },
      });

      expect(response.status).toBe(404);

      const body = await response.json();
      expect(body.error.code).toBe('NOT_FOUND');
    });

    it('should return request details after creating a request', async () => {
      // First create a request
      const createResponse = await fetch(`${baseUrl}/v1/cards/requests`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: createMockAuthHeader(testEcosystemId),
          'Idempotency-Key': generateIdempotencyKey(),
        },
        body: JSON.stringify({ productId: 'prod-standard' }),
      });

      const createBody = await createResponse.json();
      const requestId = createBody.request.requestId;

      // Then fetch the request
      const getResponse = await fetch(`${baseUrl}/v1/cards/requests/${requestId}`, {
        headers: {
          Authorization: createMockAuthHeader(testEcosystemId),
        },
      });

      expect(getResponse.status).toBe(200);

      const getBody = await getResponse.json();
      expect(getBody.request).toBeDefined();
      expect(getBody.request.requestId).toBe(requestId);
      expect(getBody.request.status).toMatch(/^(pending|approved)$/);
    });
  });
});
