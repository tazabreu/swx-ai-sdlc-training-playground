import { describe, it, expect } from 'bun:test';
import {
  validatePurchase,
  validatePayment,
  calculateNewBalance,
  calculateAvailableCredit,
  calculateMinimumPayment,
  isPaymentOnTime,
  calculateDaysOverdue,
  isFullPayment,
  meetsMinimumPayment,
  applyPurchase,
  applyPayment,
} from '../../../../src/domain/services/payment.service';
import { createCard } from '../../../../src/domain/entities/card.entity';

describe('Payment Service', () => {
  describe('validatePurchase', () => {
    it('should allow purchase within available credit', () => {
      const result = validatePurchase(100, 5000, 'active');
      expect(result.valid).toBe(true);
    });

    it('should allow purchase of exactly available credit', () => {
      const result = validatePurchase(5000, 5000, 'active');
      expect(result.valid).toBe(true);
    });

    it('should reject purchase exceeding available credit', () => {
      const result = validatePurchase(6000, 5000, 'active');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('exceeds available credit');
    });

    it('should reject purchase with zero amount', () => {
      const result = validatePurchase(0, 5000, 'active');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('must be positive');
    });

    it('should reject purchase with negative amount', () => {
      const result = validatePurchase(-100, 5000, 'active');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('must be positive');
    });

    it('should reject purchase on suspended card', () => {
      const result = validatePurchase(100, 5000, 'suspended');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('suspended');
    });

    it('should reject purchase on cancelled card', () => {
      const result = validatePurchase(100, 5000, 'cancelled');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('cancelled');
    });
  });

  describe('validatePayment', () => {
    it('should allow payment within balance', () => {
      const result = validatePayment(100, 500);
      expect(result.valid).toBe(true);
    });

    it('should allow full payment of balance', () => {
      const result = validatePayment(500, 500);
      expect(result.valid).toBe(true);
    });

    it('should reject payment exceeding balance', () => {
      const result = validatePayment(600, 500);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('exceeds balance');
    });

    it('should reject payment with zero balance', () => {
      const result = validatePayment(100, 0);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('No balance to pay');
    });

    it('should reject zero amount payment', () => {
      const result = validatePayment(0, 500);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('must be positive');
    });

    it('should reject negative amount payment', () => {
      const result = validatePayment(-100, 500);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('must be positive');
    });
  });

  describe('calculateNewBalance', () => {
    it('should increase balance for purchases', () => {
      expect(calculateNewBalance(500, 100, 'purchase')).toBe(600);
    });

    it('should decrease balance for payments', () => {
      expect(calculateNewBalance(500, 100, 'payment')).toBe(400);
    });

    it('should not go below 0 for payments', () => {
      expect(calculateNewBalance(50, 100, 'payment')).toBe(0);
    });
  });

  describe('calculateAvailableCredit', () => {
    it('should return limit - balance', () => {
      expect(calculateAvailableCredit(5000, 1000)).toBe(4000);
    });

    it('should return 0 when balance equals limit', () => {
      expect(calculateAvailableCredit(5000, 5000)).toBe(0);
    });

    it('should return full limit when balance is 0', () => {
      expect(calculateAvailableCredit(5000, 0)).toBe(5000);
    });
  });

  describe('calculateMinimumPayment', () => {
    it('should return 0 for zero balance', () => {
      expect(calculateMinimumPayment(0)).toBe(0);
    });

    it('should return $25 minimum for small balances', () => {
      expect(calculateMinimumPayment(1000)).toBe(25);
    });

    it('should return 2% for large balances', () => {
      expect(calculateMinimumPayment(5000)).toBe(100);
    });

    it('should return full balance if less than minimum', () => {
      expect(calculateMinimumPayment(20)).toBe(20);
    });
  });

  describe('isPaymentOnTime', () => {
    it('should return true when payment is before due date', () => {
      const paymentDate = new Date('2024-01-15');
      const dueDate = new Date('2024-01-20');
      expect(isPaymentOnTime(paymentDate, dueDate)).toBe(true);
    });

    it('should return true when payment is on due date', () => {
      const date = new Date('2024-01-15');
      expect(isPaymentOnTime(date, date)).toBe(true);
    });

    it('should return false when payment is after due date', () => {
      const paymentDate = new Date('2024-01-21');
      const dueDate = new Date('2024-01-20');
      expect(isPaymentOnTime(paymentDate, dueDate)).toBe(false);
    });
  });

  describe('calculateDaysOverdue', () => {
    it('should return 0 for on-time payment', () => {
      const paymentDate = new Date('2024-01-15');
      const dueDate = new Date('2024-01-20');
      expect(calculateDaysOverdue(paymentDate, dueDate)).toBe(0);
    });

    it('should return days late for late payment', () => {
      const paymentDate = new Date('2024-01-25');
      const dueDate = new Date('2024-01-20');
      expect(calculateDaysOverdue(paymentDate, dueDate)).toBe(5);
    });
  });

  describe('isFullPayment', () => {
    it('should return true when amount equals balance', () => {
      expect(isFullPayment(500, 500)).toBe(true);
    });

    it('should return true when amount exceeds balance', () => {
      expect(isFullPayment(600, 500)).toBe(true);
    });

    it('should return false when amount is less than balance', () => {
      expect(isFullPayment(400, 500)).toBe(false);
    });
  });

  describe('meetsMinimumPayment', () => {
    it('should return true when amount equals minimum', () => {
      expect(meetsMinimumPayment(25, 25)).toBe(true);
    });

    it('should return true when amount exceeds minimum', () => {
      expect(meetsMinimumPayment(50, 25)).toBe(true);
    });

    it('should return false when amount is below minimum', () => {
      expect(meetsMinimumPayment(20, 25)).toBe(false);
    });
  });

  describe('applyPurchase', () => {
    it('should increase balance and decrease available credit', () => {
      const card = createCard({
        limit: 5000,
        approvedBy: 'auto',
        scoreAtApproval: 600,
      });

      const update = applyPurchase(card, 1000);
      expect(update.balance).toBe(1000);
      expect(update.availableCredit).toBe(4000);
    });
  });

  describe('applyPayment', () => {
    it('should decrease balance and increase available credit', () => {
      const card = {
        ...createCard({
          limit: 5000,
          approvedBy: 'auto',
          scoreAtApproval: 600,
        }),
        balance: 2000,
        availableCredit: 3000,
      };

      const update = applyPayment(card, 500);
      expect(update.balance).toBe(1500);
      expect(update.availableCredit).toBe(3500);
    });

    it('should calculate new minimum payment', () => {
      const card = {
        ...createCard({
          limit: 5000,
          approvedBy: 'auto',
          scoreAtApproval: 600,
        }),
        balance: 2000,
        availableCredit: 3000,
      };

      const update = applyPayment(card, 500);
      expect(update.minimumPayment).toBeGreaterThan(0);
    });

    it('should set minimum payment to 0 when balance is paid off', () => {
      const card = {
        ...createCard({
          limit: 5000,
          approvedBy: 'auto',
          scoreAtApproval: 600,
        }),
        balance: 500,
        availableCredit: 4500,
      };

      const update = applyPayment(card, 500);
      expect(update.balance).toBe(0);
      expect(update.minimumPayment).toBe(0);
    });
  });
});
