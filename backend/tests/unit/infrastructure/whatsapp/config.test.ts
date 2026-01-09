/**
 * WhatsApp Configuration Unit Tests
 *
 * Tests for WhatsApp configuration loading and validation.
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import {
  loadWhatsAppConfig,
  validateWhatsAppConfig,
  loadAndValidateWhatsAppConfig,
  getAdminPhones,
  isWhatsAppEnabled,
  WhatsAppConfigError,
  type WhatsAppConfig,
} from '../../../../src/infrastructure/whatsapp/config';

/**
 * Create a valid test configuration
 */
function createValidConfig(): WhatsAppConfig {
  return {
    wppBaseUrl: 'http://localhost:21465',
    wppSecretKey: 'test-secret-key',
    wppSessionName: 'test-session',
    adminPhone1: '5573981112636',
    adminPhone2: '5511987654321',
    webhookSecret: 'webhook-secret',
    notificationsEnabled: true,
  };
}

describe('WhatsApp Configuration', () => {
  describe('loadWhatsAppConfig', () => {
    const originalEnv = { ...process.env };

    beforeEach(() => {
      // Clear relevant env vars
      delete process.env.WPP_BASE_URL;
      delete process.env.WPP_SECRET_KEY;
      delete process.env.WPP_SESSION_NAME;
      delete process.env.ADMIN_PHONE_1;
      delete process.env.ADMIN_PHONE_2;
      delete process.env.WEBHOOK_SECRET;
      delete process.env.WHATSAPP_NOTIFICATIONS_ENABLED;
    });

    afterEach(() => {
      // Restore original env
      process.env = { ...originalEnv };
    });

    it('should load config from environment variables', () => {
      process.env.WPP_BASE_URL = 'http://test.example.com:21465';
      process.env.WPP_SECRET_KEY = 'my-secret';
      process.env.WPP_SESSION_NAME = 'my-session';
      process.env.ADMIN_PHONE_1 = '5573981112636';
      process.env.ADMIN_PHONE_2 = '5511987654321';
      process.env.WEBHOOK_SECRET = 'webhook-secret';

      const config = loadWhatsAppConfig();

      expect(config.wppBaseUrl).toBe('http://test.example.com:21465');
      expect(config.wppSecretKey).toBe('my-secret');
      expect(config.wppSessionName).toBe('my-session');
      expect(config.adminPhone1).toBe('5573981112636');
      expect(config.adminPhone2).toBe('5511987654321');
      expect(config.webhookSecret).toBe('webhook-secret');
      expect(config.notificationsEnabled).toBe(true);
    });

    it('should use default session name if not provided', () => {
      const config = loadWhatsAppConfig();

      expect(config.wppSessionName).toBe('tazco-financial-api');
    });

    it('should default notificationsEnabled to true', () => {
      const config = loadWhatsAppConfig();

      expect(config.notificationsEnabled).toBe(true);
    });

    it('should set notificationsEnabled to false when env is "false"', () => {
      process.env.WHATSAPP_NOTIFICATIONS_ENABLED = 'false';

      const config = loadWhatsAppConfig();

      expect(config.notificationsEnabled).toBe(false);
    });

    it('should keep notificationsEnabled true for any other value', () => {
      process.env.WHATSAPP_NOTIFICATIONS_ENABLED = 'FALSE'; // uppercase

      const config = loadWhatsAppConfig();

      expect(config.notificationsEnabled).toBe(true);
    });

    it('should use empty strings for missing optional vars', () => {
      const config = loadWhatsAppConfig();

      expect(config.wppBaseUrl).toBe('');
      expect(config.wppSecretKey).toBe('');
      expect(config.adminPhone1).toBe('');
      expect(config.adminPhone2).toBe('');
      expect(config.webhookSecret).toBe('');
    });
  });

  describe('validateWhatsAppConfig', () => {
    it('should pass validation for valid config', () => {
      const config = createValidConfig();

      expect(() => validateWhatsAppConfig(config)).not.toThrow();
    });

    it('should throw when wppBaseUrl is missing', () => {
      const config = createValidConfig();
      config.wppBaseUrl = '';

      expect(() => validateWhatsAppConfig(config)).toThrow(WhatsAppConfigError);
      expect(() => validateWhatsAppConfig(config)).toThrow('WPP_BASE_URL is required');
    });

    it('should throw when wppBaseUrl is invalid URL', () => {
      const config = createValidConfig();
      config.wppBaseUrl = 'not-a-valid-url';

      expect(() => validateWhatsAppConfig(config)).toThrow('WPP_BASE_URL must be a valid URL');
    });

    it('should throw when wppSecretKey is missing', () => {
      const config = createValidConfig();
      config.wppSecretKey = '';

      expect(() => validateWhatsAppConfig(config)).toThrow('WPP_SECRET_KEY is required');
    });

    it('should throw when wppSessionName is missing', () => {
      const config = createValidConfig();
      config.wppSessionName = '';

      expect(() => validateWhatsAppConfig(config)).toThrow('WPP_SESSION_NAME is required');
    });

    it('should throw when webhookSecret is missing', () => {
      const config = createValidConfig();
      config.webhookSecret = '';

      expect(() => validateWhatsAppConfig(config)).toThrow('WEBHOOK_SECRET is required');
    });

    it('should throw when no admin phones are provided', () => {
      const config = createValidConfig();
      config.adminPhone1 = '';
      config.adminPhone2 = '';

      expect(() => validateWhatsAppConfig(config)).toThrow(
        'At least one admin phone (ADMIN_PHONE_1 or ADMIN_PHONE_2) is required'
      );
    });

    it('should pass with only adminPhone1', () => {
      const config = createValidConfig();
      config.adminPhone2 = '';

      expect(() => validateWhatsAppConfig(config)).not.toThrow();
    });

    it('should pass with only adminPhone2', () => {
      const config = createValidConfig();
      config.adminPhone1 = '';

      expect(() => validateWhatsAppConfig(config)).not.toThrow();
    });

    it('should throw when adminPhone1 is invalid Brazilian phone', () => {
      const config = createValidConfig();
      config.adminPhone1 = '12345'; // Too short

      expect(() => validateWhatsAppConfig(config)).toThrow(
        'ADMIN_PHONE_1 (12345) is not a valid Brazilian phone number'
      );
    });

    it('should throw when adminPhone2 is invalid Brazilian phone', () => {
      const config = createValidConfig();
      config.adminPhone2 = '1234567890123456'; // Too long

      expect(() => validateWhatsAppConfig(config)).toThrow('is not a valid Brazilian phone number');
    });

    it('should collect multiple errors', () => {
      const config: WhatsAppConfig = {
        wppBaseUrl: '',
        wppSecretKey: '',
        wppSessionName: '',
        adminPhone1: '',
        adminPhone2: '',
        webhookSecret: '',
        notificationsEnabled: true,
      };

      try {
        validateWhatsAppConfig(config);
        expect(true).toBe(false); // Should not reach here
      } catch (error) {
        expect(error).toBeInstanceOf(WhatsAppConfigError);
        const message = (error as WhatsAppConfigError).message;
        expect(message).toContain('WPP_BASE_URL is required');
        expect(message).toContain('WPP_SECRET_KEY is required');
        expect(message).toContain('WPP_SESSION_NAME is required');
        expect(message).toContain('WEBHOOK_SECRET is required');
        expect(message).toContain('At least one admin phone');
      }
    });
  });

  describe('loadAndValidateWhatsAppConfig', () => {
    const originalEnv = { ...process.env };

    beforeEach(() => {
      delete process.env.WPP_BASE_URL;
      delete process.env.WPP_SECRET_KEY;
      delete process.env.WPP_SESSION_NAME;
      delete process.env.ADMIN_PHONE_1;
      delete process.env.ADMIN_PHONE_2;
      delete process.env.WEBHOOK_SECRET;
    });

    afterEach(() => {
      process.env = { ...originalEnv };
    });

    it('should load and validate config successfully', () => {
      process.env.WPP_BASE_URL = 'http://localhost:21465';
      process.env.WPP_SECRET_KEY = 'secret';
      process.env.WPP_SESSION_NAME = 'session';
      process.env.ADMIN_PHONE_1 = '5573981112636';
      process.env.WEBHOOK_SECRET = 'webhook';

      const config = loadAndValidateWhatsAppConfig();

      expect(config.wppBaseUrl).toBe('http://localhost:21465');
      expect(config.notificationsEnabled).toBe(true);
    });

    it('should throw when config is invalid', () => {
      // No env vars set

      expect(() => loadAndValidateWhatsAppConfig()).toThrow(WhatsAppConfigError);
    });
  });

  describe('getAdminPhones', () => {
    it('should return both phones when both are set', () => {
      const config = createValidConfig();

      const phones = getAdminPhones(config);

      expect(phones).toEqual(['5573981112636', '5511987654321']);
    });

    it('should return only adminPhone1 when adminPhone2 is empty', () => {
      const config = createValidConfig();
      config.adminPhone2 = '';

      const phones = getAdminPhones(config);

      expect(phones).toEqual(['5573981112636']);
    });

    it('should return only adminPhone2 when adminPhone1 is empty', () => {
      const config = createValidConfig();
      config.adminPhone1 = '';

      const phones = getAdminPhones(config);

      expect(phones).toEqual(['5511987654321']);
    });

    it('should return empty array when both are empty', () => {
      const config = createValidConfig();
      config.adminPhone1 = '';
      config.adminPhone2 = '';

      const phones = getAdminPhones(config);

      expect(phones).toEqual([]);
    });
  });

  describe('isWhatsAppEnabled', () => {
    it('should return true when notificationsEnabled is true', () => {
      const config = createValidConfig();
      config.notificationsEnabled = true;

      expect(isWhatsAppEnabled(config)).toBe(true);
    });

    it('should return false when notificationsEnabled is false', () => {
      const config = createValidConfig();
      config.notificationsEnabled = false;

      expect(isWhatsAppEnabled(config)).toBe(false);
    });
  });

  describe('WhatsAppConfigError', () => {
    it('should have correct name', () => {
      const error = new WhatsAppConfigError('Test error');

      expect(error.name).toBe('WhatsAppConfigError');
      expect(error.message).toBe('Test error');
    });

    it('should be instanceof Error', () => {
      const error = new WhatsAppConfigError('Test');

      expect(error instanceof Error).toBe(true);
    });
  });
});
