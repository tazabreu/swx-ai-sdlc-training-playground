/**
 * Cancel Card Handler
 *
 * Handles card cancellation with validation, state transition,
 * audit logging, and event emission.
 */

import type { CancelCardCommand } from '../commands/cancel-card.command.js';
import type { ICardRepository } from '../../infrastructure/persistence/interfaces/card.repository.js';
import type { IIdempotencyRepository } from '../../infrastructure/persistence/interfaces/idempotency.repository.js';
import type { IAuditLogRepository } from '../../infrastructure/persistence/interfaces/audit-log.repository.js';
import type { IOutboxRepository } from '../../infrastructure/persistence/interfaces/outbox.repository.js';
import { canTransitionTo } from '../../domain/entities/card.entity.js';
import { createAuditLog } from '../../domain/entities/audit-log.entity.js';
import { createCardCancelledEvent } from '../../domain/events/event.factory.js';
import {
  createIdempotencyRecord,
  hashIdempotencyKey,
  isExpired,
  checkOperationMismatch,
} from '../../domain/entities/idempotency-record.entity.js';

/**
 * Result of cancel card operation
 */
export interface CancelCardResult {
  cardId: string;
  status: 'cancelled';
  cancelledAt: Date;
  alreadyCancelled: boolean; // True if card was already cancelled (idempotent)
}

/**
 * Cached response for idempotency
 */
interface CancelCardCachedResponse {
  cardId: string;
  status: 'cancelled';
  cancelledAt: string; // ISO string for serialization
  alreadyCancelled: boolean;
}

/**
 * Cancel card error types
 */
export class CancelCardError extends Error {
  constructor(
    message: string,
    public readonly code: 'NOT_FOUND' | 'UNAUTHORIZED' | 'INVALID_TRANSITION' | 'ALREADY_CANCELLED'
  ) {
    super(message);
    this.name = 'CancelCardError';
  }
}

/**
 * Dependencies for cancel card handler
 */
export interface CancelCardDependencies {
  cardRepository: ICardRepository;
  idempotencyRepository: IIdempotencyRepository;
  auditLogRepository: IAuditLogRepository;
  outboxRepository: IOutboxRepository;
}

/**
 * Handle cancel card command
 */
export async function handleCancelCard(
  command: CancelCardCommand,
  deps: CancelCardDependencies
): Promise<CancelCardResult> {
  const { ecosystemId, cardId, idempotencyKey, actorEcosystemId, requestId } = command;

  // Idempotency check
  const keyHash = hashIdempotencyKey(idempotencyKey);
  const existingRecord = await deps.idempotencyRepository.find(ecosystemId, keyHash);

  if (existingRecord && !isExpired(existingRecord)) {
    // Check for operation mismatch
    if (checkOperationMismatch(existingRecord, 'cancel-card')) {
      throw new CancelCardError(
        'Idempotency key used for different operation',
        'INVALID_TRANSITION'
      );
    }

    // Return cached result
    const cachedResponse = existingRecord.response as CancelCardCachedResponse;
    return {
      cardId: cachedResponse.cardId,
      status: cachedResponse.status,
      cancelledAt: new Date(cachedResponse.cancelledAt),
      alreadyCancelled: cachedResponse.alreadyCancelled,
    };
  }

  // Get card
  const card = await deps.cardRepository.findById(ecosystemId, cardId);
  if (card === null) {
    throw new CancelCardError(`Card not found: ${cardId}`, 'NOT_FOUND');
  }

  // Ownership validation
  if (ecosystemId !== actorEcosystemId) {
    throw new CancelCardError(
      `User ${actorEcosystemId} is not authorized to cancel card ${cardId}`,
      'UNAUTHORIZED'
    );
  }

  // Idempotency: if already cancelled, return success
  if (card.status === 'cancelled') {
    const result: CancelCardResult = {
      cardId: card.cardId,
      status: 'cancelled',
      cancelledAt: card.cancelledAt ?? new Date(),
      alreadyCancelled: true,
    };

    // Store idempotency result
    const cachedResponse: CancelCardCachedResponse = {
      cardId: result.cardId,
      status: result.status,
      cancelledAt: result.cancelledAt.toISOString(),
      alreadyCancelled: result.alreadyCancelled,
    };
    const idempotencyRecord = createIdempotencyRecord({
      key: idempotencyKey,
      operation: 'cancel-card',
      response: cachedResponse,
      statusCode: 200,
    });
    await deps.idempotencyRepository.save(ecosystemId, idempotencyRecord);

    return result;
  }

  // Validate state transition
  const transition = canTransitionTo(card, 'cancelled', { balanceCheck: false });
  if (!transition.allowed) {
    throw new CancelCardError(
      transition.error ?? 'Cannot cancel card',
      'INVALID_TRANSITION'
    );
  }

  // Update card status
  const now = new Date();
  card.status = 'cancelled';
  card.cancelledAt = now;
  card.updatedAt = now;
  card.version += 1;

  await deps.cardRepository.save(ecosystemId, card);

  // Create audit log
  const auditLog = createAuditLog({
    adminEcosystemId: actorEcosystemId,
    adminEmail: `${actorEcosystemId}@system.local`, // User-initiated cancellation
    action: 'card.cancelled',
    targetType: 'card',
    targetId: cardId,
    targetEcosystemId: ecosystemId,
    previousValue: { status: 'active' },
    newValue: { status: 'cancelled', cancelledAt: now },
    reason: 'User-initiated card cancellation',
    requestId,
  });

  await deps.auditLogRepository.save(auditLog);

  // Emit domain event
  const event = createCardCancelledEvent(
    card,
    ecosystemId,
    'User-initiated card cancellation',
    'user' // User-initiated cancellation
  );
  await deps.outboxRepository.save(event);

  const result: CancelCardResult = {
    cardId: card.cardId,
    status: 'cancelled',
    cancelledAt: now,
    alreadyCancelled: false,
  };

  // Store idempotency result
  const cachedResponse: CancelCardCachedResponse = {
    cardId: result.cardId,
    status: result.status,
    cancelledAt: result.cancelledAt.toISOString(),
    alreadyCancelled: result.alreadyCancelled,
  };
  const idempotencyRecord = createIdempotencyRecord({
    key: idempotencyKey,
    operation: 'cancel-card',
    response: cachedResponse,
    statusCode: 200,
  });
  await deps.idempotencyRepository.save(ecosystemId, idempotencyRecord);

  return result;
}
