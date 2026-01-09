/**
 * Transaction Test Fixtures
 *
 * Provides consistent transaction data for testing across all backends.
 */

import { v4 as uuidv4 } from 'uuid';
import {
  createPurchase,
  createPayment,
  createFailedTransaction,
  type Transaction,
  type TransactionType,
  type PaymentStatus,
} from '../../../src/domain/entities/transaction.entity.js';

export interface PurchaseFixtureOptions {
  transactionId?: string;
  amount?: number;
  merchant?: string;
  idempotencyKey?: string;
}

export interface PaymentFixtureOptions {
  transactionId?: string;
  amount?: number;
  idempotencyKey?: string;
  paymentStatus?: PaymentStatus;
  daysOverdue?: number;
  scoreImpact?: number;
}

export interface FailedTransactionOptions {
  transactionId?: string;
  type?: TransactionType;
  amount?: number;
  idempotencyKey?: string;
  failureReason?: string;
}

/**
 * Create a test purchase transaction
 */
export function createTestPurchase(options: PurchaseFixtureOptions = {}): Transaction {
  const purchase = createPurchase({
    amount: options.amount ?? 100,
    merchant: options.merchant ?? 'Test Merchant',
    idempotencyKey: options.idempotencyKey ?? `purchase-${uuidv4().slice(0, 8)}`,
  });

  if (options.transactionId !== undefined) {
    purchase.transactionId = options.transactionId;
  }

  return purchase;
}

/**
 * Create a test payment transaction
 */
export function createTestPayment(options: PaymentFixtureOptions = {}): Transaction {
  const payment = createPayment({
    amount: options.amount ?? 100,
    idempotencyKey: options.idempotencyKey ?? `payment-${uuidv4().slice(0, 8)}`,
    paymentStatus: options.paymentStatus ?? 'on_time',
    daysOverdue: options.daysOverdue,
    scoreImpact: options.scoreImpact,
  });

  if (options.transactionId !== undefined) {
    payment.transactionId = options.transactionId;
  }

  return payment;
}

/**
 * Create a test failed transaction
 */
export function createTestFailedTransaction(options: FailedTransactionOptions = {}): Transaction {
  const failed = createFailedTransaction(
    options.type ?? 'purchase',
    options.amount ?? 100,
    options.idempotencyKey ?? `failed-${uuidv4().slice(0, 8)}`,
    options.failureReason ?? 'Insufficient credit'
  );

  if (options.transactionId !== undefined) {
    failed.transactionId = options.transactionId;
  }

  return failed;
}

/**
 * Pre-built transaction fixture variants for common test scenarios
 */
export const transactionFixtures = {
  // Purchase fixtures
  /** Small purchase ($25) */
  smallPurchase: (overrides?: Partial<PurchaseFixtureOptions>) =>
    createTestPurchase({
      amount: 25,
      merchant: 'Coffee Shop',
      ...overrides,
    }),

  /** Medium purchase ($150) */
  mediumPurchase: (overrides?: Partial<PurchaseFixtureOptions>) =>
    createTestPurchase({
      amount: 150,
      merchant: 'Amazon',
      ...overrides,
    }),

  /** Large purchase ($500) */
  largePurchase: (overrides?: Partial<PurchaseFixtureOptions>) =>
    createTestPurchase({
      amount: 500,
      merchant: 'Electronics Store',
      ...overrides,
    }),

  /** Max purchase ($5000) */
  maxPurchase: (overrides?: Partial<PurchaseFixtureOptions>) =>
    createTestPurchase({
      amount: 5000,
      merchant: 'Luxury Retailer',
      ...overrides,
    }),

  // Payment fixtures
  /** On-time payment with positive score impact */
  onTimePayment: (overrides?: Partial<PaymentFixtureOptions>) =>
    createTestPayment({
      amount: 100,
      paymentStatus: 'on_time',
      scoreImpact: 10,
      ...overrides,
    }),

  /** Late payment with negative score impact */
  latePayment: (overrides?: Partial<PaymentFixtureOptions>) =>
    createTestPayment({
      amount: 100,
      paymentStatus: 'late',
      daysOverdue: 15,
      scoreImpact: -20,
      ...overrides,
    }),

  /** Minimum payment */
  minimumPayment: (overrides?: Partial<PaymentFixtureOptions>) =>
    createTestPayment({
      amount: 25,
      paymentStatus: 'on_time',
      ...overrides,
    }),

  /** Full balance payment */
  fullPayment: (overrides?: Partial<PaymentFixtureOptions>) =>
    createTestPayment({
      amount: 2500,
      paymentStatus: 'on_time',
      scoreImpact: 25,
      ...overrides,
    }),

  // Failed transaction fixtures
  /** Failed purchase - insufficient credit */
  failedInsufficientCredit: (overrides?: Partial<FailedTransactionOptions>) =>
    createTestFailedTransaction({
      type: 'purchase',
      amount: 10000,
      failureReason: 'Insufficient credit available',
      ...overrides,
    }),

  /** Failed purchase - card suspended */
  failedCardSuspended: (overrides?: Partial<FailedTransactionOptions>) =>
    createTestFailedTransaction({
      type: 'purchase',
      amount: 100,
      failureReason: 'Card is suspended',
      ...overrides,
    }),

  /** Failed payment - exceeds balance */
  failedPaymentExceedsBalance: (overrides?: Partial<FailedTransactionOptions>) =>
    createTestFailedTransaction({
      type: 'payment',
      amount: 10000,
      failureReason: 'Payment amount exceeds balance',
      ...overrides,
    }),
};

/**
 * Generate a sequence of transactions for testing history/pagination
 */
export function generateTransactionHistory(
  count: number,
  options?: { startDate?: Date; mixTypes?: boolean }
): Transaction[] {
  const transactions: Transaction[] = [];
  const startDate = options?.startDate ?? new Date();
  const mixTypes = options?.mixTypes ?? true;

  for (let i = 0; i < count; i++) {
    const date = new Date(startDate);
    date.setDate(date.getDate() - i);

    if (mixTypes && i % 3 === 0) {
      // Every 3rd transaction is a payment
      const payment = createTestPayment({
        amount: 50 + i * 10,
        paymentStatus: 'on_time',
      });
      payment.timestamp = date;
      payment.processedAt = date;
      transactions.push(payment);
    } else {
      // Purchases
      const merchants = ['Amazon', 'Starbucks', 'Target', 'Walmart', 'Gas Station'];
      const purchase = createTestPurchase({
        amount: 10 + i * 5,
        merchant: merchants[i % merchants.length],
      });
      purchase.timestamp = date;
      purchase.processedAt = date;
      transactions.push(purchase);
    }
  }

  return transactions;
}
