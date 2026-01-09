/**
 * Firestore Card Request Repository
 *
 * Firestore implementation for card request data persistence.
 */

import type { Firestore, Query, DocumentData } from 'firebase-admin/firestore';
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
import type { UserTier } from '../../../domain/entities/user.entity.js';
import { CollectionPaths } from './client.js';
import { requireDate, optionalDate } from './codec.js';

/**
 * Firestore Card Request Repository implementation
 */
export class FirestoreCardRequestRepository implements ICardRequestRepository {
  constructor(private readonly db: Firestore) {}

  async findById(ecosystemId: string, requestId: string): Promise<CardRequest | null> {
    const doc = await this.db
      .collection(CollectionPaths.CARD_REQUESTS(ecosystemId))
      .doc(requestId)
      .get();

    if (!doc.exists) {
      return null;
    }

    return this.mapDocToRequest(doc.id, doc.data()!);
  }

  async findPendingByUser(ecosystemId: string): Promise<CardRequest | null> {
    const snapshot = await this.db
      .collection(CollectionPaths.CARD_REQUESTS(ecosystemId))
      .where('status', '==', 'pending')
      .limit(1)
      .get();

    if (snapshot.empty) {
      return null;
    }

    const doc = snapshot.docs[0]!;
    return this.mapDocToRequest(doc.id, doc.data());
  }

  async findAllPending(
    sort?: PendingRequestSortOptions,
    filter?: PendingRequestFilter,
    pagination?: PaginationOptions
  ): Promise<PaginatedCardRequests> {
    // Query all users for pending requests (collection group query)
    let query: Query<DocumentData> = this.db
      .collectionGroup('cardRequests')
      .where('status', '==', 'pending');

    // Apply tier filter if provided
    if (filter?.tier !== undefined) {
      query = query.where('tierAtRequest', '==', filter.tier);
    }

    // Apply sorting
    if (sort !== undefined) {
      query = query.orderBy(sort.field, sort.order);
    } else {
      query = query.orderBy('createdAt', 'asc');
    }

    const snapshot = await query.get();

    // Map to CardRequestWithOwner
    let requests: CardRequestWithOwner[] = snapshot.docs.map((doc) => {
      // Extract ecosystemId from path: users/{ecosystemId}/cardRequests/{requestId}
      const pathParts = doc.ref.path.split('/');
      const ecosystemId = pathParts[1]!;
      return {
        ...this.mapDocToRequest(doc.id, doc.data()),
        ecosystemId,
      };
    });

    // Apply minDaysPending filter (must be done in memory)
    if (filter?.minDaysPending !== undefined) {
      const now = new Date();
      requests = requests.filter((r) => {
        const daysPending = Math.floor(
          (now.getTime() - r.createdAt.getTime()) / (1000 * 60 * 60 * 24)
        );
        return daysPending >= (filter.minDaysPending ?? 0);
      });
    }

    const totalCount = requests.length;

    // Apply pagination
    const limit = pagination?.limit ?? 20;
    let startIndex = 0;

    if (pagination?.cursor !== undefined) {
      const cursorIndex = requests.findIndex((r) => r.requestId === pagination.cursor);
      if (cursorIndex !== -1) {
        startIndex = cursorIndex + 1;
      }
    }

    const paginated = requests.slice(startIndex, startIndex + limit);
    const hasMore = startIndex + limit < requests.length;
    const nextCursor = hasMore ? paginated[paginated.length - 1]?.requestId : undefined;

    return {
      requests: paginated,
      totalCount,
      nextCursor,
      hasMore,
    };
  }

  async findRejectedByUser(ecosystemId: string, withinDays?: number): Promise<CardRequest[]> {
    const query = this.db
      .collection(CollectionPaths.CARD_REQUESTS(ecosystemId))
      .where('status', '==', 'rejected')
      .orderBy('updatedAt', 'desc');

    const snapshot = await query.get();

    let requests = snapshot.docs.map((doc) => this.mapDocToRequest(doc.id, doc.data()));

    // Filter by withinDays if provided
    if (withinDays !== undefined) {
      const now = new Date();
      const cutoffMs = withinDays * 24 * 60 * 60 * 1000;
      requests = requests.filter((r) => {
        const age = now.getTime() - r.updatedAt.getTime();
        return age <= cutoffMs;
      });
    }

    return requests;
  }

  async save(ecosystemId: string, request: CardRequest): Promise<void> {
    await this.db
      .collection(CollectionPaths.CARD_REQUESTS(ecosystemId))
      .doc(request.requestId)
      .set(this.mapRequestToDoc(request));
  }

  async updateStatus(
    ecosystemId: string,
    requestId: string,
    status: CardRequestStatus,
    decision: CardRequestDecision,
    resultingCardId?: string
  ): Promise<void> {
    const updateData: Record<string, unknown> = {
      status,
      decision,
      updatedAt: new Date(),
    };

    if (resultingCardId !== undefined) {
      updateData.resultingCardId = resultingCardId;
    }

    await this.db
      .collection(CollectionPaths.CARD_REQUESTS(ecosystemId))
      .doc(requestId)
      .update(updateData);
  }

  async delete(ecosystemId: string, requestId: string): Promise<void> {
    await this.db.collection(CollectionPaths.CARD_REQUESTS(ecosystemId)).doc(requestId).delete();
  }

  async deleteAllForUser(ecosystemId: string): Promise<number> {
    const snapshot = await this.db.collection(CollectionPaths.CARD_REQUESTS(ecosystemId)).get();
    const count = snapshot.size;

    const batch = this.db.batch();
    snapshot.docs.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();

    return count;
  }

  async countRequiringAttention(): Promise<number> {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const snapshot = await this.db
      .collectionGroup('cardRequests')
      .where('status', '==', 'pending')
      .where('createdAt', '<=', sevenDaysAgo)
      .get();

    return snapshot.size;
  }

  /**
   * Map Firestore document to CardRequest entity
   */
  private mapDocToRequest(requestId: string, data: Record<string, unknown>): CardRequest {
    const request: CardRequest = {
      requestId,
      productId: data.productId as string,
      idempotencyKey: data.idempotencyKey as string,
      status: data.status as CardRequestStatus,
      scoreAtRequest: data.scoreAtRequest as number,
      tierAtRequest: data.tierAtRequest as UserTier,
      createdAt: requireDate(data.createdAt, 'createdAt'),
      updatedAt: requireDate(data.updatedAt, 'updatedAt'),
    };

    if (data.decision !== undefined) {
      request.decision = data.decision as CardRequestDecision;
    }
    if (data.resultingCardId !== undefined) {
      request.resultingCardId = data.resultingCardId as string;
    }
    if (data.expiresAt !== undefined) {
      const expiresAt = optionalDate(data.expiresAt, 'expiresAt');
      if (expiresAt !== undefined) {
        request.expiresAt = expiresAt;
      }
    }

    return request;
  }

  /**
   * Map CardRequest entity to Firestore document
   */
  private mapRequestToDoc(request: CardRequest): Record<string, unknown> {
    const doc: Record<string, unknown> = {
      productId: request.productId,
      idempotencyKey: request.idempotencyKey,
      status: request.status,
      scoreAtRequest: request.scoreAtRequest,
      tierAtRequest: request.tierAtRequest,
      createdAt: request.createdAt,
      updatedAt: request.updatedAt,
    };

    if (request.decision !== undefined) {
      doc.decision = request.decision;
    }
    if (request.resultingCardId !== undefined) {
      doc.resultingCardId = request.resultingCardId;
    }
    if (request.expiresAt !== undefined) {
      doc.expiresAt = request.expiresAt;
    }

    return doc;
  }
}
