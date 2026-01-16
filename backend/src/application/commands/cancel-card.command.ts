/**
 * Cancel Card Command
 *
 * Command to cancel a credit card (soft-delete).
 */

/**
 * Cancel card command
 */
export interface CancelCardCommand {
  ecosystemId: string; // Card owner
  cardId: string; // Card to cancel
  idempotencyKey: string; // Idempotency key for duplicate detection
  actorEcosystemId: string; // Who initiated the cancellation
  requestId: string; // For audit trail
}

/**
 * Create a cancel card command
 */
export function createCancelCardCommand(
  ecosystemId: string,
  cardId: string,
  idempotencyKey: string,
  actorEcosystemId: string,
  requestId: string
): CancelCardCommand {
  return {
    ecosystemId,
    cardId,
    idempotencyKey,
    actorEcosystemId,
    requestId,
  };
}
