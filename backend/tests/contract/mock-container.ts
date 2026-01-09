/**
 * Mock Container for Contract Tests
 *
 * Uses real InMemory repositories + a lightweight auth provider that understands
 * the `createMockAuthHeader()` token format from `tests/contract/test-utils.ts`.
 */

import { Container, ServiceNames } from '../../src/infrastructure/di/container.js';
import type {
  IAuthProvider,
  AuthTokenClaims,
  UserStatus,
} from '../../src/infrastructure/auth/auth-provider.interface.js';
import type { IUserRepository } from '../../src/infrastructure/persistence/interfaces/user.repository.js';
import type { ICardRepository } from '../../src/infrastructure/persistence/interfaces/card.repository.js';
import type { ICardRequestRepository } from '../../src/infrastructure/persistence/interfaces/card-request.repository.js';
import type { ITransactionRepository } from '../../src/infrastructure/persistence/interfaces/transaction.repository.js';
import type { IIdempotencyRepository } from '../../src/infrastructure/persistence/interfaces/idempotency.repository.js';
import type { IOutboxRepository } from '../../src/infrastructure/persistence/interfaces/outbox.repository.js';
import type { IAuditLogRepository } from '../../src/infrastructure/persistence/interfaces/audit-log.repository.js';
import {
  InMemoryUserRepository,
  InMemoryCardRepository,
  InMemoryCardRequestRepository,
  InMemoryTransactionRepository,
  InMemoryIdempotencyRepository,
  InMemoryOutboxRepository,
  InMemoryAuditLogRepository,
} from '../../src/infrastructure/persistence/inmemory/index.js';
import type { User, UserRole, UserTier } from '../../src/domain/entities/user.entity.js';
import { deriveTier } from '../../src/domain/entities/user.entity.js';
import type { Card } from '../../src/domain/entities/card.entity.js';
import { createCard } from '../../src/domain/entities/card.entity.js';

class ContractAuthProvider implements IAuthProvider {
  async verifyToken(idToken: string): Promise<AuthTokenClaims> {
    // Expected token format: "mock.{base64_json}.signature"
    if (!idToken.startsWith('mock.')) {
      throw new Error('Invalid token');
    }

    const parts = idToken.split('.');
    const payloadEncoded = parts[1];
    if (payloadEncoded === undefined) {
      throw new Error('Invalid token');
    }

    const payload = JSON.parse(Buffer.from(payloadEncoded, 'base64').toString()) as {
      ecosystemId?: string;
      role?: 'user' | 'admin';
    };

    const ecosystemId = payload.ecosystemId;
    if (ecosystemId === undefined || ecosystemId.length === 0) {
      throw new Error('Invalid token');
    }

    return {
      uid: ecosystemId,
      ecosystemId,
      email: `${ecosystemId}@test.local`,
      emailVerified: true,
      role: payload.role ?? 'user',
    };
  }

  async getUser(uid: string): Promise<AuthTokenClaims | null> {
    return {
      uid,
      ecosystemId: uid,
      email: `${uid}@test.local`,
      emailVerified: true,
      role: 'user',
    };
  }

  async getUserStatus(_uid: string): Promise<UserStatus> {
    return 'active';
  }

  async setCustomClaims(_uid: string, _claims: Record<string, unknown>): Promise<void> {
    // no-op for contract tests
  }
}

export function createMockContainer(): Container {
  const container = new Container();

  container.registerSingleton(ServiceNames.UserRepository, () => new InMemoryUserRepository());
  container.registerSingleton(ServiceNames.CardRepository, () => new InMemoryCardRepository());
  container.registerSingleton(
    ServiceNames.CardRequestRepository,
    () => new InMemoryCardRequestRepository()
  );
  container.registerSingleton(
    ServiceNames.TransactionRepository,
    () => new InMemoryTransactionRepository()
  );
  container.registerSingleton(
    ServiceNames.IdempotencyRepository,
    () => new InMemoryIdempotencyRepository()
  );
  container.registerSingleton(ServiceNames.OutboxRepository, () => new InMemoryOutboxRepository());
  container.registerSingleton(
    ServiceNames.AuditLogRepository,
    () => new InMemoryAuditLogRepository()
  );

  container.registerInstance(ServiceNames.AuthProvider, new ContractAuthProvider());

  return container;
}

