/**
 * DynamoDB Card Request Repository
 *
 * DynamoDB implementation for card request data persistence.
 */

import type { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import {
  GetCommand,
  PutCommand,
  UpdateCommand,
  DeleteCommand,
  QueryCommand,
} from '@aws-sdk/lib-dynamodb';
import type {
  ICardRequestRepository,
  PaginationOptions,
  PendingRequestSortOptions,
  PendingRequestFilter,
  CardRequestWithOwner,
  PaginatedCardRequests,
} from '../interfaces/card-request.repository.js';
import type {
  CardRequest,
  CardRequestStatus,
  CardRequestDecision,
} from '../../../domain/entities/card-request.entity.js';
import type { UserTier } from '../../../domain/entities/user.entity.js';
import { TableNames, GSINames } from './table-names.js';
import {
  toISOString,
  requireDate,
  optionalDate,
  stripUndefined,
  encodeCursor,
  decodeCursor,
} from './codec.js';

/**
 * DynamoDB Card Request Repository implementation
 */
export class DynamoDBCardRequestRepository implements ICardRequestRepository {
  constructor(private readonly docClient: DynamoDBDocumentClient) {}

  async findById(ecosystemId: string, requestId: string): Promise<CardRequest | null> {
    const command = new GetCommand({
      TableName: TableNames.CARD_REQUESTS,
      Key: { ecosystemId, requestId },
    });

    const result = await this.docClient.send(command);

    if (!result.Item) {
      return null;
    }

    return this.mapDocToRequest(result.Item);
  }

  async findPendingByUser(ecosystemId: string): Promise<CardRequest | null> {
    const command = new QueryCommand({
      TableName: TableNames.CARD_REQUESTS,
      KeyConditionExpression: 'ecosystemId = :id',
      FilterExpression: '#status = :pending',
      ExpressionAttributeNames: {
        '#status': 'status',
      },
      ExpressionAttributeValues: {
        ':id': ecosystemId,
        ':pending': 'pending',
      },
      Limit: 1,
    });

    const result = await this.docClient.send(command);

    if (!result.Items || result.Items.length === 0) {
      return null;
    }

    return this.mapDocToRequest(result.Items[0]!);
  }

  async findAllPending(
    sort?: PendingRequestSortOptions,
    filter?: PendingRequestFilter,
    pagination?: PaginationOptions
  ): Promise<PaginatedCardRequests> {
    const limit = pagination?.limit ?? 20;
    const exclusiveStartKey = decodeCursor(pagination?.cursor);

    // Use GSI to query pending requests
    const command = new QueryCommand({
      TableName: TableNames.CARD_REQUESTS,
      IndexName: GSINames.PENDING_REQUESTS,
      KeyConditionExpression: '#status = :pending',
      ExpressionAttributeNames: {
        '#status': 'status',
      },
      ExpressionAttributeValues: {
        ':pending': filter?.status ?? 'pending',
      },
      ScanIndexForward: sort?.order !== 'desc',
      Limit: limit + 1, // Fetch one extra to check if there's more
      ExclusiveStartKey: exclusiveStartKey,
    });

    const result = await this.docClient.send(command);
    let items = result.Items ?? [];

    // Apply tier filter if specified
    if (filter?.tier) {
      items = items.filter((item) => item.tierAtRequest === filter.tier);
    }

    // Apply minDaysPending filter
    if (filter?.minDaysPending !== undefined && filter.minDaysPending > 0) {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - filter.minDaysPending);
      items = items.filter((item) => new Date(item.createdAt as string) <= cutoffDate);
    }

    const hasMore = items.length > limit;
    const requests = items.slice(0, limit).map((item) => this.mapDocToRequestWithOwner(item));

    return {
      requests,
      nextCursor: hasMore ? encodeCursor(result.LastEvaluatedKey) : undefined,
      hasMore,
      totalCount: requests.length,
    };
  }

  async findRejectedByUser(ecosystemId: string, withinDays?: number): Promise<CardRequest[]> {
    const command = new QueryCommand({
      TableName: TableNames.CARD_REQUESTS,
      KeyConditionExpression: 'ecosystemId = :id',
      FilterExpression: '#status = :rejected',
      ExpressionAttributeNames: {
        '#status': 'status',
      },
      ExpressionAttributeValues: {
        ':id': ecosystemId,
        ':rejected': 'rejected',
      },
    });

    const result = await this.docClient.send(command);
    let requests = (result.Items ?? []).map((item) => this.mapDocToRequest(item));

    // Apply withinDays filter if specified
    if (withinDays !== undefined && withinDays > 0) {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - withinDays);
      requests = requests.filter((r) => r.createdAt >= cutoffDate);
    }

    return requests;
  }

  async save(ecosystemId: string, request: CardRequest): Promise<void> {
    const command = new PutCommand({
      TableName: TableNames.CARD_REQUESTS,
      Item: this.mapRequestToDoc(ecosystemId, request),
    });

    await this.docClient.send(command);
  }

  async updateStatus(
    ecosystemId: string,
    requestId: string,
    status: CardRequestStatus,
    decision: CardRequestDecision,
    resultingCardId?: string
  ): Promise<void> {
    let updateExpression = 'SET #status = :status, decision = :decision, updatedAt = :now';
    const expressionAttributeValues: Record<string, unknown> = {
      ':status': status,
      ':decision': stripUndefined({
        outcome: decision.outcome,
        source: decision.source,
        adminId: decision.adminId,
        reason: decision.reason,
        approvedLimit: decision.approvedLimit,
        decidedAt: toISOString(decision.decidedAt),
      }),
      ':now': toISOString(new Date()),
    };

    if (resultingCardId !== undefined && resultingCardId !== '') {
      updateExpression += ', resultingCardId = :cardId';
      expressionAttributeValues[':cardId'] = resultingCardId;
    }

    const command = new UpdateCommand({
      TableName: TableNames.CARD_REQUESTS,
      Key: { ecosystemId, requestId },
      UpdateExpression: updateExpression,
      ExpressionAttributeNames: {
        '#status': 'status',
      },
      ExpressionAttributeValues: expressionAttributeValues,
    });

    await this.docClient.send(command);
  }

  async delete(ecosystemId: string, requestId: string): Promise<void> {
    const command = new DeleteCommand({
      TableName: TableNames.CARD_REQUESTS,
      Key: { ecosystemId, requestId },
    });

    await this.docClient.send(command);
  }

  async deleteAllForUser(ecosystemId: string): Promise<number> {
    const command = new QueryCommand({
      TableName: TableNames.CARD_REQUESTS,
      KeyConditionExpression: 'ecosystemId = :id',
      ExpressionAttributeValues: {
        ':id': ecosystemId,
      },
    });

    const result = await this.docClient.send(command);
    const count = result.Items?.length ?? 0;

    for (const item of result.Items ?? []) {
      await this.delete(ecosystemId, item.requestId as string);
    }

    return count;
  }

  async countRequiringAttention(): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 7);

    const command = new QueryCommand({
      TableName: TableNames.CARD_REQUESTS,
      IndexName: GSINames.PENDING_REQUESTS,
      KeyConditionExpression: '#status = :pending AND createdAt <= :cutoff',
      ExpressionAttributeNames: {
        '#status': 'status',
      },
      ExpressionAttributeValues: {
        ':pending': 'pending',
        ':cutoff': toISOString(cutoffDate),
      },
      Select: 'COUNT',
    });

    const result = await this.docClient.send(command);
    return result.Count ?? 0;
  }

  /**
   * Map DynamoDB item to CardRequest entity
   */
  private mapDocToRequest(item: Record<string, unknown>): CardRequest {
    const request: CardRequest = {
      requestId: item.requestId as string,
      productId: item.productId as string,
      idempotencyKey: item.idempotencyKey as string,
      status: item.status as CardRequestStatus,
      scoreAtRequest: item.scoreAtRequest as number,
      tierAtRequest: item.tierAtRequest as UserTier,
      createdAt: requireDate(item.createdAt, 'createdAt'),
      updatedAt: requireDate(item.updatedAt, 'updatedAt'),
    };

    // Optional fields
    if (item.decision !== undefined && item.decision !== null) {
      const decision = item.decision as Record<string, unknown>;
      const decisionObj: CardRequestDecision = {
        outcome: decision.outcome as 'approved' | 'rejected',
        source: decision.source as 'auto' | 'admin',
        decidedAt: requireDate(decision.decidedAt, 'decision.decidedAt'),
      };
      // Only add optional fields if they exist
      if (decision.adminId !== undefined) {
        decisionObj.adminId = decision.adminId as string;
      }
      if (decision.reason !== undefined) {
        decisionObj.reason = decision.reason as string;
      }
      if (decision.approvedLimit !== undefined) {
        decisionObj.approvedLimit = decision.approvedLimit as number;
      }
      request.decision = decisionObj;
    }

    if (item.resultingCardId !== undefined) {
      request.resultingCardId = item.resultingCardId as string;
    }

    const expiresAt = optionalDate(item.expiresAt);
    if (expiresAt) {
      request.expiresAt = expiresAt;
    }

    return request;
  }

  /**
   * Map DynamoDB item to CardRequestWithOwner
   */
  private mapDocToRequestWithOwner(item: Record<string, unknown>): CardRequestWithOwner {
    const request = this.mapDocToRequest(item);
    return {
      ...request,
      ecosystemId: item.ecosystemId as string,
    };
  }

  /**
   * Map CardRequest entity to DynamoDB item
   */
  private mapRequestToDoc(ecosystemId: string, request: CardRequest): Record<string, unknown> {
    const doc: Record<string, unknown> = {
      ecosystemId,
      requestId: request.requestId,
      productId: request.productId,
      idempotencyKey: request.idempotencyKey,
      status: request.status,
      scoreAtRequest: request.scoreAtRequest,
      tierAtRequest: request.tierAtRequest,
      createdAt: toISOString(request.createdAt),
      updatedAt: toISOString(request.updatedAt),
    };

    if (request.decision) {
      doc.decision = stripUndefined({
        outcome: request.decision.outcome,
        source: request.decision.source,
        adminId: request.decision.adminId,
        reason: request.decision.reason,
        approvedLimit: request.decision.approvedLimit,
        decidedAt: toISOString(request.decision.decidedAt),
      });
    }

    if (request.resultingCardId !== undefined) {
      doc.resultingCardId = request.resultingCardId;
    }

    if (request.expiresAt) {
      doc.expiresAt = toISOString(request.expiresAt);
    }

    return doc;
  }
}
