/**
 * Transaction Entity
 *
 * A purchase or payment on a card.
 *
 * Firestore Path: users/{ecosystemId}/cards/{cardId}/transactions/{transactionId}
 */

import { v7 as uuidv7 } from 'uuid';

/**
 * Transaction type
 */
export type TransactionType = 'purchase' | 'payment';

/**
 * Payment status (for payment transactions)
 */
export type PaymentStatus = 'on_time' | 'late';

/**
 * Transaction status
 */
export type TransactionStatus = 'completed' | 'failed';

/**
 * Transaction entity
 */
export interface Transaction {
  transactionId: string; // Auto-generated

  // Type
  type: TransactionType;

  // Amount (always positive)
  amount: number;

  // Purchase-specific
  merchant?: string | undefined; // Merchant name for purchases

  // Payment-specific
  paymentStatus?: PaymentStatus | undefined;
  daysOverdue?: number | undefined; // If late
  scoreImpact?: number | undefined; // Points gained/lost

  // Deduplication
  idempotencyKey: string;

  // Status
  status: TransactionStatus;
  failureReason?: string | undefined;

  // Timestamps
  timestamp: Date;
  processedAt: Date;
}

/**
 * Input for creating a purchase transaction
 */
export interface CreatePurchaseInput {
  amount: number;
  merchant: string;
  idempotencyKey: string;
}

/**
 * Input for creating a payment transaction
 */
export interface CreatePaymentInput {
  amount: number;
  idempotencyKey: string;
  paymentStatus: PaymentStatus;
  daysOverdue?: number;
  scoreImpact?: number;
}

/**
 * Create a purchase transaction
 */
export function createPurchase(input: CreatePurchaseInput): Transaction {
  const now = new Date();

  return {
    transactionId: uuidv7(),
    type: 'purchase',
    amount: input.amount,
    merchant: input.merchant,
    idempotencyKey: input.idempotencyKey,
    status: 'completed',
    timestamp: now,
    processedAt: now,
  };
}

/**
 * Create a payment transaction
 */
export function createPayment(input: CreatePaymentInput): Transaction {
  const now = new Date();

  return {
    transactionId: uuidv7(),
    type: 'payment',
    amount: input.amount,
    idempotencyKey: input.idempotencyKey,
    paymentStatus: input.paymentStatus,
    daysOverdue: input.daysOverdue,
    scoreImpact: input.scoreImpact,
    status: 'completed',
    timestamp: now,
    processedAt: now,
  };
}

/**
 * Create a failed transaction
 */
export function createFailedTransaction(
  type: TransactionType,
  amount: number,
  idempotencyKey: string,
  failureReason: string
): Transaction {
  const now = new Date();

  return {
    transactionId: uuidv7(),
    type,
    amount,
    idempotencyKey,
    status: 'failed',
    failureReason,
    timestamp: now,
    processedAt: now,
  };
}

/**
 * Type guard to check if value is a Transaction
 */
export function isTransaction(value: unknown): value is Transaction {
  if (typeof value !== 'object' || value === null) return false;

  const tx = value as Record<string, unknown>;
  const validTypes: TransactionType[] = ['purchase', 'payment'];
  const validStatuses: TransactionStatus[] = ['completed', 'failed'];

  return (
    typeof tx.transactionId === 'string' &&
    validTypes.includes(tx.type as TransactionType) &&
    typeof tx.amount === 'number' &&
    typeof tx.idempotencyKey === 'string' &&
    validStatuses.includes(tx.status as TransactionStatus) &&
    tx.timestamp instanceof Date &&
    tx.processedAt instanceof Date
  );
}

/**
 * Validate transaction data
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateTransaction(tx: Transaction): ValidationResult {
  const errors: string[] = [];

  // Validate amount
  if (tx.amount <= 0) {
    errors.push('amount must be positive');
  }

  // Validate idempotencyKey
  if (tx.idempotencyKey.length === 0) {
    errors.push('idempotencyKey is required');
  }

  // Purchase-specific validation
  if (tx.type === 'purchase') {
    if (tx.merchant === undefined || tx.merchant.length === 0) {
      errors.push('merchant is required for purchases');
    }
  }

  // Payment-specific validation
  if (tx.type === 'payment') {
    if (tx.paymentStatus === undefined) {
      errors.push('paymentStatus is required for payments');
    }
    if (tx.paymentStatus === 'late' && tx.daysOverdue === undefined) {
      errors.push('daysOverdue is required for late payments');
    }
  }

  // Failed transaction must have reason
  if (tx.status === 'failed' && tx.failureReason === undefined) {
    errors.push('failureReason is required for failed transactions');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
