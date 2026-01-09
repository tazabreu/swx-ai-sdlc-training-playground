/**
 * System Cleanup Command
 *
 * Command for admin to reset all data in the system (sandbox only).
 */

/**
 * Command for system cleanup/reset
 */
export interface SystemCleanupCommand {
  /** Admin's ecosystem ID */
  adminId: string;
  /** Admin's email for audit */
  adminEmail: string;
  /** Confirmation token to prevent accidental deletion */
  confirmationToken: string;
}

/**
 * Expected confirmation token value
 */
export const CLEANUP_CONFIRMATION_TOKEN = 'DELETE_ALL_DATA';

/**
 * Create a system cleanup command
 */
export function createSystemCleanupCommand(
  adminId: string,
  adminEmail: string,
  confirmationToken: string
): SystemCleanupCommand {
  return {
    adminId,
    adminEmail,
    confirmationToken,
  };
}

/**
 * Validate a system cleanup command
 */
export function validateSystemCleanupCommand(command: SystemCleanupCommand): {
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

  if (!command.confirmationToken) {
    errors.push('confirmationToken is required');
  } else if (command.confirmationToken !== CLEANUP_CONFIRMATION_TOKEN) {
    errors.push(`confirmationToken must be exactly "${CLEANUP_CONFIRMATION_TOKEN}"`);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
