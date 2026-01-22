/**
 * Make Payment Command Unit Tests
 *
 * Covers create + validation rules.
 */

import { describe, it, expect } from 'bun:test';
import {
  createMakePaymentCommand,
  validateMakePaymentCommand,
} from '../../../../src/application/commands/make-payment.command.js';

function makeValidCommand() {
  return createMakePaymentCommand('user-1', 'card-1', 12345, 'key-123');
}

describe('MakePaymentCommand', () => {
  describe('createMakePaymentCommand', () => {
    it('should build a command with provided fields', () => {
      const simulatedDate = new Date('2020-01-01T00:00:00.000Z');
      const command = createMakePaymentCommand(
        'user-1',
        'card-1',
        500,
        'key-123',
        simulatedDate
      );

      expect(command).toEqual({
        ecosystemId: 'user-1',
        cardId: 'card-1',
        amount: 500,
        idempotencyKey: 'key-123',
        simulatedPaymentDate: simulatedDate,
      });
    });
  });

  describe('validateMakePaymentCommand', () => {
    it('should accept a valid command', () => {
      const result = validateMakePaymentCommand(makeValidCommand());
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should require ecosystemId', () => {
      const command = makeValidCommand();
      command.ecosystemId = '';

      const result = validateMakePaymentCommand(command);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('ecosystemId is required');
    });

    it('should require cardId', () => {
      const command = makeValidCommand();
      command.cardId = '   ';

      const result = validateMakePaymentCommand(command);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('cardId is required');
    });

    it('should require idempotencyKey', () => {
      const command = makeValidCommand();
      command.idempotencyKey = '';

      const result = validateMakePaymentCommand(command);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('idempotencyKey is required');
    });

    it('should reject idempotencyKey longer than 64 characters', () => {
      const command = makeValidCommand();
      command.idempotencyKey = 'x'.repeat(65);

      const result = validateMakePaymentCommand(command);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('idempotencyKey must be at most 64 characters');
    });

    it('should reject non-positive amount', () => {
      const command = makeValidCommand();
      command.amount = 0;

      const result = validateMakePaymentCommand(command);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('amount must be a positive number');
    });

    it('should reject non-number amount', () => {
      const command = makeValidCommand();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (command as any).amount = '1000';

      const result = validateMakePaymentCommand(command);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('amount must be a positive number');
    });
  });
});
