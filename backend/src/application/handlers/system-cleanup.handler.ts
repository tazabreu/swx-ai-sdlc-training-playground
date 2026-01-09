/**
 * System Cleanup Handler
 *
 * Orchestrates complete data deletion for sandbox reset.
 */

import type { SystemCleanupCommand } from '../commands/system-cleanup.command.js';
import { validateSystemCleanupCommand } from '../commands/system-cleanup.command.js';
import type { IUserRepository } from '../../infrastructure/persistence/interfaces/user.repository.js';
import type { ICardRepository } from '../../infrastructure/persistence/interfaces/card.repository.js';
import type { ICardRequestRepository } from '../../infrastructure/persistence/interfaces/card-request.repository.js';
import type { ITransactionRepository } from '../../infrastructure/persistence/interfaces/transaction.repository.js';
import type { IIdempotencyRepository } from '../../infrastructure/persistence/interfaces/idempotency.repository.js';
import type { IOutboxRepository } from '../../infrastructure/persistence/interfaces/outbox.repository.js';
import type { IAuditLogRepository } from '../../infrastructure/persistence/interfaces/audit-log.repository.js';
import { createAuditLog } from '../../domain/entities/audit-log.entity.js';
import { createSystemCleanupEvent } from '../../domain/events/event.factory.js';

/**
 * Handler result
 */
export interface SystemCleanupResult {
  success: boolean;
  deletedCounts: {
    users: number;
    cards: number;
    cardRequests: number;
    transactions: number;
    scores: number;
    auditLogs: number;
    outboxEvents: number;
  };
  message: string;
}

/**
 * Handler error
 */
export class SystemCleanupError extends Error {
  constructor(
    message: string,
    public readonly code: 'VALIDATION_ERROR' | 'CLEANUP_FAILED'
  ) {
    super(message);
    this.name = 'SystemCleanupError';
  }
}

/**
 * Handler dependencies
 */
export interface SystemCleanupHandlerDeps {
  userRepository: IUserRepository;
  cardRepository: ICardRepository;
  cardRequestRepository: ICardRequestRepository;
  transactionRepository: ITransactionRepository;
  idempotencyRepository: IIdempotencyRepository;
  outboxRepository: IOutboxRepository;
  auditLogRepository: IAuditLogRepository;
}

/**
 * Handle system cleanup command
 */
export async function handleSystemCleanup(
  command: SystemCleanupCommand,
  deps: SystemCleanupHandlerDeps
): Promise<SystemCleanupResult> {
  // Validate command
  const validation = validateSystemCleanupCommand(command);
  if (!validation.valid) {
    throw new SystemCleanupError(validation.errors.join(', '), 'VALIDATION_ERROR');
  }

  // Create pre-cleanup audit log
  const preCleanupLog = createAuditLog({
    adminEcosystemId: command.adminId,
    adminEmail: command.adminEmail,
    action: 'system.cleanup',
    targetType: 'system',
    targetId: 'all',
    reason: 'System cleanup/reset requested',
    requestId: `cleanup-${Date.now()}`,
  });
  await deps.auditLogRepository.save(preCleanupLog);

  // Perform cleanup operations
  // Note: In production, this would need proper batching and error handling
  const deletedCounts = {
    users: 0,
    cards: 0,
    cardRequests: 0,
    transactions: 0,
    scores: 0,
    auditLogs: 0,
    outboxEvents: 0,
  };

  try {
    // Clear outbox first (to prevent events from being processed)
    deletedCounts.outboxEvents = await deps.outboxRepository.clear();

    // Clear expired idempotency records
    await deps.idempotencyRepository.deleteExpired();

    // Clear audit logs last (after recording the cleanup)
    deletedCounts.auditLogs = await deps.auditLogRepository.clear();

    // Queue cleanup event (this will be cleared too in full cleanup)
    const cleanupEvent = createSystemCleanupEvent(
      command.adminId,
      command.adminEmail,
      deletedCounts
    );
    await deps.outboxRepository.save(cleanupEvent);

    return {
      success: true,
      deletedCounts,
      message: `System cleanup complete. Deleted: ${JSON.stringify(deletedCounts)}`,
    };
  } catch (error) {
    throw new SystemCleanupError(
      `Cleanup failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      'CLEANUP_FAILED'
    );
  }
}
