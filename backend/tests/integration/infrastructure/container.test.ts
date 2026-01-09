import { describe, it, expect, beforeEach } from 'bun:test';
import { createTestContainer, Container, ServiceNames } from '../../../src/infrastructure/di/index';
import type { IUserRepository } from '../../../src/infrastructure/persistence/interfaces/user.repository';
import type { ICardRepository } from '../../../src/infrastructure/persistence/interfaces/card.repository';
import type { ICardRequestRepository } from '../../../src/infrastructure/persistence/interfaces/card-request.repository';
import type { ITransactionRepository } from '../../../src/infrastructure/persistence/interfaces/transaction.repository';
import type { IOutboxRepository } from '../../../src/infrastructure/persistence/interfaces/outbox.repository';
import type { IAuditLogRepository } from '../../../src/infrastructure/persistence/interfaces/audit-log.repository';
import type { IAuthProvider } from '../../../src/infrastructure/auth/auth-provider.interface';
import type { IEventPublisher } from '../../../src/infrastructure/events/event-publisher.interface';
import { createUser } from '../../../src/domain/entities/user.entity';
import { createCard } from '../../../src/domain/entities/card.entity';
import { createCardRequest } from '../../../src/domain/entities/card-request.entity';
import { createPurchase, createPayment } from '../../../src/domain/entities/transaction.entity';
import { createEvent } from '../../../src/domain/entities/event.entity';
import { createAuditLog } from '../../../src/domain/entities/audit-log.entity';

