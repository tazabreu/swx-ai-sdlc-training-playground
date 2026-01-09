/**
 * Admin Approve Card Handler
 *
 * Orchestrates admin approval of pending card requests.
 */

import type { AdminApproveCardCommand } from '../commands/admin-approve-card.command.js';
import { validateAdminApproveCardCommand } from '../commands/admin-approve-card.command.js';
import type { IUserRepository } from '../../infrastructure/persistence/interfaces/user.repository.js';
import type { ICardRepository } from '../../infrastructure/persistence/interfaces/card.repository.js';
import type { ICardRequestRepository } from '../../infrastructure/persistence/interfaces/card-request.repository.js';
import type { IOutboxRepository } from '../../infrastructure/persistence/interfaces/outbox.repository.js';
import type { IAuditLogRepository } from '../../infrastructure/persistence/interfaces/audit-log.repository.js';
import { createCard } from '../../domain/entities/card.entity.js';
import type { CardRequestDecision } from '../../domain/entities/card-request.entity.js';
import { createAuditLog } from '../../domain/entities/audit-log.entity.js';
import { canApproveWithLimit } from '../../domain/services/card-approval.service.js';
import { deriveTier } from '../../domain/entities/user.entity.js';
import { createCardApprovedEvent } from '../../domain/events/event.factory.js';

/**
 * Handler result
 */
export interface AdminApproveCardResult {
  success: boolean;
  cardId: string;
  requestId: string;
  limit: number;
  message: string;
}

/**
 * Handler error
 */
export class AdminApproveCardError extends Error {
  constructor(
    message: string,
    public readonly code:
      | 'VALIDATION_ERROR'
      | 'USER_NOT_FOUND'
      | 'REQUEST_NOT_FOUND'
      | 'REQUEST_NOT_PENDING'
      | 'LIMIT_EXCEEDS_POLICY'
  ) {
    super(message);
    this.name = 'AdminApproveCardError';
  }
}

/**
 * Handler dependencies
 */
export interface AdminApproveCardHandlerDeps {
  userRepository: IUserRepository;
  cardRepository: ICardRepository;
  cardRequestRepository: ICardRequestRepository;
  outboxRepository: IOutboxRepository;
  auditLogRepository: IAuditLogRepository;
}

/**
 * Handle admin approve card command
 */
export async function handleAdminApproveCard(
  command: AdminApproveCardCommand,
  deps: AdminApproveCardHandlerDeps
): Promise<AdminApproveCardResult> {
  // Validate command
  const validation = validateAdminApproveCardCommand(command);
  if (!validation.valid) {
    throw new AdminApproveCardError(validation.errors.join(', '), 'VALIDATION_ERROR');
  }

  // Get user
  const user = await deps.userRepository.findById(command.ecosystemId);
  if (!user) {
    throw new AdminApproveCardError('User not found', 'USER_NOT_FOUND');
  }

  // Get request
  const request = await deps.cardRequestRepository.findById(command.ecosystemId, command.requestId);
  if (!request) {
    throw new AdminApproveCardError('Request not found', 'REQUEST_NOT_FOUND');
  }

  // Check request is pending
  if (request.status !== 'pending') {
    throw new AdminApproveCardError(
      `Request is not pending (status: ${request.status})`,
      'REQUEST_NOT_PENDING'
    );
  }

  // Validate limit against policy
  const currentTier = deriveTier(user.currentScore);
  const approvalCheck = canApproveWithLimit(request, command.limit, currentTier);
  if (!approvalCheck.allowed) {
    throw new AdminApproveCardError(
      approvalCheck.reason ?? 'Limit exceeds policy',
      'LIMIT_EXCEEDS_POLICY'
    );
  }

  // Create card
  const card = createCard({
    limit: command.limit,
    approvedBy: 'admin',
    scoreAtApproval: user.currentScore,
  });

  // Create decision
  const decision: CardRequestDecision = {
    outcome: 'approved',
    source: 'admin',
    adminId: command.adminId,
    approvedLimit: command.limit,
    ...(command.reason !== undefined ? { reason: command.reason } : {}),
    decidedAt: new Date(),
  };

  // Update request and save card
  await Promise.all([
    deps.cardRequestRepository.updateStatus(
      command.ecosystemId,
      command.requestId,
      'approved',
      decision,
      card.cardId
    ),
    deps.cardRepository.save(command.ecosystemId, card),
  ]);

  // Update user's card summary
  const allCards = await deps.cardRepository.findByUser(command.ecosystemId);
  await deps.userRepository.updateCardSummary(command.ecosystemId, {
    activeCards: allCards.filter((c) => c.status === 'active').length + 1,
    totalBalance: allCards.reduce((sum, c) => sum + c.balance, 0),
    totalLimit: allCards.reduce((sum, c) => sum + c.limit, 0) + card.limit,
  });

  // Create audit log
  const auditLog = createAuditLog({
    adminEcosystemId: command.adminId,
    adminEmail: command.adminEmail,
    action: 'card_request.approved',
    targetType: 'card-request',
    targetId: command.requestId,
    targetEcosystemId: command.ecosystemId,
    previousValue: { status: 'pending' },
    newValue: { status: 'approved', limit: command.limit, cardId: card.cardId },
    reason: command.reason ?? 'Approved by admin',
    requestId: command.requestId,
  });
  await deps.auditLogRepository.save(auditLog);

  // Queue event
  await deps.outboxRepository.save(
    createCardApprovedEvent(
      { ...request, status: 'approved', decision, resultingCardId: card.cardId },
      card,
      command.ecosystemId,
      decision
    )
  );

  return {
    success: true,
    cardId: card.cardId,
    requestId: command.requestId,
    limit: command.limit,
    message: `Card approved with $${command.limit} limit`,
  };
}
