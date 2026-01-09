/**
 * Offers Endpoints Tests
 *
 * T132: Contract tests for /v1/offers
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'bun:test';
import type { Server } from 'http';
import { createApp } from '../../src/api/app.js';
import {
  createMockContainer,
  createTestUser,
  getUserRepo,
  resetMockContainer,
} from './mock-container.js';
import { startTestServer, stopTestServer, createMockAuthHeader } from './test-utils.js';
import type { Container } from '../../src/infrastructure/di/container.js';

describe('Offers Endpoints Contract', () => {
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

  describe('GET /v1/offers', () => {
    const testEcosystemId = 'offers-test-user';

    beforeEach(async () => {
      resetMockContainer(container);
      const userRepo = getUserRepo(container);

      const user = createTestUser({
        ecosystemId: testEcosystemId,
        currentScore: 650,
        tier: 'medium',
      });
      await userRepo.save(user);
    });

    it('should return 401 without auth', async () => {
      const response = await fetch(`${baseUrl}/v1/offers`);
      expect(response.status).toBe(401);
    });

    it('should return offers for authenticated user', async () => {
      const response = await fetch(`${baseUrl}/v1/offers`, {
        headers: {
          Authorization: createMockAuthHeader(testEcosystemId),
        },
      });

      expect(response.status).toBe(200);

      const body = await response.json();
      expect(body.offers).toBeDefined();
      expect(Array.isArray(body.offers)).toBe(true);
    });

    it('should return offers with required fields', async () => {
      const response = await fetch(`${baseUrl}/v1/offers`, {
        headers: {
          Authorization: createMockAuthHeader(testEcosystemId),
        },
      });

      const body = await response.json();

      if (body.offers.length > 0) {
        const offer = body.offers[0];
        expect(offer.productId).toBeDefined();
        expect(offer.name).toBeDefined();
        expect(offer.terms).toBeDefined();
        expect(typeof offer.terms.creditLimit).toBe('number');
        expect(offer.eligibility).toBeDefined();
        expect(typeof offer.eligibility.eligible).toBe('boolean');
      }
    });

    it('should include personalized limits based on score', async () => {
      // Create high-score user
      const highScoreUserId = 'high-score-user';
      const userRepo = getUserRepo(container);
      await userRepo.save(
        createTestUser({
          ecosystemId: highScoreUserId,
          currentScore: 850,
          tier: 'high',
        })
      );

      const response = await fetch(`${baseUrl}/v1/offers`, {
        headers: {
          Authorization: createMockAuthHeader(highScoreUserId),
        },
      });

      const body = await response.json();
      expect(body.offers).toBeDefined();

      // High score users should get better limits
      const eligibleOffers = body.offers.filter(
        (o: { eligibility: { eligible: boolean } }) => o.eligibility.eligible
      );
      expect(eligibleOffers.length).toBeGreaterThan(0);
    });

    it('should return 404 for non-existent user', async () => {
      const response = await fetch(`${baseUrl}/v1/offers`, {
        headers: {
          Authorization: createMockAuthHeader('non-existent-offers-user'),
        },
      });

      expect(response.status).toBe(404);
    });
  });
});
