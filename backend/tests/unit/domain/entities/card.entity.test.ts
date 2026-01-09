import { describe, it, expect } from 'bun:test';
import {
  createCard,
  isCard,
  validateCard,
  canTransitionTo,
  CREDIT_LIMITS,
  type Card,
  type CreateCardInput,
} from '../../../../src/domain/entities/card.entity';

describe('Card Entity', () => {
  describe('createCard', () => {
    const validInput: CreateCardInput = {
      limit: 5000,
      approvedBy: 'auto',
      scoreAtApproval: 600,
    };

    it('should create a card with default values', () => {
      const card = createCard(validInput);

      expect(card.type).toBe('credit-card');
      expect(card.status).toBe('active');
      expect(card.limit).toBe(5000);
      expect(card.balance).toBe(0);
      expect(card.availableCredit).toBe(5000);
      expect(card.minimumPayment).toBe(0);
      expect(card.version).toBe(1);
      expect(card.approvedBy).toBe('auto');
      expect(card.scoreAtApproval).toBe(600);
    });

    it('should generate a unique cardId', () => {
      const card1 = createCard(validInput);
      const card2 = createCard(validInput);

      expect(card1.cardId).toBeTruthy();
      expect(card2.cardId).toBeTruthy();
      expect(card1.cardId).not.toBe(card2.cardId);
    });

    it('should set due date 30 days in the future', () => {
      const before = new Date();
      const card = createCard(validInput);

      const expectedMinDate = new Date(before);
      expectedMinDate.setDate(expectedMinDate.getDate() + 30);

      expect(card.nextDueDate.getTime()).toBeGreaterThanOrEqual(expectedMinDate.getTime() - 1000);
    });

    it('should set activatedAt for new active cards', () => {
      const card = createCard(validInput);
      expect(card.activatedAt).toBeDefined();
    });

    it('should allow admin approval with adminId', () => {
      const card = createCard({
        ...validInput,
        approvedBy: 'admin',
        approvedByAdminId: 'admin-123',
      });

      expect(card.approvedBy).toBe('admin');
      expect(card.approvedByAdminId).toBe('admin-123');
    });
  });

  describe('isCard', () => {
    it('should return true for valid card', () => {
      const card = createCard({
        limit: 5000,
        approvedBy: 'auto',
        scoreAtApproval: 600,
      });
      expect(isCard(card)).toBe(true);
    });

    it('should return false for null', () => {
      expect(isCard(null)).toBe(false);
    });

    it('should return false for invalid status', () => {
      const card = createCard({
        limit: 5000,
        approvedBy: 'auto',
        scoreAtApproval: 600,
      });
      const invalidCard = { ...card, status: 'invalid' };
      expect(isCard(invalidCard)).toBe(false);
    });
  });

  describe('validateCard', () => {
    it('should return valid for correctly created card', () => {
      const card = createCard({
        limit: 5000,
        approvedBy: 'auto',
        scoreAtApproval: 600,
      });
      const result = validateCard(card);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should fail for limit below minimum', () => {
      const card = createCard({
        limit: 5000,
        approvedBy: 'auto',
        scoreAtApproval: 600,
      });
      const invalidCard: Card = { ...card, limit: 50, availableCredit: 50 };
      const result = validateCard(invalidCard);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('limit must be between 100 and 10000');
    });

    it('should fail for limit above maximum', () => {
      const card = createCard({
        limit: 5000,
        approvedBy: 'auto',
        scoreAtApproval: 600,
      });
      const invalidCard: Card = { ...card, limit: 15000, availableCredit: 15000 };
      const result = validateCard(invalidCard);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('limit must be between 100 and 10000');
    });

    it('should fail for negative balance', () => {
      const card = createCard({
        limit: 5000,
        approvedBy: 'auto',
        scoreAtApproval: 600,
      });
      const invalidCard: Card = { ...card, balance: -100, availableCredit: 5100 };
      const result = validateCard(invalidCard);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('balance cannot be negative');
    });

    it('should fail for balance exceeding limit', () => {
      const card = createCard({
        limit: 5000,
        approvedBy: 'auto',
        scoreAtApproval: 600,
      });
      const invalidCard: Card = { ...card, balance: 6000, availableCredit: -1000 };
      const result = validateCard(invalidCard);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('balance cannot exceed limit');
    });

    it('should fail for incorrect availableCredit calculation', () => {
      const card = createCard({
        limit: 5000,
        approvedBy: 'auto',
        scoreAtApproval: 600,
      });
      const invalidCard: Card = { ...card, balance: 1000, availableCredit: 5000 };
      const result = validateCard(invalidCard);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('availableCredit must equal limit - balance');
    });

    it('should fail for admin approval without adminId', () => {
      const card = createCard({
        limit: 5000,
        approvedBy: 'admin',
        scoreAtApproval: 600,
      });
      const result = validateCard(card);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('approvedByAdminId is required for admin approvals');
    });
  });

  describe('canTransitionTo', () => {
    const createActiveCard = (): Card =>
      createCard({
        limit: 5000,
        approvedBy: 'auto',
        scoreAtApproval: 600,
      });

    describe('from active status', () => {
      it('should allow transition to suspended', () => {
        const card = createActiveCard();
        const result = canTransitionTo(card, 'suspended');
        expect(result.allowed).toBe(true);
      });

      it('should allow transition to cancelled if balance is zero', () => {
        const card = createActiveCard();
        const result = canTransitionTo(card, 'cancelled');
        expect(result.allowed).toBe(true);
      });

      it('should not allow transition to cancelled if balance > 0', () => {
        const card: Card = { ...createActiveCard(), balance: 100, availableCredit: 4900 };
        const result = canTransitionTo(card, 'cancelled');
        expect(result.allowed).toBe(false);
        expect(result.error).toContain('Balance must be $0');
      });

      it('should allow same status transition', () => {
        const card = createActiveCard();
        const result = canTransitionTo(card, 'active');
        expect(result.allowed).toBe(true);
      });
    });

    describe('from suspended status', () => {
      it('should allow transition to active', () => {
        const card: Card = { ...createActiveCard(), status: 'suspended' };
        const result = canTransitionTo(card, 'active');
        expect(result.allowed).toBe(true);
      });

      it('should allow transition to cancelled', () => {
        const card: Card = { ...createActiveCard(), status: 'suspended' };
        const result = canTransitionTo(card, 'cancelled');
        expect(result.allowed).toBe(true);
      });

      it('should not allow transition to suspended again', () => {
        const card: Card = { ...createActiveCard(), status: 'suspended' };
        const result = canTransitionTo(card, 'suspended');
        expect(result.allowed).toBe(true); // Same status is allowed
      });
    });

    describe('from cancelled status', () => {
      it('should not allow transition to active', () => {
        const card: Card = { ...createActiveCard(), status: 'cancelled' };
        const result = canTransitionTo(card, 'active');
        expect(result.allowed).toBe(false);
        expect(result.error).toContain('Cannot transition from cancelled');
      });

      it('should not allow transition to suspended', () => {
        const card: Card = { ...createActiveCard(), status: 'cancelled' };
        const result = canTransitionTo(card, 'suspended');
        expect(result.allowed).toBe(false);
      });
    });
  });

  describe('CREDIT_LIMITS constants', () => {
    it('should have correct tier limits', () => {
      expect(CREDIT_LIMITS.HIGH).toBe(10000);
      expect(CREDIT_LIMITS.MEDIUM).toBe(5000);
      expect(CREDIT_LIMITS.LOW).toBe(2000);
      expect(CREDIT_LIMITS.MINIMUM).toBe(100);
      expect(CREDIT_LIMITS.MAXIMUM).toBe(10000);
    });
  });
});
