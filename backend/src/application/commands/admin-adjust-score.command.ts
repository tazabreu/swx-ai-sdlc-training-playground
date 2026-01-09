/**
 * Admin Adjust Score Command
 *
 * Command for admin to manually adjust a user's score.
 */

/**
 * Command for admin to adjust a user's score
 */
export interface AdminAdjustScoreCommand {
  /** Admin's ecosystem ID */
  adminId: string;
  /** Admin's email for audit */
  adminEmail: string;
  /** User's ecosystem ID */
  ecosystemId: string;
  /** New score value (0-1000) */
  newScore: number;
  /** Reason for adjustment */
  reason: string;
}

/**
 * Create an admin adjust score command
 */
export function createAdminAdjustScoreCommand(
  adminId: string,
  adminEmail: string,
  ecosystemId: string,
  newScore: number,
  reason: string
): AdminAdjustScoreCommand {
  return {
    adminId,
    adminEmail,
    ecosystemId,
    newScore,
    reason,
  };
}

/**
 * Validate an admin adjust score command
 */
export function validateAdminAdjustScoreCommand(command: AdminAdjustScoreCommand): {
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

  if (typeof command.newScore !== 'number') {
    errors.push('newScore must be a number');
  } else {
    if (!Number.isInteger(command.newScore)) {
      errors.push('newScore must be an integer');
    }
    if (command.newScore < 0 || command.newScore > 1000) {
      errors.push('newScore must be between 0 and 1000');
    }
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
