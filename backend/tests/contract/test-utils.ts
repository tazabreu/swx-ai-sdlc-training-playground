/**
 * Contract Test Utilities
 *
 * Shared utilities for API contract testing.
 */

import type { Express } from 'express';
import type { Server } from 'http';

/**
 * Start server on random port and return address
 */
export async function startTestServer(app: Express): Promise<{
  server: Server;
  baseUrl: string;
}> {
  return new Promise((resolve) => {
    const server = app.listen(0, () => {
      const address = server.address();
      const port = typeof address === 'object' && address !== null ? address.port : 0;
      resolve({
        server,
        baseUrl: `http://localhost:${port}`,
      });
    });
  });
}

/**
 * Stop test server
 */
export async function stopTestServer(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

/**
 * Create mock auth token for testing
 */
export function createMockAuthHeader(ecosystemId: string, role: 'user' | 'admin' = 'user'): string {
  // For contract tests, we use a simple mock token format
  // The mock auth provider will decode this
  const payload = { ecosystemId, role, iat: Date.now() };
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64');
  return `Bearer mock.${encoded}.signature`;
}

/**
 * Generate unique idempotency key
 */
export function generateIdempotencyKey(): string {
  return `test-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/**
 * Validate ISO 8601 date string
 */
export function isValidISODate(dateString: string): boolean {
  const date = new Date(dateString);
  return !isNaN(date.getTime()) && dateString.includes('T');
}

/**
 * Validate UUID v4 format
 */
export function isValidUUID(uuid: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}
