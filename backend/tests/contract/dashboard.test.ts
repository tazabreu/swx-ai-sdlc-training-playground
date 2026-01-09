/**
 * Dashboard Endpoints Tests
 *
 * T131: Contract tests for /v1/dashboard
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
import { startTestServer, stopTestServer, createMockAuthHeader } from './test-utils.js';
import type { Container } from '../../src/infrastructure/di/container.js';

describe('Dashboard Endpoints Contract', () => {
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

  describe('GET /v1/dashboard', () => {
    const testEcosystemId = 'test-user-123';

    beforeEach(async () => {
      resetMockContainer(container);

      const userRepo = getUserRepo(container);
      const cardRepo = getCardRepo(container);

      const user = createTestUser({
        ecosystemId: testEcosystemId,
        currentScore: 720,
        tier: 'high',
        cardSummary: { activeCards: 1, totalBalance: 500, totalLimit: 5000 },
      });
      await userRepo.save(user);

      // Add a test card
      const card = createTestCard({
        cardId: 'dashboard-card-1',
        balance: 500,
        availableCredit: 4500,
        limit: 5000,
      });
      await cardRepo.save(testEcosystemId, card);
    });

    it('should return 401 without auth header', async () => {
      const response = await fetch(`${baseUrl}/v1/dashboard`);

      expect(response.status).toBe(401);

      const body = await response.json();
      expect(body.error).toBeDefined();
      expect(body.error.code).toBe('INVALID_TOKEN');
    });

    it('should return 401 with invalid token', async () => {
      const response = await fetch(`${baseUrl}/v1/dashboard`, {
        headers: {
          Authorization: 'Bearer invalid-token',
        },
      });

      expect(response.status).toBe(401);
    });

    it('should return dashboard data with valid auth', async () => {
      const response = await fetch(`${baseUrl}/v1/dashboard`, {
        headers: {
          Authorization: createMockAuthHeader(testEcosystemId),
        },
      });

      expect(response.status).toBe(200);

      const body = await response.json();

      expect(body.user).toBeDefined();
      expect(body.user.ecosystemId).toBe(testEcosystemId);
      expect(body.user.score).toBe(720);
      expect(body.user.tier).toBe('high');

      expect(Array.isArray(body.cards)).toBe(true);
      expect(body.cards.length).toBe(1);
      expect(body.cards[0].cardId).toBe('dashboard-card-1');

      expect(Array.isArray(body.pendingRequests)).toBe(true);
      expect(body.lastUpdated).toBeDefined();
    });

    it('should include request-id header in response', async () => {
      const response = await fetch(`${baseUrl}/v1/dashboard`, {
        headers: {
          Authorization: createMockAuthHeader(testEcosystemId),
        },
      });

      expect(response.headers.get('x-request-id')).toBeTruthy();
    });

    it('should return 404 for non-existent user', async () => {
      const response = await fetch(`${baseUrl}/v1/dashboard`, {
        headers: {
          Authorization: createMockAuthHeader('non-existent-user'),
        },
      });

      expect(response.status).toBe(404);

      const body = await response.json();
      expect(body.error.code).toBe('NOT_FOUND');
    });
  });
});
