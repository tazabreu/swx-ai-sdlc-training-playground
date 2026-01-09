/**
 * InMemory Card Request Repository
 *
 * In-memory implementation for card request storage and retrieval.
 */

/* eslint-disable @typescript-eslint/require-await */

import type {
  ICardRequestRepository,
  PaginationOptions,
  PendingRequestSortOptions,
  PendingRequestFilter,
  PaginatedCardRequests,
  CardRequestWithOwner,
} from '../interfaces/card-request.repository.js';
import type {
  CardRequest,
  CardRequestStatus,
  CardRequestDecision,
} from '../../../domain/entities/card-request.entity.js';

/**
 * InMemory Card Request Repository implementation
 */
export class InMemoryCardRequestRepository implements ICardRequestRepository {
  // Map<ecosystemId, Map<requestId, CardRequest>>
  private requests: Map<string, Map<string, CardRequest>> = new Map();

  async findById(ecosystemId: string, requestId: string): Promise<CardRequest | null> {
    const userRequests = this.requests.get(ecosystemId);
    if (userRequests === undefined) return null;
    return userRequests.get(requestId) ?? null;
  }

  async findPendingByUser(ecosystemId: string): Promise<CardRequest | null> {
    const userRequests = this.requests.get(ecosystemId);
    if (userRequests === undefined) return null;

    for (const request of userRequests.values()) {
      if (request.status === 'pending') {
        return request;
      }
    }
    return null;
  }

  async findAllPending(
    sort?: PendingRequestSortOptions,
    filter?: PendingRequestFilter,
    pagination?: PaginationOptions
  ): Promise<PaginatedCardRequests> {
    // Collect all pending requests with their ecosystemIds
    const allPending: CardRequestWithOwner[] = [];

    for (const [ecosystemId, userRequests] of this.requests.entries()) {
      for (const request of userRequests.values()) {
        if (request.status === 'pending') {
          allPending.push({ ...request, ecosystemId });
        }
      }
    }

    // Apply filters
    let filtered = allPending;
    if (filter?.tier !== undefined) {
      filtered = filtered.filter((r) => r.tierAtRequest === filter.tier);
    }
    if (filter?.minDaysPending !== undefined) {
      const now = new Date();
      filtered = filtered.filter((r) => {
        const daysPending = Math.floor(
          (now.getTime() - r.createdAt.getTime()) / (1000 * 60 * 60 * 24)
        );
        return daysPending >= (filter.minDaysPending ?? 0);
      });
    }

    // Apply sorting
    if (sort !== undefined) {
      filtered.sort((a, b) => {
        let comparison = 0;
        switch (sort.field) {
          case 'createdAt':
            comparison = a.createdAt.getTime() - b.createdAt.getTime();
            break;
          case 'score':
            comparison = a.scoreAtRequest - b.scoreAtRequest;
            break;
          case 'tier': {
            const tierOrder = { high: 3, medium: 2, low: 1 };
            comparison = tierOrder[a.tierAtRequest] - tierOrder[b.tierAtRequest];
            break;
          }
        }
        return sort.order === 'desc' ? -comparison : comparison;
      });
    }

    const totalCount = filtered.length;

    // Apply pagination
    const limit = pagination?.limit ?? 20;
    let startIndex = 0;

    if (pagination?.cursor !== undefined) {
      const cursorIndex = filtered.findIndex((r) => r.requestId === pagination.cursor);
      if (cursorIndex !== -1) {
        startIndex = cursorIndex + 1;
      }
    }

    const paginated = filtered.slice(startIndex, startIndex + limit);
    const hasMore = startIndex + limit < filtered.length;
    const nextCursor = hasMore ? paginated[paginated.length - 1]?.requestId : undefined;

    return {
      requests: paginated,
      totalCount,
      nextCursor,
      hasMore,
    };
  }

  async findRejectedByUser(ecosystemId: string, withinDays?: number): Promise<CardRequest[]> {
    const userRequests = this.requests.get(ecosystemId);
    if (userRequests === undefined) return [];

    const now = new Date();
    const cutoffMs = withinDays !== undefined ? withinDays * 24 * 60 * 60 * 1000 : Infinity;

    const rejected: CardRequest[] = [];
    for (const request of userRequests.values()) {
      if (request.status === 'rejected') {
        const age = now.getTime() - request.updatedAt.getTime();
        if (age <= cutoffMs) {
          rejected.push(request);
        }
      }
    }

    return rejected;
  }

  async save(ecosystemId: string, request: CardRequest): Promise<void> {
    let userRequests = this.requests.get(ecosystemId);
    if (userRequests === undefined) {
      userRequests = new Map();
      this.requests.set(ecosystemId, userRequests);
    }
    userRequests.set(request.requestId, { ...request });
  }

  async updateStatus(
    ecosystemId: string,
    requestId: string,
    status: CardRequestStatus,
    decision: CardRequestDecision,
    resultingCardId?: string
  ): Promise<void> {
    const userRequests = this.requests.get(ecosystemId);
    if (userRequests === undefined) {
      throw new Error(`User not found: ${ecosystemId}`);
    }

    const request = userRequests.get(requestId);
    if (request === undefined) {
      throw new Error(`Request not found: ${requestId}`);
    }

    const updatedRequest: CardRequest =
      resultingCardId !== undefined
        ? {
            ...request,
            status,
            decision,
            resultingCardId,
            updatedAt: new Date(),
          }
        : {
            ...request,
            status,
            decision,
            updatedAt: new Date(),
          };
    userRequests.set(requestId, updatedRequest);
  }

  async delete(ecosystemId: string, requestId: string): Promise<void> {
    const userRequests = this.requests.get(ecosystemId);
    if (userRequests !== undefined) {
      userRequests.delete(requestId);
    }
  }

  async deleteAllForUser(ecosystemId: string): Promise<number> {
    const userRequests = this.requests.get(ecosystemId);
    if (userRequests === undefined) return 0;
    const count = userRequests.size;
    this.requests.delete(ecosystemId);
    return count;
  }

  async countRequiringAttention(): Promise<number> {
    const now = new Date();
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    let count = 0;

    for (const userRequests of this.requests.values()) {
      for (const request of userRequests.values()) {
        if (request.status === 'pending') {
          const age = now.getTime() - request.createdAt.getTime();
          if (age >= sevenDaysMs) {
            count++;
          }
        }
      }
    }

    return count;
  }

  // Test helper methods
  clear(): void {
    this.requests.clear();
  }

  getAll(): CardRequest[] {
    const allRequests: CardRequest[] = [];
    for (const userRequests of this.requests.values()) {
      allRequests.push(...userRequests.values());
    }
    return allRequests;
  }
}
