/**
 * Firestore DI Container Integration Tests
 *
 * Tests the DI container with Firestore repositories against the emulator.
 * These tests mirror the InMemory container tests to ensure behavioral parity.
 *
 * Requires: FIRESTORE_EMULATOR_HOST=localhost:8080 GCLOUD_PROJECT=demo-acme
 */

import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import {
  createEmulatorContainer,
  Container,
  ServiceNames,
} from '../../../src/infrastructure/di/index';
import { resetFirestore } from '../../../src/infrastructure/persistence/firestore/client';
import type { IUserRepository } from '../../../src/infrastructure/persistence/interfaces/user.repository';
import type { ICardRepository } from '../../../src/infrastructure/persistence/interfaces/card.repository';
import type { ICardRequestRepository } from '../../../src/infrastructure/persistence/interfaces/card-request.repository';
import type { ITransactionRepository } from '../../../src/infrastructure/persistence/interfaces/transaction.repository';
import type { IOutboxRepository } from '../../../src/infrastructure/persistence/interfaces/outbox.repository';
import type { IAuditLogRepository } from '../../../src/infrastructure/persistence/interfaces/audit-log.repository';
import { createUser } from '../../../src/domain/entities/user.entity';
import { createCard } from '../../../src/domain/entities/card.entity';
import { createCardRequest } from '../../../src/domain/entities/card-request.entity';
import { createPurchase, createPayment } from '../../../src/domain/entities/transaction.entity';
import { createEvent } from '../../../src/domain/entities/event.entity';
import { createAuditLog } from '../../../src/domain/entities/audit-log.entity';

// Skip if emulator not configured
const emulatorHost = process.env.FIRESTORE_EMULATOR_HOST;
const describeFirestore =
  emulatorHost !== undefined && emulatorHost !== '' ? describe : describe.skip;

// Generate unique test IDs to avoid collisions across tests
const testId = (): string => `${Date.now()}-${Math.random().toString(36).substring(7)}`;

