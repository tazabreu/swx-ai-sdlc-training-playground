/**
 * Transactions Endpoints Tests
 *
 * T134: Contract tests for /v1/cards/:cardId/transactions
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

describe('Transactions Endpoints Contract', () => {
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

  describe('POST /v1/cards/:cardId/transactions/purchases', () => {
    const testEcosystemId = 'purchase-user';
    const testCardId = 'purchase-card-123';

    beforeEach(async () => {
      resetMockContainer(container);
      const userRepo = getUserRepo(container);
      const cardRepo = getCardRepo(container);

      await userRepo.save(createTestUser({ ecosystemId: testEcosystemId }));
      await cardRepo.save(
        testEcosystemId,
        createTestCard({
          cardId: testCardId,
          limit: 5000,
          balance: 1000,
          availableCredit: 4000,
          status: 'active',
        })
      );
    });

    it('should return 401 without auth', async () => {
      const response = await fetch(`${baseUrl}/v1/cards/${testCardId}/transactions/purchases`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': generateIdempotencyKey(),
        },
        body: JSON.stringify({ amount: 100 }),
      });

      expect(response.status).toBe(401);
    });

    it('should return 400 without idempotency key', async () => {
      const response = await fetch(`${baseUrl}/v1/cards/${testCardId}/transactions/purchases`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: createMockAuthHeader(testEcosystemId),
        },
        body: JSON.stringify({ amount: 100 }),
      });

      expect(response.status).toBe(400);

      const body = await response.json();
      expect(body.error.message).toContain('Idempotency-Key');
    });

    it('should return 400 for invalid amount', async () => {
      const response = await fetch(`${baseUrl}/v1/cards/${testCardId}/transactions/purchases`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: createMockAuthHeader(testEcosystemId),
          'Idempotency-Key': generateIdempotencyKey(),
        },
        body: JSON.stringify({ amount: -100 }),
      });

      expect(response.status).toBe(400);

      const body = await response.json();
      expect(body.error.message).toContain('amount');
    });

    it('should create purchase transaction', async () => {
      const response = await fetch(`${baseUrl}/v1/cards/${testCardId}/transactions/purchases`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: createMockAuthHeader(testEcosystemId),
          'Idempotency-Key': generateIdempotencyKey(),
        },
        body: JSON.stringify({ amount: 100, merchant: 'Test Store' }),
      });

      expect(response.status).toBe(201);

      const body = await response.json();
      expect(body.transaction).toBeDefined();
      expect(body.transaction.transactionId).toBeDefined();
      expect(body.transaction.type).toBe('purchase');
      expect(body.transaction.amount).toBe(100);
      expect(body.transaction.status).toBe('completed');
      expect(body.transaction.merchant).toBe('Test Store');

      expect(body.card).toBeDefined();
      expect(body.card.cardId).toBe(testCardId);
    });

    it('should return 402 for insufficient credit', async () => {
      const response = await fetch(`${baseUrl}/v1/cards/${testCardId}/transactions/purchases`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: createMockAuthHeader(testEcosystemId),
          'Idempotency-Key': generateIdempotencyKey(),
        },
        body: JSON.stringify({ amount: 5000 }), // More than available credit
      });

      expect(response.status).toBe(402);

      const body = await response.json();
      expect(body.error.code).toBe('INSUFFICIENT_CREDIT');
    });

    it('should return 404 for non-existent card', async () => {
      const response = await fetch(`${baseUrl}/v1/cards/non-existent-card/transactions/purchases`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: createMockAuthHeader(testEcosystemId),
          'Idempotency-Key': generateIdempotencyKey(),
        },
        body: JSON.stringify({ amount: 100 }),
      });

      expect(response.status).toBe(404);
    });
  });

  describe('POST /v1/cards/:cardId/transactions/payments', () => {
    const testEcosystemId = 'payment-user';
    const testCardId = 'payment-card-123';

    beforeEach(async () => {
      resetMockContainer(container);
      const userRepo = getUserRepo(container);
      const cardRepo = getCardRepo(container);

      await userRepo.save(
        createTestUser({
          ecosystemId: testEcosystemId,
          currentScore: 650,
        })
      );
      await cardRepo.save(
        testEcosystemId,
        createTestCard({
          cardId: testCardId,
          balance: 1000,
          minimumPayment: 50,
        })
      );
    });

    it('should return 401 without auth', async () => {
      const response = await fetch(`${baseUrl}/v1/cards/${testCardId}/transactions/payments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': generateIdempotencyKey(),
        },
        body: JSON.stringify({ amount: 100 }),
      });

      expect(response.status).toBe(401);
    });

    it('should create payment transaction', async () => {
      const response = await fetch(`${baseUrl}/v1/cards/${testCardId}/transactions/payments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: createMockAuthHeader(testEcosystemId),
          'Idempotency-Key': generateIdempotencyKey(),
        },
        body: JSON.stringify({ amount: 200 }),
      });

      expect(response.status).toBe(201);

      const body = await response.json();
      expect(body.transaction).toBeDefined();
      expect(body.transaction.type).toBe('payment');
      expect(body.transaction.amount).toBe(200);
      expect(body.transaction.paymentStatus).toMatch(/^(on_time|late)$/);

      expect(body.card).toBeDefined();
      expect(body.scoreImpact).toBeDefined();
      expect(typeof body.scoreImpact.previousScore).toBe('number');
      expect(typeof body.scoreImpact.newScore).toBe('number');
      expect(typeof body.scoreImpact.delta).toBe('number');
    });

    it('should return 400 for payment exceeding balance', async () => {
      const response = await fetch(`${baseUrl}/v1/cards/${testCardId}/transactions/payments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: createMockAuthHeader(testEcosystemId),
          'Idempotency-Key': generateIdempotencyKey(),
        },
        body: JSON.stringify({ amount: 2000 }), // More than balance
      });

      expect(response.status).toBe(400);

      const body = await response.json();
      expect(body.error.message).toContain('balance');
    });
  });

  describe('GET /v1/cards/:cardId/transactions', () => {
    const testEcosystemId = 'tx-list-user';
    const testCardId = 'tx-list-card-123';

    beforeEach(async () => {
      resetMockContainer(container);
      const userRepo = getUserRepo(container);
      const cardRepo = getCardRepo(container);

      await userRepo.save(createTestUser({ ecosystemId: testEcosystemId }));
      await cardRepo.save(testEcosystemId, createTestCard({ cardId: testCardId }));
    });

    it('should return 401 without auth', async () => {
      const response = await fetch(`${baseUrl}/v1/cards/${testCardId}/transactions`);
      expect(response.status).toBe(401);
    });

    it('should return transaction list', async () => {
      const response = await fetch(`${baseUrl}/v1/cards/${testCardId}/transactions`, {
        headers: {
          Authorization: createMockAuthHeader(testEcosystemId),
        },
      });

      expect(response.status).toBe(200);

      const body = await response.json();
      expect(body.transactions).toBeDefined();
      expect(Array.isArray(body.transactions)).toBe(true);
      expect(body.pagination).toBeDefined();
      expect(typeof body.pagination.hasMore).toBe('boolean');
    });

    it('should support type filter', async () => {
      const response = await fetch(`${baseUrl}/v1/cards/${testCardId}/transactions?type=purchase`, {
        headers: {
          Authorization: createMockAuthHeader(testEcosystemId),
        },
      });

      expect(response.status).toBe(200);
    });

    it('should return 404 for non-existent card', async () => {
      const response = await fetch(`${baseUrl}/v1/cards/non-existent/transactions`, {
        headers: {
          Authorization: createMockAuthHeader(testEcosystemId),
        },
      });

      expect(response.status).toBe(404);
    });
  });
});
