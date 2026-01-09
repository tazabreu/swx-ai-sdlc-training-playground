/**
 * WhatsApp Approval Flow - Functional Test
 *
 * Tests the WhatsApp message handling logic for admin approval/rejection.
 * These tests focus on the message parsing, authorization, and filtering logic.
 */

import { describe, it, expect } from 'bun:test';
import { handleWhatsAppApproval } from '../../../src/application/handlers/whatsapp-approval.handler';
import type { WppWebhookPayload } from '../../../src/infrastructure/whatsapp/types';
import type { WhatsAppConfig } from '../../../src/infrastructure/whatsapp/config';

const ADMIN_PHONE_1 = '5573981112636';
const ADMIN_PHONE_2 = '5511987654321';

function createTestConfig(): WhatsAppConfig {
  return {
    wppBaseUrl: 'http://localhost:21465',
    wppSecretKey: 'test-secret',
    wppSessionName: 'test-session',
    adminPhone1: ADMIN_PHONE_1,
    adminPhone2: ADMIN_PHONE_2,
    webhookSecret: 'webhook-secret',
    notificationsEnabled: true,
  };
}

function createWebhookPayload(
  body: string,
  overrides: {
    fromPhone?: string;
    event?: string;
    fromMe?: boolean;
    isGroupMsg?: boolean;
  } = {}
): WppWebhookPayload {
  const fromPhone = overrides.fromPhone ?? ADMIN_PHONE_1;
  return {
    event: overrides.event ?? 'onmessage',
    session: 'test-session',
    data: {
      id: `msg-${Date.now()}`,
      from: `${fromPhone}@c.us`,
      to: '5573900000000@c.us',
      body,
      fromMe: overrides.fromMe ?? false,
      isGroupMsg: overrides.isGroupMsg ?? false,
      type: 'chat',
      timestamp: Math.floor(Date.now() / 1000),
      sender: {
        id: `${fromPhone}@c.us`,
        pushname: 'Admin User',
      },
    },
  };
}

function createMinimalDeps() {
  return {
    pendingApprovalRepo: {
      save: async () => {},
      findById: async () => null,
      findByRequestId: async () => null,
      findPendingByRequestId: async () => null,
      findExpired: async () => [],
      updateApprovalStatus: async () => {},
      deleteAll: async () => 0,
    },
    cardRequestRepo: {
      findById: async () => null,
      findPendingByUser: async () => null,
      findRejectedByUser: async () => [],
      findPendingForAdmin: async () => [],
      findAllPending: async () => ({ requests: [], nextCursor: null, hasMore: false }),
      save: async () => {},
      updateStatus: async () => {},
      updateDecision: async () => {},
    },
    userRepo: {
      findById: async () => null,
      findBySlug: async () => null,
      findByFirebaseUid: async () => null,
      save: async () => {},
      updateScore: async () => {},
      updateCardSummary: async () => {},
      deleteAll: async () => 0,
    },
    inboundRepo: {
      save: async () => {},
      findById: async () => null,
      findByWppMessageId: async () => null,
      findBySenderPhone: async () => [],
      updateProcessingStatus: async () => {},
      deleteAll: async () => 0,
    },
    cardRepo: {
      findById: async () => null,
      findByUser: async () => [],
      save: async () => {},
      updateBalance: async () => {},
      updateStatus: async () => {},
    },
    outboxRepo: {
      save: async () => {},
      findPending: async () => [],
      markPublished: async () => {},
      deleteOld: async () => 0,
    },
    auditLogRepo: {
      findByTarget: async () => ({ entries: [], nextCursor: null, hasMore: false }),
      save: async () => {},
    },
    config: createTestConfig(),
  };
}

