/**
 * Admin Approve Card Command
 *
 * Command for admin to approve a pending card request.
 */

/**
 * Command for admin to approve a card request
 */
export interface AdminApproveCardCommand {
  /** Admin's ecosystem ID */
  adminId: string;
  /** Admin's email for audit */
  adminEmail: string;
  /** User's ecosystem ID */
  ecosystemId: string;
  /** Card request ID to approve */
  requestId: string;
  /** Approved credit limit */
  limit: number;
  /** Optional reason for approval */
  reason?: string | undefined;
}

/**
 * Create an admin approve card command
 */
export function createAdminApproveCardCommand(
  adminId: string,
  adminEmail: string,
  ecosystemId: string,
  requestId: string,
  limit: number,
  reason?: string
): AdminApproveCardCommand {
  return {
    adminId,
    adminEmail,
    ecosystemId,
    requestId,
    limit,
    reason,
  };
}

/**
 * Validate an admin approve card command
 */
export function validateAdminApproveCardCommand(command: AdminApproveCardCommand): {
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

  if (typeof command.limit !== 'number' || command.limit < 100) {
    errors.push('limit must be at least $100');
  }

  if (typeof command.limit === 'number' && command.limit > 10000) {
    errors.push('limit cannot exceed $10,000');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
