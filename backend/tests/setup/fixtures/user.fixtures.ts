/**
 * User Test Fixtures
 *
 * Provides consistent user data for testing across all backends.
 */

import { v4 as uuidv4 } from 'uuid';
import { createUser, type User, type UserTier } from '../../../src/domain/entities/user.entity.js';

export interface UserFixtureOptions {
  ecosystemId?: string;
  firebaseUid?: string;
  email?: string;
  role?: 'user' | 'admin';
  score?: number;
  tier?: UserTier;
}

/**
 * Create a test user with sensible defaults
 */
export function createTestUser(options: UserFixtureOptions = {}): User {
  const score = options.score ?? 500;
  const tier: UserTier = options.tier ?? deriveTierFromScore(score);
  const ecosystemId = options.ecosystemId ?? `eco-${uuidv4().slice(0, 8)}`;

  // Create base user with defaults
  const user = createUser({
    firebaseUid: options.firebaseUid ?? `firebase-${uuidv4().slice(0, 8)}`,
    email: options.email ?? `test-${ecosystemId}@example.com`,
    role: options.role ?? 'user',
    ecosystemId,
  });

  // Override score and tier (createUser always uses 500/medium)
  user.currentScore = score;
  user.tier = tier;

  return user;
}

function deriveTierFromScore(score: number): UserTier {
  if (score >= 700) return 'high';
  if (score >= 500) return 'medium';
  return 'low';
}

/**
 * Pre-built user fixture variants for common test scenarios
 */
export const userFixtures = {
  /** Low-tier user (score 400, needs manual approval) */
  lowTierUser: (overrides?: Partial<UserFixtureOptions>) =>
    createTestUser({ score: 400, ...overrides }),

  /** Medium-tier user (score 550, default tier) */
  mediumTierUser: (overrides?: Partial<UserFixtureOptions>) =>
    createTestUser({ score: 550, ...overrides }),

  /** High-tier user (score 750, auto-approval eligible) */
  highTierUser: (overrides?: Partial<UserFixtureOptions>) =>
    createTestUser({ score: 750, ...overrides }),

  /** Admin user with high score */
  adminUser: (overrides?: Partial<UserFixtureOptions>) =>
    createTestUser({ role: 'admin', score: 800, ...overrides }),

  /** User at exact low/medium boundary (score 500) */
  boundaryMediumUser: (overrides?: Partial<UserFixtureOptions>) =>
    createTestUser({ score: 500, ...overrides }),

  /** User at exact medium/high boundary (score 700) */
  boundaryHighUser: (overrides?: Partial<UserFixtureOptions>) =>
    createTestUser({ score: 700, ...overrides }),

  /** User with minimum score */
  minScoreUser: (overrides?: Partial<UserFixtureOptions>) =>
    createTestUser({ score: 0, ...overrides }),

  /** User with maximum score */
  maxScoreUser: (overrides?: Partial<UserFixtureOptions>) =>
    createTestUser({ score: 1000, ...overrides }),
};
