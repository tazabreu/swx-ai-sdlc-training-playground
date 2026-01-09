/**
 * Card Entity
 *
 * A credit card owned by a user.
 *
 * Firestore Path: users/{ecosystemId}/cards/{cardId}
 */

import { v7 as uuidv7 } from 'uuid';

/**
 * Card status
 * - active: Normal use
 * - suspended: Temporarily disabled
 * - cancelled: Permanently closed
 */
export type CardStatus = 'active' | 'suspended' | 'cancelled';

/**
 * Approval source
 */
export type ApprovalSource = 'auto' | 'admin';

/**
 * Card entity representing a credit card
 */
export interface Card {
  cardId: string; // Auto-generated

  // Product Info
  type: 'credit-card'; // Extensible for future products
  productId: string; // References product catalog

  // Status
  status: CardStatus;
  statusReason?: string | undefined; // Reason for rejection/suspension

  // Financial
  limit: number; // Credit limit in dollars
  balance: number; // Current balance owed
  availableCredit: number; // limit - balance (computed, stored for queries)
  minimumPayment: number; // Minimum payment due
  nextDueDate: Date; // Payment due date

  // Concurrency Control
  version: number; // Optimistic locking

  // Approval Context
  approvedBy: ApprovalSource;
  approvedByAdminId?: string | undefined; // If admin-approved
  scoreAtApproval: number; // User's score when approved

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
  activatedAt?: Date | undefined;
  cancelledAt?: Date | undefined;
}

/**
 * Input for creating a new card
 */
export interface CreateCardInput {
  productId?: string;
  limit: number;
  approvedBy: ApprovalSource;
  approvedByAdminId?: string;
  scoreAtApproval: number;
}

/**
 * Create a new card with default values
 */
export function createCard(input: CreateCardInput): Card {
  const now = new Date();

  // Calculate due date (30 days from now)
  const dueDate = new Date(now);
  dueDate.setDate(dueDate.getDate() + 30);

  return {
    cardId: uuidv7(),
    type: 'credit-card',
    productId: input.productId ?? 'default-credit-card',
    status: 'active',
    limit: input.limit,
    balance: 0,
    availableCredit: input.limit, // limit - balance = limit - 0
    minimumPayment: 0,
    nextDueDate: dueDate,
    version: 1,
    approvedBy: input.approvedBy,
    approvedByAdminId: input.approvedByAdminId,
    scoreAtApproval: input.scoreAtApproval,
    createdAt: now,
    updatedAt: now,
    activatedAt: now,
  };
}

/**
 * Type guard to check if value is a Card
 */
export function isCard(value: unknown): value is Card {
  if (typeof value !== 'object' || value === null) return false;

  const card = value as Record<string, unknown>;
  const validStatuses: CardStatus[] = ['active', 'suspended', 'cancelled'];
  const validApprovalSources: ApprovalSource[] = ['auto', 'admin'];

  return (
    typeof card.cardId === 'string' &&
    card.type === 'credit-card' &&
    typeof card.productId === 'string' &&
    validStatuses.includes(card.status as CardStatus) &&
    typeof card.limit === 'number' &&
    typeof card.balance === 'number' &&
    typeof card.availableCredit === 'number' &&
    typeof card.version === 'number' &&
    validApprovalSources.includes(card.approvedBy as ApprovalSource) &&
    typeof card.scoreAtApproval === 'number' &&
    card.createdAt instanceof Date &&
    card.updatedAt instanceof Date
  );
}

/**
 * Validate card data
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateCard(card: Card): ValidationResult {
  const errors: string[] = [];

  // Validate limit range
  if (card.limit < 100 || card.limit > 10000) {
    errors.push('limit must be between 100 and 10000');
  }

  // Validate balance
  if (card.balance < 0) {
    errors.push('balance cannot be negative');
  }
  if (card.balance > card.limit) {
    errors.push('balance cannot exceed limit');
  }

  // Validate availableCredit
  if (card.availableCredit !== card.limit - card.balance) {
    errors.push('availableCredit must equal limit - balance');
  }

  // Validate version
  if (card.version < 1) {
    errors.push('version must be at least 1');
  }

  // Validate admin approval requires adminId
  if (card.approvedBy === 'admin' && card.approvedByAdminId === undefined) {
    errors.push('approvedByAdminId is required for admin approvals');
  }

  // Validate scoreAtApproval
  if (card.scoreAtApproval < 0 || card.scoreAtApproval > 1000) {
    errors.push('scoreAtApproval must be between 0 and 1000');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Card state transition rules
 *
 * Valid transitions:
 * - active → suspended (admin action)
 * - active → cancelled (user request / admin, balance must be $0)
 * - suspended → active (admin action)
 * - suspended → cancelled (admin action)
 */
export interface StateTransitionResult {
  allowed: boolean;
  error?: string;
}

export function canTransitionTo(
  card: Card,
  newStatus: CardStatus,
  options?: { balanceCheck?: boolean }
): StateTransitionResult {
  const { status: currentStatus, balance } = card;

  // Same status - no transition needed
  if (currentStatus === newStatus) {
    return { allowed: true };
  }

  // From cancelled - no transitions allowed
  if (currentStatus === 'cancelled') {
    return { allowed: false, error: 'Cannot transition from cancelled status' };
  }

  // Transition rules
  switch (newStatus) {
    case 'active':
      // Only suspended → active is allowed
      if (currentStatus !== 'suspended') {
        return { allowed: false, error: `Cannot transition from ${currentStatus} to active` };
      }
      return { allowed: true };

    case 'suspended':
      // Only active → suspended is allowed
      if (currentStatus !== 'active') {
        return { allowed: false, error: `Cannot transition from ${currentStatus} to suspended` };
      }
      return { allowed: true };

    case 'cancelled':
      // active → cancelled or suspended → cancelled allowed
      // Balance must be $0 for cancellation
      if (options?.balanceCheck !== false && balance > 0) {
        return { allowed: false, error: 'Balance must be $0 to cancel card' };
      }
      return { allowed: true };

    default:
      return { allowed: false, error: `Unknown status: ${newStatus as string}` };
  }
}

/**
 * Credit limit by tier per spec
 */
export const CREDIT_LIMITS = {
  HIGH: 10000, // Score ≥ 700
  MEDIUM: 5000, // Score 500-699
  LOW: 2000, // Score < 500 (admin approval required)
  MINIMUM: 100,
  MAXIMUM: 10000,
} as const;
