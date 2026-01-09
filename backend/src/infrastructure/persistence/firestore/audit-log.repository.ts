/**
 * Firestore Audit Log Repository
 *
 * Firestore implementation for audit log storage and retrieval.
 */

import type { Firestore, Query, DocumentData } from 'firebase-admin/firestore';
import type {
  IAuditLogRepository,
  AuditLogPaginationOptions,
  PaginatedAuditLogs,
} from '../interfaces/audit-log.repository.js';
import type { AuditLog, AuditAction } from '../../../domain/entities/audit-log.entity.js';
import { CollectionPaths } from './client.js';
import { requireDate } from './codec.js';

/**
 * Firestore Audit Log Repository implementation
 */
export class FirestoreAuditLogRepository implements IAuditLogRepository {
  constructor(private readonly db: Firestore) {}

  async save(log: AuditLog): Promise<void> {
    await this.db.collection(CollectionPaths.AUDIT_LOGS).doc(log.logId).set(this.mapLogToDoc(log));
  }

  async findByTarget(
    targetType: string,
    targetId: string,
    pagination?: AuditLogPaginationOptions
  ): Promise<PaginatedAuditLogs> {
    let query: Query<DocumentData> = this.db
      .collection(CollectionPaths.AUDIT_LOGS)
      .where('targetType', '==', targetType)
      .where('targetId', '==', targetId)
      .orderBy('timestamp', 'desc');

    // Handle pagination with cursor
    if (pagination?.cursor !== undefined) {
      const cursorDoc = await this.db
        .collection(CollectionPaths.AUDIT_LOGS)
        .doc(pagination.cursor)
        .get();

      if (cursorDoc.exists) {
        query = query.startAfter(cursorDoc);
      }
    }

    const limit = pagination?.limit ?? 20;
    query = query.limit(limit + 1); // Fetch one extra to check hasMore

    const snapshot = await query.get();

    const logs = snapshot.docs.slice(0, limit).map((doc) => this.mapDocToLog(doc.id, doc.data()));

    const hasMore = snapshot.docs.length > limit;
    const nextCursor = hasMore ? logs[logs.length - 1]?.logId : undefined;

    return {
      logs,
      nextCursor,
      hasMore,
    };
  }

  async findByActor(
    actorId: string,
    pagination?: AuditLogPaginationOptions
  ): Promise<PaginatedAuditLogs> {
    let query: Query<DocumentData> = this.db
      .collection(CollectionPaths.AUDIT_LOGS)
      .where('adminEcosystemId', '==', actorId)
      .orderBy('timestamp', 'desc');

    // Handle pagination with cursor
    if (pagination?.cursor !== undefined) {
      const cursorDoc = await this.db
        .collection(CollectionPaths.AUDIT_LOGS)
        .doc(pagination.cursor)
        .get();

      if (cursorDoc.exists) {
        query = query.startAfter(cursorDoc);
      }
    }

    const limit = pagination?.limit ?? 20;
    query = query.limit(limit + 1);

    const snapshot = await query.get();

    const logs = snapshot.docs.slice(0, limit).map((doc) => this.mapDocToLog(doc.id, doc.data()));

    const hasMore = snapshot.docs.length > limit;
    const nextCursor = hasMore ? logs[logs.length - 1]?.logId : undefined;

    return {
      logs,
      nextCursor,
      hasMore,
    };
  }

  async clear(): Promise<number> {
    const snapshot = await this.db.collection(CollectionPaths.AUDIT_LOGS).get();
    const count = snapshot.size;

    // Delete in batches of 500
    const batchSize = 500;
    const docs = snapshot.docs;

    for (let i = 0; i < docs.length; i += batchSize) {
      const batch = this.db.batch();
      const batchDocs = docs.slice(i, i + batchSize);

      batchDocs.forEach((doc) => batch.delete(doc.ref));
      await batch.commit();
    }

    return count;
  }

  /**
   * Map Firestore document to AuditLog entity
   */
  private mapDocToLog(logId: string, data: Record<string, unknown>): AuditLog {
    const log: AuditLog = {
      logId,
      adminEcosystemId: data.adminEcosystemId as string,
      adminEmail: data.adminEmail as string,
      action: data.action as AuditAction,
      targetType: data.targetType as string,
      targetId: data.targetId as string,
      reason: data.reason as string,
      requestId: data.requestId as string,
      timestamp: requireDate(data.timestamp, 'timestamp'),
    };

    if (data.targetEcosystemId !== undefined) {
      log.targetEcosystemId = data.targetEcosystemId as string;
    }
    if (data.previousValue !== undefined) {
      log.previousValue = data.previousValue;
    }
    if (data.newValue !== undefined) {
      log.newValue = data.newValue;
    }
    if (data.ipAddress !== undefined) {
      log.ipAddress = data.ipAddress as string;
    }
    if (data.userAgent !== undefined) {
      log.userAgent = data.userAgent as string;
    }

    return log;
  }

  /**
   * Map AuditLog entity to Firestore document
   */
  private mapLogToDoc(log: AuditLog): Record<string, unknown> {
    const doc: Record<string, unknown> = {
      adminEcosystemId: log.adminEcosystemId,
      adminEmail: log.adminEmail,
      action: log.action,
      targetType: log.targetType,
      targetId: log.targetId,
      reason: log.reason,
      requestId: log.requestId,
      timestamp: log.timestamp,
    };

    if (log.targetEcosystemId !== undefined) {
      doc.targetEcosystemId = log.targetEcosystemId;
    }
    if (log.previousValue !== undefined) {
      doc.previousValue = log.previousValue;
    }
    if (log.newValue !== undefined) {
      doc.newValue = log.newValue;
    }
    if (log.ipAddress !== undefined) {
      doc.ipAddress = log.ipAddress;
    }
    if (log.userAgent !== undefined) {
      doc.userAgent = log.userAgent;
    }

    return doc;
  }
}