describeFirestore('Firestore DI Container Integration', () => {
  let container: Container;

  beforeAll(async () => {
    // Reset any existing Firestore connection and create container once
    await resetFirestore();
    container = createEmulatorContainer();
  });

  afterAll(async () => {
    await resetFirestore();
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

  describe('User Repository (Firestore)', () => {
    let userRepo: IUserRepository;

    beforeAll(() => {
      userRepo = container.resolve<IUserRepository>(ServiceNames.UserRepository);
    });

    it('should save and retrieve user by ecosystemId', async () => {
      const user = createUser({
        firebaseUid: `firebase-fs-${testId()}`,
        email: 'test-fs@example.com',
      });

      await userRepo.save(user);
      const retrieved = await userRepo.findById(user.ecosystemId);

      expect(retrieved).not.toBeNull();
      expect(retrieved!.email).toBe('test-fs@example.com');
      expect(retrieved!.firebaseUid).toBe(user.firebaseUid);
    });

    it('should find user by Firebase UID', async () => {
      const firebaseUid = `firebase-uid-${testId()}`;
      const user = createUser({
        firebaseUid,
        email: 'test-fs2@example.com',
      });

      await userRepo.save(user);
      const retrieved = await userRepo.findByFirebaseUid(firebaseUid);

      expect(retrieved).not.toBeNull();
      expect(retrieved!.ecosystemId).toBe(user.ecosystemId);
    });

    it('should update user score and track history', async () => {
      const user = createUser({
        firebaseUid: `firebase-score-${testId()}`,
        email: 'test-score@example.com',
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
      const firebaseUid = `firebase-delete-${testId()}`;
      const user = createUser({
        firebaseUid,
        email: 'delete-fs@example.com',
      });

      await userRepo.save(user);
      await userRepo.delete(user.ecosystemId);

      const retrieved = await userRepo.findById(user.ecosystemId);
      expect(retrieved).toBeNull();

      const byFirebase = await userRepo.findByFirebaseUid(firebaseUid);
      expect(byFirebase).toBeNull();
    });

    it('should delete user with all subcollections (cards, transactions, requests, scores)', async () => {
      // Get all repositories needed for this test
      const cardRepo = container.resolve<ICardRepository>(ServiceNames.CardRepository);
      const requestRepo = container.resolve<ICardRequestRepository>(
        ServiceNames.CardRequestRepository
      );
      const txRepo = container.resolve<ITransactionRepository>(ServiceNames.TransactionRepository);

      // Create user
      const firebaseUid = `firebase-full-delete-${testId()}`;
      const user = createUser({
        firebaseUid,
        email: 'full-delete@example.com',
      });
      await userRepo.save(user);

      // Create a card
      const card = createCard({
        limit: 5000,
        approvedBy: 'auto',
        scoreAtApproval: 600,
      });
      await cardRepo.save(user.ecosystemId, card);

      // Create transactions on the card
      const purchase = createPurchase({
        amount: 100,
        merchant: 'Test Merchant',
        idempotencyKey: `idem-full-del-${testId()}`,
      });
      await txRepo.save(user.ecosystemId, card.cardId, purchase);

      // Create a card request
      const request = createCardRequest({
        idempotencyKey: `req-full-del-${testId()}`,
        scoreAtRequest: 500,
        tierAtRequest: 'medium',
      });
      await requestRepo.save(user.ecosystemId, request);

      // Create score history
      await userRepo.updateScore(user.ecosystemId, 550, 'payment_on_time', 'system');

      // Verify all data exists before deletion
      expect(await cardRepo.findById(user.ecosystemId, card.cardId)).not.toBeNull();
      expect(
        (await txRepo.findByCard(user.ecosystemId, card.cardId)).transactions.length
      ).toBeGreaterThan(0);
      expect(await requestRepo.findPendingByUser(user.ecosystemId)).not.toBeNull();
      expect((await userRepo.getScoreHistory(user.ecosystemId)).length).toBeGreaterThan(0);

      // Delete user (should cascade to all subcollections)
      await userRepo.delete(user.ecosystemId);

      // Verify user is deleted
      expect(await userRepo.findById(user.ecosystemId)).toBeNull();

      // Verify cards are deleted
      expect(await cardRepo.findById(user.ecosystemId, card.cardId)).toBeNull();

      // Verify transactions are deleted
      const txResult = await txRepo.findByCard(user.ecosystemId, card.cardId);
      expect(txResult.transactions.length).toBe(0);

      // Verify card requests are deleted
      expect(await requestRepo.findPendingByUser(user.ecosystemId)).toBeNull();

      // Verify score history is deleted
      const scoreHistory = await userRepo.getScoreHistory(user.ecosystemId);
      expect(scoreHistory.length).toBe(0);
    });
  });

  describe('Card Repository (Firestore)', () => {
    let cardRepo: ICardRepository;
    let userRepo: IUserRepository;

    beforeAll(() => {
      cardRepo = container.resolve<ICardRepository>(ServiceNames.CardRepository);
      userRepo = container.resolve<IUserRepository>(ServiceNames.UserRepository);
    });

    it('should save and retrieve card', async () => {
      // Create a test user first
      const user = createUser({
        firebaseUid: `firebase-card-${testId()}`,
        email: 'card-test@example.com',
      });
      await userRepo.save(user);

      const card = createCard({
        limit: 5000,
        approvedBy: 'auto',
        scoreAtApproval: 600,
      });

      await cardRepo.save(user.ecosystemId, card);
      const retrieved = await cardRepo.findById(user.ecosystemId, card.cardId);

      expect(retrieved).not.toBeNull();
      expect(retrieved!.limit).toBe(5000);
      expect(retrieved!.status).toBe('active');
    });

    it('should update card balance with optimistic locking', async () => {
      const user = createUser({
        firebaseUid: `firebase-card-balance-${testId()}`,
        email: 'card-balance@example.com',
      });
      await userRepo.save(user);

      const card = createCard({
        limit: 5000,
        approvedBy: 'auto',
        scoreAtApproval: 600,
      });

      await cardRepo.save(user.ecosystemId, card);
      await cardRepo.updateBalance(user.ecosystemId, card.cardId, {
        balance: 1000,
        availableCredit: 4000,
        minimumPayment: 50,
        version: card.version + 1,
      });

      const updated = await cardRepo.findById(user.ecosystemId, card.cardId);
      expect(updated!.balance).toBe(1000);
      expect(updated!.availableCredit).toBe(4000);
      expect(updated!.version).toBe(2);
    });

    it('should filter cards by status', async () => {
      const user = createUser({
        firebaseUid: `firebase-card-filter-${testId()}`,
        email: 'card-filter@example.com',
      });
      await userRepo.save(user);

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

      await cardRepo.save(user.ecosystemId, activeCard);
      await cardRepo.save(user.ecosystemId, suspendedCard);

      const activeCards = await cardRepo.findByUser(user.ecosystemId, { status: 'active' });
      expect(activeCards).toHaveLength(1);
      expect(activeCards[0]!.cardId).toBe(activeCard.cardId);
    });
  });

  describe('Card Request Repository (Firestore)', () => {
    let requestRepo: ICardRequestRepository;
    let userRepo: IUserRepository;

    beforeAll(() => {
      requestRepo = container.resolve<ICardRequestRepository>(ServiceNames.CardRequestRepository);
      userRepo = container.resolve<IUserRepository>(ServiceNames.UserRepository);
    });

    it('should save and find pending request', async () => {
      const user = createUser({
        firebaseUid: `firebase-req-${testId()}`,
        email: 'request@example.com',
      });
      await userRepo.save(user);

      const request = createCardRequest({
        idempotencyKey: `test-key-fs-${testId()}`,
        scoreAtRequest: 600,
        tierAtRequest: 'medium',
      });

      await requestRepo.save(user.ecosystemId, request);
      const pending = await requestRepo.findPendingByUser(user.ecosystemId);

      expect(pending).not.toBeNull();
      expect(pending!.requestId).toBe(request.requestId);
      expect(pending!.status).toBe('pending');
    });
  });

  describe('Transaction Repository (Firestore)', () => {
    let txRepo: ITransactionRepository;
    let cardRepo: ICardRepository;
    let userRepo: IUserRepository;

    beforeAll(() => {
      txRepo = container.resolve<ITransactionRepository>(ServiceNames.TransactionRepository);
      cardRepo = container.resolve<ICardRepository>(ServiceNames.CardRepository);
      userRepo = container.resolve<IUserRepository>(ServiceNames.UserRepository);
    });

    it('should save and retrieve transactions', async () => {
      // Create test user and card
      const user = createUser({
        firebaseUid: `firebase-tx-${testId()}`,
        email: 'tx-test@example.com',
      });
      await userRepo.save(user);

      const card = createCard({
        limit: 5000,
        approvedBy: 'auto',
        scoreAtApproval: 600,
      });
      await cardRepo.save(user.ecosystemId, card);

      const tx = createPurchase({
        amount: 100,
        merchant: 'Test Merchant',
        idempotencyKey: `idem-fs-${testId()}`,
      });

      await txRepo.save(user.ecosystemId, card.cardId, tx);
      const result = await txRepo.findByCard(user.ecosystemId, card.cardId);

      expect(result.transactions).toHaveLength(1);
      expect(result.transactions[0]!.amount).toBe(100);
    });

    it('should get recent transactions', async () => {
      const user = createUser({
        firebaseUid: `firebase-tx-recent-${testId()}`,
        email: 'tx-recent@example.com',
      });
      await userRepo.save(user);

      const card = createCard({
        limit: 5000,
        approvedBy: 'auto',
        scoreAtApproval: 600,
      });
      await cardRepo.save(user.ecosystemId, card);

      const purchase = createPurchase({
        amount: 100,
        merchant: 'Test Merchant',
        idempotencyKey: `idem-recent-fs-1-${testId()}`,
      });
      const payment = createPayment({
        amount: 50,
        idempotencyKey: `idem-recent-fs-2-${testId()}`,
        paymentStatus: 'on_time',
      });

      await txRepo.save(user.ecosystemId, card.cardId, purchase);
      await txRepo.save(user.ecosystemId, card.cardId, payment);

      const recent = await txRepo.getRecent(user.ecosystemId, card.cardId, 5);
      expect(recent.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Outbox Repository (Firestore)', () => {
    let outboxRepo: IOutboxRepository;

    beforeAll(() => {
      outboxRepo = container.resolve<IOutboxRepository>(ServiceNames.OutboxRepository);
    });

    it('should save and find pending events', async () => {
      const event = createEvent({
        eventType: 'user.created',
        entityType: 'user',
        entityId: `user-fs-${testId()}`,
        ecosystemId: `eco-fs-${testId()}`,
        sequenceNumber: 1,
        payload: { email: 'test-fs@example.com' },
      });

      await outboxRepo.save(event);
      const pending = await outboxRepo.findPending();

      expect(pending.length).toBeGreaterThanOrEqual(1);
      const found = pending.find((e) => e.eventId === event.eventId);
      expect(found).not.toBeUndefined();
    });

    it('should mark event as sent', async () => {
      const event = createEvent({
        eventType: 'user.updated',
        entityType: 'user',
        entityId: `user-sent-${testId()}`,
        ecosystemId: `eco-sent-${testId()}`,
        sequenceNumber: 2,
        payload: {},
      });

      await outboxRepo.save(event);
      await outboxRepo.markSent(event.eventId);

      const pending = await outboxRepo.findPending();
      const found = pending.find((e) => e.eventId === event.eventId);
      expect(found).toBeUndefined();
    });
  });

  describe('Audit Log Repository (Firestore)', () => {
    let auditRepo: IAuditLogRepository;

    beforeAll(() => {
      auditRepo = container.resolve<IAuditLogRepository>(ServiceNames.AuditLogRepository);
    });

    it('should save and find audit logs by target', async () => {
      const targetId = `user-target-${testId()}`;
      const log = createAuditLog({
        adminEcosystemId: `admin-fs-${testId()}`,
        adminEmail: 'admin-fs@example.com',
        action: 'score.adjusted',
        targetType: 'user',
        targetId,
        reason: 'Manual adjustment',
        requestId: `req-fs-${testId()}`,
      });

      await auditRepo.save(log);
      const result = await auditRepo.findByTarget('user', targetId);

      expect(result.logs).toHaveLength(1);
      expect(result.logs[0]!.action).toBe('score.adjusted');
    });

    it('should find audit logs by actor', async () => {
      const adminId = `admin-actor-fs-${testId()}`;
      const log = createAuditLog({
        adminEcosystemId: adminId,
        adminEmail: 'actor-fs@example.com',
        action: 'card_request.approved',
        targetType: 'cardRequest',
        targetId: `request-fs-${testId()}`,
        reason: 'Good standing',
        requestId: `req-actor-fs-${testId()}`,
      });

      await auditRepo.save(log);
      const result = await auditRepo.findByActor(adminId);

      expect(result.logs).toHaveLength(1);
      expect(result.logs[0]!.adminEmail).toBe('actor-fs@example.com');
    });
  });
});
