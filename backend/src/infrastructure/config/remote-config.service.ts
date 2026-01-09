/**
 * Remote Config Service
 *
 * Provides dynamic configuration via Firebase Remote Config.
 * Falls back to defaults when Remote Config is unavailable.
 */

import type {
  RemoteConfig,
  TierLimitsConfig,
  ApprovalConfig,
  WhatsAppFeatureConfig,
  ScoringConfig,
} from './remote-config.types.js';
import { DEFAULT_CONFIG } from './remote-config.defaults.js';

/**
 * Remote Config service options
 */
export interface RemoteConfigServiceOptions {
  /** Minimum fetch interval in seconds (default: 300 for production, 0 for dev) */
  minimumFetchIntervalSeconds?: number;
  /** Whether to use defaults only (skip Remote Config fetch) */
  useDefaultsOnly?: boolean;
}

/**
 * Remote Config Service
 *
 * Provides type-safe access to dynamic configuration parameters.
 * Uses Firebase Remote Config for production and falls back to
 * defaults for local development or when unavailable.
 */
export class RemoteConfigService {
  private config: RemoteConfig = { ...DEFAULT_CONFIG };
  private initialized = false;
  private lastFetch: Date | null = null;
  private readonly options: Required<RemoteConfigServiceOptions>;

  constructor(options: RemoteConfigServiceOptions = {}) {
    this.options = {
      minimumFetchIntervalSeconds: options.minimumFetchIntervalSeconds ?? 300,
      useDefaultsOnly: options.useDefaultsOnly ?? false,
    };
  }

  /**
   * Initialize Remote Config service
   *
   * Fetches and activates remote configuration values.
   * Falls back to defaults if fetch fails.
   */
  async initialize(): Promise<void> {
    if (this.options.useDefaultsOnly) {
      this.config = { ...DEFAULT_CONFIG };
      this.initialized = true;
      return;
    }

    try {
      // In a real implementation, this would use firebase-admin Remote Config
      // For now, we use defaults since firebase-admin Remote Config
      // requires project-level setup and service account configuration
      //
      // const remoteConfig = admin.remoteConfig();
      // const template = await remoteConfig.getTemplate();
      // this.parseTemplate(template);

      // Simulate async operation for future Remote Config integration
      await Promise.resolve();

      // Use defaults for now - can be extended with Firebase Remote Config SDK
      this.config = { ...DEFAULT_CONFIG };
      this.lastFetch = new Date();
      this.initialized = true;
    } catch (error) {
      console.warn('Failed to fetch Remote Config, using defaults:', error);
      this.config = { ...DEFAULT_CONFIG };
      this.initialized = true;
    }
  }

  /**
   * Refresh configuration from Remote Config
   *
   * Only fetches if minimum interval has passed.
   */
  async refresh(): Promise<boolean> {
    if (this.options.useDefaultsOnly) {
      return false;
    }

    if (this.lastFetch) {
      const elapsed = (Date.now() - this.lastFetch.getTime()) / 1000;
      if (elapsed < this.options.minimumFetchIntervalSeconds) {
        return false;
      }
    }

    await this.initialize();
    return true;
  }

  /**
   * Check if service is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Get credit limits configuration
   */
  getLimits(): TierLimitsConfig {
    this.ensureInitialized();
    return { ...this.config.limits };
  }

  /**
   * Get credit limit for a specific tier
   */
  getLimitForTier(tier: 'low' | 'medium' | 'high'): number {
    this.ensureInitialized();
    switch (tier) {
      case 'low':
        return this.config.limits.lowTier;
      case 'medium':
        return this.config.limits.mediumTier;
      case 'high':
        return this.config.limits.highTier;
      default:
        return this.config.limits.lowTier;
    }
  }

  /**
   * Get approval configuration
   */
  getApprovalConfig(): ApprovalConfig {
    this.ensureInitialized();
    return { ...this.config.approval };
  }

  /**
   * Get auto-approval score threshold
   */
  getAutoApproveThreshold(): number {
    this.ensureInitialized();
    return this.config.approval.autoApproveThreshold;
  }

  /**
   * Get WhatsApp feature configuration
   */
  getWhatsAppConfig(): WhatsAppFeatureConfig {
    this.ensureInitialized();
    return { ...this.config.whatsapp };
  }

  /**
   * Check if WhatsApp notifications are enabled
   */
  isWhatsAppEnabled(): boolean {
    this.ensureInitialized();
    return this.config.whatsapp.notificationsEnabled;
  }

  /**
   * Get approval expiry hours
   */
  getApprovalExpiryHours(): number {
    this.ensureInitialized();
    return this.config.whatsapp.approvalExpiryHours;
  }

  /**
   * Get scoring configuration
   */
  getScoringConfig(): ScoringConfig {
    this.ensureInitialized();
    return { ...this.config.scoring };
  }

  /**
   * Get complete configuration (copy)
   */
  getConfig(): RemoteConfig {
    this.ensureInitialized();
    return {
      limits: { ...this.config.limits },
      approval: { ...this.config.approval },
      whatsapp: { ...this.config.whatsapp },
      scoring: { ...this.config.scoring },
    };
  }

  /**
   * Update configuration from external source
   *
   * Useful for testing or when receiving config updates via other channels.
   */
  updateConfig(partial: Partial<RemoteConfig>): void {
    if (partial.limits) {
      this.config.limits = { ...this.config.limits, ...partial.limits };
    }
    if (partial.approval) {
      this.config.approval = { ...this.config.approval, ...partial.approval };
    }
    if (partial.whatsapp) {
      this.config.whatsapp = { ...this.config.whatsapp, ...partial.whatsapp };
    }
    if (partial.scoring) {
      this.config.scoring = { ...this.config.scoring, ...partial.scoring };
    }
    this.initialized = true;
  }

  /**
   * Reset to default configuration
   */
  resetToDefaults(): void {
    this.config = { ...DEFAULT_CONFIG };
    this.lastFetch = null;
  }

  /**
   * Ensure service is initialized before accessing config
   */
  private ensureInitialized(): void {
    if (!this.initialized) {
      // Auto-initialize with defaults if not initialized
      this.config = { ...DEFAULT_CONFIG };
      this.initialized = true;
    }
  }
}

/**
 * Singleton instance for the application
 */
let instance: RemoteConfigService | null = null;

/**
 * Get the singleton RemoteConfigService instance
 */
export function getRemoteConfigService(): RemoteConfigService {
  if (!instance) {
    instance = new RemoteConfigService({
      useDefaultsOnly: process.env.NODE_ENV !== 'production',
    });
  }
  return instance;
}

/**
 * Create a new RemoteConfigService instance (for testing)
 */
export function createRemoteConfigService(
  options?: RemoteConfigServiceOptions
): RemoteConfigService {
  return new RemoteConfigService(options);
}

/**
 * Reset the singleton instance (for testing)
 */
export function resetRemoteConfigService(): void {
  instance = null;
}
