import { describe, it, expect } from 'bun:test';
import {
  determineApprovalOutcome,
  validateLimitForTier,
  getMaxLimitForTier,
  canRequestCard,
  canApproveWithLimit,
} from '../../../../src/domain/services/card-approval.service';
import { createUser } from '../../../../src/domain/entities/user.entity';
import { createCard } from '../../../../src/domain/entities/card.entity';
import {
  createCardRequest,
  type CardRequest,
} from '../../../../src/domain/entities/card-request.entity';

describe('Card Approval Service', () => {
  describe('determineApprovalOutcome', () => {
    describe('high score (>= 700)', () => {
      it('should auto-approve with $10,000 limit', () => {
        const result = determineApprovalOutcome(700);
        expect(result.approved).toBe(true);
        expect(result.limit).toBe(10000);
        expect(result.requiresReview).toBe(false);
      });

      it('should auto-approve for score of 850', () => {
        const result = determineApprovalOutcome(850);
        expect(result.approved).toBe(true);
        expect(result.limit).toBe(10000);
      });

      it('should auto-approve for max score of 1000', () => {
        const result = determineApprovalOutcome(1000);
        expect(result.approved).toBe(true);
        expect(result.limit).toBe(10000);
      });
    });

    describe('medium score (500-699)', () => {
      it('should auto-approve with $5,000 limit', () => {
        const result = determineApprovalOutcome(500);
        expect(result.approved).toBe(true);
        expect(result.limit).toBe(5000);
        expect(result.requiresReview).toBe(false);
      });

      it('should auto-approve for score of 600', () => {
        const result = determineApprovalOutcome(600);
        expect(result.approved).toBe(true);
        expect(result.limit).toBe(5000);
      });

      it('should auto-approve for score of 699', () => {
        const result = determineApprovalOutcome(699);
        expect(result.approved).toBe(true);
        expect(result.limit).toBe(5000);
      });
    });

    describe('low score (< 500)', () => {
      it('should require review for score of 499', () => {
        const result = determineApprovalOutcome(499);
        expect(result.approved).toBe(false);
        expect(result.limit).toBe(2000);
        expect(result.requiresReview).toBe(true);
      });

      it('should require review for score of 300', () => {
        const result = determineApprovalOutcome(300);
        expect(result.approved).toBe(false);
        expect(result.requiresReview).toBe(true);
      });

      it('should require review for score of 0', () => {
        const result = determineApprovalOutcome(0);
        expect(result.approved).toBe(false);
        expect(result.requiresReview).toBe(true);
      });

      it('should include reason for pending', () => {
        const result = determineApprovalOutcome(400);
        expect(result.reason).toBeDefined();
        expect(result.reason).toContain('auto-approval threshold');
      });
    });
  });

  describe('validateLimitForTier', () => {
    it('should accept limits up to $10,000 for high tier', () => {
      expect(validateLimitForTier(10000, 'high')).toBe(true);
      expect(validateLimitForTier(5000, 'high')).toBe(true);
      expect(validateLimitForTier(100, 'high')).toBe(true);
    });

    it('should reject limits above $10,000 for high tier', () => {
      expect(validateLimitForTier(10001, 'high')).toBe(false);
    });

    it('should accept limits up to $5,000 for medium tier', () => {
      expect(validateLimitForTier(5000, 'medium')).toBe(true);
      expect(validateLimitForTier(2000, 'medium')).toBe(true);
    });

    it('should reject limits above $5,000 for medium tier', () => {
      expect(validateLimitForTier(5001, 'medium')).toBe(false);
    });

    it('should accept limits up to $2,000 for low tier', () => {
      expect(validateLimitForTier(2000, 'low')).toBe(true);
      expect(validateLimitForTier(1000, 'low')).toBe(true);
    });

    it('should reject limits above $2,000 for low tier', () => {
      expect(validateLimitForTier(2001, 'low')).toBe(false);
    });

    it('should reject limits below $100 for all tiers', () => {
      expect(validateLimitForTier(99, 'high')).toBe(false);
      expect(validateLimitForTier(99, 'medium')).toBe(false);
      expect(validateLimitForTier(99, 'low')).toBe(false);
    });
  });

  describe('getMaxLimitForTier', () => {
    it('should return $10,000 for high tier', () => {
      expect(getMaxLimitForTier('high')).toBe(10000);
    });

    it('should return $5,000 for medium tier', () => {
      expect(getMaxLimitForTier('medium')).toBe(5000);
    });

    it('should return $2,000 for low tier', () => {
      expect(getMaxLimitForTier('low')).toBe(2000);
    });
  });

  describe('canRequestCard', () => {
    const user = createUser({
      firebaseUid: 'firebase-123',
      email: 'test@example.com',
    });

    it('should allow request when user has no cards or pending requests', () => {
      const result = canRequestCard(user, [], [], []);
      expect(result.allowed).toBe(true);
    });

    it('should reject when user has active card', () => {
      const activeCard = createCard({
        limit: 5000,
        approvedBy: 'auto',
        scoreAtApproval: 600,
      });

      const result = canRequestCard(user, [activeCard], [], []);
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('already has an active credit card');
    });

    it('should reject when user has pending request', () => {
      const pendingRequest = createCardRequest({
        idempotencyKey: 'test-key',
        scoreAtRequest: 600,
        tierAtRequest: 'medium',
      });

      const result = canRequestCard(user, [], [pendingRequest], []);
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('pending card request');
    });

    it('should reject when user was rejected within 30 days', () => {
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
          reason: 'Insufficient documentation',
          decidedAt: new Date(), // Rejected today
        },
      };

      const result = canRequestCard(user, [], [], [recentRejection]);
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('rejected recently');
      expect(result.reason).toContain('days');
    });

    it('should allow request when rejection was more than 30 days ago', () => {
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 31);

      const oldRejection: CardRequest = {
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
          reason: 'Insufficient documentation',
          decidedAt: oldDate,
        },
      };

      const result = canRequestCard(user, [], [], [oldRejection]);
      expect(result.allowed).toBe(true);
    });
  });

  describe('canApproveWithLimit', () => {
    const pendingRequest = createCardRequest({
      idempotencyKey: 'test-key',
      scoreAtRequest: 400,
      tierAtRequest: 'low',
    });

    it('should allow approval within tier limit', () => {
      const result = canApproveWithLimit(pendingRequest, 2000, 'low');
      expect(result.allowed).toBe(true);
    });

    it('should reject limit below minimum', () => {
      const result = canApproveWithLimit(pendingRequest, 50, 'low');
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('at least');
    });

    it('should reject limit exceeding tier maximum', () => {
      const result = canApproveWithLimit(pendingRequest, 5000, 'low');
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('exceeds policy');
    });

    it('should reject non-pending requests', () => {
      const approvedRequest: CardRequest = {
        ...pendingRequest,
        status: 'approved',
      };

      const result = canApproveWithLimit(approvedRequest, 2000, 'low');
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('not pending');
    });
  });
});
