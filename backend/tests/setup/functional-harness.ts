/**
 * Multi-Backend Functional Test Harness
 *
 * Provides utilities for running end-to-end functional tests against
 * different backend implementations (InMemory, Firestore, DynamoDB).
 */

import { describe, it, beforeAll, afterAll } from 'bun:test';
import type { Container } from '../../src/infrastructure/di/container.js';
import { ServiceNames } from '../../src/infrastructure/di/container.js';
import {
  createTestContext,
  isBackendAvailable,
  generateTestId,
  type TestBackendType,
  type TestContext,
} from './test-container.factory.js';
import type { IUserRepository } from '../../src/infrastructure/persistence/interfaces/user.repository.js';
import type { ICardRepository } from '../../src/infrastructure/persistence/interfaces/card.repository.js';
import type { ICardRequestRepository } from '../../src/infrastructure/persistence/interfaces/card-request.repository.js';
import type { ITransactionRepository } from '../../src/infrastructure/persistence/interfaces/transaction.repository.js';
import type { IOutboxRepository } from '../../src/infrastructure/persistence/interfaces/outbox.repository.js';
import type { IIdempotencyRepository } from '../../src/infrastructure/persistence/interfaces/idempotency.repository.js';
import { createApp } from '../../src/api/app.js';
import type { Express } from 'express';

/**
 * Functional test context with server and repositories
 */
export interface FunctionalTestContext {
  backend: TestBackendType;
  container: Container;
  app: Express;
  server: ReturnType<Express['listen']> | null;
  baseUrl: string;
  repositories: {
    user: IUserRepository;
    card: ICardRepository;
    cardRequest: ICardRequestRepository;
    transaction: ITransactionRepository;
    outbox: IOutboxRepository;
    idempotency: IIdempotencyRepository;
  };
  cleanup: () => Promise<void>;
}

/**
 * Create a functional test context for a specific backend
 */
export async function createFunctionalContext(
  backend: TestBackendType,
  options?: { port?: number; startServer?: boolean }
): Promise<FunctionalTestContext> {
  const testContext = await createTestContext(backend);
  const { container } = testContext;

  // Create Express app with the container
  const app = createApp(container);

  // Resolve repositories
  const repositories = {
    user: container.resolve<IUserRepository>(ServiceNames.UserRepository),
    card: container.resolve<ICardRepository>(ServiceNames.CardRepository),
    cardRequest: container.resolve<ICardRequestRepository>(ServiceNames.CardRequestRepository),
    transaction: container.resolve<ITransactionRepository>(ServiceNames.TransactionRepository),
    outbox: container.resolve<IOutboxRepository>(ServiceNames.OutboxRepository),
    idempotency: container.resolve<IIdempotencyRepository>(ServiceNames.IdempotencyRepository),
  };

  // Start server if requested
  const port = options?.port ?? 0; // 0 = auto-assign
  const startServer = options?.startServer ?? false;

  let server: ReturnType<Express['listen']> | null = null;
  let baseUrl = '';

  if (startServer) {
    server = await new Promise<ReturnType<Express['listen']>>((resolve) => {
      const srv = app.listen(port, () => {
        resolve(srv);
      });
    });

    const address = server.address();
    if (address !== null && typeof address === 'object') {
      baseUrl = `http://localhost:${address.port}`;
    }
  }

  const cleanup = async (): Promise<void> => {
    if (server !== null) {
      const serverToClose = server;
      await new Promise<void>((resolve, reject) => {
        serverToClose.close((err) => {
          if (err !== null && err !== undefined) reject(err);
          else resolve();
        });
      });
    }
    await testContext.cleanup();
  };

  return {
    backend,
    container,
    app,
    server,
    baseUrl,
    repositories,
    cleanup,
  };
}

/**
 * Create mock auth header for testing
 */
export function createMockAuthHeader(
  ecosystemId: string,
  role: 'user' | 'admin' = 'user',
  email?: string
): string {
  const claims = {
    ecosystemId,
    role,
    email: email ?? `${ecosystemId}@example.com`,
  };
  const encodedClaims = Buffer.from(JSON.stringify(claims)).toString('base64');
  return `Bearer mock.${encodedClaims}.sig`;
}

/**
 * Create admin auth header
 */
export function createAdminAuthHeader(
  ecosystemId: string = 'admin-001',
  email: string = 'admin@example.com'
): string {
  return createMockAuthHeader(ecosystemId, 'admin', email);
}

/**
 * Generate unique idempotency key for functional tests
 */
export function functionalIdempotencyKey(prefix: string = 'func'): string {
  return `${prefix}-${generateTestId()}`;
}

/**
 * Wait utility for async operations
 */
export function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Describe tests for all available backends
 *
 * Usage:
 * ```typescript
 * describeForBackends(['inmemory', 'firestore', 'dynamodb'], (backend, getContext) => {
 *   it('should do something', async () => {
 *     const ctx = getContext();
 *     // test using ctx
 *   });
 * });
 * ```
 */
export function describeForBackends(
  backends: TestBackendType[],
  testSuite: (backend: TestBackendType, getContext: () => FunctionalTestContext) => void
): void {
  for (const backend of backends) {
    const isAvailable = isBackendAvailable(backend);
    const describeFn = isAvailable ? describe : describe.skip;

    describeFn(`[${backend.toUpperCase()}]`, () => {
      let context: FunctionalTestContext;

      beforeAll(async () => {
        context = await createFunctionalContext(backend);
      });

      afterAll(async () => {
        if (context !== undefined) {
          await context.cleanup();
        }
      });

      testSuite(backend, () => context);
    });
  }
}

/**
 * Run the same test across all available backends
 */
export function testForAllBackends(
  name: string,
  testFn: (ctx: FunctionalTestContext) => Promise<void>
): void {
  const backends: TestBackendType[] = ['inmemory', 'firestore', 'dynamodb'];

  for (const backend of backends) {
    const isAvailable = isBackendAvailable(backend);
    const itFn = isAvailable ? it : it.skip;

    itFn(`${name} [${backend}]`, async () => {
      const ctx = await createFunctionalContext(backend);
      try {
        await testFn(ctx);
      } finally {
        await ctx.cleanup();
      }
    });
  }
}

// Re-export types and utilities
export type { TestBackendType, TestContext };
export { isBackendAvailable, generateTestId } from './test-container.factory.js';
