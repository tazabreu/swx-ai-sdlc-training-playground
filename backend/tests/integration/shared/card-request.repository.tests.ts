/**
 * Shared Card Request Repository Tests
 *
 * These tests verify the ICardRequestRepository contract and can be run
 * against any backend implementation (InMemory, Firestore, DynamoDB).
 */

import { describe, it, expect, beforeEach } from 'bun:test';
import type { ICardRequestRepository } from '../../../src/infrastructure/persistence/interfaces/card-request.repository.js';
import type { IUserRepository } from '../../../src/infrastructure/persistence/interfaces/user.repository.js';
import {
  createTestCardRequest,
  cardRequestFixtures,
  createTestUser,
} from '../../setup/fixtures/index.js';

/**
 * Test suite factory for Card Request Repository
 */
export function createCardRequestRepositoryTests(
  getCardRequestRepository: () => ICardRequestRepository,
  getUserRepository: () => IUserRepository,
  testIdPrefix: string = 'test'
): void {
  const testId = (): string =>
    `${testIdPrefix}-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;

  describe('Card Request Repository CRUD Operations', () => {
    let requestRepo: ICardRequestRepository;
    let userRepo: IUserRepository;

    beforeEach(() => {
      requestRepo = getCardRequestRepository();
      userRepo = getUserRepository();
    });

    async function createUserForRequest(): Promise<string> {
      const user = createTestUser({
        ecosystemId: `eco-${testId()}`,
        firebaseUid: `firebase-${testId()}`,
      });
      await userRepo.save(user);
      return user.ecosystemId;
    }

    it('should save and retrieve card request by ID', async () => {
      const ecosystemId = await createUserForRequest();
      const request = createTestCardRequest({
        idempotencyKey: `idem-${testId()}`,
      });

      await requestRepo.save(ecosystemId, request);
      const retrieved = await requestRepo.findById(ecosystemId, request.requestId);

      expect(retrieved).not.toBeNull();
      expect(retrieved!.requestId).toBe(request.requestId);
      expect(retrieved!.idempotencyKey).toBe(request.idempotencyKey);
    });

    it('should return null for non-existent request', async () => {
      const ecosystemId = await createUserForRequest();
      const result = await requestRepo.findById(ecosystemId, `nonexistent-${testId()}`);
      expect(result).toBeNull();
    });

    it('should find pending request by user', async () => {
      const ecosystemId = await createUserForRequest();
      const request = cardRequestFixtures.pendingMediumTier({
        idempotencyKey: `idem-pending-${testId()}`,
      });

      await requestRepo.save(ecosystemId, request);
      const pending = await requestRepo.findPendingByUser(ecosystemId);

      expect(pending).not.toBeNull();
      expect(pending!.requestId).toBe(request.requestId);
      expect(pending!.status).toBe('pending');
    });
  });

  describe('Card Request Repository Status Transitions', () => {
    let requestRepo: ICardRequestRepository;
    let userRepo: IUserRepository;

    beforeEach(() => {
      requestRepo = getCardRequestRepository();
      userRepo = getUserRepository();
    });

    async function createUserForRequest(): Promise<string> {
      const user = createTestUser({
        ecosystemId: `eco-${testId()}`,
        firebaseUid: `firebase-${testId()}`,
      });
      await userRepo.save(user);
      return user.ecosystemId;
    }

    it('should update request status to approved', async () => {
      const ecosystemId = await createUserForRequest();
      const request = cardRequestFixtures.pendingHighTier({
        idempotencyKey: `idem-approve-${testId()}`,
      });

      await requestRepo.save(ecosystemId, request);

      const approved = {
        ...request,
        status: 'approved' as const,
        decision: {
          outcome: 'approved' as const,
          source: 'auto' as const,
          approvedLimit: 10000,
          decidedAt: new Date(),
        },
        resultingCardId: `card-${testId()}`,
        updatedAt: new Date(),
      };
      await requestRepo.save(ecosystemId, approved);

      const retrieved = await requestRepo.findById(ecosystemId, request.requestId);
      expect(retrieved!.status).toBe('approved');
      expect(retrieved!.decision?.outcome).toBe('approved');
      expect(retrieved!.resultingCardId).toBeDefined();
    });

    it('should update request status to rejected', async () => {
      const ecosystemId = await createUserForRequest();
      const adminId = `admin-${testId()}`;
      const request = cardRequestFixtures.pendingLowTier({
        idempotencyKey: `idem-reject-${testId()}`,
      });

      await requestRepo.save(ecosystemId, request);

      const rejected = {
        ...request,
        status: 'rejected' as const,
        decision: {
          outcome: 'rejected' as const,
          source: 'admin' as const,
          adminId,
          reason: 'Insufficient documentation',
          decidedAt: new Date(),
        },
        updatedAt: new Date(),
      };
      await requestRepo.save(ecosystemId, rejected);

      const retrieved = await requestRepo.findById(ecosystemId, request.requestId);
      expect(retrieved!.status).toBe('rejected');
      expect(retrieved!.decision?.outcome).toBe('rejected');
      expect(retrieved!.decision?.reason).toBe('Insufficient documentation');
    });

    it('should clear pending status after approval', async () => {
      const ecosystemId = await createUserForRequest();
      const request = cardRequestFixtures.pendingMediumTier({
        idempotencyKey: `idem-clear-${testId()}`,
      });

      await requestRepo.save(ecosystemId, request);

      // Verify pending
      let pending = await requestRepo.findPendingByUser(ecosystemId);
      expect(pending).not.toBeNull();

      // Approve
      const approved = {
        ...request,
        status: 'approved' as const,
        decision: {
          outcome: 'approved' as const,
          source: 'auto' as const,
          approvedLimit: 5000,
          decidedAt: new Date(),
        },
        resultingCardId: `card-${testId()}`,
        updatedAt: new Date(),
      };
      await requestRepo.save(ecosystemId, approved);

      // Verify no longer pending
      pending = await requestRepo.findPendingByUser(ecosystemId);
      expect(pending).toBeNull();
    });
  });

  describe('Card Request Repository Admin Queries', () => {
    let requestRepo: ICardRequestRepository;
    let userRepo: IUserRepository;

    beforeEach(() => {
      requestRepo = getCardRequestRepository();
      userRepo = getUserRepository();
    });

    async function createUserForRequest(suffix: string = ''): Promise<string> {
      const user = createTestUser({
        ecosystemId: `eco-${suffix}-${testId()}`,
        firebaseUid: `firebase-${suffix}-${testId()}`,
      });
      await userRepo.save(user);
      return user.ecosystemId;
    }

    it('should list all pending requests', async () => {
      const ecosystemId1 = await createUserForRequest('user1');
      const ecosystemId2 = await createUserForRequest('user2');

      const request1 = cardRequestFixtures.pendingLowTier({
        idempotencyKey: `idem-all-1-${testId()}`,
      });
      const request2 = cardRequestFixtures.pendingHighTier({
        idempotencyKey: `idem-all-2-${testId()}`,
      });

      await requestRepo.save(ecosystemId1, request1);
      await requestRepo.save(ecosystemId2, request2);

      const result = await requestRepo.findAllPending();
      expect(result.requests.length).toBeGreaterThanOrEqual(2);
    });

    it('should filter pending requests by tier', async () => {
      const ecosystemId1 = await createUserForRequest('tier1');
      const ecosystemId2 = await createUserForRequest('tier2');

      const lowTierRequest = cardRequestFixtures.pendingLowTier({
        idempotencyKey: `idem-tier-low-${testId()}`,
      });
      const highTierRequest = cardRequestFixtures.pendingHighTier({
        idempotencyKey: `idem-tier-high-${testId()}`,
      });

      await requestRepo.save(ecosystemId1, lowTierRequest);
      await requestRepo.save(ecosystemId2, highTierRequest);

      const lowTierResult = await requestRepo.findAllPending(undefined, { tier: 'low' });
      expect(lowTierResult.requests.length).toBeGreaterThanOrEqual(1);
      expect(lowTierResult.requests.every((r) => r.tierAtRequest === 'low')).toBe(true);
    });

    it('should paginate pending requests', async () => {
      const ecosystemId1 = await createUserForRequest('page1');
      const ecosystemId2 = await createUserForRequest('page2');
      const ecosystemId3 = await createUserForRequest('page3');

      await requestRepo.save(
        ecosystemId1,
        cardRequestFixtures.pendingLowTier({ idempotencyKey: `idem-page-1-${testId()}` })
      );
      await requestRepo.save(
        ecosystemId2,
        cardRequestFixtures.pendingLowTier({ idempotencyKey: `idem-page-2-${testId()}` })
      );
      await requestRepo.save(
        ecosystemId3,
        cardRequestFixtures.pendingLowTier({ idempotencyKey: `idem-page-3-${testId()}` })
      );

      const page1 = await requestRepo.findAllPending(undefined, undefined, { limit: 2 });
      expect(page1.requests).toHaveLength(2);
      expect(page1.hasMore).toBe(true);
    });

    it('should return request count', async () => {
      const ecosystemId = await createUserForRequest('count');
      await requestRepo.save(
        ecosystemId,
        cardRequestFixtures.pendingMediumTier({ idempotencyKey: `idem-count-${testId()}` })
      );

      const result = await requestRepo.findAllPending();
      expect(result.totalCount).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Card Request Repository Tier Preservation', () => {
    let requestRepo: ICardRequestRepository;
    let userRepo: IUserRepository;

    beforeEach(() => {
      requestRepo = getCardRequestRepository();
      userRepo = getUserRepository();
    });

    async function createUserForRequest(): Promise<string> {
      const user = createTestUser({
        ecosystemId: `eco-${testId()}`,
        firebaseUid: `firebase-${testId()}`,
      });
      await userRepo.save(user);
      return user.ecosystemId;
    }

    it('should preserve low tier request data', async () => {
      const ecosystemId = await createUserForRequest();
      const request = cardRequestFixtures.pendingLowTier({
        idempotencyKey: `idem-low-${testId()}`,
      });

      await requestRepo.save(ecosystemId, request);
      const retrieved = await requestRepo.findById(ecosystemId, request.requestId);

      expect(retrieved!.tierAtRequest).toBe('low');
      expect(retrieved!.scoreAtRequest).toBe(400);
    });

    it('should preserve high tier request data', async () => {
      const ecosystemId = await createUserForRequest();
      const request = cardRequestFixtures.pendingHighTier({
        idempotencyKey: `idem-high-${testId()}`,
      });

      await requestRepo.save(ecosystemId, request);
      const retrieved = await requestRepo.findById(ecosystemId, request.requestId);

      expect(retrieved!.tierAtRequest).toBe('high');
      expect(retrieved!.scoreAtRequest).toBe(750);
    });
  });
}
