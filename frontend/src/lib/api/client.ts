// Prefer explicit API URL, otherwise default to local backend.
// Note: this frontend is a dev/demo app and the backend defaults to port 3000.
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

export interface ApiError {
  message: string;
  statusCode: number;
}

export class ApiClientError extends Error {
  constructor(
    message: string,
    public statusCode: number
  ) {
    super(message);
    this.name = 'ApiClientError';
  }
}

// Generate unique idempotency key
function generateIdempotencyKey(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

export async function apiClient<T>(
  endpoint: string,
  options: RequestInit & {
    token?: string;
    idempotencyKey?: string;
    /**
     * Treat these HTTP status codes as successful responses (useful for endpoints that
     * deliberately return non-2xx statuses for control flow, e.g. confirmation-required flows).
     */
    acceptedStatusCodes?: number[];
  } = {}
): Promise<T> {
  const { token, idempotencyKey, acceptedStatusCodes, ...fetchOptions } = options;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  if (idempotencyKey) {
    headers['Idempotency-Key'] = idempotencyKey;
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...fetchOptions,
    headers: {
      ...headers,
      ...((options.headers as Record<string, string>) || {}),
    },
  });

  const accepted = new Set<number>(acceptedStatusCodes ?? []);

  if (!response.ok && !accepted.has(response.status)) {
    const contentType = response.headers.get('content-type') ?? '';
    const errorData = contentType.includes('application/json')
      ? await response.json().catch(() => ({}))
      : await response.text().catch(() => '');

    const message =
      (typeof errorData === 'object' &&
        errorData !== null &&
        // backend standard shape: { error: { message } }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (((errorData as any).error?.message as string | undefined) ||
          // legacy/alternate shape: { message }
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ((errorData as any).message as string | undefined))) ||
      (typeof errorData === 'string' && errorData.trim().length > 0 ? errorData : undefined) ||
      `API Error: ${response.status}`;

    throw new ApiClientError(message, response.status);
  }

  return response.json();
}

import type {
  Card,
  CardRequest,
  Dashboard,
  Offer,
  Score,
  Transaction,
  User,
} from '@/types';

export type { Card, CardRequest, Dashboard, Offer, Score, Transaction, User };

