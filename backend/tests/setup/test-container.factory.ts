/**
 * Test Container Factory
 *
 * Creates containers for different backend configurations in tests.
 * This allows running the same test suites against different backends.
 */

import { Container, ServiceNames } from '../../src/infrastructure/di/container.js';
import {
  createTestContainer,
  createEmulatorContainer,
  createLocalStackContainer,
} from '../../src/infrastructure/di/container-factory.js';

// Repository interfaces
import type { IUserRepository } from '../../src/infrastructure/persistence/interfaces/user.repository.js';
import type { ICardRepository } from '../../src/infrastructure/persistence/interfaces/card.repository.js';
import type { ICardRequestRepository } from '../../src/infrastructure/persistence/interfaces/card-request.repository.js';
import type { ITransactionRepository } from '../../src/infrastructure/persistence/interfaces/transaction.repository.js';
import type { IIdempotencyRepository } from '../../src/infrastructure/persistence/interfaces/idempotency.repository.js';
import type { IOutboxRepository } from '../../src/infrastructure/persistence/interfaces/outbox.repository.js';
import type { IAuditLogRepository } from '../../src/infrastructure/persistence/interfaces/audit-log.repository.js';
import type { IWhatsAppNotificationRepository } from '../../src/infrastructure/persistence/interfaces/whatsapp-notification.repository.js';
import type { IWhatsAppInboundRepository } from '../../src/infrastructure/persistence/interfaces/whatsapp-inbound.repository.js';
import type { IPendingApprovalRepository } from '../../src/infrastructure/persistence/interfaces/pending-approval.repository.js';

/**
 * Supported test backend types
 */
export type TestBackendType = 'inmemory' | 'firestore' | 'dynamodb';

/**
 * Repository set resolved from a container
 */
export interface TestRepositories {
  userRepository: IUserRepository;
  cardRepository: ICardRepository;
  cardRequestRepository: ICardRequestRepository;
  transactionRepository: ITransactionRepository;
  idempotencyRepository: IIdempotencyRepository;
  outboxRepository: IOutboxRepository;
  auditLogRepository: IAuditLogRepository;
  whatsAppNotificationRepository: IWhatsAppNotificationRepository;
  whatsAppInboundRepository: IWhatsAppInboundRepository;
  pendingApprovalRepository: IPendingApprovalRepository;
}

/**
 * Test context with container and repositories
 */
export interface TestContext {
  backend: TestBackendType;
  container: Container;
  repositories: TestRepositories;
  cleanup: () => Promise<void>;
}

/**
 * Create a test container for the specified backend
 */
export function createContainerForBackend(backend: TestBackendType): Container {
  switch (backend) {
    case 'inmemory':
      return createTestContainer();
    case 'firestore':
      return createEmulatorContainer();
    case 'dynamodb':
      return createLocalStackContainer();
    default:
      throw new Error(`Unsupported backend: ${backend as string}`);
  }
}

/**
 * Resolve all repositories from a container
 */
export function resolveRepositories(container: Container): TestRepositories {
  return {
    userRepository: container.resolve<IUserRepository>(ServiceNames.UserRepository),
    cardRepository: container.resolve<ICardRepository>(ServiceNames.CardRepository),
    cardRequestRepository: container.resolve<ICardRequestRepository>(
      ServiceNames.CardRequestRepository
    ),
    transactionRepository: container.resolve<ITransactionRepository>(
      ServiceNames.TransactionRepository
    ),
    idempotencyRepository: container.resolve<IIdempotencyRepository>(
      ServiceNames.IdempotencyRepository
    ),
    outboxRepository: container.resolve<IOutboxRepository>(ServiceNames.OutboxRepository),
    auditLogRepository: container.resolve<IAuditLogRepository>(ServiceNames.AuditLogRepository),
    whatsAppNotificationRepository: container.resolve<IWhatsAppNotificationRepository>(
      ServiceNames.WhatsAppNotificationRepository
    ),
    whatsAppInboundRepository: container.resolve<IWhatsAppInboundRepository>(
      ServiceNames.WhatsAppInboundRepository
    ),
    pendingApprovalRepository: container.resolve<IPendingApprovalRepository>(
      ServiceNames.PendingApprovalRepository
    ),
  };
}

/**
 * Create a test context for a specific backend
 */
export async function createTestContext(backend: TestBackendType): Promise<TestContext> {
  const container = createContainerForBackend(backend);
  const repositories = resolveRepositories(container);

  // Create cleanup function based on backend type
  const cleanup = async (): Promise<void> => {
    // For inmemory, we can just clear the maps via deleteAll methods
    // For Firestore/DynamoDB, we rely on test isolation via unique IDs
    // Real cleanup happens at the end of test suites
    if (backend === 'inmemory') {
      // These methods exist on inmemory repos
      await repositories.userRepository.deleteAll();
      await repositories.outboxRepository.deleteAll?.();
      await repositories.auditLogRepository.deleteAll?.();
      await repositories.whatsAppNotificationRepository.deleteAll?.();
      await repositories.whatsAppInboundRepository.deleteAll?.();
      await repositories.pendingApprovalRepository.deleteAll?.();
    }
  };

  return {
    backend,
    container,
    repositories,
    cleanup,
  };
}

/**
 * Generate a unique test ID for isolation across test runs
 */
export function generateTestId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
}

/**
 * Check if a specific backend is available for testing
 */
export function isBackendAvailable(backend: TestBackendType): boolean {
  switch (backend) {
    case 'inmemory':
      return true; // Always available
    case 'firestore': {
      // Requires FIRESTORE_EMULATOR_HOST
      const firestoreHost = process.env.FIRESTORE_EMULATOR_HOST;
      return firestoreHost !== undefined && firestoreHost !== '';
    }
    case 'dynamodb': {
      // Requires AWS_ENDPOINT_URL (LocalStack)
      const awsEndpoint = process.env.AWS_ENDPOINT_URL;
      return awsEndpoint !== undefined && awsEndpoint !== '';
    }
    default:
      return false;
  }
}

/**
 * Get available backends based on environment
 */
export function getAvailableBackends(): TestBackendType[] {
  const backends: TestBackendType[] = ['inmemory'];

  if (isBackendAvailable('firestore')) {
    backends.push('firestore');
  }

  if (isBackendAvailable('dynamodb')) {
    backends.push('dynamodb');
  }

  return backends;
}

/**
 * Create test ID with backend prefix for debugging
 */
export function createPrefixedTestId(backend: TestBackendType): string {
  const prefix = {
    inmemory: 'mem',
    firestore: 'fs',
    dynamodb: 'ddb',
  }[backend];

  return `${prefix}-${generateTestId()}`;
}
