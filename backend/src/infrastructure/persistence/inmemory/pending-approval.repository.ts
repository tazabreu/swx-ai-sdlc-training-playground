/**
 * In-Memory Pending Approval Repository
 *
 * In-memory implementation for testing.
 */

/* eslint-disable @typescript-eslint/require-await */

import type { IPendingApprovalRepository } from '../interfaces/pending-approval.repository.js';
import type { PendingApprovalTracker } from '../../../domain/entities/pending-approval.entity.js';

/**
 * In-Memory Pending Approval Repository implementation
 */
export class InMemoryPendingApprovalRepository implements IPendingApprovalRepository {
  private trackers: Map<string, PendingApprovalTracker> = new Map();

  async save(tracker: PendingApprovalTracker): Promise<void> {
    this.trackers.set(tracker.requestId, { ...tracker });
  }

  async findByRequestId(requestId: string): Promise<PendingApprovalTracker | null> {
    return this.trackers.get(requestId) ?? null;
  }

  async findPendingByRequestId(requestId: string): Promise<PendingApprovalTracker | null> {
    const tracker = this.trackers.get(requestId);
    if (!tracker || tracker.approvalStatus !== 'pending') {
      return null;
    }
    return tracker;
  }

  async updateApprovalStatus(
    requestId: string,
    status: 'approved' | 'rejected',
    adminPhone: string
  ): Promise<void> {
    const tracker = this.trackers.get(requestId);
    if (!tracker) {
      throw new Error(`Tracker not found: ${requestId}`);
    }

    tracker.approvalStatus = status;
    tracker.respondingAdminPhone = adminPhone;
    tracker.responseReceivedAt = new Date();
    tracker.updatedAt = new Date();
  }

  async findExpired(): Promise<PendingApprovalTracker[]> {
    const now = new Date();
    return Array.from(this.trackers.values()).filter(
      (t) => t.approvalStatus === 'pending' && t.expiresAt < now
    );
  }

  async markExpired(requestId: string): Promise<void> {
    const tracker = this.trackers.get(requestId);
    if (!tracker) {
      throw new Error(`Tracker not found: ${requestId}`);
    }

    tracker.approvalStatus = 'expired';
    tracker.updatedAt = new Date();
  }

  async deleteAll(): Promise<number> {
    const count = this.trackers.size;
    this.trackers.clear();
    return count;
  }

  /**
   * Get all trackers (for testing)
   */
  getAll(): PendingApprovalTracker[] {
    return Array.from(this.trackers.values());
  }
}
