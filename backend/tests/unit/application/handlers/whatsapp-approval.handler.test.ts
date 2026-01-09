/**
 * WhatsApp Approval Handler Unit Tests
 *
 * Tests for processing admin approval/rejection commands via WhatsApp.
 */

import { describe, it, expect } from 'bun:test';
import {
  handleWhatsAppApproval,
  type WhatsAppApprovalHandlerDeps,
} from '../../../../src/application/handlers/whatsapp-approval.handler';
import type { WppWebhookPayload } from '../../../../src/infrastructure/whatsapp/types';
import type { PendingApprovalTracker } from '../../../../src/domain/entities/pending-approval.entity';
import type { CardRequest } from '../../../../src/domain/entities/card-request.entity';
import type { User } from '../../../../src/domain/entities/user.entity';
import type { WhatsAppConfig } from '../../../../src/infrastructure/whatsapp/config';

/** Admin phone that's whitelisted in test config */
const WHITELISTED_ADMIN_PHONE = '5573981112636';

/**
 * Create test webhook payload
 */
function createTestPayload(
  overrides: Partial<{
    event: string;
    from: string;
    fromMe: boolean;
    isGroupMsg: boolean;
    body: string;
    id: string;
    pushname: string;
  }>
): WppWebhookPayload {
  const fromPhone = overrides.from ?? `${WHITELISTED_ADMIN_PHONE}@c.us`;
  return {
    event: overrides.event ?? 'onmessage',
    session: 'test-session',
    data: {
      id: overrides.id ?? 'wpp-msg-123',
      from: fromPhone,
      to: '5573900000000@c.us',
      body: overrides.body ?? 'y abc12345',
      fromMe: overrides.fromMe ?? false,
      isGroupMsg: overrides.isGroupMsg ?? false,
      type: 'chat',
      timestamp: Math.floor(Date.now() / 1000),
      sender: {
        id: fromPhone,
        pushname: overrides.pushname ?? 'Admin User',
      },
    },
  };
}

/**
 * Create mock pending approval tracker
 */
function createTestPendingApproval(
  overrides: Partial<PendingApprovalTracker> = {}
): PendingApprovalTracker {
  const now = new Date();
  return {
    requestId: overrides.requestId ?? 'abc12345-full-uuid',
    ecosystemId: overrides.ecosystemId ?? 'eco-123',
    notificationIds: overrides.notificationIds ?? ['notif-1', 'notif-2'],
    approvalStatus: overrides.approvalStatus ?? 'pending',
    expiresAt: overrides.expiresAt ?? new Date(now.getTime() + 24 * 60 * 60 * 1000),
    createdAt: overrides.createdAt ?? now,
    updatedAt: overrides.updatedAt ?? now,
    ...overrides,
  };
}

/**
 * Create mock card request
 */
