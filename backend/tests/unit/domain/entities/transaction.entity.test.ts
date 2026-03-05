import { describe, it, expect } from 'bun:test';
import {
  createPurchase,
  createPayment,
  createFailedTransaction,
  isTransaction,
  validateTransaction,
  type Transaction,
  type CreatePurchaseInput,
  type CreatePaymentInput,
} from '../../../../src/domain/entities/transaction.entity';

describe('Transaction Entity', () => {
  describe('createPurchase', () => {
    const validInput: CreatePurchaseInput = {
      amount: 150.0,
      merchant: 'Amazon',
      idempotencyKey: 'idem-purchase-001',
    };

    it('should create a purchase transaction with correct type and status', () => {
      const tx = createPurchase(validInput);

      expect(tx.type).toBe('purchase');
      expect(tx.status).toBe('completed');
    });

    it('should carry the provided amount and merchant', () => {
      const tx = createPurchase(validInput);

      expect(tx.amount).toBe(150.0);
      expect(tx.merchant).toBe('Amazon');
    });

    it('should store the idempotencyKey', () => {
      const tx = createPurchase(validInput);

      expect(tx.idempotencyKey).toBe('idem-purchase-001');
    });

    it('should generate a unique transactionId per call', () => {
      const tx1 = createPurchase(validInput);
      const tx2 = createPurchase(validInput);

      expect(tx1.transactionId).toBeTruthy();
      expect(tx2.transactionId).toBeTruthy();
      expect(tx1.transactionId).not.toBe(tx2.transactionId);
    });

    it('should set timestamp and processedAt to a recent date', () => {
      const before = new Date();
      const tx = createPurchase(validInput);
      const after = new Date();

      expect(tx.timestamp.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(tx.timestamp.getTime()).toBeLessThanOrEqual(after.getTime());
      expect(tx.processedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(tx.processedAt.getTime()).toBeLessThanOrEqual(after.getTime());
    });

    it('should not set payment-specific fields', () => {
      const tx = createPurchase(validInput);

      expect(tx.paymentStatus).toBeUndefined();
      expect(tx.daysOverdue).toBeUndefined();
      expect(tx.scoreImpact).toBeUndefined();
    });
  });

  describe('createPayment', () => {
    it('should create an on-time payment with correct fields', () => {
      const input: CreatePaymentInput = {
        amount: 500,
        idempotencyKey: 'idem-payment-001',
        paymentStatus: 'on_time',
        scoreImpact: 20,
      };

      const tx = createPayment(input);

      expect(tx.type).toBe('payment');
      expect(tx.status).toBe('completed');
      expect(tx.amount).toBe(500);
      expect(tx.paymentStatus).toBe('on_time');
      expect(tx.scoreImpact).toBe(20);
      expect(tx.merchant).toBeUndefined();
    });

    it('should create a late payment with daysOverdue and scoreImpact', () => {
      const input: CreatePaymentInput = {
        amount: 200,
        idempotencyKey: 'idem-payment-002',
        paymentStatus: 'late',
        daysOverdue: 15,
        scoreImpact: -50,
      };

      const tx = createPayment(input);

      expect(tx.paymentStatus).toBe('late');
      expect(tx.daysOverdue).toBe(15);
      expect(tx.scoreImpact).toBe(-50);
    });

    it('should generate a unique transactionId per call', () => {
      const input: CreatePaymentInput = {
        amount: 100,
        idempotencyKey: 'idem-payment-003',
        paymentStatus: 'on_time',
      };

      const tx1 = createPayment(input);
      const tx2 = createPayment(input);

      expect(tx1.transactionId).not.toBe(tx2.transactionId);
    });
  });

  describe('createFailedTransaction', () => {
    it('should create a failed purchase with a failure reason', () => {
      const tx = createFailedTransaction('purchase', 300, 'idem-fail-001', 'Insufficient credit');

      expect(tx.type).toBe('purchase');
      expect(tx.status).toBe('failed');
      expect(tx.amount).toBe(300);
      expect(tx.failureReason).toBe('Insufficient credit');
      expect(tx.idempotencyKey).toBe('idem-fail-001');
    });

    it('should create a failed payment with a failure reason', () => {
      const tx = createFailedTransaction('payment', 100, 'idem-fail-002', 'Card suspended');

      expect(tx.type).toBe('payment');
      expect(tx.status).toBe('failed');
      expect(tx.failureReason).toBe('Card suspended');
    });
  });

  describe('isTransaction', () => {
    it('should return true for a valid purchase transaction', () => {
      const tx = createPurchase({ amount: 50, merchant: 'Starbucks', idempotencyKey: 'k1' });
      expect(isTransaction(tx)).toBe(true);
    });

    it('should return true for a valid payment transaction', () => {
      const tx = createPayment({ amount: 50, idempotencyKey: 'k2', paymentStatus: 'on_time' });
      expect(isTransaction(tx)).toBe(true);
    });

    it('should return false for null', () => {
      expect(isTransaction(null)).toBe(false);
    });

    it('should return false for a plain object missing required fields', () => {
      expect(isTransaction({ amount: 100 })).toBe(false);
    });

    it('should return false when type is invalid', () => {
      const tx = createPurchase({ amount: 50, merchant: 'Shop', idempotencyKey: 'k3' });
      const invalid = { ...tx, type: 'refund' };
      expect(isTransaction(invalid)).toBe(false);
    });

    it('should return false when status is invalid', () => {
      const tx = createPurchase({ amount: 50, merchant: 'Shop', idempotencyKey: 'k4' });
      const invalid = { ...tx, status: 'pending' };
      expect(isTransaction(invalid)).toBe(false);
    });

    it('should return false when timestamp is not a Date', () => {
      const tx = createPurchase({ amount: 50, merchant: 'Shop', idempotencyKey: 'k5' });
      const invalid = { ...tx, timestamp: '2024-01-01' };
      expect(isTransaction(invalid)).toBe(false);
    });
  });

  describe('validateTransaction', () => {
    it('should return valid for a correctly created purchase', () => {
      const tx = createPurchase({ amount: 100, merchant: 'IKEA', idempotencyKey: 'v1' });
      const result = validateTransaction(tx);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should return valid for a correctly created payment', () => {
      const tx = createPayment({ amount: 200, idempotencyKey: 'v2', paymentStatus: 'on_time' });
      const result = validateTransaction(tx);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should fail when amount is zero', () => {
      const tx = createPurchase({ amount: 100, merchant: 'Shop', idempotencyKey: 'v3' });
      const invalid: Transaction = { ...tx, amount: 0 };
      const result = validateTransaction(invalid);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('amount must be positive');
    });

    it('should fail when amount is negative', () => {
      const tx = createPurchase({ amount: 100, merchant: 'Shop', idempotencyKey: 'v4' });
      const invalid: Transaction = { ...tx, amount: -50 };
      const result = validateTransaction(invalid);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('amount must be positive');
    });

    it('should fail when idempotencyKey is empty', () => {
      const tx = createPurchase({ amount: 100, merchant: 'Shop', idempotencyKey: 'v5' });
      const invalid: Transaction = { ...tx, idempotencyKey: '' };
      const result = validateTransaction(invalid);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('idempotencyKey is required');
    });

    it('should fail for purchase without merchant', () => {
      const tx = createPurchase({ amount: 100, merchant: 'Shop', idempotencyKey: 'v6' });
      const invalid: Transaction = { ...tx, merchant: '' };
      const result = validateTransaction(invalid);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('merchant is required for purchases');
    });

    it('should fail for purchase with undefined merchant', () => {
      const tx = createPurchase({ amount: 100, merchant: 'Shop', idempotencyKey: 'v7' });
      const invalid: Transaction = { ...tx, merchant: undefined };
      const result = validateTransaction(invalid);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('merchant is required for purchases');
    });

    it('should fail for payment without paymentStatus', () => {
      const tx = createPayment({ amount: 100, idempotencyKey: 'v8', paymentStatus: 'on_time' });
      const invalid: Transaction = { ...tx, paymentStatus: undefined };
      const result = validateTransaction(invalid);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('paymentStatus is required for payments');
    });

    it('should fail for late payment without daysOverdue', () => {
      const tx = createPayment({
        amount: 100,
        idempotencyKey: 'v9',
        paymentStatus: 'late',
        daysOverdue: 5,
        scoreImpact: -20,
      });
      const invalid: Transaction = { ...tx, daysOverdue: undefined };
      const result = validateTransaction(invalid);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('daysOverdue is required for late payments');
    });

    it('should fail for failed transaction without failureReason', () => {
      const tx = createFailedTransaction('purchase', 100, 'v10', 'Some reason');
      const invalid: Transaction = { ...tx, failureReason: undefined };
      const result = validateTransaction(invalid);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('failureReason is required for failed transactions');
    });
  });
});