// API methods matching actual backend (see LOCAL_TESTING_GUIDE.md)
export const api = {
  // Health check
  health: () => apiClient<{ status: string }>('/health/liveness'),


  // User endpoints
  users: {
    // Create user (idempotent - uses token claims for identity)
    // Don't send email in body - backend uses email from token
    create: (token: string) =>
      apiClient<{ user: User; created: boolean }>('/v1/users', {
        method: 'POST',
        body: JSON.stringify({}),
        token,
      }),

    // Create a user with a specific ecosystemId/role by generating a mock token for them.
    // This is useful for admin tools that need to ensure a target user exists before lookup.
    ensureExists: async (ecosystemId: string, role: 'user' | 'admin' = 'user'): Promise<User> => {
      // Generate a mock token for the target user with consistent email format
      const email = `${ecosystemId}@test.local`;
      const payload = { ecosystemId, role, email };
      const base64Payload = btoa(JSON.stringify(payload));
      const mockToken = `mock.${base64Payload}.sig`;

      // Don't send email in body - backend will use email from token
      const res = await apiClient<{ user: User; created: boolean }>('/v1/users', {
        method: 'POST',
        body: JSON.stringify({}),
        token: mockToken,
      });
      return res.user;
    },
  },

  // Dashboard
  dashboard: {
    get: (token: string) => apiClient<Dashboard>('/v1/dashboard', { token }),
  },

  // Offers
  offers: {
    list: (token: string) => apiClient<{ offers: Offer[] }>('/v1/offers', { token }),
  },

  // Card endpoints
  cards: {
    list: (token: string) => apiClient<{ cards: Card[] }>('/v1/cards', { token }),

    get: (cardId: string, token: string) => apiClient<{ card: Card }>(`/v1/cards/${cardId}`, { token }),

    request: (productId: string, token: string) =>
      apiClient<{ request: CardRequest }>('/v1/cards/requests', {
        method: 'POST',
        body: JSON.stringify({ productId }),
        token,
        idempotencyKey: generateIdempotencyKey('card-req'),
      }),

    // Transactions
    getTransactions: (cardId: string, token: string) =>
      apiClient<{ transactions: Transaction[] }>(`/v1/cards/${cardId}/transactions`, { token }),

    purchase: (cardId: string, data: { amount: number; merchant: string; category?: string }, token: string) =>
      apiClient<{ transaction: Transaction; card: Card }>(`/v1/cards/${cardId}/transactions/purchases`, {
        method: 'POST',
        body: JSON.stringify(data),
        token,
        idempotencyKey: generateIdempotencyKey('purchase'),
      }),

    payment: (cardId: string, data: { amount: number; source?: string }, token: string) =>
      apiClient<{ transaction: Transaction; card: Card }>(`/v1/cards/${cardId}/transactions/payments`, {
        method: 'POST',
        body: JSON.stringify(data),
        token,
        idempotencyKey: generateIdempotencyKey('payment'),
      }),
  },

  // Admin endpoints
  admin: {
    // Card requests
    getPendingRequests: (token: string) =>
      apiClient<{ requests: CardRequest[] }>('/v1/admin/card-requests', { token }),

    approveRequest: (requestId: string, creditLimit: number, token: string) =>
      apiClient<{ request: CardRequest }>(`/v1/admin/card-requests/${requestId}/approve`, {
        method: 'POST',
        body: JSON.stringify({ creditLimit }),
        token,
        idempotencyKey: generateIdempotencyKey(`approve-${requestId}`),
      }),

    rejectRequest: (requestId: string, reason: string, token: string) =>
      apiClient<{ request: CardRequest }>(`/v1/admin/card-requests/${requestId}/reject`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
        token,
        idempotencyKey: generateIdempotencyKey(`reject-${requestId}`),
      }),

    // User score
    // Backend returns { user: { ecosystemId, currentScore, tier, ... }, history: [...] }
    // We map it to { score: { ecosystemId, score, tier } } for frontend compatibility
    getUserScore: async (ecosystemId: string, token: string): Promise<{ score: Score }> => {
      const res = await apiClient<{ user: { ecosystemId: string; currentScore: number; tier: string } }>(
        `/v1/admin/users/${ecosystemId}/score`,
        { token }
      );
      return {
        score: {
          ecosystemId: res.user.ecosystemId,
          score: res.user.currentScore,
          tier: res.user.tier,
        },
      };
    },

    adjustScore: async (
      ecosystemId: string,
      data: { score: number; reason: string },
      token: string
    ): Promise<{ score: Score }> => {
      const res = await apiClient<{ user: { ecosystemId: string; currentScore: number; tier: string } }>(
        `/v1/admin/users/${ecosystemId}/score`,
        {
          method: 'PATCH',
          body: JSON.stringify(data),
          token,
          idempotencyKey: generateIdempotencyKey('score'),
        }
      );
      return {
        score: {
          ecosystemId: res.user.ecosystemId,
          score: res.user.currentScore,
          tier: res.user.tier,
        },
      };
    },

    // Cleanup (two-step)
    requestCleanup: (token: string) =>
      // Backend returns 400 with a confirmationToken on first call (confirmation required).
      apiClient<{ message: string; confirmationToken: string; expiresAt: string }>('/v1/admin/cleanup', {
        method: 'POST',
        body: JSON.stringify({}),
        token,
        acceptedStatusCodes: [400],
      }),

    confirmCleanup: (confirmationToken: string, token: string) =>
      apiClient<{
        status: 'completed';
        deletedCounts: {
          users: number;
          cards: number;
          transactions: number;
          cardRequests: number;
          events: number;
        };
        duration: string;
      }>('/v1/admin/cleanup', {
        method: 'POST',
        body: JSON.stringify({ confirmationToken }),
        token,
      }),
  },
};
