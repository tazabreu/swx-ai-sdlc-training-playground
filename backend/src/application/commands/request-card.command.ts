/**
 * Request Card Command
 *
 * Command to request a new credit card.
 */

/**
 * Command to request a new credit card
 */
export interface RequestCardCommand {
  /** Unique key to ensure idempotency */
  idempotencyKey: string;
  /** User's ecosystem ID */
  ecosystemId: string;
  /** Optional product ID (defaults to default-credit-card) */
  productId?: string | undefined;
}

/**
 * Create a request card command
 */
export function createRequestCardCommand(
  ecosystemId: string,
  idempotencyKey: string,
  productId?: string
): RequestCardCommand {
  return {
    ecosystemId,
    idempotencyKey,
    productId,
  };
}

/**
 * Validate a request card command
 */
export function validateRequestCardCommand(command: RequestCardCommand): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!command.ecosystemId || command.ecosystemId.trim() === '') {
    errors.push('ecosystemId is required');
  }

  if (!command.idempotencyKey || command.idempotencyKey.trim() === '') {
    errors.push('idempotencyKey is required');
  }

  if (command.idempotencyKey && command.idempotencyKey.length > 64) {
    errors.push('idempotencyKey must be at most 64 characters');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