describe('DI Container Integration', () => {
  let container: Container;

  beforeEach(() => {
    container = createTestContainer();
  });

  describe('Container Setup', () => {
    it('should create a container with all required services', () => {
      expect(container.has(ServiceNames.UserRepository)).toBe(true);
      expect(container.has(ServiceNames.CardRepository)).toBe(true);
      expect(container.has(ServiceNames.CardRequestRepository)).toBe(true);
      expect(container.has(ServiceNames.TransactionRepository)).toBe(true);
      expect(container.has(ServiceNames.IdempotencyRepository)).toBe(true);
      expect(container.has(ServiceNames.OutboxRepository)).toBe(true);
      expect(container.has(ServiceNames.AuditLogRepository)).toBe(true);
      expect(container.has(ServiceNames.AuthProvider)).toBe(true);
      expect(container.has(ServiceNames.EventPublisher)).toBe(true);
    });

    it('should return singleton instances for repositories', () => {
      const repo1 = container.resolve<IUserRepository>(ServiceNames.UserRepository);
      const repo2 = container.resolve<IUserRepository>(ServiceNames.UserRepository);
      expect(repo1).toBe(repo2);
    });
  });

  describe('User Repository', () => {
    let userRepo: IUserRepository;

    beforeEach(() => {
      userRepo = container.resolve<IUserRepository>(ServiceNames.UserRepository);
    });

    it('should save and retrieve user by ecosystemId', async () => {
      const user = createUser({
        firebaseUid: 'firebase-123',
        email: 'test@example.com',
      });

      await userRepo.save(user);
      const retrieved = await userRepo.findById(user.ecosystemId);

      expect(retrieved).not.toBeNull();
      expect(retrieved!.email).toBe('test@example.com');
      expect(retrieved!.firebaseUid).toBe('firebase-123');
    });

    it('should find user by Firebase UID', async () => {
      const user = createUser({
        firebaseUid: 'firebase-456',
        email: 'test2@example.com',
      });

      await userRepo.save(user);
      const retrieved = await userRepo.findByFirebaseUid('firebase-456');

      expect(retrieved).not.toBeNull();
      expect(retrieved!.ecosystemId).toBe(user.ecosystemId);
    });

    it('should update user score and track history', async () => {
      const user = createUser({
        firebaseUid: 'firebase-789',
        email: 'test3@example.com',
      });

      await userRepo.save(user);
      const score = await userRepo.updateScore(user.ecosystemId, 600, 'payment_on_time', 'system');

      expect(score.value).toBe(600);
      expect(score.previousValue).toBe(500);
      expect(score.delta).toBe(100);

      const history = await userRepo.getScoreHistory(user.ecosystemId);
      expect(history).toHaveLength(1);
      expect(history[0]!.value).toBe(600);
    });

    it('should delete user and all associated data', async () => {
      const user = createUser({
        firebaseUid: 'firebase-delete',
        email: 'delete@example.com',
      });

      await userRepo.save(user);
      await userRepo.delete(user.ecosystemId);

      const retrieved = await userRepo.findById(user.ecosystemId);
      expect(retrieved).toBeNull();

      const byFirebase = await userRepo.findByFirebaseUid('firebase-delete');
      expect(byFirebase).toBeNull();
    });
  });

  describe('Card Repository', () => {
    let cardRepo: ICardRepository;

    beforeEach(() => {
      cardRepo = container.resolve<ICardRepository>(ServiceNames.CardRepository);
    });

    it('should save and retrieve card', async () => {
      const card = createCard({
        limit: 5000,
        approvedBy: 'auto',
        scoreAtApproval: 600,
      });

      await cardRepo.save('user-123', card);
      const retrieved = await cardRepo.findById('user-123', card.cardId);

      expect(retrieved).not.toBeNull();
      expect(retrieved!.limit).toBe(5000);
      expect(retrieved!.status).toBe('active');
    });

    it('should update card balance with optimistic locking', async () => {
      const card = createCard({
        limit: 5000,
        approvedBy: 'auto',
        scoreAtApproval: 600,
      });

      await cardRepo.save('user-123', card);
      await cardRepo.updateBalance('user-123', card.cardId, {
        balance: 1000,
        availableCredit: 4000,
        minimumPayment: 50,
        version: card.version + 1,
      });

      const updated = await cardRepo.findById('user-123', card.cardId);
      expect(updated!.balance).toBe(1000);
      expect(updated!.availableCredit).toBe(4000);
      expect(updated!.version).toBe(2);
    });

    it('should filter cards by status', async () => {
      const activeCard = createCard({
        limit: 5000,
        approvedBy: 'auto',
        scoreAtApproval: 600,
      });
      const suspendedCard = {
        ...createCard({
          limit: 3000,
          approvedBy: 'auto',
          scoreAtApproval: 500,
        }),
        status: 'suspended' as const,
      };

      await cardRepo.save('user-456', activeCard);
      await cardRepo.save('user-456', suspendedCard);

      const activeCards = await cardRepo.findByUser('user-456', { status: 'active' });
      expect(activeCards).toHaveLength(1);
      expect(activeCards[0]!.cardId).toBe(activeCard.cardId);
    });
  });

  describe('Card Request Repository', () => {
    let requestRepo: ICardRequestRepository;

    beforeEach(() => {
      requestRepo = container.resolve<ICardRequestRepository>(ServiceNames.CardRequestRepository);
    });

    it('should save and find pending request', async () => {
      const request = createCardRequest({
        idempotencyKey: 'test-key-1',
        scoreAtRequest: 600,
        tierAtRequest: 'medium',
      });

      await requestRepo.save('user-789', request);
      const pending = await requestRepo.findPendingByUser('user-789');

      expect(pending).not.toBeNull();
      expect(pending!.requestId).toBe(request.requestId);
      expect(pending!.status).toBe('pending');
    });

    it('should list all pending requests with pagination', async () => {
      const requests = [
        createCardRequest({
          idempotencyKey: 'key-1',
          scoreAtRequest: 600,
          tierAtRequest: 'medium',
        }),
        createCardRequest({ idempotencyKey: 'key-2', scoreAtRequest: 700, tierAtRequest: 'high' }),
        createCardRequest({ idempotencyKey: 'key-3', scoreAtRequest: 400, tierAtRequest: 'low' }),
      ];

      for (let i = 0; i < requests.length; i++) {
        await requestRepo.save(`user-${i}`, requests[i]!);
      }

      const result = await requestRepo.findAllPending(undefined, undefined, { limit: 2 });
      expect(result.requests).toHaveLength(2);
      expect(result.totalCount).toBe(3);
      expect(result.hasMore).toBe(true);
    });

    it('should filter pending requests by tier', async () => {
      const requests = [
        createCardRequest({ idempotencyKey: 'tier-1', scoreAtRequest: 700, tierAtRequest: 'high' }),
        createCardRequest({ idempotencyKey: 'tier-2', scoreAtRequest: 400, tierAtRequest: 'low' }),
      ];

      await requestRepo.save('user-a', requests[0]!);
      await requestRepo.save('user-b', requests[1]!);

      const result = await requestRepo.findAllPending(undefined, { tier: 'high' });
      expect(result.requests).toHaveLength(1);
      expect(result.requests[0]!.tierAtRequest).toBe('high');
    });
  });

  describe('Transaction Repository', () => {
    let txRepo: ITransactionRepository;

    beforeEach(() => {
      txRepo = container.resolve<ITransactionRepository>(ServiceNames.TransactionRepository);
    });

    it('should save and retrieve transactions', async () => {
      const tx = createPurchase({
        amount: 100,
        merchant: 'Test Merchant',
        idempotencyKey: 'idem-123',
      });

      await txRepo.save('user-tx', 'card-123', tx);
      const result = await txRepo.findByCard('user-tx', 'card-123');

      expect(result.transactions).toHaveLength(1);
      expect(result.transactions[0]!.amount).toBe(100);
    });

    it('should get recent transactions', async () => {
      const purchase = createPurchase({
        amount: 100,
        merchant: 'Test Merchant',
        idempotencyKey: 'idem-recent-1',
      });
      const payment = createPayment({
        amount: 50,
        idempotencyKey: 'idem-recent-2',
        paymentStatus: 'on_time',
      });

      await txRepo.save('user-recent', 'card-recent', purchase);
      await txRepo.save('user-recent', 'card-recent', payment);

      const recent = await txRepo.getRecent('user-recent', 'card-recent', 5);
      expect(recent.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Outbox Repository', () => {
    let outboxRepo: IOutboxRepository;

    beforeEach(() => {
      outboxRepo = container.resolve<IOutboxRepository>(ServiceNames.OutboxRepository);
    });

    it('should save and find pending events', async () => {
      const event = createEvent({
        eventType: 'user.created',
        entityType: 'user',
        entityId: 'user-123',
        ecosystemId: 'eco-123',
        sequenceNumber: 1,
        payload: { email: 'test@example.com' },
      });

      await outboxRepo.save(event);
      const pending = await outboxRepo.findPending();

      expect(pending).toHaveLength(1);
      expect(pending[0]!.eventId).toBe(event.eventId);
    });

    it('should mark event as sent', async () => {
      const event = createEvent({
        eventType: 'user.updated',
        entityType: 'user',
        entityId: 'user-456',
        ecosystemId: 'eco-456',
        sequenceNumber: 2,
        payload: {},
      });

      await outboxRepo.save(event);
      await outboxRepo.markSent(event.eventId);

      const pending = await outboxRepo.findPending();
      expect(pending.filter((e) => e.eventId === event.eventId)).toHaveLength(0);
    });
  });

  describe('Audit Log Repository', () => {
    let auditRepo: IAuditLogRepository;

    beforeEach(() => {
      auditRepo = container.resolve<IAuditLogRepository>(ServiceNames.AuditLogRepository);
    });

    it('should save and find audit logs by target', async () => {
      const log = createAuditLog({
        adminEcosystemId: 'admin-123',
        adminEmail: 'admin@example.com',
        action: 'score.adjusted',
        targetType: 'user',
        targetId: 'user-target',
        reason: 'Manual adjustment',
        requestId: 'req-123',
      });

      await auditRepo.save(log);
      const result = await auditRepo.findByTarget('user', 'user-target');

      expect(result.logs).toHaveLength(1);
      expect(result.logs[0]!.action).toBe('score.adjusted');
    });

    it('should find audit logs by actor', async () => {
      const log = createAuditLog({
        adminEcosystemId: 'admin-actor',
        adminEmail: 'actor@example.com',
        action: 'card_request.approved',
        targetType: 'cardRequest',
        targetId: 'request-789',
        reason: 'Good standing',
        requestId: 'req-456',
      });

      await auditRepo.save(log);
      const result = await auditRepo.findByActor('admin-actor');

      expect(result.logs).toHaveLength(1);
      expect(result.logs[0]!.adminEmail).toBe('actor@example.com');
    });
  });

  describe('Auth Provider', () => {
    it('should verify tokens and return claims', async () => {
      const authProvider = container.resolve<IAuthProvider>(ServiceNames.AuthProvider);

      // For MockAuthProvider, we need to register a user and token first
      const mockAuth = authProvider as unknown as {
        registerUser: (user: { uid: string; email: string; role: 'user' | 'admin' }) => void;
        registerToken: (token: string, uid: string) => void;
      };

      mockAuth.registerUser({
        uid: 'firebase-auth-test',
        email: 'auth@example.com',
        role: 'user',
      });
      mockAuth.registerToken('valid-token', 'firebase-auth-test');

      const claims = await authProvider.verifyToken('valid-token');
      expect(claims.uid).toBe('firebase-auth-test');
      expect(claims.email).toBe('auth@example.com');
    });
  });

  describe('Event Publisher', () => {
    it('should publish events and notify subscribers', async () => {
      const publisher = container.resolve<IEventPublisher>(ServiceNames.EventPublisher);
      const receivedEvents: unknown[] = [];

      publisher.subscribe('user.created', (event) => {
        receivedEvents.push(event);
        return Promise.resolve();
      });

      const event = createEvent({
        eventType: 'user.created',
        entityType: 'user',
        entityId: 'user-pub-test',
        ecosystemId: 'eco-pub',
        sequenceNumber: 1,
        payload: { test: true },
      });

      await publisher.publish(event);

      expect(receivedEvents).toHaveLength(1);
    });
  });
});
