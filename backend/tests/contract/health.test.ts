/**
 * Health Endpoints Tests
 *
 * T130: Contract tests for /health/liveness and /health/readiness
 */

import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import type { Server } from 'http';
import { createApp } from '../../src/api/app.js';
import { createMockContainer } from './mock-container.js';
import { startTestServer, stopTestServer, isValidISODate } from './test-utils.js';

describe('Health Endpoints Contract', () => {
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

  describe('GET /health/liveness', () => {
    it('should return 200 with status ok', async () => {
      const response = await fetch(`${baseUrl}/health/liveness`);

      expect(response.status).toBe(200);

      const body = await response.json();
      expect(body.status).toBe('ok');
      expect(isValidISODate(body.timestamp)).toBe(true);
    });

    it('should include proper content-type header', async () => {
      const response = await fetch(`${baseUrl}/health/liveness`);

      expect(response.headers.get('content-type')).toContain('application/json');
    });
  });

  describe('GET /health/readiness', () => {
    it('should return 200 with healthy dependencies', async () => {
      const response = await fetch(`${baseUrl}/health/readiness`);

      expect(response.status).toBe(200);

      const body = await response.json();
      expect(body.status).toBe('healthy');
      expect(body.dependencies).toBeDefined();
      expect(body.dependencies.database).toBe('healthy');
      expect(body.dependencies.message_stream).toBe('healthy');
      expect(body.dependencies.auth_provider).toBe('healthy');
    });

    it('should not include warnings when all healthy', async () => {
      const response = await fetch(`${baseUrl}/health/readiness`);
      const body = await response.json();

      // Warnings should be undefined or empty
      expect(body.warnings).toBeUndefined();
    });
  });
});
