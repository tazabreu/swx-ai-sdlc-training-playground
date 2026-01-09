/**
 * Transaction Flow - Functional Tests
 *
 * Tests complete transaction flows: purchases and payments.
 * Validates credit limit management and score impacts.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'bun:test';
import type { Server } from 'http';
import { createApp } from '../../src/api/app';
import {
  createMockContainer,
  createTestUser,
  createTestCard,
  getUserRepo,
  getCardRepo,
  resetMockContainer,
} from '../contract/mock-container';
import { startTestServer, stopTestServer, createMockAuthHeader } from '../contract/test-utils';
import type { Container } from '../../src/infrastructure/di/container';

/**
 * Generate unique idempotency key
 */
function idempotencyKey(): string {
  return `tx-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

describe('Transaction Flow', () => {
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

  beforeEach(() => {
    resetMockContainer(container);
  });

  describe('Complete Purchase to Payment Cycle', () => {
    it('should handle full cycle: purchase → balance increase → payment → score improvement', async () => {
      const ecosystemId = 'tx-user-1';
      const cardId = 'tx-card-1';
      const initialScore = 650;

      // Step 1: Setup user with active card
      const userRepo = getUserRepo(container);
      const cardRepo = getCardRepo(container);

      await userRepo.save(
        createTestUser({
          ecosystemId,
          currentScore: initialScore,
          tier: 'medium',
          cardSummary: { activeCards: 1, totalBalance: 0, totalLimit: 3000 },
        })
      );

      await cardRepo.save(
        ecosystemId,
        createTestCard({
          cardId,
          limit: 3000,
          balance: 0,
        })
      );

      // Step 2: Make a purchase (uses /transactions/purchases route)
      const purchaseResponse = await fetch(`${baseUrl}/v1/cards/${cardId}/transactions/purchases`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: createMockAuthHeader(ecosystemId),
          'Idempotency-Key': idempotencyKey(),
        },
        body: JSON.stringify({
          amount: 500,
          merchant: 'Electronics Store',
        }),
      });

      expect(purchaseResponse.status).toBe(201);
      const purchaseBody = await purchaseResponse.json();

      expect(purchaseBody.transaction).toBeDefined();
      expect(purchaseBody.transaction.type).toBe('purchase');
      expect(purchaseBody.transaction.amount).toBe(500);
      expect(purchaseBody.transaction.status).toBe('completed');

      // Verify card balance updated
      const cardAfterPurchase = await fetch(`${baseUrl}/v1/cards/${cardId}`, {
        headers: {
          Authorization: createMockAuthHeader(ecosystemId),
        },
      });
      const cardData = await cardAfterPurchase.json();
      expect(cardData.card.balance).toBe(500);
      expect(cardData.card.availableCredit).toBe(2500);

      // Step 3: Make a payment (uses /transactions/payments route)
      const paymentResponse = await fetch(`${baseUrl}/v1/cards/${cardId}/transactions/payments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: createMockAuthHeader(ecosystemId),
          'Idempotency-Key': idempotencyKey(),
        },
        body: JSON.stringify({
          amount: 500,
        }),
      });

      expect(paymentResponse.status).toBe(201);
      const paymentBody = await paymentResponse.json();

      expect(paymentBody.transaction).toBeDefined();
      expect(paymentBody.transaction.type).toBe('payment');
      expect(paymentBody.transaction.amount).toBe(500);
      expect(paymentBody.transaction.status).toBe('completed');

      // Verify balance cleared
      const cardAfterPayment = await fetch(`${baseUrl}/v1/cards/${cardId}`, {
        headers: {
          Authorization: createMockAuthHeader(ecosystemId),
        },
      });
      const finalCardData = await cardAfterPayment.json();
      expect(finalCardData.card.balance).toBe(0);
      expect(finalCardData.card.availableCredit).toBe(3000);

      // Step 4: Verify score impact info in payment response
      expect(paymentBody.scoreImpact).toBeDefined();
      expect(paymentBody.scoreImpact.previousScore).toBe(initialScore);
    });

    it('should reject purchase exceeding available credit', async () => {
      const ecosystemId = 'tx-user-2';
      const cardId = 'tx-card-2';

      // Setup user with low limit card
      const userRepo = getUserRepo(container);
      const cardRepo = getCardRepo(container);

      await userRepo.save(
        createTestUser({
          ecosystemId,
          currentScore: 500,
          tier: 'low',
        })
      );

      await cardRepo.save(
        ecosystemId,
        createTestCard({
          cardId,
          limit: 500,
          balance: 0,
        })
      );

      // Try to make purchase exceeding limit
      const purchaseResponse = await fetch(`${baseUrl}/v1/cards/${cardId}/transactions/purchases`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: createMockAuthHeader(ecosystemId),
          'Idempotency-Key': idempotencyKey(),
        },
        body: JSON.stringify({
          amount: 600, // Exceeds 500 limit
          merchant: 'Big Purchase',
        }),
      });

      // API returns 402 Payment Required for insufficient credit
      expect(purchaseResponse.status).toBe(402);
      const errorBody = await purchaseResponse.json();
      expect(errorBody.error.code).toBe('INSUFFICIENT_CREDIT');
    });

    it('should reject overpayment exceeding balance', async () => {
      const ecosystemId = 'tx-user-3';
      const cardId = 'tx-card-3';

      // Setup user with card that has balance
      const userRepo = getUserRepo(container);
      const cardRepo = getCardRepo(container);

      await userRepo.save(
        createTestUser({
          ecosystemId,
          currentScore: 600,
          tier: 'medium',
        })
      );

      await cardRepo.save(
        ecosystemId,
        createTestCard({
          cardId,
          limit: 2000,
          balance: 100, // Current balance
        })
      );

      // Try to pay more than owed
      const paymentResponse = await fetch(`${baseUrl}/v1/cards/${cardId}/transactions/payments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: createMockAuthHeader(ecosystemId),
          'Idempotency-Key': idempotencyKey(),
        },
        body: JSON.stringify({
          amount: 200, // More than 100 balance
        }),
      });

      expect(paymentResponse.status).toBe(400);
      const errorBody = await paymentResponse.json();
      expect(errorBody.error).toBeDefined();
    });
  });

  describe('Transaction History Flow', () => {
    it('should list transactions with proper ordering', async () => {
      const ecosystemId = 'tx-history-user';
      const cardId = 'tx-history-card';

      // Setup user with card
      const userRepo = getUserRepo(container);
      const cardRepo = getCardRepo(container);

      await userRepo.save(
        createTestUser({
          ecosystemId,
          currentScore: 700,
          tier: 'high',
        })
      );

      await cardRepo.save(
        ecosystemId,
        createTestCard({
          cardId,
          limit: 5000,
          balance: 0,
        })
      );

      // Make multiple transactions
      for (let i = 0; i < 3; i++) {
        await fetch(`${baseUrl}/v1/cards/${cardId}/transactions/purchases`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: createMockAuthHeader(ecosystemId),
            'Idempotency-Key': idempotencyKey(),
          },
          body: JSON.stringify({
            amount: 100 + i * 50,
            merchant: `Store ${i + 1}`,
          }),
        });
      }

      // Fetch transaction history
      const historyResponse = await fetch(`${baseUrl}/v1/cards/${cardId}/transactions`, {
        headers: {
          Authorization: createMockAuthHeader(ecosystemId),
        },
      });

      expect(historyResponse.status).toBe(200);
      const historyBody = await historyResponse.json();

      expect(historyBody.transactions).toBeDefined();
      expect(Array.isArray(historyBody.transactions)).toBe(true);
      expect(historyBody.transactions.length).toBe(3);
    });
  });

  describe('Near Limit Warning Flow', () => {
    it('should flag card as near limit when over 90% utilization', async () => {
      const ecosystemId = 'near-limit-user';
      const cardId = 'near-limit-card';

      // Setup user with card
      const userRepo = getUserRepo(container);
      const cardRepo = getCardRepo(container);

      await userRepo.save(
        createTestUser({
          ecosystemId,
          currentScore: 600,
          tier: 'medium',
        })
      );

      await cardRepo.save(
        ecosystemId,
        createTestCard({
          cardId,
          limit: 1000,
          balance: 0,
        })
      );

      // Make purchase that brings balance to 95% of limit (near limit is > 90%)
      await fetch(`${baseUrl}/v1/cards/${cardId}/transactions/purchases`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: createMockAuthHeader(ecosystemId),
          'Idempotency-Key': idempotencyKey(),
        },
        body: JSON.stringify({
          amount: 950, // 95% of 1000 limit
          merchant: 'Large Purchase',
        }),
      });

      // Check card status
      const cardResponse = await fetch(`${baseUrl}/v1/cards/${cardId}`, {
        headers: {
          Authorization: createMockAuthHeader(ecosystemId),
        },
      });

      const cardBody = await cardResponse.json();

      // Should be flagged as near limit (>90% utilization)
      expect(cardBody.card.nearLimit).toBe(true);
      expect(cardBody.card.balance).toBe(950);
      expect(cardBody.card.availableCredit).toBe(50);
    });
  });

  describe('Idempotency Flow', () => {
    it('should handle duplicate transactions gracefully', async () => {
      const ecosystemId = 'idempotent-user';
      const cardId = 'idempotent-card';
      const sharedKey = idempotencyKey();

      // Setup user with card
      const userRepo = getUserRepo(container);
      const cardRepo = getCardRepo(container);

      await userRepo.save(
        createTestUser({
          ecosystemId,
          currentScore: 650,
          tier: 'medium',
        })
      );

      await cardRepo.save(
        ecosystemId,
        createTestCard({
          cardId,
          limit: 2000,
          balance: 0,
        })
      );

      // Make first purchase
      const response1 = await fetch(`${baseUrl}/v1/cards/${cardId}/transactions/purchases`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: createMockAuthHeader(ecosystemId),
          'Idempotency-Key': sharedKey,
        },
        body: JSON.stringify({
          amount: 300,
          merchant: 'Test Store',
        }),
      });

      expect(response1.status).toBe(201);
      const body1 = await response1.json();

      // Make duplicate with same idempotency key
      const response2 = await fetch(`${baseUrl}/v1/cards/${cardId}/transactions/purchases`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: createMockAuthHeader(ecosystemId),
          'Idempotency-Key': sharedKey,
        },
        body: JSON.stringify({
          amount: 300,
          merchant: 'Test Store',
        }),
      });

      // Should return 200 (from idempotency cache) not 201
      expect(response2.status).toBe(200);
      const body2 = await response2.json();

      // Should return same transaction, not create duplicate
      expect(body1.transaction.transactionId).toBe(body2.transaction.transactionId);

      // Verify balance only increased once
      const cardResponse = await fetch(`${baseUrl}/v1/cards/${cardId}`, {
        headers: {
          Authorization: createMockAuthHeader(ecosystemId),
        },
      });

      const cardBody = await cardResponse.json();
      expect(cardBody.card.balance).toBe(300); // Not 600
    });
  });
});
