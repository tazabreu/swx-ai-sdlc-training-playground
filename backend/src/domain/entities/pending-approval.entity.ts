/**
 * Pending Approval Tracker Entity
 *
 * Links card requests to their WhatsApp notification state.
 *
 * Firestore Path: pending_approvals/{requestId}
 */

import type { ApprovalStatus } from '../../infrastructure/whatsapp/types.js';

/**
 * Default expiration time: 24 hours in milliseconds
 */
export const DEFAULT_EXPIRATION_MS = 24 * 60 * 60 * 1000;

/**
 * Pending Approval Tracker entity
 */
export interface PendingApprovalTracker {
  /** FK to CardRequest.requestId */
  requestId: string;
  /** FK to User.ecosystemId */
  ecosystemId: string;
  /** WhatsAppNotification IDs (2 admins) */
  notificationIds: string[];
  /** When notifications were sent */
  notificationsSentAt?: Date;
  /** Current approval status */
  approvalStatus: ApprovalStatus;
  /** Phone of admin who responded */
  respondingAdminPhone?: string;
  /** When response was received */
  responseReceivedAt?: Date;
  /** When this approval expires */
  expiresAt: Date;
  /** When tracker was created */
  createdAt: Date;
  /** When tracker was last updated */
  updatedAt: Date;
}

/**
 * Input for creating a new pending approval tracker
 */
export interface CreatePendingApprovalInput {
  requestId: string;
  ecosystemId: string;
  notificationIds?: string[];
  expirationMs?: number;
}

/**
 * Validation result for PendingApprovalTracker
 */
export interface PendingApprovalValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Create a new pending approval tracker with default values
 *
 * @param input - Creation input
 * @returns New PendingApprovalTracker with 24-hour expiration
 */
export function createPendingApprovalTracker(
  input: CreatePendingApprovalInput
): PendingApprovalTracker {
  const now = new Date();
  const expirationMs = input.expirationMs ?? DEFAULT_EXPIRATION_MS;
  const expiresAt = new Date(now.getTime() + expirationMs);

  return {
    requestId: input.requestId,
    ecosystemId: input.ecosystemId,
    notificationIds: input.notificationIds ?? [],
    approvalStatus: 'pending',
    expiresAt,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Validate pending approval tracker data
 */
export function validatePendingApprovalTracker(
  tracker: PendingApprovalTracker
): PendingApprovalValidationResult {
  const errors: string[] = [];

  if (!tracker.requestId) {
    errors.push('requestId is required');
  }
  if (!tracker.ecosystemId) {
    errors.push('ecosystemId is required');
  }
  if (tracker.expiresAt === undefined) {
    errors.push('expiresAt is required');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Check if approval is still pending
 */
export function isPending(tracker: PendingApprovalTracker): boolean {
  return tracker.approvalStatus === 'pending';
}

/**
 * Check if approval has expired
 */
export function isExpired(tracker: PendingApprovalTracker): boolean {
  return tracker.approvalStatus === 'expired' || new Date() > tracker.expiresAt;
}

/**
 * Check if approval can be processed (pending and not expired)
 */
export function canProcess(tracker: PendingApprovalTracker): boolean {
  return isPending(tracker) && !isExpired(tracker);
}

/**
 * Mark tracker as approved
 */
export function markAsApproved(
  tracker: PendingApprovalTracker,
  adminPhone: string
): PendingApprovalTracker {
  const now = new Date();
  return {
    ...tracker,
    approvalStatus: 'approved',
    respondingAdminPhone: adminPhone,
    responseReceivedAt: now,
    updatedAt: now,
  };
}

/**
 * Mark tracker as rejected
 */
export function markAsRejected(
  tracker: PendingApprovalTracker,
  adminPhone: string
): PendingApprovalTracker {
  const now = new Date();
  return {
    ...tracker,
    approvalStatus: 'rejected',
    respondingAdminPhone: adminPhone,
    responseReceivedAt: now,
    updatedAt: now,
  };
}

/**
 * Mark tracker as expired
 */
export function markTrackerAsExpired(tracker: PendingApprovalTracker): PendingApprovalTracker {
  return {
    ...tracker,
    approvalStatus: 'expired',
    updatedAt: new Date(),
  };
}

/**
 * Add notification IDs to tracker
 */
export function addNotificationIds(
  tracker: PendingApprovalTracker,
  notificationIds: string[]
): PendingApprovalTracker {
  const now = new Date();
  return {
    ...tracker,
    notificationIds: [...tracker.notificationIds, ...notificationIds],
    notificationsSentAt: now,
    updatedAt: now,
  };
}

/**
 * Type guard for PendingApprovalTracker
 */
export function isPendingApprovalTracker(value: unknown): value is PendingApprovalTracker {
  if (typeof value !== 'object' || value === null) return false;

  const t = value as Record<string, unknown>;
  return (
    typeof t.requestId === 'string' &&
    typeof t.ecosystemId === 'string' &&
    Array.isArray(t.notificationIds) &&
    typeof t.approvalStatus === 'string' &&
    t.expiresAt instanceof Date &&
    t.createdAt instanceof Date &&
    t.updatedAt instanceof Date
  );
}
