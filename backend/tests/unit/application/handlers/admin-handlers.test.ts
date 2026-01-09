/**
 * Admin Handlers Unit Tests
 *
 * T062: Tests for admin handler orchestration logic.
 */

import { describe, it, expect } from 'bun:test';
import {
  handleAdminApproveCard,
  AdminApproveCardError,
  type AdminApproveCardHandlerDeps,
} from '../../../../src/application/handlers/admin-approve-card.handler.js';
import {
  handleAdminRejectCard,
  AdminRejectCardError,
  type AdminRejectCardHandlerDeps,
} from '../../../../src/application/handlers/admin-reject-card.handler.js';
import {
  handleAdminAdjustScore,
  AdminAdjustScoreError,
  type AdminAdjustScoreHandlerDeps,
} from '../../../../src/application/handlers/admin-adjust-score.handler.js';
import type { AdminApproveCardCommand } from '../../../../src/application/commands/admin-approve-card.command.js';
import type { AdminRejectCardCommand } from '../../../../src/application/commands/admin-reject-card.command.js';
import type { AdminAdjustScoreCommand } from '../../../../src/application/commands/admin-adjust-score.command.js';
import type { User } from '../../../../src/domain/entities/user.entity.js';
import type { CardRequest } from '../../../../src/domain/entities/card-request.entity.js';
import type { Card } from '../../../../src/domain/entities/card.entity.js';
import type { Event } from '../../../../src/domain/entities/event.entity.js';
import type { AuditLogEntry } from '../../../../src/domain/entities/audit-log.entity.js';

/**
 * Create mock user
 */
function createTestUser(score: number = 600): User {
  const tier = score >= 700 ? 'high' : score >= 500 ? 'medium' : 'low';
  return {
    ecosystemId: 'test-user-123',
    firebaseUid: 'firebase-123',
    email: 'test@example.com',
    role: 'user',
    status: 'active',
    currentScore: score,
    tier,
    cardSummary: { activeCards: 0, totalBalance: 0, totalLimit: 0 },
    createdAt: new Date(),
    updatedAt: new Date(),
    lastLoginAt: new Date(),
  };
}

/**
 * Create mock pending request
 */
