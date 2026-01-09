/**
 * Shared Transaction Repository Tests
 *
 * These tests verify the ITransactionRepository contract and can be run
 * against any backend implementation (InMemory, Firestore, DynamoDB).
 */

import { describe, it, expect, beforeEach } from 'bun:test';
import type { ITransactionRepository } from '../../../src/infrastructure/persistence/interfaces/transaction.repository.js';
import type { ICardRepository } from '../../../src/infrastructure/persistence/interfaces/card.repository.js';
import type { IUserRepository } from '../../../src/infrastructure/persistence/interfaces/user.repository.js';
import {
  createTestPurchase,
  transactionFixtures,
  generateTransactionHistory,
  createTestUser,
  cardFixtures,
} from '../../setup/fixtures/index.js';

/**
 * Test suite factory for Transaction Repository
 */
export function createTransactionRepositoryTests(
  getTransactionRepository: () => ITransactionRepository,
  getCardRepository: () => ICardRepository,
  getUserRepository: () => IUserRepository,
  testIdPrefix: string = 'test'
): void {
  const testId = (): string =>
    `${testIdPrefix}-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;

  describe('Transaction Repository CRUD Operations', () => {
    let txRepo: ITransactionRepository;
    let cardRepo: ICardRepository;
    let userRepo: IUserRepository;

    beforeEach(() => {
      txRepo = getTransactionRepository();
      cardRepo = getCardRepository();
      userRepo = getUserRepository();
    });

    async function setupUserAndCard(): Promise<{ ecosystemId: string; cardId: string }> {
      const user = createTestUser({
        ecosystemId: `eco-${testId()}`,
        firebaseUid: `firebase-${testId()}`,
      });
      await userRepo.save(user);

      const card = cardFixtures.autoApprovedCard();
      await cardRepo.save(user.ecosystemId, card);

      return { ecosystemId: user.ecosystemId, cardId: card.cardId };
    }

    it('should save and retrieve purchase transaction', async () => {
      const { ecosystemId, cardId } = await setupUserAndCard();
      const purchase = transactionFixtures.mediumPurchase({
        idempotencyKey: `idem-purchase-${testId()}`,
      });

      await txRepo.save(ecosystemId, cardId, purchase);
      const result = await txRepo.findByCard(ecosystemId, cardId);

      expect(result.transactions.length).toBeGreaterThanOrEqual(1);
      const found = result.transactions.find((t) => t.transactionId === purchase.transactionId);
      expect(found).not.toBeUndefined();
      expect(found!.type).toBe('purchase');
      expect(found!.amount).toBe(150);
      expect(found!.merchant).toBe('Amazon');
    });

    it('should save and retrieve payment transaction', async () => {
      const { ecosystemId, cardId } = await setupUserAndCard();
      const payment = transactionFixtures.onTimePayment({
        idempotencyKey: `idem-payment-${testId()}`,
      });

      await txRepo.save(ecosystemId, cardId, payment);
      const result = await txRepo.findByCard(ecosystemId, cardId);

      expect(result.transactions.length).toBeGreaterThanOrEqual(1);
      const found = result.transactions.find((t) => t.transactionId === payment.transactionId);
      expect(found).not.toBeUndefined();
      expect(found!.type).toBe('payment');
      expect(found!.paymentStatus).toBe('on_time');
    });
  });

  describe('Transaction Repository Query Operations', () => {
    let txRepo: ITransactionRepository;
    let cardRepo: ICardRepository;
    let userRepo: IUserRepository;

    beforeEach(() => {
      txRepo = getTransactionRepository();
      cardRepo = getCardRepository();
      userRepo = getUserRepository();
    });

    async function setupUserAndCard(): Promise<{ ecosystemId: string; cardId: string }> {
      const user = createTestUser({
        ecosystemId: `eco-${testId()}`,
        firebaseUid: `firebase-${testId()}`,
      });
      await userRepo.save(user);

      const card = cardFixtures.autoApprovedCard();
      await cardRepo.save(user.ecosystemId, card);

      return { ecosystemId: user.ecosystemId, cardId: card.cardId };
    }

    it('should get recent transactions with limit', async () => {
      const { ecosystemId, cardId } = await setupUserAndCard();

      // Create multiple transactions
      const transactions = generateTransactionHistory(5);
      for (const tx of transactions) {
        await txRepo.save(ecosystemId, cardId, tx);
      }

      const recent = await txRepo.getRecent(ecosystemId, cardId, 3);
      expect(recent).toHaveLength(3);
    });

    it('should return all transactions for a card', async () => {
      const { ecosystemId, cardId } = await setupUserAndCard();

      const purchase1 = createTestPurchase({
        idempotencyKey: `idem-order-1-${testId()}`,
        amount: 100,
      });
      const purchase2 = createTestPurchase({
        idempotencyKey: `idem-order-2-${testId()}`,
        amount: 200,
      });
      const purchase3 = createTestPurchase({
        idempotencyKey: `idem-order-3-${testId()}`,
        amount: 300,
      });

      await txRepo.save(ecosystemId, cardId, purchase1);
      await txRepo.save(ecosystemId, cardId, purchase2);
      await txRepo.save(ecosystemId, cardId, purchase3);

      const result = await txRepo.findByCard(ecosystemId, cardId);
      expect(result.transactions.length).toBeGreaterThanOrEqual(3);

      // All three transactions should be in results
      const amounts = result.transactions.map((t) => t.amount);
      expect(amounts).toContain(100);
      expect(amounts).toContain(200);
      expect(amounts).toContain(300);
    });

    it('should filter transactions by type (purchase)', async () => {
      const { ecosystemId, cardId } = await setupUserAndCard();

      await txRepo.save(
        ecosystemId,
        cardId,
        transactionFixtures.mediumPurchase({
          idempotencyKey: `idem-filter-p-${testId()}`,
        })
      );
      await txRepo.save(
        ecosystemId,
        cardId,
        transactionFixtures.onTimePayment({
          idempotencyKey: `idem-filter-pay-${testId()}`,
        })
      );

      const result = await txRepo.findByCard(ecosystemId, cardId, { type: 'purchase' });
      expect(result.transactions.length).toBeGreaterThanOrEqual(1);
      expect(result.transactions.every((t) => t.type === 'purchase')).toBe(true);
    });

    it('should filter transactions by type (payment)', async () => {
      const { ecosystemId, cardId } = await setupUserAndCard();

      await txRepo.save(
        ecosystemId,
        cardId,
        transactionFixtures.mediumPurchase({
          idempotencyKey: `idem-filter-pur-${testId()}`,
        })
      );
      await txRepo.save(
        ecosystemId,
        cardId,
        transactionFixtures.onTimePayment({
          idempotencyKey: `idem-filter-pmt-${testId()}`,
        })
      );

      const result = await txRepo.findByCard(ecosystemId, cardId, { type: 'payment' });
      expect(result.transactions.length).toBeGreaterThanOrEqual(1);
      expect(result.transactions.every((t) => t.type === 'payment')).toBe(true);
    });
  });

  describe('Transaction Repository Pagination', () => {
    let txRepo: ITransactionRepository;
    let cardRepo: ICardRepository;
    let userRepo: IUserRepository;

    beforeEach(() => {
      txRepo = getTransactionRepository();
      cardRepo = getCardRepository();
      userRepo = getUserRepository();
    });

    async function setupUserAndCard(): Promise<{ ecosystemId: string; cardId: string }> {
      const user = createTestUser({
        ecosystemId: `eco-${testId()}`,
        firebaseUid: `firebase-${testId()}`,
      });
      await userRepo.save(user);

      const card = cardFixtures.autoApprovedCard();
      await cardRepo.save(user.ecosystemId, card);

      return { ecosystemId: user.ecosystemId, cardId: card.cardId };
    }

    it('should support pagination with limit', async () => {
      const { ecosystemId, cardId } = await setupUserAndCard();

      // Create transactions
      const transactions = generateTransactionHistory(10, { mixTypes: false });
      for (const tx of transactions) {
        await txRepo.save(ecosystemId, cardId, tx);
      }

      // Test that limit parameter works
      const page1 = await txRepo.findByCard(ecosystemId, cardId, undefined, { limit: 5 });
      expect(page1.transactions.length).toBeLessThanOrEqual(5);

      // If there are more transactions, hasMore should indicate it
      const allTx = await txRepo.findByCard(ecosystemId, cardId);
      if (allTx.transactions.length > 5) {
        expect(page1.hasMore).toBe(true);
      }
    });
  });

  describe('Transaction Repository Payment Types', () => {
    let txRepo: ITransactionRepository;
    let cardRepo: ICardRepository;
    let userRepo: IUserRepository;

    beforeEach(() => {
      txRepo = getTransactionRepository();
      cardRepo = getCardRepository();
      userRepo = getUserRepository();
    });

    async function setupUserAndCard(): Promise<{ ecosystemId: string; cardId: string }> {
      const user = createTestUser({
        ecosystemId: `eco-${testId()}`,
        firebaseUid: `firebase-${testId()}`,
      });
      await userRepo.save(user);

      const card = cardFixtures.autoApprovedCard();
      await cardRepo.save(user.ecosystemId, card);

      return { ecosystemId: user.ecosystemId, cardId: card.cardId };
    }

    it('should store on-time payment with score impact', async () => {
      const { ecosystemId, cardId } = await setupUserAndCard();
      const payment = transactionFixtures.onTimePayment({
        idempotencyKey: `idem-ontime-${testId()}`,
      });

      await txRepo.save(ecosystemId, cardId, payment);
      const result = await txRepo.findByCard(ecosystemId, cardId, { type: 'payment' });

      const found = result.transactions.find((t) => t.transactionId === payment.transactionId);
      expect(found!.paymentStatus).toBe('on_time');
      expect(found!.scoreImpact).toBe(10);
    });

    it('should store late payment with days overdue', async () => {
      const { ecosystemId, cardId } = await setupUserAndCard();
      const payment = transactionFixtures.latePayment({
        idempotencyKey: `idem-late-${testId()}`,
      });

      await txRepo.save(ecosystemId, cardId, payment);
      const result = await txRepo.findByCard(ecosystemId, cardId, { type: 'payment' });

      const found = result.transactions.find((t) => t.transactionId === payment.transactionId);
      expect(found!.paymentStatus).toBe('late');
      expect(found!.daysOverdue).toBe(15);
      expect(found!.scoreImpact).toBe(-20);
    });
  });

  describe('Transaction Repository Failed Transactions', () => {
    let txRepo: ITransactionRepository;
    let cardRepo: ICardRepository;
    let userRepo: IUserRepository;

    beforeEach(() => {
      txRepo = getTransactionRepository();
      cardRepo = getCardRepository();
      userRepo = getUserRepository();
    });

    async function setupUserAndCard(): Promise<{ ecosystemId: string; cardId: string }> {
      const user = createTestUser({
        ecosystemId: `eco-${testId()}`,
        firebaseUid: `firebase-${testId()}`,
      });
      await userRepo.save(user);

      const card = cardFixtures.autoApprovedCard();
      await cardRepo.save(user.ecosystemId, card);

      return { ecosystemId: user.ecosystemId, cardId: card.cardId };
    }

    it('should store failed transaction with reason', async () => {
      const { ecosystemId, cardId } = await setupUserAndCard();
      const failed = transactionFixtures.failedInsufficientCredit({
        idempotencyKey: `idem-failed-${testId()}`,
      });

      await txRepo.save(ecosystemId, cardId, failed);
      const result = await txRepo.findByCard(ecosystemId, cardId);

      const found = result.transactions.find((t) => t.transactionId === failed.transactionId);
      expect(found!.status).toBe('failed');
      expect(found!.failureReason).toBe('Insufficient credit available');
    });
  });
}
