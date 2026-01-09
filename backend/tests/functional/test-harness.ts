/**
 * Test Harness for Functional Tests
 *
 * Re-exports contract test utilities and adds functional test helpers.
 * Use this module to set up end-to-end flow tests.
 */

// Re-export contract test utilities
export {
  startTestServer,
  stopTestServer,
  createMockAuthHeader,
  generateIdempotencyKey,
  isValidISODate,
  isValidUUID,
} from '../contract/test-utils';

export {
  createMockContainer,
  createTestUser,
  createTestCard,
  createTestTransaction,
  getUserRepo,
  getCardRepo,
  getTransactionRepo,
  getCardRequestRepo,
  resetMockContainer,
} from '../contract/mock-container';

export { createApp } from '../../src/api/app';
export { createContainer } from '../../src/infrastructure/di/container';

/**
 * Generate a unique idempotency key for functional tests
 */
export function functionalIdempotencyKey(prefix = 'functional'): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/**
 * Wait for a specified duration (useful for async operations)
 */
export function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Create admin auth headers
 */
export function createAdminAuthHeader(): Record<string, string> {
  const adminKey = process.env.ADMIN_API_KEY;
  return {
    'X-Admin-Key': adminKey !== undefined && adminKey !== '' ? adminKey : 'test-admin-key',
  };
}

/**
 * Helper to perform complete card request flow
 */
export interface CardRequestFlowResult {
  requestId: string;
  status: 'pending' | 'approved' | 'rejected';
  cardId?: string;
}

/**
 * Perform a complete card request through the API
 */
export async function performCardRequest(
  baseUrl: string,
  ecosystemId: string,
  productId = 'prod-standard'
): Promise<CardRequestFlowResult> {
  const { createMockAuthHeader: createAuth } = await import('../contract/test-utils');

  const response = await fetch(`${baseUrl}/v1/cards/requests`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: createAuth(ecosystemId),
      'Idempotency-Key': functionalIdempotencyKey('card-request'),
    },
    body: JSON.stringify({ productId }),
  });

  if (!response.ok) {
    throw new Error(`Card request failed: ${response.status}`);
  }

  const body = await response.json();

  return {
    requestId: body.request.requestId,
    status: body.request.status,
    cardId: body.request.card?.cardId,
  };
}

/**
 * Perform a purchase transaction through the API
 */
export async function performPurchase(
  baseUrl: string,
  ecosystemId: string,
  cardId: string,
  amount: number,
  description = 'Test purchase'
): Promise<{ transactionId: string; newBalance: number }> {
  const { createMockAuthHeader: createAuth } = await import('../contract/test-utils');

  const response = await fetch(`${baseUrl}/v1/cards/${cardId}/transactions/purchase`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: createAuth(ecosystemId),
      'Idempotency-Key': functionalIdempotencyKey('purchase'),
    },
    body: JSON.stringify({ amount, description }),
  });

  if (!response.ok) {
    throw new Error(`Purchase failed: ${response.status}`);
  }

  const body = await response.json();

  return {
    transactionId: body.transaction.transactionId,
    newBalance: body.card?.balance ?? 0,
  };
}

/**
 * Perform a payment transaction through the API
 */
export async function performPayment(
  baseUrl: string,
  ecosystemId: string,
  cardId: string,
  amount: number,
  source = 'bank_transfer'
): Promise<{ transactionId: string; newBalance: number }> {
  const { createMockAuthHeader: createAuth } = await import('../contract/test-utils');

  const response = await fetch(`${baseUrl}/v1/cards/${cardId}/transactions/payment`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: createAuth(ecosystemId),
      'Idempotency-Key': functionalIdempotencyKey('payment'),
    },
    body: JSON.stringify({ amount, source }),
  });

  if (!response.ok) {
    throw new Error(`Payment failed: ${response.status}`);
  }

  const body = await response.json();

  return {
    transactionId: body.transaction.transactionId,
    newBalance: body.card?.balance ?? 0,
  };
}

/**
 * Admin approve a pending card request
 */
export async function adminApproveRequest(
  baseUrl: string,
  requestId: string,
  reason = 'Approved by functional test'
): Promise<{ cardId: string }> {
  const response = await fetch(`${baseUrl}/v1/admin/requests/${requestId}/approve`, {
    method: 'POST',
    headers: {
      ...createAdminAuthHeader(),
      'Content-Type': 'application/json',
      'Idempotency-Key': functionalIdempotencyKey('admin-approve'),
    },
    body: JSON.stringify({ reason }),
  });

  if (!response.ok) {
    throw new Error(`Admin approval failed: ${response.status}`);
  }

  const body = await response.json();

  return {
    cardId: body.request.card.cardId,
  };
}

/**
 * Admin reject a pending card request
 */
export async function adminRejectRequest(
  baseUrl: string,
  requestId: string,
  reason = 'Rejected by functional test'
): Promise<void> {
  const response = await fetch(`${baseUrl}/v1/admin/requests/${requestId}/reject`, {
    method: 'POST',
    headers: {
      ...createAdminAuthHeader(),
      'Content-Type': 'application/json',
      'Idempotency-Key': functionalIdempotencyKey('admin-reject'),
    },
    body: JSON.stringify({ reason }),
  });

  if (!response.ok) {
    throw new Error(`Admin rejection failed: ${response.status}`);
  }
}
