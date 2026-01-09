/**
 * Make Payment Command
 *
 * Command to make a payment on a credit card.
 */

/**
 * Command to make a payment
 */
export interface MakePaymentCommand {
  /** Unique key to ensure idempotency */
  idempotencyKey: string;
  /** User's ecosystem ID */
  ecosystemId: string;
  /** Card ID to pay */
  cardId: string;
  /** Payment amount in cents */
  amount: number;
  /** Optional: simulate payment date (for testing late payments) */
  simulatedPaymentDate?: Date | undefined;
}

/**
 * Create a make payment command
 */
export function createMakePaymentCommand(
  ecosystemId: string,
  cardId: string,
  amount: number,
  idempotencyKey: string,
  simulatedPaymentDate?: Date
): MakePaymentCommand {
  return {
    ecosystemId,
    cardId,
    amount,
    idempotencyKey,
    simulatedPaymentDate,
  };
}

/**
 * Validate a make payment command
 */
export function validateMakePaymentCommand(command: MakePaymentCommand): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!command.ecosystemId || command.ecosystemId.trim() === '') {
    errors.push('ecosystemId is required');
  }

  if (!command.cardId || command.cardId.trim() === '') {
    errors.push('cardId is required');
  }

  if (!command.idempotencyKey || command.idempotencyKey.trim() === '') {
    errors.push('idempotencyKey is required');
  }

  if (command.idempotencyKey && command.idempotencyKey.length > 64) {
    errors.push('idempotencyKey must be at most 64 characters');
  }

  if (typeof command.amount !== 'number' || command.amount <= 0) {
    errors.push('amount must be a positive number');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
