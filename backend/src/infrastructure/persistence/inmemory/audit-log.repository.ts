/**
 * InMemory Audit Log Repository
 *
 * In-memory implementation for audit log storage and retrieval.
 */

/* eslint-disable @typescript-eslint/require-await */

import type {
  IAuditLogRepository,
  AuditLogPaginationOptions,
  PaginatedAuditLogs,
} from '../interfaces/audit-log.repository.js';
import type { AuditLog } from '../../../domain/entities/audit-log.entity.js';

/**
 * InMemory Audit Log Repository implementation
 */
export class InMemoryAuditLogRepository implements IAuditLogRepository {
  private logs: Map<string, AuditLog> = new Map();

  async save(log: AuditLog): Promise<void> {
    this.logs.set(log.logId, { ...log });
  }

  async findByTarget(
    targetType: string,
    targetId: string,
    pagination?: AuditLogPaginationOptions
  ): Promise<PaginatedAuditLogs> {
    // Get logs matching target and sort by timestamp descending
    const matchingLogs = Array.from(this.logs.values())
      .filter((log) => log.targetType === targetType && log.targetId === targetId)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    return this.paginate(matchingLogs, pagination);
  }

  async findByActor(
    actorId: string,
    pagination?: AuditLogPaginationOptions
  ): Promise<PaginatedAuditLogs> {
    // Get logs matching actor (adminEcosystemId) and sort by timestamp descending
    const matchingLogs = Array.from(this.logs.values())
      .filter((log) => log.adminEcosystemId === actorId)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    return this.paginate(matchingLogs, pagination);
  }

  async clear(): Promise<number> {
    const count = this.logs.size;
    this.logs.clear();
    return count;
  }

  // Test helper methods
  getAll(): AuditLog[] {
    return Array.from(this.logs.values());
  }

  /**
   * Apply pagination to a sorted list of logs
   */
  private paginate(logs: AuditLog[], pagination?: AuditLogPaginationOptions): PaginatedAuditLogs {
    const limit = pagination?.limit ?? 20;
    let startIndex = 0;

    if (pagination?.cursor !== undefined) {
      const cursorIndex = logs.findIndex((log) => log.logId === pagination.cursor);
      if (cursorIndex !== -1) {
        startIndex = cursorIndex + 1;
      }
    }

    const paginated = logs.slice(startIndex, startIndex + limit);
    const hasMore = startIndex + limit < logs.length;
    const nextCursor = hasMore ? paginated[paginated.length - 1]?.logId : undefined;

    return {
      logs: paginated,
      nextCursor,
      hasMore,
    };
  }
}
