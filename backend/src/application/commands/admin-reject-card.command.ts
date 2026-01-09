/**
 * Admin Reject Card Command
 *
 * Command for admin to reject a pending card request.
 */

/**
 * Command for admin to reject a card request
 */
export interface AdminRejectCardCommand {
  /** Admin's ecosystem ID */
  adminId: string;
  /** Admin's email for audit */
  adminEmail: string;
  /** User's ecosystem ID */
  ecosystemId: string;
  /** Card request ID to reject */
  requestId: string;
  /** Reason for rejection */
  reason: string;
}

/**
 * Create an admin reject card command
 */
export function createAdminRejectCardCommand(
  adminId: string,
  adminEmail: string,
  ecosystemId: string,
  requestId: string,
  reason: string
): AdminRejectCardCommand {
  return {
    adminId,
    adminEmail,
    ecosystemId,
    requestId,
    reason,
  };
}

/**
 * Validate an admin reject card command
 */
export function validateAdminRejectCardCommand(command: AdminRejectCardCommand): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!command.adminId || command.adminId.trim() === '') {
    errors.push('adminId is required');
  }

  if (!command.adminEmail || command.adminEmail.trim() === '') {
    errors.push('adminEmail is required');
  }

  if (!command.ecosystemId || command.ecosystemId.trim() === '') {
    errors.push('ecosystemId is required');
  }

  if (!command.requestId || command.requestId.trim() === '') {
    errors.push('requestId is required');
  }

  if (!command.reason || command.reason.trim() === '') {
    errors.push('reason is required');
  }

  if (command.reason && command.reason.length > 500) {
    errors.push('reason must be at most 500 characters');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
