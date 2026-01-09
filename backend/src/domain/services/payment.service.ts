/**
 * Payment Service
 *
 * Pure business logic for purchase and payment validation.
 * No external dependencies - operates only on domain types.
 */

import type { Card, CardStatus } from '../entities/card.entity.js';

/**
 * Validation result
 */
export interface ValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validate a purchase transaction
 *
 * Rules:
 * - Amount must be positive
 * - Amount must not exceed available credit
 * - Card must be active
 */
export function validatePurchase(
  amount: number,
  availableCredit: number,
  cardStatus: CardStatus
): ValidationResult {
  // Amount must be positive
  if (amount <= 0) {
    return { valid: false, error: 'Amount must be positive' };
  }

  // Card must be active
  if (cardStatus !== 'active') {
    return { valid: false, error: `Card is ${cardStatus}, cannot process purchase` };
  }

  // Amount must not exceed available credit
  if (amount > availableCredit) {
    return {
      valid: false,
      error: `Purchase amount ($${amount}) exceeds available credit ($${availableCredit})`,
    };
  }

  return { valid: true };
}

/**
 * Validate a payment transaction
 *
 * Rules:
 * - Amount must be positive
 * - Amount must not exceed balance
 * - Balance must be greater than zero
 */
export function validatePayment(amount: number, balance: number): ValidationResult {
  // Amount must be positive
  if (amount <= 0) {
    return { valid: false, error: 'Amount must be positive' };
  }

  // Balance must be greater than zero
  if (balance <= 0) {
    return { valid: false, error: 'No balance to pay' };
  }

  // Amount must not exceed balance
  if (amount > balance) {
    return {
      valid: false,
      error: `Payment amount ($${amount}) exceeds balance ($${balance})`,
    };
  }

  return { valid: true };
}

/**
 * Calculate new balance after transaction
 *
 * - Purchase: increases balance
 * - Payment: decreases balance
 */
export function calculateNewBalance(
  currentBalance: number,
  amount: number,
  type: 'purchase' | 'payment'
): number {
  if (type === 'purchase') {
    return currentBalance + amount;
  }
  return Math.max(0, currentBalance - amount);
}

/**
 * Calculate new available credit after transaction
 *
 * Available credit = limit - balance
 */
export function calculateAvailableCredit(limit: number, balance: number): number {
  return Math.max(0, limit - balance);
}

/**
 * Calculate minimum payment due
 *
 * Minimum payment is typically 2% of balance or $25, whichever is greater
 * (with balance as the max)
 */
export function calculateMinimumPayment(balance: number): number {
  if (balance <= 0) return 0;

  const percentageMinimum = balance * 0.02;
  const flatMinimum = 25;
  const minimum = Math.max(percentageMinimum, flatMinimum);

  return Math.min(minimum, balance);
}

/**
 * Determine if a payment is on time
 *
 * A payment is on time if made on or before the due date
 */
export function isPaymentOnTime(paymentDate: Date, dueDate: Date): boolean {
  // Compare dates only (ignore time)
  const payment = new Date(
    paymentDate.getFullYear(),
    paymentDate.getMonth(),
    paymentDate.getDate()
  );
  const due = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());

  return payment <= due;
}

/**
 * Calculate days overdue
 *
 * Returns 0 if payment is on time, otherwise returns the number of days late
 */
export function calculateDaysOverdue(paymentDate: Date, dueDate: Date): number {
  if (isPaymentOnTime(paymentDate, dueDate)) return 0;

  const diffMs = paymentDate.getTime() - dueDate.getTime();
  return Math.ceil(diffMs / (24 * 60 * 60 * 1000));
}

/**
 * Determine if payment is a full payment
 */
export function isFullPayment(amount: number, balance: number): boolean {
  return amount >= balance;
}

/**
 * Determine if payment meets minimum requirement
 */
export function meetsMinimumPayment(amount: number, minimumPayment: number): boolean {
  return amount >= minimumPayment;
}

/**
 * Calculate next due date (30 days from now)
 */
export function calculateNextDueDate(fromDate: Date = new Date()): Date {
  const dueDate = new Date(fromDate);
  dueDate.setDate(dueDate.getDate() + 30);
  return dueDate;
}

/**
 * Apply purchase to card (returns updated values)
 */
export interface CardUpdate {
  balance: number;
  availableCredit: number;
}

export function applyPurchase(card: Card, amount: number): CardUpdate {
  const newBalance = calculateNewBalance(card.balance, amount, 'purchase');
  const newAvailableCredit = calculateAvailableCredit(card.limit, newBalance);

  return {
    balance: newBalance,
    availableCredit: newAvailableCredit,
  };
}

/**
 * Apply payment to card (returns updated values)
 */
export interface PaymentUpdate extends CardUpdate {
  minimumPayment: number;
  nextDueDate: Date;
}

export function applyPayment(card: Card, amount: number): PaymentUpdate {
  const newBalance = calculateNewBalance(card.balance, amount, 'payment');
  const newAvailableCredit = calculateAvailableCredit(card.limit, newBalance);
  const newMinimumPayment = calculateMinimumPayment(newBalance);
  const newDueDate = calculateNextDueDate();

  return {
    balance: newBalance,
    availableCredit: newAvailableCredit,
    minimumPayment: newMinimumPayment,
    nextDueDate: newDueDate,
  };
}
