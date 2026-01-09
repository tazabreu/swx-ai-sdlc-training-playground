/**
 * User Entity
 *
 * A person who interacts with the financial system.
 * Central entity that owns all other resources.
 *
 * Firestore Path: users/{ecosystemId}
 */

import { v7 as uuidv7 } from 'uuid';

/**
 * User role in the system
 */
export type UserRole = 'user' | 'admin';

/**
 * User account status
 */
export type UserStatus = 'active' | 'disabled';

/**
 * User tier based on credit score
 * - high: ≥700 (premium limits, guaranteed auto-approval)
 * - medium: 500-699 (standard limits, auto-approval)
 * - low: <500 (requires admin review)
 */
export type UserTier = 'high' | 'medium' | 'low';

/**
 * Summary of user's card holdings (denormalized for fast dashboard)
 */
export interface CardSummary {
  activeCards: number;
  totalBalance: number;
  totalLimit: number;
}

/**
 * User entity representing a person in the financial system
 */
export interface User {
  // Identity
  ecosystemId: string; // Primary key (stable across products, UUID v7)
  firebaseUid: string; // Firebase Auth UID
  email: string; // From Firebase Auth

  // Role & Status
  role: UserRole;
  status: UserStatus;

  // Score (denormalized for fast dashboard)
  currentScore: number; // 0-1000
  tier: UserTier;

  // Dashboard Summary (denormalized)
  cardSummary: CardSummary;

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt: Date;
}

/**
 * Input for creating a new user
 */
export interface CreateUserInput {
  ecosystemId?: string;
  firebaseUid: string;
  email: string;
  role?: UserRole;
}

/**
 * Derive tier from score
 * - high: ≥700
 * - medium: 500-699
 * - low: <500
 */
export function deriveTier(score: number): UserTier {
  if (score >= 700) return 'high';
  if (score >= 500) return 'medium';
  return 'low';
}

/**
 * Create a new user with default values
 * - Initial score: 500 (medium tier)
 * - Status: active
 * - Role: user (admin via Firebase custom claim)
 */
export function createUser(input: CreateUserInput): User {
  const now = new Date();
  const initialScore = 500;

  return {
    ecosystemId: input.ecosystemId ?? uuidv7(),
    firebaseUid: input.firebaseUid,
    email: input.email,
    role: input.role ?? 'user',
    status: 'active',
    currentScore: initialScore,
    tier: deriveTier(initialScore),
    cardSummary: {
      activeCards: 0,
      totalBalance: 0,
      totalLimit: 0,
    },
    createdAt: now,
    updatedAt: now,
    lastLoginAt: now,
  };
}

/**
 * Type guard to check if value is a User
 */
export function isUser(value: unknown): value is User {
  if (typeof value !== 'object' || value === null) return false;

  const user = value as Record<string, unknown>;

  return (
    typeof user.ecosystemId === 'string' &&
    typeof user.firebaseUid === 'string' &&
    typeof user.email === 'string' &&
    (user.role === 'user' || user.role === 'admin') &&
    (user.status === 'active' || user.status === 'disabled') &&
    typeof user.currentScore === 'number' &&
    (user.tier === 'high' || user.tier === 'medium' || user.tier === 'low') &&
    typeof user.cardSummary === 'object' &&
    user.cardSummary !== null &&
    user.createdAt instanceof Date &&
    user.updatedAt instanceof Date &&
    user.lastLoginAt instanceof Date
  );
}

/**
 * Validate user data
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateUser(user: User): ValidationResult {
  const errors: string[] = [];

  // Validate ecosystemId (should be UUID-like)
  if (user.ecosystemId.length === 0) {
    errors.push('ecosystemId is required');
  }

  // Validate firebaseUid
  if (user.firebaseUid.length === 0) {
    errors.push('firebaseUid is required');
  }

  // Validate email format (basic check)
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(user.email)) {
    errors.push('email must be a valid email format');
  }

  // Validate score range
  if (user.currentScore < 0 || user.currentScore > 1000) {
    errors.push('currentScore must be between 0 and 1000');
  }

  // Validate score is an integer
  if (!Number.isInteger(user.currentScore)) {
    errors.push('currentScore must be an integer');
  }

  // Validate tier matches score
  const expectedTier = deriveTier(user.currentScore);
  if (user.tier !== expectedTier) {
    errors.push(`tier should be '${expectedTier}' for score ${user.currentScore}`);
  }

  // Validate cardSummary
  if (user.cardSummary.activeCards < 0) {
    errors.push('activeCards cannot be negative');
  }
  if (user.cardSummary.totalBalance < 0) {
    errors.push('totalBalance cannot be negative');
  }
  if (user.cardSummary.totalLimit < 0) {
    errors.push('totalLimit cannot be negative');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