export function resetMockContainer(container: Container): void {
  const userRepo = container.resolve<IUserRepository>(ServiceNames.UserRepository) as unknown as {
    clear?: () => void;
  };
  const cardRepo = container.resolve<ICardRepository>(ServiceNames.CardRepository) as unknown as {
    clear?: () => void;
  };
  const requestRepo = container.resolve<ICardRequestRepository>(
    ServiceNames.CardRequestRepository
  ) as unknown as { clear?: () => void };
  const txRepo = container.resolve<ITransactionRepository>(
    ServiceNames.TransactionRepository
  ) as unknown as { clear?: () => void };
  const idempotencyRepo = container.resolve<IIdempotencyRepository>(
    ServiceNames.IdempotencyRepository
  ) as unknown as { clear?: () => void };
  const outboxRepo = container.resolve<IOutboxRepository>(
    ServiceNames.OutboxRepository
  ) as unknown as { clear?: () => void };
  const auditRepo = container.resolve<IAuditLogRepository>(
    ServiceNames.AuditLogRepository
  ) as unknown as { clear?: () => void };

  userRepo.clear?.();
  cardRepo.clear?.();
  requestRepo.clear?.();
  txRepo.clear?.();
  idempotencyRepo.clear?.();
  outboxRepo.clear?.();
  auditRepo.clear?.();
}

export function getUserRepo(container: Container): IUserRepository {
  return container.resolve<IUserRepository>(ServiceNames.UserRepository);
}

export function getCardRepo(container: Container): ICardRepository {
  return container.resolve<ICardRepository>(ServiceNames.CardRepository);
}

export function getCardRequestRepo(container: Container): ICardRequestRepository {
  return container.resolve<ICardRequestRepository>(ServiceNames.CardRequestRepository);
}

export function getTransactionRepo(container: Container): ITransactionRepository {
  return container.resolve<ITransactionRepository>(ServiceNames.TransactionRepository);
}

export function createTestUser(input: {
  ecosystemId: string;
  role?: UserRole;
  status?: 'active' | 'disabled';
  email?: string;
  currentScore?: number;
  tier?: UserTier;
  cardSummary?: { activeCards: number; totalBalance: number; totalLimit: number };
}): User {
  const now = new Date();
  const currentScore = input.currentScore ?? 500;
  const tier = input.tier ?? deriveTier(currentScore);

  return {
    ecosystemId: input.ecosystemId,
    firebaseUid: input.ecosystemId,
    email: input.email ?? `${input.ecosystemId}@test.local`,
    role: input.role ?? 'user',
    status: input.status ?? 'active',
    currentScore,
    tier,
    cardSummary: input.cardSummary ?? { activeCards: 0, totalBalance: 0, totalLimit: 0 },
    createdAt: now,
    updatedAt: now,
    lastLoginAt: now,
  };
}

export function createTestCard(input?: Partial<Card> & { cardId?: string }): Card {
  const base = createCard({
    limit: input?.limit ?? 5000,
    approvedBy: input?.approvedBy ?? 'auto',
    scoreAtApproval: input?.scoreAtApproval ?? 650,
    ...(input?.approvedBy === 'admin' && input.approvedByAdminId !== undefined
      ? { approvedByAdminId: input.approvedByAdminId }
      : {}),
    ...(input?.productId !== undefined ? { productId: input.productId } : {}),
  });

  const cardId = input?.cardId ?? base.cardId;
  const balance = input?.balance ?? base.balance;
  const limit = input?.limit ?? base.limit;
  const availableCredit = input?.availableCredit ?? limit - balance;

  return {
    ...base,
    ...input,
    cardId,
    limit,
    balance,
    availableCredit,
    minimumPayment: input?.minimumPayment ?? base.minimumPayment,
  };
}
