/**
 * Admin Adjust Score Handler
 *
 * Orchestrates admin adjustment of user scores.
 */

import type { AdminAdjustScoreCommand } from '../commands/admin-adjust-score.command.js';
import { validateAdminAdjustScoreCommand } from '../commands/admin-adjust-score.command.js';
import type { IUserRepository } from '../../infrastructure/persistence/interfaces/user.repository.js';
import type { IOutboxRepository } from '../../infrastructure/persistence/interfaces/outbox.repository.js';
import type { IAuditLogRepository } from '../../infrastructure/persistence/interfaces/audit-log.repository.js';
import { createAuditLog } from '../../domain/entities/audit-log.entity.js';
import { deriveTier } from '../../domain/entities/user.entity.js';
import { createScoreChangedEvent } from '../../domain/events/event.factory.js';

/**
 * Handler result
 */
export interface AdminAdjustScoreResult {
  success: boolean;
  ecosystemId: string;
  previousScore: number;
  newScore: number;
  delta: number;
  previousTier: string;
  newTier: string;
  message: string;
}

/**
 * Handler error
 */
export class AdminAdjustScoreError extends Error {
  constructor(
    message: string,
    public readonly code: 'VALIDATION_ERROR' | 'USER_NOT_FOUND'
  ) {
    super(message);
    this.name = 'AdminAdjustScoreError';
  }
}

/**
 * Handler dependencies
 */
export interface AdminAdjustScoreHandlerDeps {
  userRepository: IUserRepository;
  outboxRepository: IOutboxRepository;
  auditLogRepository: IAuditLogRepository;
}

/**
 * Handle admin adjust score command
 */
export async function handleAdminAdjustScore(
  command: AdminAdjustScoreCommand,
  deps: AdminAdjustScoreHandlerDeps
): Promise<AdminAdjustScoreResult> {
  // Validate command
  const validation = validateAdminAdjustScoreCommand(command);
  if (!validation.valid) {
    throw new AdminAdjustScoreError(validation.errors.join(', '), 'VALIDATION_ERROR');
  }

  // Get user
  const user = await deps.userRepository.findById(command.ecosystemId);
  if (!user) {
    throw new AdminAdjustScoreError('User not found', 'USER_NOT_FOUND');
  }

  const previousScore = user.currentScore;
  const previousTier = deriveTier(previousScore);
  const newTier = deriveTier(command.newScore);
  const delta = command.newScore - previousScore;

  // Update score
  await deps.userRepository.updateScore(
    command.ecosystemId,
    command.newScore,
    command.reason,
    'admin',
    command.adminId
  );

  // Create audit log
  const auditLog = createAuditLog({
    adminEcosystemId: command.adminId,
    adminEmail: command.adminEmail,
    action: 'score.adjusted',
    targetType: 'user',
    targetId: command.ecosystemId,
    previousValue: { score: previousScore, tier: previousTier },
    newValue: { score: command.newScore, tier: newTier },
    reason: command.reason,
    requestId: `score-adjust-${Date.now()}`,
  });
  await deps.auditLogRepository.save(auditLog);

  // Queue event
  await deps.outboxRepository.save(
    createScoreChangedEvent(
      command.ecosystemId,
      previousScore,
      command.newScore,
      command.reason,
      'admin',
      command.adminId
    )
  );

  return {
    success: true,
    ecosystemId: command.ecosystemId,
    previousScore,
    newScore: command.newScore,
    delta,
    previousTier,
    newTier,
    message: `Score adjusted from ${previousScore} to ${command.newScore} (${delta >= 0 ? '+' : ''}${delta})`,
  };
}
