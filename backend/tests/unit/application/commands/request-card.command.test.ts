/**
 * Request Card Command Unit Tests
 *
 * Covers create + validation rules.
 */

import { describe, it, expect } from 'bun:test';
import {
  createRequestCardCommand,
  validateRequestCardCommand,
} from '../../../../src/application/commands/request-card.command.js';

function makeValidCommand() {
  return createRequestCardCommand('user-1', 'key-123');
}

describe('RequestCardCommand', () => {
  describe('createRequestCardCommand', () => {
    it('should build a command with provided fields', () => {
      const command = createRequestCardCommand('user-1', 'key-123', 'default-credit-card');

      expect(command).toEqual({
        ecosystemId: 'user-1',
        idempotencyKey: 'key-123',
        productId: 'default-credit-card',
      });
    });

    it('should allow omitting optional productId', () => {
      const command = createRequestCardCommand('user-1', 'key-123');
      expect(command.productId).toBeUndefined();
    });
  });

  describe('validateRequestCardCommand', () => {
    it('should accept a valid command', () => {
      const result = validateRequestCardCommand(makeValidCommand());
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should require ecosystemId', () => {
      const command = makeValidCommand();
      command.ecosystemId = ' ';

      const result = validateRequestCardCommand(command);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('ecosystemId is required');
    });

    it('should require idempotencyKey', () => {
      const command = makeValidCommand();
      command.idempotencyKey = '';

      const result = validateRequestCardCommand(command);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('idempotencyKey is required');
    });

    it('should reject idempotencyKey longer than 64 characters', () => {
      const command = makeValidCommand();
      command.idempotencyKey = 'x'.repeat(65);

      const result = validateRequestCardCommand(command);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('idempotencyKey must be at most 64 characters');
    });
  });
});
