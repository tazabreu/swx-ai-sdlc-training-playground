/**
 * Phone Utilities Unit Tests
 *
 * Tests for Brazilian phone number normalization and validation.
 */

import { describe, it, expect } from 'bun:test';
import {
  normalizeBrazilianPhone,
  extractPhoneFromWppId,
  isValidBrazilianPhone,
  isWhitelistedAdmin,
  formatPhoneForDisplay,
  InvalidPhoneError,
} from '../../../../src/infrastructure/whatsapp/phone-utils';

describe('Phone Utilities', () => {
  describe('normalizeBrazilianPhone', () => {
    describe('valid inputs', () => {
      it('should return 13-digit number with 55 prefix as-is', () => {
        expect(normalizeBrazilianPhone('5573981112636')).toBe('5573981112636');
      });

      it('should add 55 prefix to 11-digit number', () => {
        expect(normalizeBrazilianPhone('73981112636')).toBe('5573981112636');
      });

      it('should add 55 prefix and 9 to 10-digit number', () => {
        expect(normalizeBrazilianPhone('7381112636')).toBe('5573981112636');
      });

      it('should add 9 to 12-digit number with 55 prefix', () => {
        expect(normalizeBrazilianPhone('557381112636')).toBe('5573981112636');
      });

      it('should handle phone with spaces', () => {
        expect(normalizeBrazilianPhone('73 98111-2636')).toBe('5573981112636');
      });

      it('should handle phone with + prefix', () => {
        expect(normalizeBrazilianPhone('+55 73 981112636')).toBe('5573981112636');
      });

      it('should handle phone with parentheses', () => {
        expect(normalizeBrazilianPhone('(73) 98111-2636')).toBe('5573981112636');
      });

      it('should handle phone with country code and formatting', () => {
        expect(normalizeBrazilianPhone('+55 (73) 98111-2636')).toBe('5573981112636');
      });
    });

    describe('invalid inputs', () => {
      it('should throw for empty string', () => {
        expect(() => normalizeBrazilianPhone('')).toThrow(InvalidPhoneError);
      });

      it('should throw for null', () => {
        expect(() => normalizeBrazilianPhone(null as unknown as string)).toThrow(InvalidPhoneError);
      });

      it('should throw for undefined', () => {
        expect(() => normalizeBrazilianPhone(undefined as unknown as string)).toThrow(
          InvalidPhoneError
        );
      });

      it('should throw for too short number (8 digits without DDD)', () => {
        expect(() => normalizeBrazilianPhone('81112636')).toThrow('missing DDD');
      });

      it('should throw for 9-digit number (missing DDD)', () => {
        expect(() => normalizeBrazilianPhone('981112636')).toThrow('missing DDD');
      });

      it('should throw for too short number (less than 8 digits)', () => {
        expect(() => normalizeBrazilianPhone('12345')).toThrow('too short');
      });
    });
  });

  describe('extractPhoneFromWppId', () => {
    it('should extract phone from standard WPP ID', () => {
      expect(extractPhoneFromWppId('5573981112636@c.us')).toBe('5573981112636');
    });

    it('should extract phone from group WPP ID', () => {
      expect(extractPhoneFromWppId('5573981112636@g.us')).toBe('5573981112636');
    });

    it('should throw for missing @ symbol', () => {
      expect(() => extractPhoneFromWppId('5573981112636')).toThrow(InvalidPhoneError);
    });

    it('should throw for empty string', () => {
      expect(() => extractPhoneFromWppId('')).toThrow(InvalidPhoneError);
    });

    it('should throw for null', () => {
      expect(() => extractPhoneFromWppId(null as unknown as string)).toThrow(InvalidPhoneError);
    });

    it('should throw for too short phone in WPP ID', () => {
      expect(() => extractPhoneFromWppId('12345@c.us')).toThrow('Invalid phone number');
    });
  });

  describe('isValidBrazilianPhone', () => {
    it('should return true for valid 13-digit mobile number', () => {
      expect(isValidBrazilianPhone('5573981112636')).toBe(true);
    });

    it('should return true for SP DDD (11)', () => {
      expect(isValidBrazilianPhone('5511987654321')).toBe(true);
    });

    it('should return true for RJ DDD (21)', () => {
      expect(isValidBrazilianPhone('5521987654321')).toBe(true);
    });

    it('should return true for various valid DDDs', () => {
      // Major cities DDDs
      expect(isValidBrazilianPhone('5531987654321')).toBe(true); // BH
      expect(isValidBrazilianPhone('5541987654321')).toBe(true); // Curitiba
      expect(isValidBrazilianPhone('5551987654321')).toBe(true); // Porto Alegre
      expect(isValidBrazilianPhone('5561987654321')).toBe(true); // Brasilia
      expect(isValidBrazilianPhone('5571987654321')).toBe(true); // Salvador
      expect(isValidBrazilianPhone('5581987654321')).toBe(true); // Recife
      expect(isValidBrazilianPhone('5591987654321')).toBe(true); // Belem
      expect(isValidBrazilianPhone('5599987654321')).toBe(true); // Edge DDD 99
    });

    it('should return false for 12-digit number', () => {
      expect(isValidBrazilianPhone('557381112636')).toBe(false);
    });

    it('should return false for 14-digit number', () => {
      expect(isValidBrazilianPhone('55739811126360')).toBe(false);
    });

    it('should return false for non-55 country code', () => {
      expect(isValidBrazilianPhone('1173981112636')).toBe(false);
    });

    it('should return false for invalid DDD (below 11)', () => {
      expect(isValidBrazilianPhone('5510987654321')).toBe(false);
    });

    it('should return false for DDD 00', () => {
      expect(isValidBrazilianPhone('5500987654321')).toBe(false);
    });

    it('should return false for DDD 01-10', () => {
      expect(isValidBrazilianPhone('5501987654321')).toBe(false);
      expect(isValidBrazilianPhone('5505987654321')).toBe(false);
    });

    it('should return false for missing 9 prefix', () => {
      expect(isValidBrazilianPhone('5573881112636')).toBe(false);
    });

    it('should return false for empty string', () => {
      expect(isValidBrazilianPhone('')).toBe(false);
    });

    it('should return false for null', () => {
      expect(isValidBrazilianPhone(null as unknown as string)).toBe(false);
    });

    it('should return false for undefined', () => {
      expect(isValidBrazilianPhone(undefined as unknown as string)).toBe(false);
    });

    it('should return false for non-string types', () => {
      expect(isValidBrazilianPhone(5573981112636 as unknown as string)).toBe(false);
      expect(isValidBrazilianPhone({} as unknown as string)).toBe(false);
      expect(isValidBrazilianPhone([] as unknown as string)).toBe(false);
    });
  });

  describe('isWhitelistedAdmin', () => {
    const whitelist = ['5573981112636', '5511987654321'];

    it('should return true for phone in whitelist', () => {
      expect(isWhitelistedAdmin('5573981112636', whitelist)).toBe(true);
    });

    it('should return true for normalized phone matching whitelist', () => {
      expect(isWhitelistedAdmin('73981112636', whitelist)).toBe(true);
    });

    it('should return true for formatted phone matching whitelist', () => {
      expect(isWhitelistedAdmin('(73) 98111-2636', whitelist)).toBe(true);
    });

    it('should return false for phone not in whitelist', () => {
      expect(isWhitelistedAdmin('5521999999999', whitelist)).toBe(false);
    });

    it('should return false for empty phone', () => {
      expect(isWhitelistedAdmin('', whitelist)).toBe(false);
    });

    it('should return false for empty whitelist', () => {
      expect(isWhitelistedAdmin('5573981112636', [])).toBe(false);
    });

    it('should handle whitelist with various formats', () => {
      const mixedWhitelist = ['(73) 98111-2636', '+55 11 98765-4321'];
      expect(isWhitelistedAdmin('5573981112636', mixedWhitelist)).toBe(true);
      expect(isWhitelistedAdmin('5511987654321', mixedWhitelist)).toBe(true);
    });
  });

  describe('formatPhoneForDisplay', () => {
    it('should mask phone showing only last 4 digits', () => {
      expect(formatPhoneForDisplay('5573981112636')).toBe('****-2636');
    });

    it('should handle phone with fewer than 4 digits', () => {
      expect(formatPhoneForDisplay('123')).toBe('****');
    });

    it('should handle exactly 4 digits', () => {
      expect(formatPhoneForDisplay('2636')).toBe('****-2636');
    });

    it('should strip non-digits before masking', () => {
      expect(formatPhoneForDisplay('+55 (73) 98111-2636')).toBe('****-2636');
    });
  });
});
