/**
 * Remote Config Service Unit Tests
 *
 * Tests for dynamic configuration service with fallback defaults.
 */

import { describe, it, expect, beforeEach } from 'bun:test';
import {
  createRemoteConfigService,
  getRemoteConfigService,
  resetRemoteConfigService,
} from '../../../../src/infrastructure/config/remote-config.service';
import {
  DEFAULT_CONFIG,
  DEFAULT_LIMITS,
} from '../../../../src/infrastructure/config/remote-config.defaults';

describe('RemoteConfigService', () => {
  beforeEach(() => {
    resetRemoteConfigService();
  });

  describe('initialization', () => {
    it('should initialize with default values when useDefaultsOnly is true', async () => {
      const service = createRemoteConfigService({ useDefaultsOnly: true });

      await service.initialize();

      expect(service.isInitialized()).toBe(true);
      expect(service.getLimits()).toEqual(DEFAULT_CONFIG.limits);
    });

    it('should auto-initialize when accessing config before explicit init', () => {
      const service = createRemoteConfigService({ useDefaultsOnly: true });

      // Access config without calling initialize()
      const limits = service.getLimits();

      expect(service.isInitialized()).toBe(true);
      expect(limits).toEqual(DEFAULT_CONFIG.limits);
    });

    it('should use defaults when initialization fails', async () => {
      const service = createRemoteConfigService();

      await service.initialize();

      expect(service.isInitialized()).toBe(true);
      expect(service.getConfig()).toEqual(DEFAULT_CONFIG);
    });
  });

  describe('getLimits', () => {
    it('should return tier limits configuration', async () => {
      const service = createRemoteConfigService({ useDefaultsOnly: true });
      await service.initialize();

      const limits = service.getLimits();

      expect(limits.lowTier).toBe(500);
      expect(limits.mediumTier).toBe(1500);
      expect(limits.highTier).toBe(3000);
    });

    it('should return a copy of limits (not reference)', async () => {
      const service = createRemoteConfigService({ useDefaultsOnly: true });
      await service.initialize();

      const limits1 = service.getLimits();
      const limits2 = service.getLimits();

      expect(limits1).toEqual(limits2);
      expect(limits1).not.toBe(limits2); // Different object references
    });
  });

  describe('getLimitForTier', () => {
    it('should return correct limit for low tier', async () => {
      const service = createRemoteConfigService({ useDefaultsOnly: true });
      await service.initialize();

      expect(service.getLimitForTier('low')).toBe(500);
    });

    it('should return correct limit for medium tier', async () => {
      const service = createRemoteConfigService({ useDefaultsOnly: true });
      await service.initialize();

      expect(service.getLimitForTier('medium')).toBe(1500);
    });

    it('should return correct limit for high tier', async () => {
      const service = createRemoteConfigService({ useDefaultsOnly: true });
      await service.initialize();

      expect(service.getLimitForTier('high')).toBe(3000);
    });

    it('should return low tier limit for unknown tier', async () => {
      const service = createRemoteConfigService({ useDefaultsOnly: true });
      await service.initialize();

      // @ts-expect-error Testing unknown tier
      expect(service.getLimitForTier('unknown')).toBe(500);
    });
  });

  describe('getApprovalConfig', () => {
    it('should return approval configuration', async () => {
      const service = createRemoteConfigService({ useDefaultsOnly: true });
      await service.initialize();

      const approval = service.getApprovalConfig();

      expect(approval.autoApproveThreshold).toBe(700);
    });
  });

  describe('getAutoApproveThreshold', () => {
    it('should return auto-approve threshold', async () => {
      const service = createRemoteConfigService({ useDefaultsOnly: true });
      await service.initialize();

      expect(service.getAutoApproveThreshold()).toBe(700);
    });
  });

  describe('getWhatsAppConfig', () => {
    it('should return WhatsApp configuration', async () => {
      const service = createRemoteConfigService({ useDefaultsOnly: true });
      await service.initialize();

      const whatsapp = service.getWhatsAppConfig();

      expect(whatsapp.notificationsEnabled).toBe(true);
      expect(whatsapp.approvalExpiryHours).toBe(24);
    });
  });

  describe('isWhatsAppEnabled', () => {
    it('should return true when notifications enabled', async () => {
      const service = createRemoteConfigService({ useDefaultsOnly: true });
      await service.initialize();

      expect(service.isWhatsAppEnabled()).toBe(true);
    });

    it('should return false after disabling notifications', async () => {
      const service = createRemoteConfigService({ useDefaultsOnly: true });
      await service.initialize();

      service.updateConfig({
        whatsapp: { notificationsEnabled: false, approvalExpiryHours: 24 },
      });

      expect(service.isWhatsAppEnabled()).toBe(false);
    });
  });

  describe('getApprovalExpiryHours', () => {
    it('should return default expiry hours', async () => {
      const service = createRemoteConfigService({ useDefaultsOnly: true });
      await service.initialize();

      expect(service.getApprovalExpiryHours()).toBe(24);
    });
  });

  describe('getScoringConfig', () => {
    it('should return scoring configuration', async () => {
      const service = createRemoteConfigService({ useDefaultsOnly: true });
      await service.initialize();

      const scoring = service.getScoringConfig();

      expect(scoring.paymentBonusMax).toBe(50);
      expect(scoring.paymentBonusMin).toBe(10);
      expect(scoring.latePenaltyMild).toBe(20);
      expect(scoring.latePenaltyModerate).toBe(50);
      expect(scoring.latePenaltySevere).toBe(100);
    });
  });

  describe('getConfig', () => {
    it('should return complete configuration copy', async () => {
      const service = createRemoteConfigService({ useDefaultsOnly: true });
      await service.initialize();

      const config = service.getConfig();

      expect(config).toEqual(DEFAULT_CONFIG);
    });

    it('should return a copy (not reference)', async () => {
      const service = createRemoteConfigService({ useDefaultsOnly: true });
      await service.initialize();

      const config1 = service.getConfig();
      const config2 = service.getConfig();

      expect(config1).toEqual(config2);
      expect(config1).not.toBe(config2);
      expect(config1.limits).not.toBe(config2.limits);
    });
  });

  describe('updateConfig', () => {
    it('should update limits configuration', async () => {
      const service = createRemoteConfigService({ useDefaultsOnly: true });
      await service.initialize();

      service.updateConfig({
        limits: { lowTier: 750, mediumTier: 2000, highTier: 5000 },
      });

      expect(service.getLimitForTier('low')).toBe(750);
      expect(service.getLimitForTier('medium')).toBe(2000);
      expect(service.getLimitForTier('high')).toBe(5000);
    });

    it('should update partial limits configuration', async () => {
      const service = createRemoteConfigService({ useDefaultsOnly: true });
      await service.initialize();

      service.updateConfig({
        limits: { lowTier: 750, mediumTier: 1500, highTier: 3000 },
      });

      expect(service.getLimitForTier('low')).toBe(750);
      expect(service.getLimitForTier('medium')).toBe(1500); // unchanged
    });

    it('should update approval configuration', async () => {
      const service = createRemoteConfigService({ useDefaultsOnly: true });
      await service.initialize();

      service.updateConfig({
        approval: { autoApproveThreshold: 650 },
      });

      expect(service.getAutoApproveThreshold()).toBe(650);
    });

    it('should update WhatsApp configuration', async () => {
      const service = createRemoteConfigService({ useDefaultsOnly: true });
      await service.initialize();

      service.updateConfig({
        whatsapp: { notificationsEnabled: false, approvalExpiryHours: 48 },
      });

      expect(service.isWhatsAppEnabled()).toBe(false);
      expect(service.getApprovalExpiryHours()).toBe(48);
    });

    it('should update scoring configuration', async () => {
      const service = createRemoteConfigService({ useDefaultsOnly: true });
      await service.initialize();

      service.updateConfig({
        scoring: {
          paymentBonusMax: 75,
          paymentBonusMin: 15,
          latePenaltyMild: 25,
          latePenaltyModerate: 60,
          latePenaltySevere: 150,
        },
      });

      const scoring = service.getScoringConfig();
      expect(scoring.paymentBonusMax).toBe(75);
      expect(scoring.latePenaltySevere).toBe(150);
    });

    it('should mark service as initialized after update', () => {
      const service = createRemoteConfigService({ useDefaultsOnly: true });

      expect(service.isInitialized()).toBe(false);

      service.updateConfig({
        limits: { lowTier: 600, mediumTier: 1500, highTier: 3000 },
      });

      expect(service.isInitialized()).toBe(true);
    });
  });

  describe('resetToDefaults', () => {
    it('should reset configuration to defaults', async () => {
      const service = createRemoteConfigService({ useDefaultsOnly: true });
      await service.initialize();

      service.updateConfig({
        limits: { lowTier: 1000, mediumTier: 3000, highTier: 10000 },
      });

      expect(service.getLimitForTier('low')).toBe(1000);

      service.resetToDefaults();

      expect(service.getLimitForTier('low')).toBe(500);
      expect(service.getConfig()).toEqual(DEFAULT_CONFIG);
    });
  });

  describe('refresh', () => {
    it('should not refresh when useDefaultsOnly is true', async () => {
      const service = createRemoteConfigService({ useDefaultsOnly: true });
      await service.initialize();

      const refreshed = await service.refresh();

      expect(refreshed).toBe(false);
    });

    it('should not refresh within minimum interval', async () => {
      const service = createRemoteConfigService({
        minimumFetchIntervalSeconds: 60,
      });
      await service.initialize();

      const refreshed = await service.refresh();

      expect(refreshed).toBe(false);
    });
  });

  describe('singleton', () => {
    it('should return same instance from getRemoteConfigService', () => {
      const instance1 = getRemoteConfigService();
      const instance2 = getRemoteConfigService();

      expect(instance1).toBe(instance2);
    });

    it('should reset singleton with resetRemoteConfigService', () => {
      const instance1 = getRemoteConfigService();

      resetRemoteConfigService();

      const instance2 = getRemoteConfigService();

      expect(instance1).not.toBe(instance2);
    });
  });
});

describe('DEFAULT_LIMITS', () => {
  it('should have correct low tier default', () => {
    expect(DEFAULT_LIMITS.lowTier).toBe(500);
  });

  it('should have correct medium tier default', () => {
    expect(DEFAULT_LIMITS.mediumTier).toBe(1500);
  });

  it('should have correct high tier default', () => {
    expect(DEFAULT_LIMITS.highTier).toBe(3000);
  });
});
