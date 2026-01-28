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
    const validPurchaseInput: CreatePurchaseInput = {
      amount: 100,
      merchant: 'Amazon',
      idempotencyKey: 'purchase-key-123',
    };

    it('should create a purchase transaction with correct properties', () => {
      const transaction = createPurchase(validPurchaseInput);

      expect(transaction.type).toBe('purchase');
      expect(transaction.amount).toBe(100);
      expect(transaction.merchant).toBe('Amazon');
      expect(transaction.idempotencyKey).toBe('purchase-key-123');
      expect(transaction.status).toBe('completed');
      expect(transaction.timestamp).toBeInstanceOf(Date);
      expect(transaction.processedAt).toBeInstanceOf(Date);
    });

    it('should generate a unique transactionId', () => {
      const tx1 = createPurchase(validPurchaseInput);
      const tx2 = createPurchase(validPurchaseInput);

      expect(tx1.transactionId).toBeTruthy();
      expect(tx2.transactionId).toBeTruthy();
      expect(tx1.transactionId).not.toBe(tx2.transactionId);
    });

    it('should set timestamp and processedAt to current time', () => {
      const before = Date.now();
      const transaction = createPurchase(validPurchaseInput);
      const after = Date.now();

      expect(transaction.timestamp.getTime()).toBeGreaterThanOrEqual(before);
      expect(transaction.timestamp.getTime()).toBeLessThanOrEqual(after);
      expect(transaction.processedAt.getTime()).toBeGreaterThanOrEqual(before);
      expect(transaction.processedAt.getTime()).toBeLessThanOrEqual(after);
    });

    it('should not have payment-specific fields', () => {
      const transaction = createPurchase(validPurchaseInput);

      expect(transaction.paymentStatus).toBeUndefined();
      expect(transaction.daysOverdue).toBeUndefined();
      expect(transaction.scoreImpact).toBeUndefined();
    });
  });

  describe('createPayment', () => {
    const validPaymentInput: CreatePaymentInput = {
      amount: 50,
      idempotencyKey: 'payment-key-456',
      paymentStatus: 'on_time',
    };

    it('should create a payment transaction with correct properties', () => {
      const transaction = createPayment(validPaymentInput);

      expect(transaction.type).toBe('payment');
      expect(transaction.amount).toBe(50);
      expect(transaction.idempotencyKey).toBe('payment-key-456');
      expect(transaction.paymentStatus).toBe('on_time');
      expect(transaction.status).toBe('completed');
      expect(transaction.timestamp).toBeInstanceOf(Date);
      expect(transaction.processedAt).toBeInstanceOf(Date);
    });

    it('should create a late payment with daysOverdue and scoreImpact', () => {
      const latePaymentInput: CreatePaymentInput = {
        amount: 75,
        idempotencyKey: 'late-payment-789',
        paymentStatus: 'late',
        daysOverdue: 15,
        scoreImpact: -10,
      };

      const transaction = createPayment(latePaymentInput);

      expect(transaction.paymentStatus).toBe('late');
      expect(transaction.daysOverdue).toBe(15);
      expect(transaction.scoreImpact).toBe(-10);
    });

    it('should generate a unique transactionId', () => {
      const tx1 = createPayment(validPaymentInput);
      const tx2 = createPayment(validPaymentInput);

      expect(tx1.transactionId).toBeTruthy();
      expect(tx2.transactionId).toBeTruthy();
      expect(tx1.transactionId).not.toBe(tx2.transactionId);
    });

    it('should not have merchant field', () => {
      const transaction = createPayment(validPaymentInput);

      expect(transaction.merchant).toBeUndefined();
    });
  });

  describe('createFailedTransaction', () => {
    it('should create a failed purchase transaction', () => {
      const transaction = createFailedTransaction(
        'purchase',
        200,
        'failed-purchase-key',
        'Insufficient credit'
      );

      expect(transaction.type).toBe('purchase');
      expect(transaction.amount).toBe(200);
      expect(transaction.idempotencyKey).toBe('failed-purchase-key');
      expect(transaction.status).toBe('failed');
      expect(transaction.failureReason).toBe('Insufficient credit');
      expect(transaction.timestamp).toBeInstanceOf(Date);
      expect(transaction.processedAt).toBeInstanceOf(Date);
    });

    it('should create a failed payment transaction', () => {
      const transaction = createFailedTransaction(
        'payment',
        150,
        'failed-payment-key',
        'Payment processing error'
      );

      expect(transaction.type).toBe('payment');
      expect(transaction.amount).toBe(150);
      expect(transaction.failureReason).toBe('Payment processing error');
      expect(transaction.status).toBe('failed');
    });

    it('should generate a unique transactionId', () => {
      const tx1 = createFailedTransaction('purchase', 100, 'key1', 'reason1');
      const tx2 = createFailedTransaction('purchase', 100, 'key2', 'reason2');

      expect(tx1.transactionId).toBeTruthy();
      expect(tx2.transactionId).toBeTruthy();
      expect(tx1.transactionId).not.toBe(tx2.transactionId);
    });
  });

  describe('isTransaction', () => {
    it('should return true for valid purchase transaction', () => {
      const transaction = createPurchase({
        amount: 100,
        merchant: 'Store',
        idempotencyKey: 'key-123',
      });
      expect(isTransaction(transaction)).toBe(true);
    });

    it('should return true for valid payment transaction', () => {
      const transaction = createPayment({
        amount: 50,
        idempotencyKey: 'key-456',
        paymentStatus: 'on_time',
      });
      expect(isTransaction(transaction)).toBe(true);
    });

    it('should return false for null', () => {
      expect(isTransaction(null)).toBe(false);
    });

    it('should return false for undefined', () => {
      expect(isTransaction(undefined)).toBe(false);
    });

    it('should return false for non-object values', () => {
      expect(isTransaction('string')).toBe(false);
      expect(isTransaction(123)).toBe(false);
      expect(isTransaction(true)).toBe(false);
    });

    it('should return false for invalid transaction type', () => {
      const invalidTx = {
        ...createPurchase({
          amount: 100,
          merchant: 'Store',
          idempotencyKey: 'key',
        }),
        type: 'invalid',
      };
      expect(isTransaction(invalidTx)).toBe(false);
    });

    it('should return false for invalid status', () => {
      const invalidTx = {
        ...createPurchase({
          amount: 100,
          merchant: 'Store',
          idempotencyKey: 'key',
        }),
        status: 'pending',
      };
      expect(isTransaction(invalidTx)).toBe(false);
    });

    it('should return false for missing required fields', () => {
      const incompleteTx = {
        transactionId: 'tx-123',
        type: 'purchase',
        amount: 100,
        // missing idempotencyKey, status, timestamp, processedAt
      };
      expect(isTransaction(incompleteTx)).toBe(false);
    });
  });

  describe('validateTransaction', () => {
    describe('purchase transactions', () => {
      it('should validate a valid purchase transaction', () => {
        const transaction = createPurchase({
          amount: 100,
          merchant: 'Amazon',
          idempotencyKey: 'key-123',
        });

        const result = validateTransaction(transaction);
        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it('should fail for purchase with empty merchant', () => {
        const transaction = createPurchase({
          amount: 100,
          merchant: 'Store',
          idempotencyKey: 'key-123',
        });
        const invalidTx: Transaction = { ...transaction, merchant: '' };

        const result = validateTransaction(invalidTx);
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('merchant is required for purchases');
      });

      it('should fail for purchase with undefined merchant', () => {
        const transaction = createPurchase({
          amount: 100,
          merchant: 'Store',
          idempotencyKey: 'key-123',
        });
        const invalidTx: Transaction = { ...transaction, merchant: undefined };

        const result = validateTransaction(invalidTx);
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('merchant is required for purchases');
      });

      it('should fail for purchase with zero amount', () => {
        const transaction = createPurchase({
          amount: 100,
          merchant: 'Store',
          idempotencyKey: 'key-123',
        });
        const invalidTx: Transaction = { ...transaction, amount: 0 };

        const result = validateTransaction(invalidTx);
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('amount must be positive');
      });

      it('should fail for purchase with negative amount', () => {
        const transaction = createPurchase({
          amount: 100,
          merchant: 'Store',
          idempotencyKey: 'key-123',
        });
        const invalidTx: Transaction = { ...transaction, amount: -50 };

        const result = validateTransaction(invalidTx);
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('amount must be positive');
      });
    });

    describe('payment transactions', () => {
      it('should validate a valid on-time payment', () => {
        const transaction = createPayment({
          amount: 50,
          idempotencyKey: 'key-456',
          paymentStatus: 'on_time',
        });

        const result = validateTransaction(transaction);
        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it('should validate a valid late payment with daysOverdue', () => {
        const transaction = createPayment({
          amount: 50,
          idempotencyKey: 'key-456',
          paymentStatus: 'late',
          daysOverdue: 10,
          scoreImpact: -5,
        });

        const result = validateTransaction(transaction);
        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it('should fail for payment without paymentStatus', () => {
        const transaction = createPayment({
          amount: 50,
          idempotencyKey: 'key-456',
          paymentStatus: 'on_time',
        });
        const invalidTx: Transaction = { ...transaction, paymentStatus: undefined };

        const result = validateTransaction(invalidTx);
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('paymentStatus is required for payments');
      });

      it('should fail for late payment without daysOverdue', () => {
        const transaction = createPayment({
          amount: 50,
          idempotencyKey: 'key-456',
          paymentStatus: 'late',
          daysOverdue: 10,
        });
        const invalidTx: Transaction = { ...transaction, daysOverdue: undefined };

        const result = validateTransaction(invalidTx);
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('daysOverdue is required for late payments');
      });
    });

    describe('general validation', () => {
      it('should fail for empty idempotencyKey', () => {
        const transaction = createPurchase({
          amount: 100,
          merchant: 'Store',
          idempotencyKey: 'key-123',
        });
        const invalidTx: Transaction = { ...transaction, idempotencyKey: '' };

        const result = validateTransaction(invalidTx);
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('idempotencyKey is required');
      });

      it('should fail for failed transaction without failureReason', () => {
        const transaction = createFailedTransaction(
          'purchase',
          100,
          'key-123',
          'Some error'
        );
        const invalidTx: Transaction = { ...transaction, failureReason: undefined };

        const result = validateTransaction(invalidTx);
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('failureReason is required for failed transactions');
      });

      it('should collect multiple validation errors', () => {
        const transaction = createPurchase({
          amount: 100,
          merchant: 'Store',
          idempotencyKey: 'key-123',
        });
        const invalidTx: Transaction = {
          ...transaction,
          amount: -10,
          merchant: '',
          idempotencyKey: '',
        };

        const result = validateTransaction(invalidTx);
        expect(result.valid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(1);
        expect(result.errors).toContain('amount must be positive');
        expect(result.errors).toContain('merchant is required for purchases');
        expect(result.errors).toContain('idempotencyKey is required');
      });
    });
  });
});
