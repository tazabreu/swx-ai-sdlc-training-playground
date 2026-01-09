/**
 * Score and Tier Promotion Flow - Functional Test
 *
 * Tests the complete end-to-end flow of score adjustments and tier changes:
 * 1. User starts with a score
 * 2. Admin adjusts score (positive or negative)
 * 3. Tier is recalculated
 * 4. Events are emitted for downstream systems
 */

import { describe, it, expect, beforeEach } from 'bun:test';
import { handleAdminAdjustScore } from '../../../src/application/handlers/admin-adjust-score.handler';
import { deriveTier, type User, type UserTier } from '../../../src/domain/entities/user.entity';
import type { Event } from '../../../src/domain/entities/event.entity';
import type { AuditLogEntry } from '../../../src/domain/entities/audit-log.entity';

interface FlowStore {
  users: Map<string, User>;
  events: Event[];
  auditLogs: AuditLogEntry[];
}

function createFlowStore(): FlowStore {
  return {
    users: new Map(),
    events: [],
    auditLogs: [],
  };
}

function createTestUser(ecosystemId: string, score: number): User {
  const tier: UserTier = deriveTier(score);
  return {
    ecosystemId,
    firebaseUid: `firebase-${ecosystemId}`,
    email: `${ecosystemId}@example.com`,
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

describe('Score and Tier Promotion Flow', () => {
  let store: FlowStore;

  beforeEach(() => {
    store = createFlowStore();
  });

  function createDeps() {
    return {
      userRepository: {
        findById: async (id: string) => store.users.get(id) ?? null,
        findBySlug: async () => null,
        findByFirebaseUid: async () => null,
        save: async () => {},
        updateScore: async (
          id: string,
          score: number,
          _reason: string,
          _source: string,
          _sourceId: string
        ) => {
          const user = store.users.get(id);
          if (user) {
            user.currentScore = score;
            user.tier = deriveTier(score);
            user.updatedAt = new Date();
          }
        },
        updateCardSummary: async () => {},
        deleteAll: async () => 0,
      },
      outboxRepository: {
        save: async (event: Event) => {
          store.events.push(event);
        },
        findPending: async () => [],
        markPublished: async () => {},
        deleteOld: async () => 0,
      },
      auditLogRepository: {
        findByTarget: async () => ({ entries: [], nextCursor: null, hasMore: false }),
        save: async (log: AuditLogEntry) => {
          store.auditLogs.push(log);
        },
      },
    };
  }

  describe('Tier Promotion: Low → Medium → High', () => {
    it('should promote user from low to medium tier', async () => {
      // Setup: User with low tier (score 400)
      const user = createTestUser('user-promote', 400);
      store.users.set(user.ecosystemId, user);

      expect(user.tier).toBe('low');

      // Admin adjusts score to 550 (medium tier threshold is 500)
      const result = await handleAdminAdjustScore(
        {
          ecosystemId: user.ecosystemId,
          adminId: 'admin-001',
          adminEmail: 'admin@company.com',
          newScore: 550,
          reason: 'Good payment history recognized',
        },
        createDeps()
      );

      expect(result.success).toBe(true);
      expect(result.previousScore).toBe(400);
      expect(result.newScore).toBe(550);
      expect(result.previousTier).toBe('low');
      expect(result.newTier).toBe('medium');

      // Verify user was updated in store
      const updatedUser = store.users.get(user.ecosystemId);
      expect(updatedUser?.currentScore).toBe(550);
      expect(updatedUser?.tier).toBe('medium');

      // Verify score change event was emitted
      const scoreEvents = store.events.filter((e) => e.eventType === 'score.changed');
      expect(scoreEvents.length).toBe(1);

      // Verify audit log was created
      expect(store.auditLogs.length).toBe(1);
      expect(store.auditLogs[0].reason).toBe('Good payment history recognized');
    });

    it('should promote user from medium to high tier', async () => {
      // Setup: User with medium tier (score 550)
      const user = createTestUser('user-to-high', 550);
      store.users.set(user.ecosystemId, user);

      expect(user.tier).toBe('medium');

      // Admin adjusts score to 750 (high tier threshold is 700)
      const result = await handleAdminAdjustScore(
        {
          ecosystemId: user.ecosystemId,
          adminId: 'admin-002',
          adminEmail: 'senior-admin@company.com',
          newScore: 750,
          reason: 'Excellent credit behavior - promoted to high tier',
        },
        createDeps()
      );

      expect(result.success).toBe(true);
      expect(result.previousTier).toBe('medium');
      expect(result.newTier).toBe('high');

      const updatedUser = store.users.get(user.ecosystemId);
      expect(updatedUser?.tier).toBe('high');
    });

    it('should handle promotion across two tiers (low → high)', async () => {
      // Setup: User with low tier (score 350)
      const user = createTestUser('user-jump', 350);
      store.users.set(user.ecosystemId, user);

      // Admin adjusts directly to high tier
      const result = await handleAdminAdjustScore(
        {
          ecosystemId: user.ecosystemId,
          adminId: 'admin-003',
          adminEmail: 'admin@company.com',
          newScore: 800,
          reason: 'Manual adjustment - verified external credit history',
        },
        createDeps()
      );

      expect(result.success).toBe(true);
      expect(result.previousTier).toBe('low');
      expect(result.newTier).toBe('high');
      expect(result.newScore).toBe(800);
    });
  });

  describe('Tier Demotion: High → Medium → Low', () => {
    it('should demote user from high to medium tier', async () => {
      // Setup: User with high tier (score 750)
      const user = createTestUser('user-demote', 750);
      store.users.set(user.ecosystemId, user);

      expect(user.tier).toBe('high');

      // Admin adjusts score down to 600 (medium tier)
      const result = await handleAdminAdjustScore(
        {
          ecosystemId: user.ecosystemId,
          adminId: 'admin-001',
          adminEmail: 'admin@company.com',
          newScore: 600,
          reason: 'Late payments - tier adjustment',
        },
        createDeps()
      );

      expect(result.success).toBe(true);
      expect(result.previousTier).toBe('high');
      expect(result.newTier).toBe('medium');

      const updatedUser = store.users.get(user.ecosystemId);
      expect(updatedUser?.tier).toBe('medium');
    });

    it('should demote user from medium to low tier', async () => {
      // Setup: User with medium tier (score 550)
      const user = createTestUser('user-to-low', 550);
      store.users.set(user.ecosystemId, user);

      // Admin adjusts score down to 400 (low tier)
      const result = await handleAdminAdjustScore(
        {
          ecosystemId: user.ecosystemId,
          adminId: 'admin-002',
          adminEmail: 'admin@company.com',
          newScore: 400,
          reason: 'Multiple missed payments',
        },
        createDeps()
      );

      expect(result.success).toBe(true);
      expect(result.previousTier).toBe('medium');
      expect(result.newTier).toBe('low');
    });
  });

  describe('Score Adjustment Within Same Tier', () => {
    it('should adjust score without changing tier', async () => {
      // Setup: User with medium tier (score 550)
      const user = createTestUser('user-same-tier', 550);
      store.users.set(user.ecosystemId, user);

      // Admin adjusts score to 650 (still medium tier)
      const result = await handleAdminAdjustScore(
        {
          ecosystemId: user.ecosystemId,
          adminId: 'admin-001',
          adminEmail: 'admin@company.com',
          newScore: 650,
          reason: 'Good behavior bonus',
        },
        createDeps()
      );

      expect(result.success).toBe(true);
      expect(result.previousScore).toBe(550);
      expect(result.newScore).toBe(650);
      expect(result.previousTier).toBe('medium');
      expect(result.newTier).toBe('medium'); // Same tier

      // Event should still be emitted for score change
      expect(store.events.length).toBe(1);
    });
  });

  describe('Edge Cases', () => {
    it('should handle maximum score (1000)', async () => {
      const user = createTestUser('user-max', 800);
      store.users.set(user.ecosystemId, user);

      const result = await handleAdminAdjustScore(
        {
          ecosystemId: user.ecosystemId,
          adminId: 'admin-001',
          adminEmail: 'admin@company.com',
          newScore: 1000,
          reason: 'Perfect credit score achieved',
        },
        createDeps()
      );

      expect(result.success).toBe(true);
      expect(result.newScore).toBe(1000);
      expect(result.newTier).toBe('high');
    });

    it('should handle minimum score (0)', async () => {
      const user = createTestUser('user-min', 300);
      store.users.set(user.ecosystemId, user);

      const result = await handleAdminAdjustScore(
        {
          ecosystemId: user.ecosystemId,
          adminId: 'admin-001',
          adminEmail: 'admin@company.com',
          newScore: 0,
          reason: 'Account suspended - score reset',
        },
        createDeps()
      );

      expect(result.success).toBe(true);
      expect(result.newScore).toBe(0);
      expect(result.newTier).toBe('low');
    });

    it('should handle exact tier boundary (500 = medium)', async () => {
      const user = createTestUser('user-boundary', 499);
      store.users.set(user.ecosystemId, user);

      const result = await handleAdminAdjustScore(
        {
          ecosystemId: user.ecosystemId,
          adminId: 'admin-001',
          adminEmail: 'admin@company.com',
          newScore: 500,
          reason: 'Reached medium tier threshold',
        },
        createDeps()
      );

      expect(result.success).toBe(true);
      expect(result.previousTier).toBe('low');
      expect(result.newTier).toBe('medium');
    });

    it('should handle exact tier boundary (700 = high)', async () => {
      const user = createTestUser('user-boundary-high', 699);
      store.users.set(user.ecosystemId, user);

      const result = await handleAdminAdjustScore(
        {
          ecosystemId: user.ecosystemId,
          adminId: 'admin-001',
          adminEmail: 'admin@company.com',
          newScore: 700,
          reason: 'Reached high tier threshold',
        },
        createDeps()
      );

      expect(result.success).toBe(true);
      expect(result.previousTier).toBe('medium');
      expect(result.newTier).toBe('high');
    });
  });

  describe('Audit Trail', () => {
    it('should create complete audit trail for score adjustments', async () => {
      const user = createTestUser('user-audit', 500);
      store.users.set(user.ecosystemId, user);

      // Perform multiple adjustments
      await handleAdminAdjustScore(
        {
          ecosystemId: user.ecosystemId,
          adminId: 'admin-001',
          adminEmail: 'admin1@company.com',
          newScore: 600,
          reason: 'First adjustment',
        },
        createDeps()
      );

      await handleAdminAdjustScore(
        {
          ecosystemId: user.ecosystemId,
          adminId: 'admin-002',
          adminEmail: 'admin2@company.com',
          newScore: 750,
          reason: 'Second adjustment',
        },
        createDeps()
      );

      // Verify audit trail
      expect(store.auditLogs.length).toBe(2);
      expect(store.auditLogs[0].adminEcosystemId).toBe('admin-001');
      expect(store.auditLogs[1].adminEcosystemId).toBe('admin-002');

      // Verify events trail
      expect(store.events.length).toBe(2);
    });
  });
});
