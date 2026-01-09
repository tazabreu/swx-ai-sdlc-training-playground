import { describe, it, expect } from 'bun:test';
import {
  getTermsForTier,
  generateOffers,
  getOfferSummary,
} from '../../../../src/domain/services/offers.service';
import { createUser, type User } from '../../../../src/domain/entities/user.entity';
import { createCard } from '../../../../src/domain/entities/card.entity';
import {
  createCardRequest,
  type CardRequest,
} from '../../../../src/domain/entities/card-request.entity';

describe('Offers Service', () => {
  describe('getTermsForTier', () => {
    it('should return premium terms for high tier', () => {
      const terms = getTermsForTier('high');
      expect(terms.limit).toBe(10000);
      expect(terms.apr).toBe('12.99%');
      expect(terms.annualFee).toBe(0);
      expect(terms.features).toContain('Premium rewards program');
      expect(terms.features).toContain('2% cash back on all purchases');
    });

    it('should return standard terms for medium tier', () => {
      const terms = getTermsForTier('medium');
      expect(terms.limit).toBe(5000);
      expect(terms.apr).toBe('18.99%');
      expect(terms.annualFee).toBe(0);
      expect(terms.features).toContain('1% cash back on all purchases');
    });

    it('should return starter terms for low tier', () => {
      const terms = getTermsForTier('low');
      expect(terms.limit).toBe(2000);
      expect(terms.apr).toBe('24.99%');
      expect(terms.annualFee).toBe(29);
      expect(terms.features).toContain('Credit building program');
    });
  });

  describe('generateOffers', () => {
    const createTestUser = (overrides: Partial<User> = {}): User => ({
      ...createUser({
        firebaseUid: 'firebase-123',
        email: 'test@example.com',
      }),
      ...overrides,
    });

    it('should return credit card offer for user without card', () => {
      const user = createTestUser();
      const offers = generateOffers(user, [], [], []);

      expect(offers).toHaveLength(1);
      expect(offers[0]!.productType).toBe('credit-card');
      expect(offers[0]!.eligibility.eligible).toBe(true);
    });

    it('should not include offer for user with active card', () => {
      const user = createTestUser();
      const activeCard = createCard({
        limit: 5000,
        approvedBy: 'auto',
        scoreAtApproval: 600,
      });

      const offers = generateOffers(user, [activeCard], [], []);
      expect(offers).toHaveLength(0);
    });

    it('should show offer as not eligible for user with pending request', () => {
      const user = createTestUser();
      const pendingRequest = createCardRequest({
        idempotencyKey: 'test-key',
        scoreAtRequest: 600,
        tierAtRequest: 'medium',
      });

      const offers = generateOffers(user, [], [pendingRequest], []);

      expect(offers).toHaveLength(1);
      expect(offers[0]!.eligibility.eligible).toBe(false);
      expect(offers[0]!.eligibility.reason).toContain('pending');
    });

    it('should mark low tier offers as requiring approval', () => {
      const user = createTestUser({ currentScore: 400, tier: 'low' });
      const offers = generateOffers(user, [], [], []);

      expect(offers[0]!.eligibility.requiresApproval).toBe(true);
    });

    it('should not mark medium/high tier offers as requiring approval', () => {
      const mediumUser = createTestUser({ currentScore: 600, tier: 'medium' });
      const highUser = createTestUser({ currentScore: 800, tier: 'high' });

      const mediumOffers = generateOffers(mediumUser, [], [], []);
      const highOffers = generateOffers(highUser, [], [], []);

      expect(mediumOffers[0]!.eligibility.requiresApproval).toBe(false);
      expect(highOffers[0]!.eligibility.requiresApproval).toBe(false);
    });

    it('should show cooldown info for recently rejected users', () => {
      const user = createTestUser();
      const recentRejection: CardRequest = {
        ...createCardRequest({
          idempotencyKey: 'old-key',
          scoreAtRequest: 400,
          tierAtRequest: 'low',
        }),
        status: 'rejected',
        decision: {
          outcome: 'rejected',
          source: 'admin',
          adminId: 'admin-123',
          reason: 'Test rejection',
          decidedAt: new Date(),
        },
      };

      const offers = generateOffers(user, [], [], [recentRejection]);

      expect(offers[0]!.eligibility.eligible).toBe(false);
      expect(offers[0]!.eligibility.cooldownDaysRemaining).toBeDefined();
      expect(offers[0]!.eligibility.cooldownDaysRemaining).toBeGreaterThan(0);
    });

    it('should tailor offer name to tier', () => {
      const highUser = createTestUser({ currentScore: 800, tier: 'high' });
      const lowUser = createTestUser({ currentScore: 400, tier: 'low' });

      const highOffers = generateOffers(highUser, [], [], []);
      const lowOffers = generateOffers(lowUser, [], [], []);

      expect(highOffers[0]!.name).toContain('Premium');
      expect(lowOffers[0]!.name).toContain('Starter');
    });
  });

  describe('getOfferSummary', () => {
    const user = createUser({
      firebaseUid: 'firebase-123',
      email: 'test@example.com',
    });

    it('should indicate offers available for user without card', () => {
      const summary = getOfferSummary(user, [], []);

      expect(summary.hasOffers).toBe(true);
      expect(summary.creditCardAvailable).toBe(true);
    });

    it('should indicate no offers for user with active card', () => {
      const activeCard = createCard({
        limit: 5000,
        approvedBy: 'auto',
        scoreAtApproval: 600,
      });

      const summary = getOfferSummary(user, [activeCard], []);

      expect(summary.hasOffers).toBe(false);
      expect(summary.creditCardAvailable).toBe(false);
      expect(summary.message).toContain('already have an active credit card');
    });

    it('should indicate no offers for user with pending request', () => {
      const pendingRequest = createCardRequest({
        idempotencyKey: 'test-key',
        scoreAtRequest: 600,
        tierAtRequest: 'medium',
      });

      const summary = getOfferSummary(user, [], [pendingRequest]);

      expect(summary.hasOffers).toBe(false);
      expect(summary.creditCardAvailable).toBe(false);
      expect(summary.message).toContain('being reviewed');
    });

    it('should include approval message for low tier users', () => {
      const lowTierUser: User = {
        ...user,
        currentScore: 400,
        tier: 'low',
      };

      const summary = getOfferSummary(lowTierUser, [], []);

      expect(summary.hasOffers).toBe(true);
      expect(summary.message).toContain('subject to approval');
    });
  });
});
