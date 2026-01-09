/**
 * Admin Approval Flow - Functional Tests
 *
 * Tests complete admin workflows for card request management.
 * Demonstrates admin approval and rejection flows.
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
 * Generate unique idempotency key
 */
function idempotencyKey(): string {
  return `admin-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

describe('Admin Approval Flow', () => {
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

  describe('Admin Card Request Management', () => {
    it('should allow admin to approve pending request and create card', async () => {
      const userEcosystemId = 'approval-user-1';
      const adminEcosystemId = 'approval-admin-1';

      // Step 1: Setup user with low score (requires admin approval)
      const userRepo = getUserRepo(container);
      await userRepo.save(
        createTestUser({
          ecosystemId: userEcosystemId,
          currentScore: 400,
          tier: 'low',
        })
      );

      // Create admin user
      await userRepo.save(
        createTestUser({
          ecosystemId: adminEcosystemId,
          role: 'admin',
        })
      );

      // Step 2: User requests card (should go to pending)
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
      expect(requestBody.request.status).toBe('pending');
      const requestId = requestBody.request.requestId;

      // Step 3: Admin fetches pending requests
      const pendingResponse = await fetch(`${baseUrl}/v1/admin/card-requests`, {
        headers: {
          Authorization: createMockAuthHeader(adminEcosystemId, 'admin'),
        },
      });

      expect(pendingResponse.status).toBe(200);
      const pendingBody = await pendingResponse.json();
      expect(
        pendingBody.requests.some((r: { requestId: string }) => r.requestId === requestId)
      ).toBe(true);

      // Step 4: Admin approves the request
      const approveResponse = await fetch(
        `${baseUrl}/v1/admin/card-requests/${requestId}/approve`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: createMockAuthHeader(adminEcosystemId, 'admin'),
            'Idempotency-Key': idempotencyKey(),
          },
          body: JSON.stringify({ creditLimit: 500 }),
        }
      );

      expect(approveResponse.status).toBe(200);
      const approveBody = await approveResponse.json();
      expect(approveBody.request.status).toBe('approved');
      expect(approveBody.card).toBeDefined(); // card is at top level

      const cardId = approveBody.card.cardId;

      // Step 5: User can now view their new card
      const cardResponse = await fetch(`${baseUrl}/v1/cards/${cardId}`, {
        headers: {
          Authorization: createMockAuthHeader(userEcosystemId),
        },
      });

      expect(cardResponse.status).toBe(200);
      const cardBody = await cardResponse.json();
      expect(cardBody.card.status).toBe('active');
      expect(cardBody.card.limit).toBe(500);
      expect(cardBody.card.approvedBy).toBe('admin');
    });

    it('should allow admin to reject pending request with reason', async () => {
      const userEcosystemId = 'rejection-user-1';
      const adminEcosystemId = 'rejection-admin-1';

      // Setup user and admin
      const userRepo = getUserRepo(container);
      await userRepo.save(
        createTestUser({
          ecosystemId: userEcosystemId,
          currentScore: 350,
          tier: 'low',
        })
      );

      await userRepo.save(
        createTestUser({
          ecosystemId: adminEcosystemId,
          role: 'admin',
        })
      );

      // User requests card
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
      const requestId = requestBody.request.requestId;

      // Admin rejects the request
      const rejectResponse = await fetch(`${baseUrl}/v1/admin/card-requests/${requestId}/reject`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: createMockAuthHeader(adminEcosystemId, 'admin'),
          'Idempotency-Key': idempotencyKey(),
        },
        body: JSON.stringify({ reason: 'High risk profile' }),
      });

      expect(rejectResponse.status).toBe(200);
      const rejectBody = await rejectResponse.json();
      expect(rejectBody.request.status).toBe('rejected');

      // User's request is now rejected
      const statusResponse = await fetch(`${baseUrl}/v1/cards/requests/${requestId}`, {
        headers: {
          Authorization: createMockAuthHeader(userEcosystemId),
        },
      });

      expect(statusResponse.status).toBe(200);
      const statusBody = await statusResponse.json();
      expect(statusBody.request.status).toBe('rejected');
      expect(statusBody.request.decision.source).toBe('admin');
    });
  });

  describe('Admin Authorization', () => {
    it('should reject non-admin access to admin endpoints', async () => {
      const regularUserEcosystemId = 'regular-user-1';

      // Setup regular user (not admin)
      const userRepo = getUserRepo(container);
      await userRepo.save(
        createTestUser({
          ecosystemId: regularUserEcosystemId,
          role: 'user',
        })
      );

      // Try to access admin endpoint as regular user
      const response = await fetch(`${baseUrl}/v1/admin/card-requests`, {
        headers: {
          Authorization: createMockAuthHeader(regularUserEcosystemId, 'user'),
        },
      });

      // Should be forbidden
      expect(response.status).toBe(403);
    });
  });

  describe('Request Status Tracking', () => {
    it('should show request progression in user history', async () => {
      const ecosystemId = 'history-user-1';

      // Create high-score user (auto-approves)
      const userRepo = getUserRepo(container);
      await userRepo.save(
        createTestUser({
          ecosystemId,
          currentScore: 750,
          tier: 'high',
        })
      );

      // Request card (auto-approved for high tier)
      const requestResponse = await fetch(`${baseUrl}/v1/cards/requests`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: createMockAuthHeader(ecosystemId),
          'Idempotency-Key': idempotencyKey(),
        },
        body: JSON.stringify({ productId: 'prod-premium' }),
      });

      expect(requestResponse.status).toBe(201);
      const requestBody = await requestResponse.json();
      const requestId = requestBody.request.requestId;

      // Check request status
      const statusResponse = await fetch(`${baseUrl}/v1/cards/requests/${requestId}`, {
        headers: {
          Authorization: createMockAuthHeader(ecosystemId),
        },
      });

      expect(statusResponse.status).toBe(200);
      const statusBody = await statusResponse.json();
      expect(statusBody.request.status).toBe('approved');
      expect(statusBody.request.decision.source).toBe('auto');
      expect(statusBody.request.decision.approvedLimit).toBeGreaterThan(0);
    });
  });
});
