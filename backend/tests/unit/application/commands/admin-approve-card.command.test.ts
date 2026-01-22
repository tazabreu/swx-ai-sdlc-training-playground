/**
 * Admin Approve Card Command Unit Tests
 *
 * Covers create + validation rules.
 */

import { describe, it, expect } from 'bun:test';
import {
  createAdminApproveCardCommand,
  validateAdminApproveCardCommand,
} from '../../../../src/application/commands/admin-approve-card.command.js';

function makeValidCommand() {
  return createAdminApproveCardCommand(
    'admin-1',
    'admin@example.com',
    'user-1',
    'req-1',
    500,
    'Approved after review'
  );
}

describe('AdminApproveCardCommand', () => {
  describe('createAdminApproveCardCommand', () => {
    it('should build a command with provided fields', () => {
      const command = createAdminApproveCardCommand(
        'admin-1',
        'admin@example.com',
        'user-1',
        'req-1',
        2500,
        'ok'
      );

      expect(command).toEqual({
        adminId: 'admin-1',
        adminEmail: 'admin@example.com',
        ecosystemId: 'user-1',
        requestId: 'req-1',
        limit: 2500,
        reason: 'ok',
      });
    });

    it('should allow omitting optional reason', () => {
      const command = createAdminApproveCardCommand(
        'admin-1',
        'admin@example.com',
        'user-1',
        'req-1',
        2500
      );

      expect(command.reason).toBeUndefined();
    });
  });

  describe('validateAdminApproveCardCommand', () => {
    it('should accept a valid command', () => {
      const result = validateAdminApproveCardCommand(makeValidCommand());
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should require adminId', () => {
      const command = makeValidCommand();
      command.adminId = '';

      const result = validateAdminApproveCardCommand(command);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('adminId is required');
    });

    it('should require adminEmail', () => {
      const command = makeValidCommand();
      command.adminEmail = '   ';

      const result = validateAdminApproveCardCommand(command);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('adminEmail is required');
    });

    it('should require ecosystemId', () => {
      const command = makeValidCommand();
      command.ecosystemId = '';

      const result = validateAdminApproveCardCommand(command);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('ecosystemId is required');
    });

    it('should require requestId', () => {
      const command = makeValidCommand();
      command.requestId = ' ';

      const result = validateAdminApproveCardCommand(command);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('requestId is required');
    });

    it('should require limit to be a number >= 100', () => {
      const command = makeValidCommand();
      command.limit = 50;

      const result = validateAdminApproveCardCommand(command);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('limit must be at least $100');
    });

    it('should reject limit above 10,000', () => {
      const command = makeValidCommand();
      command.limit = 10001;

      const result = validateAdminApproveCardCommand(command);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('limit cannot exceed $10,000');
    });

    it('should reject non-number limit', () => {
      const command = makeValidCommand();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (command as any).limit = '500';

      const result = validateAdminApproveCardCommand(command);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('limit must be at least $100');
    });
  });
});
