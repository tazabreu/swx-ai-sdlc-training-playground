/**
 * Pending Approval Repository Interface
 *
 * Defines persistence operations for pending approval trackers.
 */

import type { PendingApprovalTracker } from '../../../domain/entities/pending-approval.entity.js';

/**
 * Repository interface for pending approval tracker persistence
 */
export interface IPendingApprovalRepository {
  /**
   * Save a new tracker or update an existing one
   */
  save(tracker: PendingApprovalTracker): Promise<void>;

  /**
   * Find tracker by request ID
   */
  findByRequestId(requestId: string): Promise<PendingApprovalTracker | null>;

  /**
   * Find pending tracker by request ID (status = 'pending')
   */
  findPendingByRequestId(requestId: string): Promise<PendingApprovalTracker | null>;

  /**
   * Update approval status when admin responds
   */
  updateApprovalStatus(
    requestId: string,
    status: 'approved' | 'rejected',
    adminPhone: string
  ): Promise<void>;

  /**
   * Find expired trackers (for auto-rejection)
   */
  findExpired(): Promise<PendingApprovalTracker[]>;

  /**
   * Mark a tracker as expired
   */
  markExpired(requestId: string): Promise<void>;

  /**
   * Delete all trackers (for cleanup)
   */
  deleteAll(): Promise<number>;
}
