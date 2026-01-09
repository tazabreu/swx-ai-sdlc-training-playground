import { describe, it, expect } from 'bun:test';
import {
  createCardRequest,
  isCardRequest,
  validateCardRequest,
  requiresAttention,
  CARD_REQUEST_RULES,
  type CardRequest,
  type CreateCardRequestInput,
} from '../../../../src/domain/entities/card-request.entity';

describe('CardRequest Entity', () => {
  describe('createCardRequest', () => {
    const validInput: CreateCardRequestInput = {
      idempotencyKey: 'test-key-123',
      scoreAtRequest: 600,
      tierAtRequest: 'medium',
    };

    it('should create a card request with pending status', () => {
      const request = createCardRequest(validInput);

      expect(request.status).toBe('pending');
      expect(request.idempotencyKey).toBe('test-key-123');
      expect(request.scoreAtRequest).toBe(600);
      expect(request.tierAtRequest).toBe('medium');
      expect(request.productId).toBe('default-credit-card');
    });

    it('should generate a unique requestId', () => {
      const request1 = createCardRequest(validInput);
      const request2 = createCardRequest(validInput);

      expect(request1.requestId).toBeTruthy();
      expect(request2.requestId).toBeTruthy();
      expect(request1.requestId).not.toBe(request2.requestId);
    });

    it('should set expiration 7 days in the future', () => {
      const before = new Date();
      const request = createCardRequest(validInput);

      const expectedMinDate = new Date(before);
      expectedMinDate.setDate(expectedMinDate.getDate() + 7);

      expect(request.expiresAt).toBeDefined();
      expect(request.expiresAt!.getTime()).toBeGreaterThanOrEqual(expectedMinDate.getTime() - 1000);
    });

    it('should allow custom productId', () => {
      const request = createCardRequest({
        ...validInput,
        productId: 'premium-card',
      });

      expect(request.productId).toBe('premium-card');
    });
  });

  describe('isCardRequest', () => {
    it('should return true for valid card request', () => {
      const request = createCardRequest({
        idempotencyKey: 'test-key',
        scoreAtRequest: 600,
        tierAtRequest: 'medium',
      });
      expect(isCardRequest(request)).toBe(true);
    });

    it('should return false for null', () => {
      expect(isCardRequest(null)).toBe(false);
    });

    it('should return false for invalid status', () => {
      const request = createCardRequest({
        idempotencyKey: 'test-key',
        scoreAtRequest: 600,
        tierAtRequest: 'medium',
      });
      const invalidRequest = { ...request, status: 'invalid' };
      expect(isCardRequest(invalidRequest)).toBe(false);
    });

    it('should return false for invalid tier', () => {
      const request = createCardRequest({
        idempotencyKey: 'test-key',
        scoreAtRequest: 600,
        tierAtRequest: 'medium',
      });
      const invalidRequest = { ...request, tierAtRequest: 'invalid' };
      expect(isCardRequest(invalidRequest)).toBe(false);
    });
  });

  describe('validateCardRequest', () => {
    it('should return valid for pending request', () => {
      const request = createCardRequest({
        idempotencyKey: 'test-key',
        scoreAtRequest: 600,
        tierAtRequest: 'medium',
      });
      const result = validateCardRequest(request);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should fail for empty idempotencyKey', () => {
      const request = createCardRequest({
        idempotencyKey: '',
        scoreAtRequest: 600,
        tierAtRequest: 'medium',
      });
      const result = validateCardRequest(request);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('idempotencyKey is required');
    });

    it('should fail for idempotencyKey exceeding max length', () => {
      const request = createCardRequest({
        idempotencyKey: 'a'.repeat(65),
        scoreAtRequest: 600,
        tierAtRequest: 'medium',
      });
      const result = validateCardRequest(request);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('idempotencyKey must be at most 64 characters');
    });

    it('should fail for score out of range', () => {
      const request = createCardRequest({
        idempotencyKey: 'test-key',
        scoreAtRequest: 1001,
        tierAtRequest: 'medium',
      });
      const result = validateCardRequest(request);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('scoreAtRequest must be between 0 and 1000');
    });

    it('should fail for approved request without decision', () => {
      const request = createCardRequest({
        idempotencyKey: 'test-key',
        scoreAtRequest: 600,
        tierAtRequest: 'medium',
      });
      const approvedRequest: CardRequest = { ...request, status: 'approved' };
      const result = validateCardRequest(approvedRequest);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('decision is required for non-pending requests');
    });

    it('should fail for approved request without resultingCardId', () => {
      const request = createCardRequest({
        idempotencyKey: 'test-key',
        scoreAtRequest: 600,
        tierAtRequest: 'medium',
      });
      const approvedRequest: CardRequest = {
        ...request,
        status: 'approved',
        decision: {
          outcome: 'approved',
          source: 'auto',
          approvedLimit: 5000,
          decidedAt: new Date(),
        },
      };
      const result = validateCardRequest(approvedRequest);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('resultingCardId is required for approved requests');
    });

    it('should fail for admin decision without adminId', () => {
      const request = createCardRequest({
        idempotencyKey: 'test-key',
        scoreAtRequest: 600,
        tierAtRequest: 'medium',
      });
      const rejectedRequest: CardRequest = {
        ...request,
        status: 'rejected',
        decision: {
          outcome: 'rejected',
          source: 'admin',
          reason: 'Insufficient documentation',
          decidedAt: new Date(),
        },
      };
      const result = validateCardRequest(rejectedRequest);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('adminId is required for admin decisions');
    });
  });

  describe('requiresAttention', () => {
    it('should return false for non-pending requests', () => {
      const request = createCardRequest({
        idempotencyKey: 'test-key',
        scoreAtRequest: 600,
        tierAtRequest: 'medium',
      });
      const approvedRequest: CardRequest = { ...request, status: 'approved' };
      expect(requiresAttention(approvedRequest)).toBe(false);
    });

    it('should return false for recent pending requests', () => {
      const request = createCardRequest({
        idempotencyKey: 'test-key',
        scoreAtRequest: 600,
        tierAtRequest: 'medium',
      });
      expect(requiresAttention(request)).toBe(false);
    });

    it('should return true for pending requests older than 7 days', () => {
      const request = createCardRequest({
        idempotencyKey: 'test-key',
        scoreAtRequest: 600,
        tierAtRequest: 'medium',
      });

      // Set createdAt to 8 days ago
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 8);
      const oldRequest: CardRequest = { ...request, createdAt: oldDate };

      expect(requiresAttention(oldRequest)).toBe(true);
    });
  });

  describe('CARD_REQUEST_RULES constants', () => {
    it('should have correct business rules', () => {
      expect(CARD_REQUEST_RULES.COOLDOWN_DAYS_AFTER_REJECTION).toBe(30);
      expect(CARD_REQUEST_RULES.PENDING_ATTENTION_THRESHOLD_DAYS).toBe(7);
      expect(CARD_REQUEST_RULES.IDEMPOTENCY_KEY_MAX_LENGTH).toBe(64);
    });
  });
});
