import { describe, it, expect } from 'bun:test';
import {
  deriveTier,
  clampScore,
  calculatePaymentScoreImpact,
  applyScoreDelta,
  isAutoApprovalEligible,
  isValidScore,
  SCORE_BOUNDS,
  TIER_BOUNDARIES,
} from '../../../../src/domain/services/scoring.service';

describe('Scoring Service', () => {
  describe('deriveTier', () => {
    it('should return high tier for score >= 700', () => {
      expect(deriveTier(700)).toBe('high');
      expect(deriveTier(850)).toBe('high');
      expect(deriveTier(1000)).toBe('high');
    });

    it('should return medium tier for score 500-699', () => {
      expect(deriveTier(500)).toBe('medium');
      expect(deriveTier(600)).toBe('medium');
      expect(deriveTier(699)).toBe('medium');
    });

    it('should return low tier for score < 500', () => {
      expect(deriveTier(499)).toBe('low');
      expect(deriveTier(300)).toBe('low');
      expect(deriveTier(0)).toBe('low');
    });

    describe('tier boundaries', () => {
      it('499 should be low tier', () => {
        expect(deriveTier(499)).toBe('low');
      });

      it('500 should be medium tier', () => {
        expect(deriveTier(500)).toBe('medium');
      });

      it('699 should be medium tier', () => {
        expect(deriveTier(699)).toBe('medium');
      });

      it('700 should be high tier', () => {
        expect(deriveTier(700)).toBe('high');
      });
    });
  });

  describe('clampScore', () => {
    it('should return score as-is when within bounds', () => {
      expect(clampScore(500)).toBe(500);
      expect(clampScore(0)).toBe(0);
      expect(clampScore(1000)).toBe(1000);
    });

    it('should clamp score to 0 when negative', () => {
      expect(clampScore(-100)).toBe(0);
      expect(clampScore(-1)).toBe(0);
    });

    it('should clamp score to 1000 when exceeds maximum', () => {
      expect(clampScore(1001)).toBe(1000);
      expect(clampScore(2000)).toBe(1000);
    });

    it('should round decimal scores', () => {
      expect(clampScore(500.4)).toBe(500);
      expect(clampScore(500.6)).toBe(501);
    });
  });

  describe('calculatePaymentScoreImpact', () => {
    describe('on-time payments', () => {
      it('should return +10 for minimum payment', () => {
        const result = calculatePaymentScoreImpact(50, 1000, true, 0);
        expect(result.delta).toBe(12); // 10 + (50/1000 * 40) = 12
        expect(result.reason).toBe('payment_on_time');
      });

      it('should return +50 for full payment', () => {
        const result = calculatePaymentScoreImpact(1000, 1000, true, 0);
        expect(result.delta).toBe(50);
        expect(result.reason).toBe('payment_on_time');
      });

      it('should scale between +10 and +50 for partial payment', () => {
        const result = calculatePaymentScoreImpact(500, 1000, true, 0);
        expect(result.delta).toBe(30); // 10 + (0.5 * 40) = 30
        expect(result.reason).toBe('payment_on_time');
      });
    });

    describe('late payments', () => {
      it('should return -20 for 1-7 days late', () => {
        expect(calculatePaymentScoreImpact(100, 1000, false, 1).delta).toBe(-20);
        expect(calculatePaymentScoreImpact(100, 1000, false, 7).delta).toBe(-20);
      });

      it('should return -50 for 8-30 days late', () => {
        expect(calculatePaymentScoreImpact(100, 1000, false, 8).delta).toBe(-50);
        expect(calculatePaymentScoreImpact(100, 1000, false, 30).delta).toBe(-50);
      });

      it('should return -100 for 30+ days late', () => {
        expect(calculatePaymentScoreImpact(100, 1000, false, 31).delta).toBe(-100);
        expect(calculatePaymentScoreImpact(100, 1000, false, 60).delta).toBe(-100);
      });

      it('should set reason to payment_late', () => {
        const result = calculatePaymentScoreImpact(100, 1000, false, 5);
        expect(result.reason).toBe('payment_late');
      });
    });
  });

  describe('applyScoreDelta', () => {
    it('should add positive delta', () => {
      expect(applyScoreDelta(500, 50)).toBe(550);
    });

    it('should subtract negative delta', () => {
      expect(applyScoreDelta(500, -100)).toBe(400);
    });

    it('should clamp result to 0', () => {
      expect(applyScoreDelta(50, -100)).toBe(0);
    });

    it('should clamp result to 1000', () => {
      expect(applyScoreDelta(980, 50)).toBe(1000);
    });
  });

  describe('isAutoApprovalEligible', () => {
    it('should return true for score >= 500', () => {
      expect(isAutoApprovalEligible(500)).toBe(true);
      expect(isAutoApprovalEligible(700)).toBe(true);
      expect(isAutoApprovalEligible(1000)).toBe(true);
    });

    it('should return false for score < 500', () => {
      expect(isAutoApprovalEligible(499)).toBe(false);
      expect(isAutoApprovalEligible(300)).toBe(false);
      expect(isAutoApprovalEligible(0)).toBe(false);
    });
  });

  describe('isValidScore', () => {
    it('should return true for valid integer scores', () => {
      expect(isValidScore(0)).toBe(true);
      expect(isValidScore(500)).toBe(true);
      expect(isValidScore(1000)).toBe(true);
    });

    it('should return false for negative scores', () => {
      expect(isValidScore(-1)).toBe(false);
    });

    it('should return false for scores above 1000', () => {
      expect(isValidScore(1001)).toBe(false);
    });

    it('should return false for non-integer scores', () => {
      expect(isValidScore(500.5)).toBe(false);
    });

    it('should return false for non-number values', () => {
      expect(isValidScore(NaN)).toBe(false);
    });
  });

  describe('constants', () => {
    it('should have correct score bounds', () => {
      expect(SCORE_BOUNDS.MIN).toBe(0);
      expect(SCORE_BOUNDS.MAX).toBe(1000);
    });

    it('should have correct tier boundaries', () => {
      expect(TIER_BOUNDARIES.HIGH).toBe(700);
      expect(TIER_BOUNDARIES.MEDIUM).toBe(500);
    });
  });
});
