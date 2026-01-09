import { describe, it, expect } from 'bun:test';
import {
  createUser,
  isUser,
  validateUser,
  deriveTier,
  type User,
  type CreateUserInput,
} from '../../../../src/domain/entities/user.entity';

describe('User Entity', () => {
  describe('deriveTier', () => {
    it('should return high tier for score >= 700', () => {
      expect(deriveTier(700)).toBe('high');
      expect(deriveTier(850)).toBe('high');
      expect(deriveTier(1000)).toBe('high');
    });

    it('should return medium tier for score 500-699', () => {
      expect(deriveTier(500)).toBe('medium');
      expect(deriveTier(600)).toBe('medium');
      expect(deriveTier(699)).toBe('medium');
    });

    it('should return low tier for score < 500', () => {
      expect(deriveTier(499)).toBe('low');
      expect(deriveTier(300)).toBe('low');
      expect(deriveTier(0)).toBe('low');
    });

    it('should handle exact boundary at 500', () => {
      expect(deriveTier(499)).toBe('low');
      expect(deriveTier(500)).toBe('medium');
    });

    it('should handle exact boundary at 700', () => {
      expect(deriveTier(699)).toBe('medium');
      expect(deriveTier(700)).toBe('high');
    });
  });

  describe('createUser', () => {
    const validInput: CreateUserInput = {
      firebaseUid: 'firebase-123',
      email: 'test@example.com',
    };

    it('should create a user with default values', () => {
      const user = createUser(validInput);

      expect(user.firebaseUid).toBe('firebase-123');
      expect(user.email).toBe('test@example.com');
      expect(user.role).toBe('user');
      expect(user.status).toBe('active');
      expect(user.currentScore).toBe(500);
      expect(user.tier).toBe('medium');
      expect(user.cardSummary.activeCards).toBe(0);
      expect(user.cardSummary.totalBalance).toBe(0);
      expect(user.cardSummary.totalLimit).toBe(0);
    });

    it('should generate a unique ecosystemId', () => {
      const user1 = createUser(validInput);
      const user2 = createUser(validInput);

      expect(user1.ecosystemId).toBeTruthy();
      expect(user2.ecosystemId).toBeTruthy();
      expect(user1.ecosystemId).not.toBe(user2.ecosystemId);
    });

    it('should set timestamps', () => {
      const before = new Date();
      const user = createUser(validInput);
      const after = new Date();

      expect(user.createdAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(user.createdAt.getTime()).toBeLessThanOrEqual(after.getTime());
      expect(user.updatedAt.getTime()).toBe(user.createdAt.getTime());
      expect(user.lastLoginAt.getTime()).toBe(user.createdAt.getTime());
    });

    it('should allow specifying admin role', () => {
      const user = createUser({ ...validInput, role: 'admin' });
      expect(user.role).toBe('admin');
    });
  });

  describe('isUser', () => {
    it('should return true for valid user', () => {
      const user = createUser({
        firebaseUid: 'firebase-123',
        email: 'test@example.com',
      });
      expect(isUser(user)).toBe(true);
    });

    it('should return false for null', () => {
      expect(isUser(null)).toBe(false);
    });

    it('should return false for undefined', () => {
      expect(isUser(undefined)).toBe(false);
    });

    it('should return false for non-object', () => {
      expect(isUser('string')).toBe(false);
      expect(isUser(123)).toBe(false);
    });

    it('should return false for object missing required fields', () => {
      expect(isUser({ ecosystemId: '123' })).toBe(false);
    });

    it('should return false for invalid role', () => {
      const user = createUser({
        firebaseUid: 'firebase-123',
        email: 'test@example.com',
      });
      const invalidUser = { ...user, role: 'invalid' };
      expect(isUser(invalidUser)).toBe(false);
    });
  });

  describe('validateUser', () => {
    it('should return valid for correctly created user', () => {
      const user = createUser({
        firebaseUid: 'firebase-123',
        email: 'test@example.com',
      });
      const result = validateUser(user);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should fail validation for empty ecosystemId', () => {
      const user = createUser({
        firebaseUid: 'firebase-123',
        email: 'test@example.com',
      });
      const invalidUser: User = { ...user, ecosystemId: '' };
      const result = validateUser(invalidUser);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('ecosystemId is required');
    });

    it('should fail validation for empty firebaseUid', () => {
      const user = createUser({
        firebaseUid: 'firebase-123',
        email: 'test@example.com',
      });
      const invalidUser: User = { ...user, firebaseUid: '' };
      const result = validateUser(invalidUser);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('firebaseUid is required');
    });

    it('should fail validation for invalid email format', () => {
      const user = createUser({
        firebaseUid: 'firebase-123',
        email: 'test@example.com',
      });
      const invalidUser: User = { ...user, email: 'invalid-email' };
      const result = validateUser(invalidUser);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('email must be a valid email format');
    });

    it('should fail validation for score below 0', () => {
      const user = createUser({
        firebaseUid: 'firebase-123',
        email: 'test@example.com',
      });
      const invalidUser: User = { ...user, currentScore: -1 };
      const result = validateUser(invalidUser);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('currentScore must be between 0 and 1000');
    });

    it('should fail validation for score above 1000', () => {
      const user = createUser({
        firebaseUid: 'firebase-123',
        email: 'test@example.com',
      });
      const invalidUser: User = { ...user, currentScore: 1001 };
      const result = validateUser(invalidUser);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('currentScore must be between 0 and 1000');
    });

    it('should fail validation for non-integer score', () => {
      const user = createUser({
        firebaseUid: 'firebase-123',
        email: 'test@example.com',
      });
      const invalidUser: User = { ...user, currentScore: 500.5 };
      const result = validateUser(invalidUser);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('currentScore must be an integer');
    });

    it('should fail validation for mismatched tier', () => {
      const user = createUser({
        firebaseUid: 'firebase-123',
        email: 'test@example.com',
      });
      const invalidUser: User = { ...user, currentScore: 700, tier: 'medium' };
      const result = validateUser(invalidUser);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("tier should be 'high'"))).toBe(true);
    });

    it('should fail validation for negative cardSummary values', () => {
      const user = createUser({
        firebaseUid: 'firebase-123',
        email: 'test@example.com',
      });
      const invalidUser: User = {
        ...user,
        cardSummary: { activeCards: -1, totalBalance: 0, totalLimit: 0 },
      };
      const result = validateUser(invalidUser);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('activeCards cannot be negative');
    });
  });
});
