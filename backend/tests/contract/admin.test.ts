/**
 * Admin Endpoints Tests
 *
 * Minimal contract coverage for admin-only routes.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'bun:test';
import type { Server } from 'http';
import { createApp } from '../../src/api/app.js';
import {
  createMockContainer,
  resetMockContainer,
  createTestUser,
  getUserRepo,
  getCardRequestRepo,
} from './mock-container.js';
import {
  startTestServer,
  stopTestServer,
  createMockAuthHeader,
  generateIdempotencyKey,
} from './test-utils.js';
import type { Container } from '../../src/infrastructure/di/container.js';
import { createCardRequest } from '../../src/domain/entities/card-request.entity.js';

describe('Admin Endpoints Contract', () => {
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

  describe('GET /v1/admin/card-requests', () => {
    it('should return 401 without auth', async () => {
      const response = await fetch(`${baseUrl}/v1/admin/card-requests`);
      expect(response.status).toBe(401);
    });

    it('should return 403 for non-admin user', async () => {
      const userRepo = getUserRepo(container);
      await userRepo.save(createTestUser({ ecosystemId: 'regular-user', role: 'user' }));

      const response = await fetch(`${baseUrl}/v1/admin/card-requests`, {
        headers: { Authorization: createMockAuthHeader('regular-user', 'user') },
      });
      expect(response.status).toBe(403);
    });

    it('should return pending requests for admin', async () => {
      const userRepo = getUserRepo(container);
      const requestRepo = getCardRequestRepo(container);

      await userRepo.save(createTestUser({ ecosystemId: 'admin-user', role: 'admin' }));
      await userRepo.save(createTestUser({ ecosystemId: 'target-user', currentScore: 550 }));

      const request = createCardRequest({
        idempotencyKey: generateIdempotencyKey(),
        scoreAtRequest: 550,
        tierAtRequest: 'medium',
        productId: 'prod-standard',
      });
      await requestRepo.save('target-user', request);

      const response = await fetch(`${baseUrl}/v1/admin/card-requests`, {
        headers: { Authorization: createMockAuthHeader('admin-user', 'admin') },
      });

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(Array.isArray(body.requests)).toBe(true);
      expect(body.pagination).toBeDefined();
    });
  });

  describe('POST /v1/admin/card-requests/:requestId/approve', () => {
    it('should return 400 without creditLimit', async () => {
      const userRepo = getUserRepo(container);
      await userRepo.save(createTestUser({ ecosystemId: 'admin-approve', role: 'admin' }));

      const response = await fetch(`${baseUrl}/v1/admin/card-requests/some-request/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: createMockAuthHeader('admin-approve', 'admin'),
        },
        body: JSON.stringify({}),
      });

      expect(response.status).toBe(400);
    });

    it('should approve a pending request', async () => {
      const userRepo = getUserRepo(container);
      const requestRepo = getCardRequestRepo(container);

      await userRepo.save(createTestUser({ ecosystemId: 'admin-approve', role: 'admin' }));
      await userRepo.save(createTestUser({ ecosystemId: 'target-user', currentScore: 550 }));

      const request = createCardRequest({
        idempotencyKey: generateIdempotencyKey(),
        scoreAtRequest: 550,
        tierAtRequest: 'medium',
        productId: 'prod-standard',
      });
      await requestRepo.save('target-user', request);

      const response = await fetch(
        `${baseUrl}/v1/admin/card-requests/${request.requestId}/approve`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: createMockAuthHeader('admin-approve', 'admin'),
            'Idempotency-Key': generateIdempotencyKey(),
          },
          body: JSON.stringify({ creditLimit: 3000 }),
        }
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.request).toBeDefined();
      expect(body.card).toBeDefined();
      expect(body.card.cardId).toBeDefined();
    });
  });
});
