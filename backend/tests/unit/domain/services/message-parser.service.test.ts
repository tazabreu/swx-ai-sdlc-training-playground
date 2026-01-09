/**
 * Message Parser Service Unit Tests
 *
 * Tests for parsing WhatsApp approval/rejection commands.
 */

import { describe, it, expect } from 'bun:test';
import { MessageParserService } from '../../../../src/domain/services/message-parser.service';

describe('MessageParserService', () => {
  const parser = new MessageParserService();

  describe('parseCommand', () => {
    describe('approval commands', () => {
      it('should parse "y <ID>" as approve', () => {
        const result = parser.parseCommand('y abc12345');

        expect(result.action).toBe('approve');
        expect(result.requestId).toBe('abc12345');
        expect(result.rawInput).toBe('y abc12345');
      });

      it('should parse "yes <ID>" as approve', () => {
        const result = parser.parseCommand('yes abc12345');

        expect(result.action).toBe('approve');
        expect(result.requestId).toBe('abc12345');
      });

      it('should parse "Y <ID>" as approve (case insensitive)', () => {
        const result = parser.parseCommand('Y abc12345');

        expect(result.action).toBe('approve');
        expect(result.requestId).toBe('abc12345');
      });

      it('should parse "YES <ID>" as approve (case insensitive)', () => {
        const result = parser.parseCommand('YES abc12345');

        expect(result.action).toBe('approve');
        expect(result.requestId).toBe('abc12345');
      });

      it('should parse "Yes <ID>" as approve (mixed case)', () => {
        const result = parser.parseCommand('Yes abc12345');

        expect(result.action).toBe('approve');
        expect(result.requestId).toBe('abc12345');
      });
    });

    describe('rejection commands', () => {
      it('should parse "n <ID>" as reject', () => {
        const result = parser.parseCommand('n abc12345');

        expect(result.action).toBe('reject');
        expect(result.requestId).toBe('abc12345');
        expect(result.rawInput).toBe('n abc12345');
      });

      it('should parse "no <ID>" as reject', () => {
        const result = parser.parseCommand('no abc12345');

        expect(result.action).toBe('reject');
        expect(result.requestId).toBe('abc12345');
      });

      it('should parse "N <ID>" as reject (case insensitive)', () => {
        const result = parser.parseCommand('N abc12345');

        expect(result.action).toBe('reject');
        expect(result.requestId).toBe('abc12345');
      });

      it('should parse "NO <ID>" as reject (case insensitive)', () => {
        const result = parser.parseCommand('NO abc12345');

        expect(result.action).toBe('reject');
        expect(result.requestId).toBe('abc12345');
      });

      it('should parse "No <ID>" as reject (mixed case)', () => {
        const result = parser.parseCommand('No abc12345');

        expect(result.action).toBe('reject');
        expect(result.requestId).toBe('abc12345');
      });
    });

    describe('whitespace handling', () => {
      it('should trim leading whitespace', () => {
        const result = parser.parseCommand('  y abc12345');

        expect(result.action).toBe('approve');
        expect(result.requestId).toBe('abc12345');
      });

      it('should trim trailing whitespace', () => {
        const result = parser.parseCommand('y abc12345  ');

        expect(result.action).toBe('approve');
        expect(result.requestId).toBe('abc12345');
      });

      it('should collapse multiple spaces', () => {
        const result = parser.parseCommand('y    abc12345');

        expect(result.action).toBe('approve');
        expect(result.requestId).toBe('abc12345');
      });

      it('should handle tabs', () => {
        const result = parser.parseCommand('y\tabc12345');

        expect(result.action).toBe('approve');
        expect(result.requestId).toBe('abc12345');
      });
    });

    describe('request ID formats', () => {
      it('should accept short ID (8 chars)', () => {
        const result = parser.parseCommand('y abc12345');

        expect(result.action).toBe('approve');
        expect(result.requestId).toBe('abc12345');
      });

      it('should accept full UUID', () => {
        const uuid = '550e8400-e29b-41d4-a716-446655440000';
        const result = parser.parseCommand(`y ${uuid}`);

        expect(result.action).toBe('approve');
        expect(result.requestId).toBe(uuid);
      });

      it('should accept UUID without hyphens', () => {
        const uuid = '550e8400e29b41d4a716446655440000';
        const result = parser.parseCommand(`n ${uuid}`);

        expect(result.action).toBe('reject');
        expect(result.requestId).toBe(uuid);
      });

      it('should preserve mixed-case request ID', () => {
        const result = parser.parseCommand('y AbC12345');

        expect(result.requestId).toBe('AbC12345');
      });
    });

    describe('unknown commands', () => {
      it('should return unknown for empty string', () => {
        const result = parser.parseCommand('');

        expect(result.action).toBe('unknown');
        expect(result.requestId).toBe('');
        expect(result.rawInput).toBe('');
      });

      it('should return unknown for whitespace only', () => {
        const result = parser.parseCommand('   ');

        expect(result.action).toBe('unknown');
        expect(result.requestId).toBe('');
      });

      it('should return unknown for random text', () => {
        const result = parser.parseCommand('hello world');

        expect(result.action).toBe('unknown');
        expect(result.requestId).toBe('');
        expect(result.rawInput).toBe('hello world');
      });

      it('should return unknown for "y" without ID', () => {
        const result = parser.parseCommand('y');

        expect(result.action).toBe('unknown');
        expect(result.requestId).toBe('');
      });

      it('should return unknown for "n" without ID', () => {
        const result = parser.parseCommand('n');

        expect(result.action).toBe('unknown');
        expect(result.requestId).toBe('');
      });

      it('should return unknown for "yes" without ID', () => {
        const result = parser.parseCommand('yes');

        expect(result.action).toBe('unknown');
        expect(result.requestId).toBe('');
      });

      it('should return unknown for invalid prefix', () => {
        const result = parser.parseCommand('yep abc12345');

        expect(result.action).toBe('unknown');
        expect(result.requestId).toBe('');
      });

      it('should return unknown for number prefix', () => {
        const result = parser.parseCommand('1 abc12345');

        expect(result.action).toBe('unknown');
        expect(result.requestId).toBe('');
      });
    });
  });

  describe('isActionable', () => {
    it('should return true for approve action', () => {
      const command = parser.parseCommand('y abc12345');

      expect(parser.isActionable(command)).toBe(true);
    });

    it('should return true for reject action', () => {
      const command = parser.parseCommand('n abc12345');

      expect(parser.isActionable(command)).toBe(true);
    });

    it('should return false for unknown action', () => {
      const command = parser.parseCommand('hello');

      expect(parser.isActionable(command)).toBe(false);
    });
  });

  describe('hasValidRequestId', () => {
    it('should return true for non-empty request ID', () => {
      const command = parser.parseCommand('y abc12345');

      expect(parser.hasValidRequestId(command)).toBe(true);
    });

    it('should return false for empty request ID', () => {
      const command = parser.parseCommand('hello');

      expect(parser.hasValidRequestId(command)).toBe(false);
    });
  });

  describe('isValidCommand', () => {
    it('should return true for valid approve command', () => {
      const command = parser.parseCommand('y abc12345');

      expect(parser.isValidCommand(command)).toBe(true);
    });

    it('should return true for valid reject command', () => {
      const command = parser.parseCommand('n abc12345');

      expect(parser.isValidCommand(command)).toBe(true);
    });

    it('should return false for unknown action', () => {
      const command = parser.parseCommand('hello');

      expect(parser.isValidCommand(command)).toBe(false);
    });

    it('should return false for valid action but missing ID', () => {
      // Edge case: manually construct an invalid state
      const command = { action: 'approve' as const, requestId: '', rawInput: 'y' };

      expect(parser.isValidCommand(command)).toBe(false);
    });
  });
});