describe('WhatsApp Approval Flow', () => {
  describe('Event Type Filtering', () => {
    it('should ignore non-message events (onack)', async () => {
      const payload = createWebhookPayload('y ABC12345', { event: 'onack' });
      const result = await handleWhatsAppApproval(payload, createMinimalDeps());

      expect(result.ok).toBe(true);
      expect(result.action).toBe('ignored');
      expect(result.reason).toBe('non_message_event');
    });

    it('should ignore non-message events (onstatechange)', async () => {
      const payload = createWebhookPayload('y ABC12345', { event: 'onstatechange' });
      const result = await handleWhatsAppApproval(payload, createMinimalDeps());

      expect(result.ok).toBe(true);
      expect(result.action).toBe('ignored');
      expect(result.reason).toBe('non_message_event');
    });
  });

  describe('Self and Group Message Filtering', () => {
    it('should ignore self-messages (fromMe: true)', async () => {
      const payload = createWebhookPayload('y ABC12345', { fromMe: true });
      const result = await handleWhatsAppApproval(payload, createMinimalDeps());

      expect(result.ok).toBe(true);
      expect(result.action).toBe('ignored');
      expect(result.reason).toBe('from_self');
    });

    it('should ignore group messages', async () => {
      const payload = createWebhookPayload('y ABC12345', { isGroupMsg: true });
      const result = await handleWhatsAppApproval(payload, createMinimalDeps());

      expect(result.ok).toBe(true);
      expect(result.action).toBe('ignored');
      expect(result.reason).toBe('group_message');
    });
  });

  describe('Admin Whitelist Authorization', () => {
    it('should reject messages from non-whitelisted phones', async () => {
      const payload = createWebhookPayload('y ABC12345', { fromPhone: '5521999999999' });
      const result = await handleWhatsAppApproval(payload, createMinimalDeps());

      expect(result.ok).toBe(true);
      expect(result.action).toBe('ignored');
      expect(result.reason).toBe('not_whitelisted');
    });

    it('should accept messages from primary admin phone', async () => {
      const payload = createWebhookPayload('y ABC12345', { fromPhone: ADMIN_PHONE_1 });
      const result = await handleWhatsAppApproval(payload, createMinimalDeps());

      expect(result.ok).toBe(true);
      // Will be request_not_found because no pending approval exists
      expect(result.reason).not.toBe('not_whitelisted');
    });

    it('should accept messages from secondary admin phone', async () => {
      const payload = createWebhookPayload('y ABC12345', { fromPhone: ADMIN_PHONE_2 });
      const result = await handleWhatsAppApproval(payload, createMinimalDeps());

      expect(result.ok).toBe(true);
      // Will be request_not_found because no pending approval exists
      expect(result.reason).not.toBe('not_whitelisted');
    });
  });

  describe('Command Parsing', () => {
    it('should ignore empty messages', async () => {
      const payload = createWebhookPayload('');
      const result = await handleWhatsAppApproval(payload, createMinimalDeps());

      expect(result.ok).toBe(true);
      expect(result.action).toBe('ignored');
      expect(result.reason).toBe('invalid_command');
    });

    it('should ignore random text messages', async () => {
      const payload = createWebhookPayload('Hello, how are you?');
      const result = await handleWhatsAppApproval(payload, createMinimalDeps());

      expect(result.ok).toBe(true);
      expect(result.action).toBe('ignored');
      expect(result.reason).toBe('invalid_command');
    });

    it('should ignore command without request ID', async () => {
      const payload = createWebhookPayload('y');
      const result = await handleWhatsAppApproval(payload, createMinimalDeps());

      expect(result.ok).toBe(true);
      expect(result.action).toBe('ignored');
      expect(result.reason).toBe('invalid_command');
    });

    it('should ignore command with only spaces', async () => {
      const payload = createWebhookPayload('   ');
      const result = await handleWhatsAppApproval(payload, createMinimalDeps());

      expect(result.ok).toBe(true);
      expect(result.action).toBe('ignored');
      expect(result.reason).toBe('invalid_command');
    });
  });

  describe('Request Lookup', () => {
    it('should return request_not_found for non-existent request', async () => {
      const payload = createWebhookPayload('y NOTEXIST');
      const result = await handleWhatsAppApproval(payload, createMinimalDeps());

      expect(result.ok).toBe(true);
      expect(result.action).toBe('ignored');
      expect(result.reason).toBe('request_not_found');
    });

    it('should handle "yes" command format', async () => {
      const payload = createWebhookPayload('yes ABC12345');
      const result = await handleWhatsAppApproval(payload, createMinimalDeps());

      expect(result.ok).toBe(true);
      // Will be request_not_found since no pending approval exists
      // but command was parsed correctly
      expect(result.reason).toBe('request_not_found');
    });

    it('should handle "no" command format', async () => {
      const payload = createWebhookPayload('no ABC12345');
      const result = await handleWhatsAppApproval(payload, createMinimalDeps());

      expect(result.ok).toBe(true);
      expect(result.reason).toBe('request_not_found');
    });

    it('should handle uppercase commands', async () => {
      const payload = createWebhookPayload('Y ABC12345');
      const result = await handleWhatsAppApproval(payload, createMinimalDeps());

      expect(result.ok).toBe(true);
      expect(result.reason).toBe('request_not_found');
    });

    it('should handle lowercase request ID', async () => {
      const payload = createWebhookPayload('y abc12345');
      const result = await handleWhatsAppApproval(payload, createMinimalDeps());

      expect(result.ok).toBe(true);
      expect(result.reason).toBe('request_not_found');
    });
  });

  describe('Response Structure', () => {
    it('should always return ok: true for handled messages', async () => {
      const testCases = [
        createWebhookPayload('y ABC12345', { event: 'onack' }),
        createWebhookPayload('y ABC12345', { fromMe: true }),
        createWebhookPayload('y ABC12345', { isGroupMsg: true }),
        createWebhookPayload('y ABC12345', { fromPhone: '5521999999999' }),
        createWebhookPayload('hello world'),
        createWebhookPayload('y NOTEXIST'),
      ];

      for (const payload of testCases) {
        const result = await handleWhatsAppApproval(payload, createMinimalDeps());
        expect(result.ok).toBe(true);
      }
    });

    it('should include reason for ignored actions', async () => {
      const payload = createWebhookPayload('y ABC12345', { event: 'onack' });
      const result = await handleWhatsAppApproval(payload, createMinimalDeps());

      expect(result.action).toBe('ignored');
      expect(result.reason).toBeDefined();
    });
  });
});
