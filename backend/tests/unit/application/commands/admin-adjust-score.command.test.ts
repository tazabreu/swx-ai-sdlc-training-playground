/**
 * Admin Adjust Score Command Unit Tests
 *
 * Covers create + validation rules.
 */

import { describe, it, expect } from 'bun:test';
import {
  createAdminAdjustScoreCommand,
  validateAdminAdjustScoreCommand,
} from '../../../../src/application/commands/admin-adjust-score.command.js';

function makeValidCommand() {
  return createAdminAdjustScoreCommand(
    'admin-1',
    'admin@example.com',
    'user-1',
    750,
    'Manual adjustment after review'
  );
}

describe('AdminAdjustScoreCommand', () => {
  describe('createAdminAdjustScoreCommand', () => {
    it('should build a command with provided fields', () => {
      const command = createAdminAdjustScoreCommand(
        'admin-1',
        'admin@example.com',
        'user-1',
        900,
        'reason'
      );

      expect(command).toEqual({
        adminId: 'admin-1',
        adminEmail: 'admin@example.com',
        ecosystemId: 'user-1',
        newScore: 900,
        reason: 'reason',
      });
    });
  });

  describe('validateAdminAdjustScoreCommand', () => {
    it('should accept a valid command', () => {
      const result = validateAdminAdjustScoreCommand(makeValidCommand());
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should require adminId (trimmed)', () => {
      const command = makeValidCommand();
      command.adminId = '   ';

      const result = validateAdminAdjustScoreCommand(command);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('adminId is required');
    });

    it('should require adminEmail (trimmed)', () => {
      const command = makeValidCommand();
      command.adminEmail = '';

      const result = validateAdminAdjustScoreCommand(command);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('adminEmail is required');
    });

    it('should require ecosystemId (trimmed)', () => {
      const command = makeValidCommand();
      command.ecosystemId = ' ';

      const result = validateAdminAdjustScoreCommand(command);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('ecosystemId is required');
    });

    it('should reject non-number newScore', () => {
      const command = makeValidCommand();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (command as any).newScore = '900';

      const result = validateAdminAdjustScoreCommand(command);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('newScore must be a number');
    });

    it('should reject non-integer newScore', () => {
      const command = makeValidCommand();
      command.newScore = 12.34;

      const result = validateAdminAdjustScoreCommand(command);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('newScore must be an integer');
    });

    it('should reject out-of-range newScore', () => {
      const command = makeValidCommand();
      command.newScore = 1001;

      const result = validateAdminAdjustScoreCommand(command);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('newScore must be between 0 and 1000');
    });

    it('should require reason (trimmed)', () => {
      const command = makeValidCommand();
      command.reason = '   ';

      const result = validateAdminAdjustScoreCommand(command);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('reason is required');
    });

    it('should reject reason longer than 500 characters', () => {
      const command = makeValidCommand();
      command.reason = 'x'.repeat(501);

      const result = validateAdminAdjustScoreCommand(command);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('reason must be at most 500 characters');
    });
  });
});