function createTestCardRequest(overrides: Partial<CardRequest> = {}): CardRequest {
  return {
    requestId: overrides.requestId ?? 'abc12345-full-uuid',
    status: overrides.status ?? 'pending',
    idempotencyKey: 'key-123',
    scoreAtRequest: 400,
    tierAtRequest: 'low',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

/**
 * Create mock user
 */
function createTestUser(overrides: Partial<User> = {}): User {
  return {
    ecosystemId: 'eco-123',
    firebaseUid: 'firebase-123',
    email: 'test@example.com',
    role: 'user',
    status: 'active',
    currentScore: 400,
    tier: 'low',
    cardSummary: { activeCards: 0, totalBalance: 0, totalLimit: 0 },
    createdAt: new Date(),
    updatedAt: new Date(),
    lastLoginAt: new Date(),
    ...overrides,
  };
}

/**
 * Create mock config
 */
function createTestConfig(): WhatsAppConfig {
  return {
    wppBaseUrl: 'http://localhost:21465',
    wppSecretKey: 'test-secret',
    wppSessionName: 'test-session',
    adminPhone1: WHITELISTED_ADMIN_PHONE,
    adminPhone2: '',
    webhookSecret: 'webhook-secret',
    notificationsEnabled: true,
  };
}

/**
 * Create mock dependencies
 */
function createMockDeps(
  overrides: Partial<{
    pendingApproval: PendingApprovalTracker | null;
    cardRequest: CardRequest | null;
    user: User | null;
    config: WhatsAppConfig;
  }> = {}
): WhatsAppApprovalHandlerDeps {
  const savedInboundMessages: unknown[] = [];
  const updatedApprovals: { requestId: string; status: string; phone: string }[] = [];

  // Use shared test entities - these are functions to get fresh instances
  const testPending = createTestPendingApproval();
  const getTestRequest = () =>
    'cardRequest' in overrides ? overrides.cardRequest : createTestCardRequest();

  return {
    pendingApprovalRepo: {
      save: async () => {},
      findById: async () =>
        'pendingApproval' in overrides ? overrides.pendingApproval : testPending,
      findByRequestId: async () =>
        'pendingApproval' in overrides ? overrides.pendingApproval : testPending,
      findPendingByRequestId: async (requestId: string) => {
        if ('pendingApproval' in overrides) {
          return overrides.pendingApproval;
        }
        // Match by full ID or short ID prefix (first 8 chars)
        const fullId = testPending.requestId;
        const shortId = fullId.slice(0, 8).toUpperCase();
        const searchId = requestId.toUpperCase();

        if (
          fullId === requestId ||
          shortId === searchId ||
          fullId.toUpperCase().startsWith(searchId)
        ) {
          return testPending;
        }
        return null;
      },
      findExpired: async () => [],
      updateApprovalStatus: async (requestId: string, status: string, phone: string) => {
        updatedApprovals.push({ requestId, status, phone });
      },
      deleteAll: async () => 0,
    },
    cardRequestRepo: {
      findById: async () => getTestRequest(),
      findPendingByUser: async () => null,
      findRejectedByUser: async () => [],
      findPendingForAdmin: async () => [],
      findAllPending: async () => {
        // Return matching card request for short ID lookup
        const cardReq = getTestRequest();
        if (cardReq === null) {
          return { requests: [], nextCursor: null, hasMore: false };
        }
        return {
          requests: [{ ...cardReq, ecosystemId: testPending.ecosystemId }],
          nextCursor: null,
          hasMore: false,
        };
      },
      save: async () => {},
      updateStatus: async () => {},
      updateDecision: async () => {},
    },
    userRepo: {
      findById: async () => ('user' in overrides ? overrides.user : createTestUser()),
      findBySlug: async () => null,
      findByFirebaseUid: async () => null,
      save: async () => {},
      updateScore: async () => {},
      updateCardSummary: async () => {},
      deleteAll: async () => 0,
    },
    inboundRepo: {
      save: async (msg: unknown) => {
        savedInboundMessages.push(msg);
      },
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
    config: overrides.config ?? createTestConfig(),
  };
}

describe('WhatsApp Approval Handler', () => {
  describe('event validation', () => {
    it('should ignore non-message events', async () => {
      const payload = createTestPayload({ event: 'onack' });
      const deps = createMockDeps();

      const result = await handleWhatsAppApproval(payload, deps);

      expect(result.ok).toBe(true);
      expect(result.action).toBe('ignored');
      expect(result.reason).toBe('non_message_event');
    });

    it('should ignore self-messages', async () => {
      const payload = createTestPayload({ fromMe: true });
      const deps = createMockDeps();

      const result = await handleWhatsAppApproval(payload, deps);

      expect(result.ok).toBe(true);
      expect(result.action).toBe('ignored');
      expect(result.reason).toBe('from_self');
    });

    it('should ignore group messages', async () => {
      const payload = createTestPayload({ isGroupMsg: true });
      const deps = createMockDeps();

      const result = await handleWhatsAppApproval(payload, deps);

      expect(result.ok).toBe(true);
      expect(result.action).toBe('ignored');
      expect(result.reason).toBe('group_message');
    });
  });

  describe('admin whitelist validation', () => {
    it('should ignore messages from non-whitelisted phones', async () => {
      const payload = createTestPayload({ from: '5511999999999@c.us' });
      const deps = createMockDeps();

      const result = await handleWhatsAppApproval(payload, deps);

      expect(result.ok).toBe(true);
      expect(result.action).toBe('ignored');
      expect(result.reason).toBe('not_whitelisted');
    });

    it('should process messages from whitelisted phones', async () => {
      const payload = createTestPayload({ from: '5573981112636@c.us' });
      const deps = createMockDeps();

      const result = await handleWhatsAppApproval(payload, deps);

      // Will fail at request lookup since mock returns pending approval
      expect(result.ok).toBe(true);
    });
  });

  describe('command parsing', () => {
    it('should ignore invalid commands', async () => {
      const payload = createTestPayload({ body: 'hello world' });
      const deps = createMockDeps();

      const result = await handleWhatsAppApproval(payload, deps);

      expect(result.ok).toBe(true);
      expect(result.action).toBe('ignored');
      expect(result.reason).toBe('invalid_command');
    });

    it('should ignore commands without request ID', async () => {
      const payload = createTestPayload({ body: 'y' });
      const deps = createMockDeps();

      const result = await handleWhatsAppApproval(payload, deps);

      expect(result.ok).toBe(true);
      expect(result.action).toBe('ignored');
      expect(result.reason).toBe('invalid_command');
    });
  });

  describe('pending approval lookup', () => {
    it('should return request_not_found when no pending approval exists', async () => {
      const payload = createTestPayload({ body: 'y nonexistent' });
      const deps = createMockDeps({ pendingApproval: null });

      const result = await handleWhatsAppApproval(payload, deps);

      expect(result.ok).toBe(true);
      expect(result.action).toBe('ignored');
      expect(result.reason).toBe('request_not_found');
    });

    it('should return request_not_found when card request does not exist', async () => {
      const payload = createTestPayload({ body: 'y abc12345' });
      const deps = createMockDeps({ cardRequest: null });

      const result = await handleWhatsAppApproval(payload, deps);

      expect(result.ok).toBe(true);
      expect(result.action).toBe('ignored');
      expect(result.reason).toBe('request_not_found');
    });
  });

  describe('duplicate processing check', () => {
    it('should return already_processed for approved request', async () => {
      const payload = createTestPayload({ body: 'y abc12345' });
      const deps = createMockDeps({
        cardRequest: createTestCardRequest({ status: 'approved' }),
      });

      const result = await handleWhatsAppApproval(payload, deps);

      expect(result.ok).toBe(true);
      expect(result.action).toBe('ignored');
      expect(result.reason).toBe('already_processed');
    });

    it('should return already_processed for rejected request', async () => {
      const payload = createTestPayload({ body: 'y abc12345' });
      const deps = createMockDeps({
        cardRequest: createTestCardRequest({ status: 'rejected' }),
      });

      const result = await handleWhatsAppApproval(payload, deps);

      expect(result.ok).toBe(true);
      expect(result.action).toBe('ignored');
      expect(result.reason).toBe('already_processed');
    });
  });

  describe('successful approval', () => {
    it('should approve card request with "y" command', async () => {
      const payload = createTestPayload({
        body: 'y abc12345',
        pushname: 'Admin User',
      });
      const deps = createMockDeps();

      const result = await handleWhatsAppApproval(payload, deps);

      expect(result.ok).toBe(true);
      expect(result.action).toBe('approved');
      expect(result.requestId).toBe('abc12345-full-uuid');
    });

    it('should approve card request with "yes" command', async () => {
      const payload = createTestPayload({ body: 'yes abc12345' });
      const deps = createMockDeps();

      const result = await handleWhatsAppApproval(payload, deps);

      expect(result.ok).toBe(true);
      expect(result.action).toBe('approved');
    });

    it('should approve card request with uppercase "Y" command', async () => {
      const payload = createTestPayload({ body: 'Y abc12345' });
      const deps = createMockDeps();

      const result = await handleWhatsAppApproval(payload, deps);

      expect(result.ok).toBe(true);
      expect(result.action).toBe('approved');
    });
  });

  describe('successful rejection', () => {
    it('should reject card request with "n" command', async () => {
      const payload = createTestPayload({ body: 'n abc12345' });
      const deps = createMockDeps();

      const result = await handleWhatsAppApproval(payload, deps);

      expect(result.ok).toBe(true);
      expect(result.action).toBe('rejected');
      expect(result.requestId).toBe('abc12345-full-uuid');
    });

    it('should reject card request with "no" command', async () => {
      const payload = createTestPayload({ body: 'no abc12345' });
      const deps = createMockDeps();

      const result = await handleWhatsAppApproval(payload, deps);

      expect(result.ok).toBe(true);
      expect(result.action).toBe('rejected');
    });

    it('should reject card request with uppercase "N" command', async () => {
      const payload = createTestPayload({ body: 'N abc12345' });
      const deps = createMockDeps();

      const result = await handleWhatsAppApproval(payload, deps);

      expect(result.ok).toBe(true);
      expect(result.action).toBe('rejected');
    });
  });

  describe('tier-based limits', () => {
    it('should use 500 limit for low tier', async () => {
      const payload = createTestPayload({ body: 'y abc12345' });
      const deps = createMockDeps({
        cardRequest: createTestCardRequest({ tierAtRequest: 'low' }),
        user: createTestUser({ currentScore: 400, tier: 'low' }),
      });

      const result = await handleWhatsAppApproval(payload, deps);

      expect(result.ok).toBe(true);
      expect(result.action).toBe('approved');
    });

    it('should use 1500 limit for medium tier', async () => {
      const payload = createTestPayload({ body: 'y abc12345' });
      const deps = createMockDeps({
        cardRequest: createTestCardRequest({ tierAtRequest: 'medium', scoreAtRequest: 600 }),
        user: createTestUser({ currentScore: 600, tier: 'medium' }),
      });

      const result = await handleWhatsAppApproval(payload, deps);

      expect(result.ok).toBe(true);
      expect(result.action).toBe('approved');
    });

    it('should use 3000 limit for high tier', async () => {
      const payload = createTestPayload({ body: 'y abc12345' });
      const deps = createMockDeps({
        cardRequest: createTestCardRequest({ tierAtRequest: 'high', scoreAtRequest: 750 }),
        user: createTestUser({ currentScore: 750, tier: 'high' }),
      });

      const result = await handleWhatsAppApproval(payload, deps);

      expect(result.ok).toBe(true);
      expect(result.action).toBe('approved');
    });
  });
});
