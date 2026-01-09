/**
 * Admin Reject Card Handler
 *
 * Orchestrates admin rejection of pending card requests.
 */

import type { AdminRejectCardCommand } from '../commands/admin-reject-card.command.js';
import { validateAdminRejectCardCommand } from '../commands/admin-reject-card.command.js';
import type { IUserRepository } from '../../infrastructure/persistence/interfaces/user.repository.js';
import type { ICardRequestRepository } from '../../infrastructure/persistence/interfaces/card-request.repository.js';
import type { IOutboxRepository } from '../../infrastructure/persistence/interfaces/outbox.repository.js';
import type { IAuditLogRepository } from '../../infrastructure/persistence/interfaces/audit-log.repository.js';
import type { CardRequestDecision } from '../../domain/entities/card-request.entity.js';
import { createAuditLog } from '../../domain/entities/audit-log.entity.js';
import { createCardRejectedEvent } from '../../domain/events/event.factory.js';

/**
 * Handler result
 */
export interface AdminRejectCardResult {
  success: boolean;
  requestId: string;
  reason: string;
  message: string;
}

/**
 * Handler error
 */
export class AdminRejectCardError extends Error {
  constructor(
    message: string,
    public readonly code:
      | 'VALIDATION_ERROR'
      | 'USER_NOT_FOUND'
      | 'REQUEST_NOT_FOUND'
      | 'REQUEST_NOT_PENDING'
  ) {
    super(message);
    this.name = 'AdminRejectCardError';
  }
}

/**
 * Handler dependencies
 */
export interface AdminRejectCardHandlerDeps {
  userRepository: IUserRepository;
  cardRequestRepository: ICardRequestRepository;
  outboxRepository: IOutboxRepository;
  auditLogRepository: IAuditLogRepository;
}

/**
 * Handle admin reject card command
 */
export async function handleAdminRejectCard(
  command: AdminRejectCardCommand,
  deps: AdminRejectCardHandlerDeps
): Promise<AdminRejectCardResult> {
  // Validate command
  const validation = validateAdminRejectCardCommand(command);
  if (!validation.valid) {
    throw new AdminRejectCardError(validation.errors.join(', '), 'VALIDATION_ERROR');
  }

  // Get user (for audit)
  const user = await deps.userRepository.findById(command.ecosystemId);
  if (!user) {
    throw new AdminRejectCardError('User not found', 'USER_NOT_FOUND');
  }

  // Get request
  const request = await deps.cardRequestRepository.findById(command.ecosystemId, command.requestId);
  if (!request) {
    throw new AdminRejectCardError('Request not found', 'REQUEST_NOT_FOUND');
  }

  // Check request is pending
  if (request.status !== 'pending') {
    throw new AdminRejectCardError(
      `Request is not pending (status: ${request.status})`,
      'REQUEST_NOT_PENDING'
    );
  }

  // Create decision
  const decision: CardRequestDecision = {
    outcome: 'rejected',
    source: 'admin',
    adminId: command.adminId,
    reason: command.reason,
    decidedAt: new Date(),
  };

  // Update request
  await deps.cardRequestRepository.updateStatus(
    command.ecosystemId,
    command.requestId,
    'rejected',
    decision
  );

  // Create audit log
  const auditLog = createAuditLog({
    adminEcosystemId: command.adminId,
    adminEmail: command.adminEmail,
    action: 'card_request.rejected',
    targetType: 'card-request',
    targetId: command.requestId,
    targetEcosystemId: command.ecosystemId,
    previousValue: { status: 'pending' },
    newValue: { status: 'rejected' },
    reason: command.reason,
    requestId: command.requestId,
  });
  await deps.auditLogRepository.save(auditLog);

  // Queue event
  await deps.outboxRepository.save(
    createCardRejectedEvent(
      { ...request, status: 'rejected', decision },
      command.ecosystemId,
      decision
    )
  );

  return {
    success: true,
    requestId: command.requestId,
    reason: command.reason,
    message: `Card request rejected: ${command.reason}`,
  };
}
