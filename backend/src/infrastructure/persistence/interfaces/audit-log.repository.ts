/**
 * Audit Log Repository Interface
 *
 * Contract for audit log data access operations.
 */

import type { AuditLog } from '../../../domain/entities/audit-log.entity.js';

/**
 * Audit log pagination options
 */
export interface AuditLogPaginationOptions {
  cursor?: string | undefined;
  limit?: number | undefined;
}

/**
 * Paginated audit logs result
 */
export interface PaginatedAuditLogs {
  logs: AuditLog[];
  nextCursor?: string | undefined;
  hasMore: boolean;
}

/**
 * Audit log repository interface
 */
export interface IAuditLogRepository {
  /**
   * Save audit log
   */
  save(log: AuditLog): Promise<void>;

  /**
   * Find audit logs by target
   */
  findByTarget(
    targetType: string,
    targetId: string,
    pagination?: AuditLogPaginationOptions
  ): Promise<PaginatedAuditLogs>;

  /**
   * Find audit logs by actor
   */
  findByActor(actorId: string, pagination?: AuditLogPaginationOptions): Promise<PaginatedAuditLogs>;

  /**
   * Clear all audit logs (for cleanup)
   */
  clear(): Promise<number>;
}
