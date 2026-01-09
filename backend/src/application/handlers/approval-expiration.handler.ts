/**
 * Approval Expiration Handler
 *
 * Handles expiration of pending approvals that exceed the 24-hour window.
 * Called periodically (e.g., every hour) to auto-reject expired requests.
 */

import type { IPendingApprovalRepository } from '../../infrastructure/persistence/interfaces/pending-approval.repository.js';
import type { ICardRequestRepository } from '../../infrastructure/persistence/interfaces/card-request.repository.js';
import type { IUserRepository } from '../../infrastructure/persistence/interfaces/user.repository.js';
import type { IOutboxRepository } from '../../infrastructure/persistence/interfaces/outbox.repository.js';
import type { IAuditLogRepository } from '../../infrastructure/persistence/interfaces/audit-log.repository.js';
import { handleAdminRejectCard } from './admin-reject-card.handler.js';

/**
 * Handler dependencies
 */
export interface ApprovalExpirationHandlerDeps {
  pendingApprovalRepo: IPendingApprovalRepository;
  cardRequestRepo: ICardRequestRepository;
  userRepo: IUserRepository;
  outboxRepo: IOutboxRepository;
  auditLogRepo: IAuditLogRepository;
}

/**
 * Handler result
 */
export interface ApprovalExpirationResult {
  processedCount: number;
  successCount: number;
  failedCount: number;
  expiredRequestIds: string[];
  errors: Array<{ requestId: string; error: string }>;
}

/**
 * System admin ID for automated expirations
 */
const SYSTEM_ADMIN_ID = 'system';
const SYSTEM_ADMIN_EMAIL = 'system@expired.internal';

/**
 * Handle expired approvals
 *
 * Logic flow:
 * 1. Find all expired pending approvals (expiresAt < now, status = pending)
 * 2. For each expired approval:
 *    a. Auto-reject the card request with "expired" reason
 *    b. Mark PendingApprovalTracker as expired
 * 3. Return count of processed items
 */
export async function handleExpiredApprovals(
  deps: ApprovalExpirationHandlerDeps
): Promise<ApprovalExpirationResult> {
  const result: ApprovalExpirationResult = {
    processedCount: 0,
    successCount: 0,
    failedCount: 0,
    expiredRequestIds: [],
    errors: [],
  };

  // Find all expired pending approvals
  const expiredTrackers = await deps.pendingApprovalRepo.findExpired();

  for (const tracker of expiredTrackers) {
    result.processedCount++;

    try {
      // Check if the card request still exists and is pending
      const cardRequest = await deps.cardRequestRepo.findById(
        tracker.ecosystemId,
        tracker.requestId
      );

      if (!cardRequest) {
        // Request no longer exists - just mark tracker as expired
        await deps.pendingApprovalRepo.markExpired(tracker.requestId);
        result.successCount++;
        result.expiredRequestIds.push(tracker.requestId);
        continue;
      }

      if (cardRequest.status !== 'pending') {
        // Request already processed - just mark tracker as expired
        await deps.pendingApprovalRepo.markExpired(tracker.requestId);
        result.successCount++;
        result.expiredRequestIds.push(tracker.requestId);
        continue;
      }

      // Auto-reject the card request
      await handleAdminRejectCard(
        {
          adminId: SYSTEM_ADMIN_ID,
          adminEmail: SYSTEM_ADMIN_EMAIL,
          ecosystemId: tracker.ecosystemId,
          requestId: tracker.requestId,
          reason: 'Approval request expired after 24 hours without response',
        },
        {
          userRepository: deps.userRepo,
          cardRequestRepository: deps.cardRequestRepo,
          outboxRepository: deps.outboxRepo,
          auditLogRepository: deps.auditLogRepo,
        }
      );

      // Mark tracker as expired
      await deps.pendingApprovalRepo.markExpired(tracker.requestId);

      result.successCount++;
      result.expiredRequestIds.push(tracker.requestId);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      result.failedCount++;
      result.errors.push({
        requestId: tracker.requestId,
        error: errorMessage,
      });
    }
  }

  return result;
}
