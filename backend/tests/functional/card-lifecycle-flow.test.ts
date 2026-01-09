/**
 * Card Lifecycle Flow - Functional Tests
 *
 * Tests complete card lifecycle from request through approval.
 * Demonstrates end-to-end flows through the Financial API.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'bun:test';
import type { Server } from 'http';
import { createApp } from '../../src/api/app';
import {
  createMockContainer,
  createTestUser,
  getUserRepo,
  resetMockContainer,
} from '../contract/mock-container';
import { startTestServer, stopTestServer, createMockAuthHeader } from '../contract/test-utils';
import type { Container } from '../../src/infrastructure/di/container';

/**
 * Generate unique idempotency key for test requests
 */
function idempotencyKey(): string {
  return `functional-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

describe('Card Lifecycle Flow', () => {
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

  describe('Complete Card Request Flow', () => {
    it('should auto-approve high-tier user: request → approve → view card', async () => {
      const ecosystemId = 'lifecycle-user-1';

      // Step 1: Create user with high score (auto-approve eligible)
      const userRepo = getUserRepo(container);
      await userRepo.save(
        createTestUser({
          ecosystemId,
          currentScore: 750,
          tier: 'high',
        })
      );

      // Step 2: Request a credit card
      const requestResponse = await fetch(`${baseUrl}/v1/cards/requests`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: createMockAuthHeader(ecosystemId),
          'Idempotency-Key': idempotencyKey(),
        },
        body: JSON.stringify({ productId: 'prod-standard' }),
      });

      expect(requestResponse.status).toBe(201);
      const requestBody = await requestResponse.json();

      // Verify auto-approval for high-tier user
      expect(requestBody.request.status).toBe('approved');
      expect(requestBody.request.decision.source).toBe('auto');
      expect(requestBody.request.card).toBeDefined();

      const cardId = requestBody.request.card.cardId;

      // Step 3: View the approved card
      const cardResponse = await fetch(`${baseUrl}/v1/cards/${cardId}`, {
        headers: {
          Authorization: createMockAuthHeader(ecosystemId),
        },
      });

      expect(cardResponse.status).toBe(200);
      const cardBody = await cardResponse.json();

      expect(cardBody.card.cardId).toBe(cardId);
      expect(cardBody.card.status).toBe('active');
      expect(cardBody.card.limit).toBeGreaterThan(0);
      expect(cardBody.card.balance).toBe(0);
    });

    it('should require admin approval for low-tier user', async () => {
      const userEcosystemId = 'lifecycle-user-2';
      const adminEcosystemId = 'admin-user-1';

      // Step 1: Create regular user with low score
      const userRepo = getUserRepo(container);
      await userRepo.save(
        createTestUser({
          ecosystemId: userEcosystemId,
          currentScore: 450,
          tier: 'low',
        })
      );

      // Create admin user for approval
      await userRepo.save(
        createTestUser({
          ecosystemId: adminEcosystemId,
          role: 'admin',
        })
      );

      // Step 2: Request a credit card
      const requestResponse = await fetch(`${baseUrl}/v1/cards/requests`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: createMockAuthHeader(userEcosystemId),
          'Idempotency-Key': idempotencyKey(),
        },
        body: JSON.stringify({ productId: 'prod-standard' }),
      });

      expect(requestResponse.status).toBe(201);
      const requestBody = await requestResponse.json();

      // Verify pending status for low-tier user
      expect(requestBody.request.status).toBe('pending');
      const requestId = requestBody.request.requestId;

      // Step 3: Admin views pending requests
      const pendingResponse = await fetch(`${baseUrl}/v1/admin/card-requests`, {
        headers: {
          Authorization: createMockAuthHeader(adminEcosystemId, 'admin'),
        },
      });

      expect(pendingResponse.status).toBe(200);
      const pendingBody = await pendingResponse.json();

      // Verify the request appears in pending list
      const foundRequest = pendingBody.requests.find(
        (r: { requestId: string }) => r.requestId === requestId
      );
      expect(foundRequest).toBeDefined();
      expect(foundRequest.status).toBe('pending');
    });
  });

  describe('Dashboard Flow', () => {
    it('should show user score and tier on dashboard', async () => {
      const ecosystemId = 'dashboard-user-1';

      // Create user with score
      const userRepo = getUserRepo(container);
      await userRepo.save(
        createTestUser({
          ecosystemId,
          currentScore: 650,
          tier: 'medium',
        })
      );

      // View dashboard
      const dashboardResponse = await fetch(`${baseUrl}/v1/dashboard`, {
        headers: {
          Authorization: createMockAuthHeader(ecosystemId),
        },
      });

      expect(dashboardResponse.status).toBe(200);
      const dashboardBody = await dashboardResponse.json();

      expect(dashboardBody.user).toBeDefined();
      expect(dashboardBody.user.score).toBe(650);
      expect(dashboardBody.user.tier).toBe('medium');
      expect(dashboardBody.cards).toBeDefined();
      expect(Array.isArray(dashboardBody.cards)).toBe(true);
    });
  });

  describe('Offers Flow', () => {
    it('should show offers based on user tier', async () => {
      const ecosystemId = 'offers-user-1';

      // Create user
      const userRepo = getUserRepo(container);
      await userRepo.save(
        createTestUser({
          ecosystemId,
          currentScore: 800,
          tier: 'high',
        })
      );

      // Get offers
      const offersResponse = await fetch(`${baseUrl}/v1/offers`, {
        headers: {
          Authorization: createMockAuthHeader(ecosystemId),
        },
      });

      expect(offersResponse.status).toBe(200);
      const offersBody = await offersResponse.json();

      expect(offersBody.offers).toBeDefined();
      expect(Array.isArray(offersBody.offers)).toBe(true);
      expect(offersBody.offers.length).toBeGreaterThan(0);

      // Verify offers have required fields
      offersBody.offers.forEach((offer: { productId?: string; name?: string; limit?: number }) => {
        expect(offer.productId).toBeDefined();
        expect(offer.name).toBeDefined();
      });
    });
  });
});
