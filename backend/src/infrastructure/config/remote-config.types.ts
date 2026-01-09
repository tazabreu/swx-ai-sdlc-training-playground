/**
 * Remote Config Types
 *
 * Type definitions for Firebase Remote Config parameters.
 * These enable dynamic configuration without redeployment.
 */

/**
 * Credit limits configuration by tier
 */
export interface TierLimitsConfig {
  /** Credit limit for low tier users (score < 500) */
  lowTier: number;
  /** Credit limit for medium tier users (score 500-699) */
  mediumTier: number;
  /** Credit limit for high tier users (score >= 700) */
  highTier: number;
}

/**
 * Card approval configuration
 */
export interface ApprovalConfig {
  /** Minimum score for automatic approval without review */
  autoApproveThreshold: number;
}

/**
 * WhatsApp feature configuration
 */
export interface WhatsAppFeatureConfig {
  /** Toggle for WhatsApp notifications */
  notificationsEnabled: boolean;
  /** Hours before pending approval expires */
  approvalExpiryHours: number;
}

/**
 * Scoring rules configuration
 */
export interface ScoringConfig {
  /** Maximum score bonus for on-time payment */
  paymentBonusMax: number;
  /** Minimum score bonus for on-time payment */
  paymentBonusMin: number;
  /** Penalty for late payment (1-7 days) */
  latePenaltyMild: number;
  /** Penalty for late payment (8-30 days) */
  latePenaltyModerate: number;
  /** Penalty for late payment (30+ days) */
  latePenaltySevere: number;
}

/**
 * Complete remote configuration
 */
export interface RemoteConfig {
  /** Credit limits by tier */
  limits: TierLimitsConfig;
  /** Approval rules */
  approval: ApprovalConfig;
  /** WhatsApp feature settings */
  whatsapp: WhatsAppFeatureConfig;
  /** Scoring parameters */
  scoring: ScoringConfig;
}

/**
 * Remote Config parameter keys (for Firebase Remote Config)
 */
export const REMOTE_CONFIG_KEYS = {
  // Limits
  LIMITS_LOW_TIER: 'limits_low_tier',
  LIMITS_MEDIUM_TIER: 'limits_medium_tier',
  LIMITS_HIGH_TIER: 'limits_high_tier',

  // Approval
  APPROVAL_AUTO_APPROVE_THRESHOLD: 'approval_auto_approve_threshold',

  // WhatsApp
  WHATSAPP_NOTIFICATIONS_ENABLED: 'whatsapp_notifications_enabled',
  WHATSAPP_APPROVAL_EXPIRY_HOURS: 'whatsapp_approval_expiry_hours',

  // Scoring
  SCORING_PAYMENT_BONUS_MAX: 'scoring_payment_bonus_max',
  SCORING_PAYMENT_BONUS_MIN: 'scoring_payment_bonus_min',
  SCORING_LATE_PENALTY_MILD: 'scoring_late_penalty_mild',
  SCORING_LATE_PENALTY_MODERATE: 'scoring_late_penalty_moderate',
  SCORING_LATE_PENALTY_SEVERE: 'scoring_late_penalty_severe',
} as const;
