/**
 * AuditLog Entity
 *
 * Record of admin actions for compliance.
 *
 * Firestore Path: auditLogs/{logId}
 */

import { v7 as uuidv7 } from 'uuid';

/**
 * Audit action types
 */
export type AuditAction =
  | 'score.adjusted'
  | 'card_request.approved'
  | 'card_request.rejected'
  | 'card.suspended'
  | 'card.cancelled'
  | 'card.reactivated'
  | 'user.disabled'
  | 'user.enabled'
  | 'system.cleanup';

/**
 * AuditLog entity
 */
export interface AuditLog {
  logId: string; // Auto-generated

  // Actor
  adminEcosystemId: string; // Admin who performed action
  adminEmail: string; // For readability

  // Action
  action: AuditAction;
  targetType: string; // 'user', 'card', 'cardRequest', etc.
  targetId: string;
  targetEcosystemId?: string | undefined; // If action on another user

  // Change Details
  previousValue?: unknown; // State before change
  newValue?: unknown; // State after change
  reason: string; // Required justification

  // Context
  requestId: string; // Correlation ID
  ipAddress?: string | undefined;
  userAgent?: string | undefined;

  // Timestamp
  timestamp: Date;
}

/**
 * Input for creating an audit log
 */
export interface CreateAuditLogInput {
  adminEcosystemId: string;
  adminEmail: string;
  action: AuditAction;
  targetType: string;
  targetId: string;
  targetEcosystemId?: string;
  previousValue?: unknown;
  newValue?: unknown;
  reason: string;
  requestId: string;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Create a new audit log entry
 */
export function createAuditLog(input: CreateAuditLogInput): AuditLog {
  return {
    logId: uuidv7(),
    adminEcosystemId: input.adminEcosystemId,
    adminEmail: input.adminEmail,
    action: input.action,
    targetType: input.targetType,
    targetId: input.targetId,
    targetEcosystemId: input.targetEcosystemId,
    previousValue: input.previousValue,
    newValue: input.newValue,
    reason: input.reason,
    requestId: input.requestId,
    ipAddress: input.ipAddress,
    userAgent: input.userAgent,
    timestamp: new Date(),
  };
}

/**
 * Type guard to check if value is an AuditLog
 */
export function isAuditLog(value: unknown): value is AuditLog {
  if (typeof value !== 'object' || value === null) return false;

  const log = value as Record<string, unknown>;
  const validActions: AuditAction[] = [
    'score.adjusted',
    'card_request.approved',
    'card_request.rejected',
    'card.suspended',
    'card.cancelled',
    'card.reactivated',
    'user.disabled',
    'user.enabled',
    'system.cleanup',
  ];

  return (
    typeof log.logId === 'string' &&
    typeof log.adminEcosystemId === 'string' &&
    typeof log.adminEmail === 'string' &&
    validActions.includes(log.action as AuditAction) &&
    typeof log.targetType === 'string' &&
    typeof log.targetId === 'string' &&
    typeof log.reason === 'string' &&
    typeof log.requestId === 'string' &&
    log.timestamp instanceof Date
  );
}

/**
 * Validate audit log data
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateAuditLog(log: AuditLog): ValidationResult {
  const errors: string[] = [];

  // Validate required fields
  if (log.adminEcosystemId.length === 0) {
    errors.push('adminEcosystemId is required');
  }

  if (log.adminEmail.length === 0) {
    errors.push('adminEmail is required');
  }

  if (log.reason.length === 0) {
    errors.push('reason is required');
  }

  if (log.requestId.length === 0) {
    errors.push('requestId is required');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Audit retention rules per spec
 */
export const AUDIT_RULES = {
  RETENTION_YEARS: 7, // Financial compliance requirement
} as const;