function createTestRequest(status: 'pending' | 'approved' | 'rejected' = 'pending'): CardRequest {
  return {
    requestId: 'request-123',
    status,
    idempotencyKey: 'key-123',
    scoreAtRequest: 400,
    tierAtRequest: 'low',
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

describe('AdminApproveCardHandler', () => {
  function createMockDeps(
    overrides: Partial<{
      user: User | null;
      request: CardRequest | null;
      cards: Card[];
    }> = {}
  ): AdminApproveCardHandlerDeps {
    const savedEvents: Event[] = [];
    const savedAuditLogs: AuditLogEntry[] = [];

    return {
      userRepository: {
        findById: async () => ('user' in overrides ? overrides.user : createTestUser(400)),
        findBySlug: async () => null,
        findByFirebaseUid: async () => null,
        save: async () => {},
        updateScore: async () => {},
        updateCardSummary: async () => {},
        deleteAll: async () => 0,
      },
      cardRepository: {
        findById: async () => null,
        findByUser: async () => overrides.cards ?? [],
        save: async () => {},
        updateBalance: async () => {},
        updateStatus: async () => {},
      },
      cardRequestRepository: {
        findById: async () => ('request' in overrides ? overrides.request : createTestRequest()),
        findPendingByUser: async () => null,
        findRejectedByUser: async () => [],
        findPendingForAdmin: async () => [],
        save: async () => {},
        updateStatus: async () => {},
        updateDecision: async () => {},
      },
      outboxRepository: {
        save: async (event: Event) => {
          savedEvents.push(event);
        },
        findPending: async () => [],
        markPublished: async () => {},
        deleteOld: async () => 0,
      },
      auditLogRepository: {
        findByTarget: async () => ({ entries: [], nextCursor: null, hasMore: false }),
        save: async (log: AuditLogEntry) => {
          savedAuditLogs.push(log);
        },
      },
    };
  }

  describe('validation', () => {
    it('should throw VALIDATION_ERROR for missing adminId', async () => {
      const command: AdminApproveCardCommand = {
        ecosystemId: 'test-user-123',
        requestId: 'request-123',
        adminId: '',
        adminEmail: 'admin@example.com',
        limit: 3000,
      };
      const deps = createMockDeps();

      try {
        await handleAdminApproveCard(command, deps);
        expect(true).toBe(false);
      } catch (error) {
        expect((error as AdminApproveCardError).code).toBe('VALIDATION_ERROR');
      }
    });

    it('should throw VALIDATION_ERROR for invalid limit', async () => {
      const command: AdminApproveCardCommand = {
        ecosystemId: 'test-user-123',
        requestId: 'request-123',
        adminId: 'admin-123',
        adminEmail: 'admin@example.com',
        limit: 0,
      };
      const deps = createMockDeps();

      try {
        await handleAdminApproveCard(command, deps);
        expect(true).toBe(false);
      } catch (error) {
        expect((error as AdminApproveCardError).code).toBe('VALIDATION_ERROR');
      }
    });
  });

  describe('request lookup', () => {
    it('should throw USER_NOT_FOUND when user does not exist', async () => {
      const command: AdminApproveCardCommand = {
        ecosystemId: 'non-existent',
        requestId: 'request-123',
        adminId: 'admin-123',
        adminEmail: 'admin@example.com',
        limit: 3000,
      };
      const deps = createMockDeps({ user: null });

      try {
        await handleAdminApproveCard(command, deps);
        expect(true).toBe(false);
      } catch (error) {
        expect((error as AdminApproveCardError).code).toBe('USER_NOT_FOUND');
      }
    });

    it('should throw REQUEST_NOT_FOUND when request does not exist', async () => {
      const command: AdminApproveCardCommand = {
        ecosystemId: 'test-user-123',
        requestId: 'non-existent',
        adminId: 'admin-123',
        adminEmail: 'admin@example.com',
        limit: 3000,
      };
      const deps = createMockDeps({ request: null });

      try {
        await handleAdminApproveCard(command, deps);
        expect(true).toBe(false);
      } catch (error) {
        expect((error as AdminApproveCardError).code).toBe('REQUEST_NOT_FOUND');
      }
    });

    it('should throw REQUEST_NOT_PENDING when request is already approved', async () => {
      const command: AdminApproveCardCommand = {
        ecosystemId: 'test-user-123',
        requestId: 'request-123',
        adminId: 'admin-123',
        adminEmail: 'admin@example.com',
        limit: 3000,
      };
      const deps = createMockDeps({ request: createTestRequest('approved') });

      try {
        await handleAdminApproveCard(command, deps);
        expect(true).toBe(false);
      } catch (error) {
        expect((error as AdminApproveCardError).code).toBe('REQUEST_NOT_PENDING');
      }
    });
  });

  describe('successful approval', () => {
    it('should approve request and create card', async () => {
      const command: AdminApproveCardCommand = {
        ecosystemId: 'test-user-123',
        requestId: 'request-123',
        adminId: 'admin-123',
        adminEmail: 'admin@example.com',
        limit: 2000, // Max for low tier (score 400)
        reason: 'Approved after review',
      };
      const deps = createMockDeps();

      const result = await handleAdminApproveCard(command, deps);

      expect(result.success).toBe(true);
      expect(result.cardId).toBeDefined();
      expect(result.limit).toBe(2000);
      expect(result.message).toContain('approved');
    });
  });
});

describe('AdminRejectCardHandler', () => {
  function createMockDeps(
    overrides: Partial<{
      user: User | null;
      request: CardRequest | null;
    }> = {}
  ): AdminRejectCardHandlerDeps {
    return {
      userRepository: {
        findById: async () => ('user' in overrides ? overrides.user : createTestUser(400)),
        findBySlug: async () => null,
        findByFirebaseUid: async () => null,
        save: async () => {},
        updateScore: async () => {},
        updateCardSummary: async () => {},
        deleteAll: async () => 0,
      },
      cardRequestRepository: {
        findById: async () => ('request' in overrides ? overrides.request : createTestRequest()),
        findPendingByUser: async () => null,
        findRejectedByUser: async () => [],
        findPendingForAdmin: async () => [],
        save: async () => {},
        updateStatus: async () => {},
        updateDecision: async () => {},
      },
      outboxRepository: {
        save: async () => {},
        findPending: async () => [],
        markPublished: async () => {},
        deleteOld: async () => 0,
      },
      auditLogRepository: {
        findByTarget: async () => ({ entries: [], nextCursor: null, hasMore: false }),
        save: async () => {},
      },
    };
  }

  describe('validation', () => {
    it('should throw VALIDATION_ERROR for missing reason', async () => {
      const command: AdminRejectCardCommand = {
        ecosystemId: 'test-user-123',
        requestId: 'request-123',
        adminId: 'admin-123',
        adminEmail: 'admin@example.com',
        reason: '',
      };
      const deps = createMockDeps();

      try {
        await handleAdminRejectCard(command, deps);
        expect(true).toBe(false);
      } catch (error) {
        expect((error as AdminRejectCardError).code).toBe('VALIDATION_ERROR');
      }
    });
  });

  describe('successful rejection', () => {
    it('should reject request with reason', async () => {
      const command: AdminRejectCardCommand = {
        ecosystemId: 'test-user-123',
        requestId: 'request-123',
        adminId: 'admin-123',
        adminEmail: 'admin@example.com',
        reason: 'Insufficient documentation',
      };
      const deps = createMockDeps();

      const result = await handleAdminRejectCard(command, deps);

      expect(result.success).toBe(true);
      expect(result.requestId).toBe('request-123');
      expect(result.reason).toBe('Insufficient documentation');
    });
  });
});

describe('AdminAdjustScoreHandler', () => {
  function createMockDeps(
    overrides: Partial<{
      user: User | null;
    }> = {}
  ): AdminAdjustScoreHandlerDeps {
    return {
      userRepository: {
        findById: async () => ('user' in overrides ? overrides.user : createTestUser(500)),
        findBySlug: async () => null,
        findByFirebaseUid: async () => null,
        save: async () => {},
        updateScore: async () => {},
        updateCardSummary: async () => {},
        deleteAll: async () => 0,
      },
      outboxRepository: {
        save: async () => {},
        findPending: async () => [],
        markPublished: async () => {},
        deleteOld: async () => 0,
      },
      auditLogRepository: {
        findByTarget: async () => ({ entries: [], nextCursor: null, hasMore: false }),
        save: async () => {},
      },
    };
  }

  describe('validation', () => {
    it('should throw VALIDATION_ERROR for score below 0', async () => {
      const command: AdminAdjustScoreCommand = {
        ecosystemId: 'test-user-123',
        adminId: 'admin-123',
        adminEmail: 'admin@example.com',
        newScore: -50,
        reason: 'Test',
      };
      const deps = createMockDeps();

      try {
        await handleAdminAdjustScore(command, deps);
        expect(true).toBe(false);
      } catch (error) {
        expect((error as AdminAdjustScoreError).code).toBe('VALIDATION_ERROR');
      }
    });

    it('should throw VALIDATION_ERROR for score above 1000', async () => {
      const command: AdminAdjustScoreCommand = {
        ecosystemId: 'test-user-123',
        adminId: 'admin-123',
        adminEmail: 'admin@example.com',
        newScore: 1500,
        reason: 'Test',
      };
      const deps = createMockDeps();

      try {
        await handleAdminAdjustScore(command, deps);
        expect(true).toBe(false);
      } catch (error) {
        expect((error as AdminAdjustScoreError).code).toBe('VALIDATION_ERROR');
      }
    });

    it('should throw VALIDATION_ERROR for missing reason', async () => {
      const command: AdminAdjustScoreCommand = {
        ecosystemId: 'test-user-123',
        adminId: 'admin-123',
        adminEmail: 'admin@example.com',
        newScore: 700,
        reason: '',
      };
      const deps = createMockDeps();

      try {
        await handleAdminAdjustScore(command, deps);
        expect(true).toBe(false);
      } catch (error) {
        expect((error as AdminAdjustScoreError).code).toBe('VALIDATION_ERROR');
      }
    });
  });

  describe('user lookup', () => {
    it('should throw USER_NOT_FOUND when user does not exist', async () => {
      const command: AdminAdjustScoreCommand = {
        ecosystemId: 'non-existent',
        adminId: 'admin-123',
        adminEmail: 'admin@example.com',
        newScore: 700,
        reason: 'Account review',
      };
      const deps = createMockDeps({ user: null });

      try {
        await handleAdminAdjustScore(command, deps);
        expect(true).toBe(false);
      } catch (error) {
        expect((error as AdminAdjustScoreError).code).toBe('USER_NOT_FOUND');
      }
    });
  });

  describe('successful adjustment', () => {
    it('should adjust score and update tier', async () => {
      const command: AdminAdjustScoreCommand = {
        ecosystemId: 'test-user-123',
        adminId: 'admin-123',
        adminEmail: 'admin@example.com',
        newScore: 750,
        reason: 'Account review - good history',
      };
      const deps = createMockDeps({ user: createTestUser(500) });

      const result = await handleAdminAdjustScore(command, deps);

      expect(result.success).toBe(true);
      expect(result.previousScore).toBe(500);
      expect(result.newScore).toBe(750);
      expect(result.previousTier).toBe('medium');
      expect(result.newTier).toBe('high');
    });
  });
});
