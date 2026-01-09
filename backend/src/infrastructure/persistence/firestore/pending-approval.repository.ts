/**
 * Pending Approval Firestore Repository
 *
 * Firestore implementation for pending approval tracker persistence.
 */

import type { Firestore } from 'firebase-admin/firestore';
import type { IPendingApprovalRepository } from '../interfaces/pending-approval.repository.js';
import type { PendingApprovalTracker } from '../../../domain/entities/pending-approval.entity.js';
import type { ApprovalStatus } from '../../whatsapp/types.js';
import { requireDate, optionalDate } from './codec.js';

/**
 * Collection name for pending approvals
 */
const COLLECTION = 'pending_approvals';

/**
 * Firestore Pending Approval Repository implementation
 */
export class PendingApprovalFirestoreRepository implements IPendingApprovalRepository {
  constructor(private readonly db: Firestore) {}

  async save(tracker: PendingApprovalTracker): Promise<void> {
    await this.db.collection(COLLECTION).doc(tracker.requestId).set(this.mapToDoc(tracker));
  }

  async findByRequestId(requestId: string): Promise<PendingApprovalTracker | null> {
    const doc = await this.db.collection(COLLECTION).doc(requestId).get();

    if (!doc.exists) {
      return null;
    }

    return this.mapFromDoc(doc.id, doc.data()!);
  }

  async findPendingByRequestId(requestId: string): Promise<PendingApprovalTracker | null> {
    const tracker = await this.findByRequestId(requestId);

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
    const now = new Date();

    await this.db.collection(COLLECTION).doc(requestId).update({
      approvalStatus: status,
      respondingAdminPhone: adminPhone,
      responseReceivedAt: now,
      updatedAt: now,
    });
  }

  async findExpired(): Promise<PendingApprovalTracker[]> {
    const now = new Date();

    const snapshot = await this.db
      .collection(COLLECTION)
      .where('approvalStatus', '==', 'pending')
      .where('expiresAt', '<', now)
      .get();

    return snapshot.docs.map((doc) => this.mapFromDoc(doc.id, doc.data()));
  }

  async markExpired(requestId: string): Promise<void> {
    await this.db.collection(COLLECTION).doc(requestId).update({
      approvalStatus: 'expired',
      updatedAt: new Date(),
    });
  }

  async deleteAll(): Promise<number> {
    const snapshot = await this.db.collection(COLLECTION).get();
    const batch = this.db.batch();

    snapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });

    await batch.commit();
    return snapshot.size;
  }

  private mapToDoc(tracker: PendingApprovalTracker): Record<string, unknown> {
    const doc: Record<string, unknown> = {
      ecosystemId: tracker.ecosystemId,
      notificationIds: tracker.notificationIds,
      approvalStatus: tracker.approvalStatus,
      expiresAt: tracker.expiresAt,
      createdAt: tracker.createdAt,
      updatedAt: tracker.updatedAt,
    };

    if (tracker.notificationsSentAt !== undefined) {
      doc.notificationsSentAt = tracker.notificationsSentAt;
    }
    if (tracker.respondingAdminPhone !== undefined) {
      doc.respondingAdminPhone = tracker.respondingAdminPhone;
    }
    if (tracker.responseReceivedAt !== undefined) {
      doc.responseReceivedAt = tracker.responseReceivedAt;
    }

    return doc;
  }

  private mapFromDoc(requestId: string, data: Record<string, unknown>): PendingApprovalTracker {
    const tracker: PendingApprovalTracker = {
      requestId,
      ecosystemId: data.ecosystemId as string,
      notificationIds: data.notificationIds as string[],
      approvalStatus: data.approvalStatus as ApprovalStatus,
      expiresAt: requireDate(data.expiresAt, 'expiresAt'),
      createdAt: requireDate(data.createdAt, 'createdAt'),
      updatedAt: requireDate(data.updatedAt, 'updatedAt'),
    };

    if (data.notificationsSentAt !== undefined) {
      const notificationsSentAtDate = optionalDate(data.notificationsSentAt, 'notificationsSentAt');
      if (notificationsSentAtDate !== undefined) {
        tracker.notificationsSentAt = notificationsSentAtDate;
      }
    }
    if (data.respondingAdminPhone !== undefined) {
      tracker.respondingAdminPhone = data.respondingAdminPhone as string;
    }
    if (data.responseReceivedAt !== undefined) {
      const responseReceivedAtDate = optionalDate(data.responseReceivedAt, 'responseReceivedAt');
      if (responseReceivedAtDate !== undefined) {
        tracker.responseReceivedAt = responseReceivedAtDate;
      }
    }

    return tracker;
  }
}
