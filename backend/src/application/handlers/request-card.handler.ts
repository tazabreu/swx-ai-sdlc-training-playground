/**
 * Request Card Handler
 *
 * Orchestrates card request flow.
 */

import type { RequestCardCommand } from '../commands/request-card.command.js';
import { validateRequestCardCommand } from '../commands/request-card.command.js';
import type { IUserRepository } from '../../infrastructure/persistence/interfaces/user.repository.js';
import type { ICardRepository } from '../../infrastructure/persistence/interfaces/card.repository.js';
import type { ICardRequestRepository } from '../../infrastructure/persistence/interfaces/card-request.repository.js';
import type { IIdempotencyRepository } from '../../infrastructure/persistence/interfaces/idempotency.repository.js';
import type { IOutboxRepository } from '../../infrastructure/persistence/interfaces/outbox.repository.js';
import {
  createCardRequest,
  type CardRequest,
  type CardRequestDecision,
} from '../../domain/entities/card-request.entity.js';
import { createCard, type Card } from '../../domain/entities/card.entity.js';
import {
  createIdempotencyRecord,
  hashIdempotencyKey,
  isExpired,
  checkOperationMismatch,
} from '../../domain/entities/idempotency-record.entity.js';
import {
  canRequestCard,
  determineApprovalOutcome,
} from '../../domain/services/card-approval.service.js';
import {
  createCardRequestedEvent,
  createCardApprovedEvent,
} from '../../domain/events/event.factory.js';

/**
 * Cached idempotency response shape for request-card
 */
interface RequestCardCachedResponse {
  status: 'approved' | 'pending' | 'rejected';
  requestId: string;
  limit?: number | undefined;
  cardId?: string | undefined;
}

/**
 * Handler result
 */
export interface RequestCardResult {
  success: boolean;
  requestId?: string | undefined;
  cardId?: string | undefined;
  status: 'approved' | 'pending' | 'rejected';
  message: string;
  limit?: number | undefined;
  fromIdempotency?: boolean | undefined;
}

/**
 * Handler error
 */
export class RequestCardError extends Error {
  constructor(
    message: string,
    public readonly code:
      | 'VALIDATION_ERROR'
      | 'USER_NOT_FOUND'
      | 'NOT_ELIGIBLE'
      | 'IDEMPOTENCY_MISMATCH'
  ) {
    super(message);
    this.name = 'RequestCardError';
  }
}

/**
 * Handler dependencies
 */
export interface RequestCardHandlerDeps {
  userRepository: IUserRepository;
  cardRepository: ICardRepository;
  cardRequestRepository: ICardRequestRepository;
  idempotencyRepository: IIdempotencyRepository;
  outboxRepository: IOutboxRepository;
}

/**
 * Handle card request command
 */
export async function handleRequestCard(
  command: RequestCardCommand,
  deps: RequestCardHandlerDeps
): Promise<RequestCardResult> {
  // Validate command
  const validation = validateRequestCardCommand(command);
  if (!validation.valid) {
    throw new RequestCardError(validation.errors.join(', '), 'VALIDATION_ERROR');
  }

  // Check idempotency
  const keyHash = hashIdempotencyKey(command.idempotencyKey);
  const existingRecord = await deps.idempotencyRepository.find(command.ecosystemId, keyHash);

  if (existingRecord && !isExpired(existingRecord)) {
    // Check for operation mismatch
    if (checkOperationMismatch(existingRecord, 'request-card')) {
      throw new RequestCardError(
        'Idempotency key used for different operation',
        'IDEMPOTENCY_MISMATCH'
      );
    }

    // Return cached result
    const cachedResponse = existingRecord.response as RequestCardCachedResponse;
    return {
      success: true,
      requestId: cachedResponse.requestId,
      status: cachedResponse.status,
      message: 'Request already processed',
      limit: cachedResponse.limit,
      cardId: cachedResponse.cardId,
      fromIdempotency: true,
    };
  }

  // Get user
  const user = await deps.userRepository.findById(command.ecosystemId);
  if (!user) {
    throw new RequestCardError('User not found', 'USER_NOT_FOUND');
  }

  // Get existing cards and requests
  const [cards, pendingRequests, rejectedRequests] = await Promise.all([
    deps.cardRepository.findByUser(command.ecosystemId),
    deps.cardRequestRepository.findPendingByUser(command.ecosystemId),
    deps.cardRequestRepository.findRejectedByUser(command.ecosystemId, 30),
  ]);

  // Check eligibility
  const eligibility = canRequestCard(
    user,
    cards,
    pendingRequests ? [pendingRequests] : [],
    rejectedRequests
  );
  if (!eligibility.allowed) {
    throw new RequestCardError(eligibility.reason ?? 'Not eligible', 'NOT_ELIGIBLE');
  }

  // Determine approval outcome
  const outcome = determineApprovalOutcome(user.currentScore);

  // Create card request
  const request = createCardRequest({
    idempotencyKey: command.idempotencyKey,
    scoreAtRequest: user.currentScore,
    tierAtRequest: user.tier,
    ...(command.productId !== undefined ? { productId: command.productId } : {}),
  });

  let card: Card | undefined;
  let result: RequestCardResult;

  if (outcome.approved) {
    // Auto-approve: create card immediately
    card = createCard({
      limit: outcome.limit,
      approvedBy: 'auto',
      scoreAtApproval: user.currentScore,
    });

    const decision: CardRequestDecision = {
      outcome: 'approved',
      source: 'auto',
      approvedLimit: outcome.limit,
      decidedAt: new Date(),
    };

    // Update request with decision
    const approvedRequest: CardRequest = {
      ...request,
      status: 'approved',
      decision,
      resultingCardId: card.cardId,
    };

    // Save everything
    await Promise.all([
      deps.cardRequestRepository.save(command.ecosystemId, approvedRequest),
      deps.cardRepository.save(command.ecosystemId, card),
    ]);

    // Update user's card summary
    await deps.userRepository.updateCardSummary(command.ecosystemId, {
      activeCards: cards.filter((c) => c.status === 'active').length + 1,
      totalBalance: cards.reduce((sum, c) => sum + c.balance, 0),
      totalLimit: cards.reduce((sum, c) => sum + c.limit, 0) + card.limit,
    });

    // Queue events
    await deps.outboxRepository.save(
      createCardApprovedEvent(approvedRequest, card, command.ecosystemId, decision)
    );

    result = {
      success: true,
      requestId: request.requestId,
      cardId: card.cardId,
      status: 'approved',
      message: `Card approved with $${outcome.limit} limit`,
      limit: outcome.limit,
    };
  } else {
    // Pending: requires admin review
    await deps.cardRequestRepository.save(command.ecosystemId, request);

    // Queue event
    await deps.outboxRepository.save(createCardRequestedEvent(request, command.ecosystemId));

    result = {
      success: true,
      requestId: request.requestId,
      status: 'pending',
      message: outcome.reason ?? 'Request pending admin review',
    };
  }

  // Save idempotency record
  const cachedResponse: RequestCardCachedResponse = {
    status: result.status,
    requestId: request.requestId,
    limit: result.limit,
    cardId: result.cardId,
  };
  const idempotencyRecord = createIdempotencyRecord({
    key: command.idempotencyKey,
    operation: 'request-card',
    response: cachedResponse,
    statusCode: 200,
  });
  await deps.idempotencyRepository.save(command.ecosystemId, idempotencyRecord);

  return result;
}
