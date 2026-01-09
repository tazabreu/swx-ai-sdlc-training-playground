/**
 * Shared User Repository Tests
 *
 * These tests verify the IUserRepository contract and can be run
 * against any backend implementation (InMemory, Firestore, DynamoDB).
 */

import { describe, it, expect, beforeEach } from 'bun:test';
import type { IUserRepository } from '../../../src/infrastructure/persistence/interfaces/user.repository.js';
import { createTestUser, userFixtures } from '../../setup/fixtures/index.js';

/**
 * Test suite factory for User Repository
 *
 * @param getRepository - Function that returns a fresh repository instance
 * @param testIdPrefix - Prefix for unique test IDs
 */
export function createUserRepositoryTests(
  getRepository: () => IUserRepository,
  testIdPrefix: string = 'test'
): void {
  const testId = (): string =>
    `${testIdPrefix}-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;

  describe('User Repository CRUD Operations', () => {
    let userRepo: IUserRepository;

    beforeEach(() => {
      userRepo = getRepository();
    });

    it('should save and retrieve user by ecosystemId', async () => {
      const user = createTestUser({
        ecosystemId: `eco-${testId()}`,
        firebaseUid: `firebase-${testId()}`,
        email: `user-${testId()}@example.com`,
      });

      await userRepo.save(user);
      const retrieved = await userRepo.findById(user.ecosystemId);

      expect(retrieved).not.toBeNull();
      expect(retrieved!.ecosystemId).toBe(user.ecosystemId);
      expect(retrieved!.email).toBe(user.email);
      expect(retrieved!.firebaseUid).toBe(user.firebaseUid);
    });

    it('should return null for non-existent user', async () => {
      const result = await userRepo.findById(`nonexistent-${testId()}`);
      expect(result).toBeNull();
    });

    it('should find user by Firebase UID', async () => {
      const firebaseUid = `firebase-uid-${testId()}`;
      const user = createTestUser({
        ecosystemId: `eco-${testId()}`,
        firebaseUid,
        email: `uid-test-${testId()}@example.com`,
      });

      await userRepo.save(user);
      const retrieved = await userRepo.findByFirebaseUid(firebaseUid);

      expect(retrieved).not.toBeNull();
      expect(retrieved!.ecosystemId).toBe(user.ecosystemId);
      expect(retrieved!.firebaseUid).toBe(firebaseUid);
    });

    it('should return null for non-existent Firebase UID', async () => {
      const result = await userRepo.findByFirebaseUid(`nonexistent-uid-${testId()}`);
      expect(result).toBeNull();
    });

    it('should update existing user', async () => {
      const user = createTestUser({
        ecosystemId: `eco-update-${testId()}`,
        firebaseUid: `firebase-update-${testId()}`,
        email: `before-${testId()}@example.com`,
      });

      await userRepo.save(user);

      // Update user with new email
      const updatedUser = { ...user, email: `after-${testId()}@example.com` };
      await userRepo.save(updatedUser);

      const retrieved = await userRepo.findById(user.ecosystemId);
      expect(retrieved!.email).toBe(updatedUser.email);
    });

    it('should delete user', async () => {
      const firebaseUid = `firebase-delete-${testId()}`;
      const user = createTestUser({
        ecosystemId: `eco-delete-${testId()}`,
        firebaseUid,
        email: `delete-${testId()}@example.com`,
      });

      await userRepo.save(user);
      await userRepo.delete(user.ecosystemId);

      const byId = await userRepo.findById(user.ecosystemId);
      expect(byId).toBeNull();

      const byUid = await userRepo.findByFirebaseUid(firebaseUid);
      expect(byUid).toBeNull();
    });
  });

  describe('User Repository Score Operations', () => {
    let userRepo: IUserRepository;

    beforeEach(() => {
      userRepo = getRepository();
    });

    it('should update user score', async () => {
      const user = userFixtures.mediumTierUser({
        ecosystemId: `eco-score-${testId()}`,
        firebaseUid: `firebase-score-${testId()}`,
      });

      await userRepo.save(user);
      const score = await userRepo.updateScore(user.ecosystemId, 700, 'test_upgrade', 'system');

      expect(score.value).toBe(700);
      expect(score.previousValue).toBe(user.currentScore);
      expect(score.delta).toBe(700 - user.currentScore);
      expect(score.reason).toBe('test_upgrade');
    });

    it('should track score history', async () => {
      const user = userFixtures.mediumTierUser({
        ecosystemId: `eco-history-${testId()}`,
        firebaseUid: `firebase-history-${testId()}`,
      });

      await userRepo.save(user);
      await userRepo.updateScore(user.ecosystemId, 600, 'payment_on_time', 'system');
      await userRepo.updateScore(user.ecosystemId, 700, 'credit_increase', 'system');

      const history = await userRepo.getScoreHistory(user.ecosystemId);
      expect(history.length).toBeGreaterThanOrEqual(2);

      // Most recent should be first (700)
      expect(history[0]!.value).toBe(700);
      expect(history[1]!.value).toBe(600);
    });

    it('should record admin score changes', async () => {
      const user = userFixtures.lowTierUser({
        ecosystemId: `eco-admin-${testId()}`,
        firebaseUid: `firebase-admin-${testId()}`,
      });
      const adminId = `admin-${testId()}`;

      await userRepo.save(user);
      const score = await userRepo.updateScore(
        user.ecosystemId,
        600,
        'manual_adjustment',
        'admin',
        adminId
      );

      expect(score.value).toBe(600);
      expect(score.source).toBe('admin');
      expect(score.sourceId).toBe(adminId);
    });

    it('should handle negative score adjustments', async () => {
      const user = userFixtures.highTierUser({
        ecosystemId: `eco-neg-${testId()}`,
        firebaseUid: `firebase-neg-${testId()}`,
      });

      await userRepo.save(user);
      // High tier user starts at 750, reduce to 500
      const score = await userRepo.updateScore(user.ecosystemId, 500, 'late_payment', 'system');

      expect(score.value).toBe(500);
      // Delta should be 500 - 750 = -250
      expect(score.previousValue).toBe(750);
      expect(score.delta).toBe(-250);
    });
  });

  describe('User Repository Tier Handling', () => {
    let userRepo: IUserRepository;

    beforeEach(() => {
      userRepo = getRepository();
    });

    it('should store low-tier user correctly', async () => {
      const user = userFixtures.lowTierUser({
        ecosystemId: `eco-low-${testId()}`,
        firebaseUid: `firebase-low-${testId()}`,
      });

      await userRepo.save(user);
      const retrieved = await userRepo.findById(user.ecosystemId);

      expect(retrieved!.tier).toBe('low');
      expect(retrieved!.currentScore).toBe(400);
    });

    it('should store medium-tier user correctly', async () => {
      const user = userFixtures.mediumTierUser({
        ecosystemId: `eco-med-${testId()}`,
        firebaseUid: `firebase-med-${testId()}`,
      });

      await userRepo.save(user);
      const retrieved = await userRepo.findById(user.ecosystemId);

      expect(retrieved!.tier).toBe('medium');
      expect(retrieved!.currentScore).toBe(550);
    });

    it('should store high-tier user correctly', async () => {
      const user = userFixtures.highTierUser({
        ecosystemId: `eco-high-${testId()}`,
        firebaseUid: `firebase-high-${testId()}`,
      });

      await userRepo.save(user);
      const retrieved = await userRepo.findById(user.ecosystemId);

      expect(retrieved!.tier).toBe('high');
      expect(retrieved!.currentScore).toBe(750);
    });

    it('should store boundary score users correctly', async () => {
      const boundaryMedium = userFixtures.boundaryMediumUser({
        ecosystemId: `eco-bnd-med-${testId()}`,
        firebaseUid: `firebase-bnd-med-${testId()}`,
      });
      const boundaryHigh = userFixtures.boundaryHighUser({
        ecosystemId: `eco-bnd-high-${testId()}`,
        firebaseUid: `firebase-bnd-high-${testId()}`,
      });

      await userRepo.save(boundaryMedium);
      await userRepo.save(boundaryHigh);

      const retrievedMedium = await userRepo.findById(boundaryMedium.ecosystemId);
      const retrievedHigh = await userRepo.findById(boundaryHigh.ecosystemId);

      expect(retrievedMedium!.currentScore).toBe(500);
      expect(retrievedMedium!.tier).toBe('medium');
      expect(retrievedHigh!.currentScore).toBe(700);
      expect(retrievedHigh!.tier).toBe('high');
    });
  });

  describe('User Repository Role Handling', () => {
    let userRepo: IUserRepository;

    beforeEach(() => {
      userRepo = getRepository();
    });

    it('should store regular user role', async () => {
      const user = createTestUser({
        ecosystemId: `eco-user-${testId()}`,
        firebaseUid: `firebase-user-${testId()}`,
        role: 'user',
      });

      await userRepo.save(user);
      const retrieved = await userRepo.findById(user.ecosystemId);

      expect(retrieved!.role).toBe('user');
    });

    it('should store admin user role', async () => {
      const user = userFixtures.adminUser({
        ecosystemId: `eco-admin-role-${testId()}`,
        firebaseUid: `firebase-admin-role-${testId()}`,
      });

      await userRepo.save(user);
      const retrieved = await userRepo.findById(user.ecosystemId);

      expect(retrieved!.role).toBe('admin');
    });
  });
}
