/**
 * Shared Card Repository Tests
 *
 * These tests verify the ICardRepository contract and can be run
 * against any backend implementation (InMemory, Firestore, DynamoDB).
 */

import { describe, it, expect, beforeEach } from 'bun:test';
import type { ICardRepository } from '../../../src/infrastructure/persistence/interfaces/card.repository.js';
import type { IUserRepository } from '../../../src/infrastructure/persistence/interfaces/user.repository.js';
import { createTestCard, cardFixtures, createTestUser } from '../../setup/fixtures/index.js';

/**
 * Test suite factory for Card Repository
 *
 * @param getCardRepository - Function that returns a fresh card repository
 * @param getUserRepository - Function that returns a fresh user repository (for setup)
 * @param testIdPrefix - Prefix for unique test IDs
 */
export function createCardRepositoryTests(
  getCardRepository: () => ICardRepository,
  getUserRepository: () => IUserRepository,
  testIdPrefix: string = 'test'
): void {
  const testId = (): string =>
    `${testIdPrefix}-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;

  describe('Card Repository CRUD Operations', () => {
    let cardRepo: ICardRepository;
    let userRepo: IUserRepository;

    beforeEach(() => {
      cardRepo = getCardRepository();
      userRepo = getUserRepository();
    });

    async function createUserForCard(): Promise<string> {
      const user = createTestUser({
        ecosystemId: `eco-${testId()}`,
        firebaseUid: `firebase-${testId()}`,
      });
      await userRepo.save(user);
      return user.ecosystemId;
    }

    it('should save and retrieve card by ID', async () => {
      const ecosystemId = await createUserForCard();
      const card = cardFixtures.autoApprovedCard();

      await cardRepo.save(ecosystemId, card);
      const retrieved = await cardRepo.findById(ecosystemId, card.cardId);

      expect(retrieved).not.toBeNull();
      expect(retrieved!.cardId).toBe(card.cardId);
      expect(retrieved!.limit).toBe(card.limit);
      expect(retrieved!.status).toBe('active');
    });

    it('should return null for non-existent card', async () => {
      const ecosystemId = await createUserForCard();
      const result = await cardRepo.findById(ecosystemId, `nonexistent-${testId()}`);
      expect(result).toBeNull();
    });

    it('should find all cards for a user', async () => {
      const ecosystemId = await createUserForCard();
      const card1 = cardFixtures.autoApprovedCard();
      const card2 = cardFixtures.adminApprovedCard();

      await cardRepo.save(ecosystemId, card1);
      await cardRepo.save(ecosystemId, card2);

      const cards = await cardRepo.findByUser(ecosystemId);
      expect(cards.length).toBeGreaterThanOrEqual(2);

      const cardIds = cards.map((c) => c.cardId);
      expect(cardIds).toContain(card1.cardId);
      expect(cardIds).toContain(card2.cardId);
    });

    it('should update card', async () => {
      const ecosystemId = await createUserForCard();
      const card = cardFixtures.autoApprovedCard();

      await cardRepo.save(ecosystemId, card);

      const updated = { ...card, status: 'suspended' as const, statusReason: 'Test suspension' };
      await cardRepo.save(ecosystemId, updated);

      const retrieved = await cardRepo.findById(ecosystemId, card.cardId);
      expect(retrieved!.status).toBe('suspended');
      expect(retrieved!.statusReason).toBe('Test suspension');
    });

    it('should delete card', async () => {
      const ecosystemId = await createUserForCard();
      const card = cardFixtures.autoApprovedCard();

      await cardRepo.save(ecosystemId, card);
      await cardRepo.delete(ecosystemId, card.cardId);

      const retrieved = await cardRepo.findById(ecosystemId, card.cardId);
      expect(retrieved).toBeNull();
    });
  });

  describe('Card Repository Balance Operations', () => {
    let cardRepo: ICardRepository;
    let userRepo: IUserRepository;

    beforeEach(() => {
      cardRepo = getCardRepository();
      userRepo = getUserRepository();
    });

    async function createUserForCard(): Promise<string> {
      const user = createTestUser({
        ecosystemId: `eco-${testId()}`,
        firebaseUid: `firebase-${testId()}`,
      });
      await userRepo.save(user);
      return user.ecosystemId;
    }

    it('should update card balance with optimistic locking', async () => {
      const ecosystemId = await createUserForCard();
      const card = createTestCard({ limit: 5000, balance: 0 });

      await cardRepo.save(ecosystemId, card);
      await cardRepo.updateBalance(ecosystemId, card.cardId, {
        balance: 1000,
        availableCredit: 4000,
        minimumPayment: 50,
        version: card.version + 1,
      });

      const updated = await cardRepo.findById(ecosystemId, card.cardId);
      expect(updated!.balance).toBe(1000);
      expect(updated!.availableCredit).toBe(4000);
      expect(updated!.minimumPayment).toBe(50);
      expect(updated!.version).toBe(2);
    });

    it('should reject balance update with stale version', async () => {
      const ecosystemId = await createUserForCard();
      const card = createTestCard({ limit: 5000, balance: 0 });

      await cardRepo.save(ecosystemId, card);

      // First update succeeds
      await cardRepo.updateBalance(ecosystemId, card.cardId, {
        balance: 1000,
        availableCredit: 4000,
        minimumPayment: 50,
        version: card.version + 1,
      });

      // Second update with same version should fail
      let error: Error | null = null;
      try {
        await cardRepo.updateBalance(ecosystemId, card.cardId, {
          balance: 2000,
          availableCredit: 3000,
          minimumPayment: 100,
          version: card.version + 1, // Using stale version
        });
      } catch (e) {
        error = e as Error;
      }

      expect(error).not.toBeNull();
    });

    it('should handle balance at limit (maxed out card)', async () => {
      const ecosystemId = await createUserForCard();
      const card = createTestCard({ limit: 5000, balance: 0 });

      await cardRepo.save(ecosystemId, card);
      await cardRepo.updateBalance(ecosystemId, card.cardId, {
        balance: 5000,
        availableCredit: 0,
        minimumPayment: 250,
        version: card.version + 1,
      });

      const maxed = await cardRepo.findById(ecosystemId, card.cardId);
      expect(maxed!.balance).toBe(5000);
      expect(maxed!.availableCredit).toBe(0);
    });
  });

  describe('Card Repository Status Filtering', () => {
    let cardRepo: ICardRepository;
    let userRepo: IUserRepository;

    beforeEach(() => {
      cardRepo = getCardRepository();
      userRepo = getUserRepository();
    });

    async function createUserForCard(): Promise<string> {
      const user = createTestUser({
        ecosystemId: `eco-${testId()}`,
        firebaseUid: `firebase-${testId()}`,
      });
      await userRepo.save(user);
      return user.ecosystemId;
    }

    it('should filter cards by active status', async () => {
      const ecosystemId = await createUserForCard();
      const activeCard = cardFixtures.autoApprovedCard();
      const suspendedCard = cardFixtures.suspendedCard();

      await cardRepo.save(ecosystemId, activeCard);
      await cardRepo.save(ecosystemId, suspendedCard);

      const activeCards = await cardRepo.findByUser(ecosystemId, { status: 'active' });
      expect(activeCards.length).toBeGreaterThanOrEqual(1);
      expect(activeCards.every((c) => c.status === 'active')).toBe(true);
    });

    it('should filter cards by suspended status', async () => {
      const ecosystemId = await createUserForCard();
      const activeCard = cardFixtures.autoApprovedCard();
      const suspendedCard = cardFixtures.suspendedCard();

      await cardRepo.save(ecosystemId, activeCard);
      await cardRepo.save(ecosystemId, suspendedCard);

      const suspendedCards = await cardRepo.findByUser(ecosystemId, { status: 'suspended' });
      expect(suspendedCards.length).toBeGreaterThanOrEqual(1);
      expect(suspendedCards.every((c) => c.status === 'suspended')).toBe(true);
    });

    it('should filter cards by cancelled status', async () => {
      const ecosystemId = await createUserForCard();
      const activeCard = cardFixtures.autoApprovedCard();
      const cancelledCard = cardFixtures.cancelledCard();

      await cardRepo.save(ecosystemId, activeCard);
      await cardRepo.save(ecosystemId, cancelledCard);

      const cancelledCards = await cardRepo.findByUser(ecosystemId, { status: 'cancelled' });
      expect(cancelledCards.length).toBeGreaterThanOrEqual(1);
      expect(cancelledCards.every((c) => c.status === 'cancelled')).toBe(true);
    });
  });

  describe('Card Repository Approval Source', () => {
    let cardRepo: ICardRepository;
    let userRepo: IUserRepository;

    beforeEach(() => {
      cardRepo = getCardRepository();
      userRepo = getUserRepository();
    });

    async function createUserForCard(): Promise<string> {
      const user = createTestUser({
        ecosystemId: `eco-${testId()}`,
        firebaseUid: `firebase-${testId()}`,
      });
      await userRepo.save(user);
      return user.ecosystemId;
    }

    it('should preserve auto-approval source', async () => {
      const ecosystemId = await createUserForCard();
      const card = cardFixtures.autoApprovedCard();

      await cardRepo.save(ecosystemId, card);
      const retrieved = await cardRepo.findById(ecosystemId, card.cardId);

      expect(retrieved!.approvedBy).toBe('auto');
      expect(retrieved!.approvedByAdminId).toBeUndefined();
    });

    it('should preserve admin-approval source with admin ID', async () => {
      const ecosystemId = await createUserForCard();
      const card = cardFixtures.adminApprovedCard();

      await cardRepo.save(ecosystemId, card);
      const retrieved = await cardRepo.findById(ecosystemId, card.cardId);

      expect(retrieved!.approvedBy).toBe('admin');
      expect(retrieved!.approvedByAdminId).toBeDefined();
      expect(retrieved!.approvedByAdminId).not.toBe('');
    });

    it('should preserve score at approval', async () => {
      const ecosystemId = await createUserForCard();
      const card = createTestCard({ scoreAtApproval: 750, limit: 10000 });

      await cardRepo.save(ecosystemId, card);
      const retrieved = await cardRepo.findById(ecosystemId, card.cardId);

      expect(retrieved!.scoreAtApproval).toBe(750);
    });
  });
}
