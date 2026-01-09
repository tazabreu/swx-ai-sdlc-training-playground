/**
 * Error Handling Tests
 *
 * T136: Contract tests for error responses and edge cases
 */

import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import type { Server } from 'http';
import { createApp } from '../../src/api/app.js';
import { createMockContainer } from './mock-container.js';
import { startTestServer, stopTestServer, createMockAuthHeader } from './test-utils.js';

describe('Error Handling Contract', () => {
  let server: Server;
  let baseUrl: string;

  beforeAll(async () => {
    const container = createMockContainer();
    const app = createApp(container);
    const result = await startTestServer(app);
    server = result.server;
    baseUrl = result.baseUrl;
  });

  afterAll(async () => {
    await stopTestServer(server);
  });

  describe('404 Not Found', () => {
    it('should return 404 for unknown routes', async () => {
      const response = await fetch(`${baseUrl}/v1/unknown-endpoint`);

      expect(response.status).toBe(404);

      const body = await response.json();
      expect(body.error).toBeDefined();
      expect(body.error.code).toBe('NOT_FOUND');
      expect(body.error.message).toContain('Route not found');
    });

    it('should include method and path in 404 message', async () => {
      const response = await fetch(`${baseUrl}/v1/nonexistent`, {
        method: 'POST',
      });

      const body = await response.json();
      expect(body.error.message).toContain('POST');
      expect(body.error.message).toContain('/v1/nonexistent');
    });
  });

  describe('401 Unauthorized', () => {
    it('should return 401 for missing Authorization header', async () => {
      const response = await fetch(`${baseUrl}/v1/dashboard`);

      expect(response.status).toBe(401);

      const body = await response.json();
      expect(body.error).toBeDefined();
      expect(body.error.code).toBe('INVALID_TOKEN');
    });

    it('should return 401 for malformed Authorization header', async () => {
      const response = await fetch(`${baseUrl}/v1/dashboard`, {
        headers: {
          Authorization: 'NotBearer token',
        },
      });

      expect(response.status).toBe(401);
    });

    it('should return 401 for invalid token format', async () => {
      const response = await fetch(`${baseUrl}/v1/dashboard`, {
        headers: {
          Authorization: 'Bearer invalid.token',
        },
      });

      expect(response.status).toBe(401);
    });
  });

  describe('400 Bad Request', () => {
    it('should return 400 for missing required body fields', async () => {
      const response = await fetch(`${baseUrl}/v1/cards/requests`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: createMockAuthHeader('test-user'),
          'Idempotency-Key': 'test-key',
        },
        body: JSON.stringify({}),
      });

      expect(response.status).toBe(400);

      const body = await response.json();
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 400 for invalid JSON body', async () => {
      const response = await fetch(`${baseUrl}/v1/cards/requests`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: createMockAuthHeader('test-user'),
          'Idempotency-Key': 'test-key',
        },
        body: 'not valid json',
      });

      // Express returns 400 for malformed JSON
      expect(response.status).toBeGreaterThanOrEqual(400);
    });
  });

  describe('Error Response Format', () => {
    it('should return consistent error structure', async () => {
      const response = await fetch(`${baseUrl}/v1/dashboard`);

      const body = await response.json();

      // All errors should have this structure
      expect(body.error).toBeDefined();
      expect(typeof body.error.code).toBe('string');
      expect(typeof body.error.message).toBe('string');
    });

    it('should include details when available', async () => {
      const response = await fetch(`${baseUrl}/v1/cards/requests`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: createMockAuthHeader('test-user'),
        },
        body: JSON.stringify({ productId: 'test' }),
      });

      // Missing idempotency key - should have details or clear message
      const body = await response.json();
      expect(body.error.message).toBeTruthy();
    });
  });

  describe('Request ID Tracking', () => {
    it('should include x-request-id in all responses', async () => {
      const response = await fetch(`${baseUrl}/v1/dashboard`);

      const requestId = response.headers.get('x-request-id');
      expect(requestId).toBeTruthy();
    });

    it('should include x-request-id in error responses', async () => {
      const response = await fetch(`${baseUrl}/v1/unknown`);

      const requestId = response.headers.get('x-request-id');
      expect(requestId).toBeTruthy();
    });

    it('should echo back client-provided request id', async () => {
      const clientRequestId = 'client-request-12345';

      const response = await fetch(`${baseUrl}/v1/dashboard`, {
        headers: {
          'X-Request-ID': clientRequestId,
        },
      });

      const responseRequestId = response.headers.get('x-request-id');
      expect(responseRequestId).toBe(clientRequestId);
    });
  });

  describe('Security Headers', () => {
    it('should include security headers from helmet', async () => {
      const response = await fetch(`${baseUrl}/health/liveness`);

      // Helmet adds various security headers
      expect(response.headers.get('x-content-type-options')).toBe('nosniff');
      expect(response.headers.get('x-frame-options')).toBe('SAMEORIGIN');
    });

    it('should handle CORS preflight', async () => {
      const response = await fetch(`${baseUrl}/v1/dashboard`, {
        method: 'OPTIONS',
        headers: {
          Origin: 'http://localhost:3000',
          'Access-Control-Request-Method': 'GET',
        },
      });

      // CORS should allow the request
      expect(response.status).toBeLessThan(400);
    });
  });

  describe('Content-Type Handling', () => {
    it('should return application/json for all responses', async () => {
      const response = await fetch(`${baseUrl}/health/liveness`);

      const contentType = response.headers.get('content-type');
      expect(contentType).toContain('application/json');
    });

    it('should return application/json for error responses', async () => {
      const response = await fetch(`${baseUrl}/v1/unknown`);

      const contentType = response.headers.get('content-type');
      expect(contentType).toContain('application/json');
    });
  });
});
