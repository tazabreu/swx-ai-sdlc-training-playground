/**
 * Admin Reject Card Command Unit Tests
 *
 * Covers create + validation rules.
 */

import { describe, it, expect } from 'bun:test';
import {
  createAdminRejectCardCommand,
  validateAdminRejectCardCommand,
} from '../../../../src/application/commands/admin-reject-card.command.js';

function makeValidCommand() {
  return createAdminRejectCardCommand(
    'admin-1',
    'admin@example.com',
    'user-1',
    'req-1',
    'Rejected due to insufficient history'
  );
}

describe('AdminRejectCardCommand', () => {
  describe('createAdminRejectCardCommand', () => {
    it('should build a command with provided fields', () => {
      const command = createAdminRejectCardCommand(
        'admin-1',
        'admin@example.com',
        'user-1',
        'req-1',
        'reason'
      );

      expect(command).toEqual({
        adminId: 'admin-1',
        adminEmail: 'admin@example.com',
        ecosystemId: 'user-1',
        requestId: 'req-1',
        reason: 'reason',
      });
    });
  });

  describe('validateAdminRejectCardCommand', () => {
    it('should accept a valid command', () => {
      const result = validateAdminRejectCardCommand(makeValidCommand());
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should require adminId', () => {
      const command = makeValidCommand();
      command.adminId = '';

      const result = validateAdminRejectCardCommand(command);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('adminId is required');
    });

    it('should require adminEmail', () => {
      const command = makeValidCommand();
      command.adminEmail = ' ';

      const result = validateAdminRejectCardCommand(command);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('adminEmail is required');
    });

    it('should require ecosystemId', () => {
      const command = makeValidCommand();
      command.ecosystemId = '';

      const result = validateAdminRejectCardCommand(command);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('ecosystemId is required');
    });

    it('should require requestId', () => {
      const command = makeValidCommand();
      command.requestId = '   ';

      const result = validateAdminRejectCardCommand(command);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('requestId is required');
    });

    it('should require reason (trimmed)', () => {
      const command = makeValidCommand();
      command.reason = '   ';

      const result = validateAdminRejectCardCommand(command);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('reason is required');
    });

    it('should reject reason longer than 500 characters', () => {
      const command = makeValidCommand();
      command.reason = 'x'.repeat(501);

      const result = validateAdminRejectCardCommand(command);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('reason must be at most 500 characters');
    });
  });
});
