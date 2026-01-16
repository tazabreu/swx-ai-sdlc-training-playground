/**
 * WhatsApp Configuration
 *
 * Load and validate WhatsApp configuration from environment variables.
 */

import { isValidBrazilianPhone } from './phone-utils.js';

/**
 * WhatsApp feature configuration
 */
export interface WhatsAppConfig {
  /** Base URL of the wpp-connect server */
  wppBaseUrl: string;
  /** Secret key for wpp-connect authentication */
  wppSecretKey: string;
  /** WhatsApp session name */
  wppSessionName: string;
  /** First admin phone number (E.164 format) */
  adminPhone1: string;
  /** Second admin phone number (E.164 format) */
  adminPhone2: string;
  /** Shared secret for webhook authentication */
  webhookSecret: string;
  /** Feature flag to enable/disable WhatsApp notifications */
  notificationsEnabled: boolean;
}

/**
 * Error thrown when configuration is invalid
 */
export class WhatsAppConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WhatsAppConfigError';
  }
}

/**
 * Get list of admin phone numbers from config
 */
export function getAdminPhones(config: WhatsAppConfig): string[] {
  const phones: string[] = [];
  if (config.adminPhone1) phones.push(config.adminPhone1);
  if (config.adminPhone2) phones.push(config.adminPhone2);
  return phones;
}

/**
 * Load WhatsApp configuration from environment variables
 *
 * Required environment variables:
 * - WPP_BASE_URL: Base URL of the wpp-connect server
 * - WPP_SECRET_KEY: Secret key for authentication
 * - WPP_SESSION_NAME: Session name
 * - ADMIN_PHONE_1: First admin phone number
 * - ADMIN_PHONE_2: Second admin phone number
 * - WEBHOOK_SECRET: Shared secret for webhook auth
 *
 * Optional:
 * - WHATSAPP_NOTIFICATIONS_ENABLED: Feature flag (default: true)
 */
export function loadWhatsAppConfig(): WhatsAppConfig {
  const config: WhatsAppConfig = {
    wppBaseUrl: process.env.WPP_BASE_URL ?? '',
    wppSecretKey: process.env.WPP_SECRET_KEY ?? '',
    wppSessionName: process.env.WPP_SESSION_NAME ?? 'acme-financial-api',
    adminPhone1: process.env.ADMIN_PHONE_1 ?? '',
    adminPhone2: process.env.ADMIN_PHONE_2 ?? '',
    webhookSecret: process.env.WEBHOOK_SECRET ?? '',
    notificationsEnabled: process.env.WHATSAPP_NOTIFICATIONS_ENABLED !== 'false',
  };

  return config;
}

/**
 * Validate WhatsApp configuration
 *
 * @throws WhatsAppConfigError if configuration is invalid
 */
export function validateWhatsAppConfig(config: WhatsAppConfig): void {
  const errors: string[] = [];

  // Required fields
  if (!config.wppBaseUrl) {
    errors.push('WPP_BASE_URL is required');
  } else {
    // Validate URL format
    try {
      new URL(config.wppBaseUrl);
    } catch {
      errors.push('WPP_BASE_URL must be a valid URL');
    }
  }

  if (!config.wppSecretKey) {
    errors.push('WPP_SECRET_KEY is required');
  }

  if (!config.wppSessionName) {
    errors.push('WPP_SESSION_NAME is required');
  }

  if (!config.webhookSecret) {
    errors.push('WEBHOOK_SECRET is required');
  }

  // Validate admin phones
  if (!config.adminPhone1 && !config.adminPhone2) {
    errors.push('At least one admin phone (ADMIN_PHONE_1 or ADMIN_PHONE_2) is required');
  }

  if (config.adminPhone1 && !isValidBrazilianPhone(config.adminPhone1)) {
    errors.push(`ADMIN_PHONE_1 (${config.adminPhone1}) is not a valid Brazilian phone number`);
  }

  if (config.adminPhone2 && !isValidBrazilianPhone(config.adminPhone2)) {
    errors.push(`ADMIN_PHONE_2 (${config.adminPhone2}) is not a valid Brazilian phone number`);
  }

  if (errors.length > 0) {
    throw new WhatsAppConfigError(`Invalid WhatsApp configuration:\n- ${errors.join('\n- ')}`);
  }
}

/**
 * Load and validate WhatsApp configuration
 *
 * @throws WhatsAppConfigError if configuration is invalid
 */
export function loadAndValidateWhatsAppConfig(): WhatsAppConfig {
  const config = loadWhatsAppConfig();
  validateWhatsAppConfig(config);
  return config;
}

/**
 * Check if WhatsApp notifications are enabled
 */
export function isWhatsAppEnabled(config: WhatsAppConfig): boolean {
  return config.notificationsEnabled;
}
