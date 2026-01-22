/**
 * Make Purchase Command Unit Tests
 *
 * Covers create + validation rules.
 */

import { describe, it, expect } from 'bun:test';
import {
  createMakePurchaseCommand,
  validateMakePurchaseCommand,
} from '../../../../src/application/commands/make-purchase.command.js';

function makeValidCommand() {
  return createMakePurchaseCommand('user-1', 'card-1', 2500, 'Coffee Shop', 'key-123');
}

describe('MakePurchaseCommand', () => {
  describe('createMakePurchaseCommand', () => {
    it('should build a command with provided fields', () => {
      const command = createMakePurchaseCommand(
        'user-1',
        'card-1',
        2500,
        'Coffee Shop',
        'key-123',
        'food'
      );

      expect(command).toEqual({
        ecosystemId: 'user-1',
        cardId: 'card-1',
        amount: 2500,
        merchant: 'Coffee Shop',
        idempotencyKey: 'key-123',
        category: 'food',
      });
    });

    it('should allow omitting optional category', () => {
      const command = createMakePurchaseCommand('user-1', 'card-1', 2500, 'Coffee', 'key-123');
      expect(command.category).toBeUndefined();
    });
  });

  describe('validateMakePurchaseCommand', () => {
    it('should accept a valid command', () => {
      const result = validateMakePurchaseCommand(makeValidCommand());
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should require ecosystemId', () => {
      const command = makeValidCommand();
      command.ecosystemId = '';

      const result = validateMakePurchaseCommand(command);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('ecosystemId is required');
    });

    it('should require cardId', () => {
      const command = makeValidCommand();
      command.cardId = ' ';

      const result = validateMakePurchaseCommand(command);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('cardId is required');
    });

    it('should require idempotencyKey', () => {
      const command = makeValidCommand();
      command.idempotencyKey = '';

      const result = validateMakePurchaseCommand(command);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('idempotencyKey is required');
    });

    it('should reject idempotencyKey longer than 64 characters', () => {
      const command = makeValidCommand();
      command.idempotencyKey = 'x'.repeat(65);

      const result = validateMakePurchaseCommand(command);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('idempotencyKey must be at most 64 characters');
    });

    it('should reject non-positive amount', () => {
      const command = makeValidCommand();
      command.amount = -1;

      const result = validateMakePurchaseCommand(command);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('amount must be a positive number');
    });

    it('should require merchant (trimmed)', () => {
      const command = makeValidCommand();
      command.merchant = '   ';

      const result = validateMakePurchaseCommand(command);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('merchant is required');
    });
  });
});
