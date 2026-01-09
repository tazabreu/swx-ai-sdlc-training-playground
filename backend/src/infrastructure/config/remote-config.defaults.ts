/**
 * Remote Config Defaults
 *
 * Default values used as fallbacks when Remote Config is unavailable
 * or when running in local development mode.
 */

import type { RemoteConfig } from './remote-config.types.js';

/**
 * Default credit limits by tier
 *
 * These match the original hardcoded values in card-approval.service.ts
 */
export const DEFAULT_LIMITS = {
  lowTier: 500,
  mediumTier: 1500,
  highTier: 3000,
} as const;

/**
 * Default approval configuration
 */
export const DEFAULT_APPROVAL = {
  autoApproveThreshold: 700,
} as const;

/**
 * Default WhatsApp feature configuration
 */
export const DEFAULT_WHATSAPP = {
  notificationsEnabled: true,
  approvalExpiryHours: 24,
} as const;

/**
 * Default scoring parameters
 *
 * These match the original hardcoded values in scoring.service.ts
 */
export const DEFAULT_SCORING = {
  paymentBonusMax: 50,
  paymentBonusMin: 10,
  latePenaltyMild: 20,
  latePenaltyModerate: 50,
  latePenaltySevere: 100,
} as const;

/**
 * Complete default configuration
 *
 * Used as fallback when Remote Config is unavailable.
 */
export const DEFAULT_CONFIG: RemoteConfig = {
  limits: { ...DEFAULT_LIMITS },
  approval: { ...DEFAULT_APPROVAL },
  whatsapp: { ...DEFAULT_WHATSAPP },
  scoring: { ...DEFAULT_SCORING },
};

/**
 * Get limit for a specific tier
 */
export function getDefaultLimitForTier(tier: 'low' | 'medium' | 'high'): number {
  switch (tier) {
    case 'low':
      return DEFAULT_LIMITS.lowTier;
    case 'medium':
      return DEFAULT_LIMITS.mediumTier;
    case 'high':
      return DEFAULT_LIMITS.highTier;
    default:
      return DEFAULT_LIMITS.lowTier;
  }
}
