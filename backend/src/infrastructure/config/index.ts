/**
 * Config Infrastructure Module
 *
 * Exports configuration services and types.
 */

// Types
export type {
  RemoteConfig,
  TierLimitsConfig,
  ApprovalConfig,
  WhatsAppFeatureConfig,
  ScoringConfig,
} from './remote-config.types.js';

export { REMOTE_CONFIG_KEYS } from './remote-config.types.js';

// Defaults
export {
  DEFAULT_CONFIG,
  DEFAULT_LIMITS,
  DEFAULT_APPROVAL,
  DEFAULT_WHATSAPP,
  DEFAULT_SCORING,
  getDefaultLimitForTier,
} from './remote-config.defaults.js';

// Service
export {
  RemoteConfigService,
  getRemoteConfigService,
  createRemoteConfigService,
  resetRemoteConfigService,
  type RemoteConfigServiceOptions,
} from './remote-config.service.js';

// AWS SSM loader (optional)
export { SSMConfigService, type SSMConfigServiceOptions } from './ssm-config.service.js';
