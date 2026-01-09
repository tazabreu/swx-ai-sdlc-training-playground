/**
 * Make Purchase Command
 *
 * Command to simulate a purchase on a credit card.
 */

/**
 * Command to make a purchase
 */
export interface MakePurchaseCommand {
  /** Unique key to ensure idempotency */
  idempotencyKey: string;
  /** User's ecosystem ID */
  ecosystemId: string;
  /** Card ID to charge */
  cardId: string;
  /** Purchase amount in cents */
  amount: number;
  /** Merchant name */
  merchant: string;
  /** Optional merchant category */
  category?: string | undefined;
}

/**
 * Create a make purchase command
 */
export function createMakePurchaseCommand(
  ecosystemId: string,
  cardId: string,
  amount: number,
  merchant: string,
  idempotencyKey: string,
  category?: string
): MakePurchaseCommand {
  return {
    ecosystemId,
    cardId,
    amount,
    merchant,
    idempotencyKey,
    category,
  };
}

/**
 * Validate a make purchase command
 */
export function validateMakePurchaseCommand(command: MakePurchaseCommand): {
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

  if (!command.merchant || command.merchant.trim() === '') {
    errors.push('merchant is required');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
