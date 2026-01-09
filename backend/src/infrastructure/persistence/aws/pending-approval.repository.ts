/**
 * DynamoDB Pending Approval Repository
 *
 * DynamoDB implementation for pending approval tracker data persistence.
 */

import type { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import {
  GetCommand,
  PutCommand,
  UpdateCommand,
  DeleteCommand,
  QueryCommand,
  ScanCommand,
} from '@aws-sdk/lib-dynamodb';
import type { IPendingApprovalRepository } from '../interfaces/pending-approval.repository.js';
import type { PendingApprovalTracker } from '../../../domain/entities/pending-approval.entity.js';
import type { ApprovalStatus } from '../../whatsapp/types.js';
import { TableNames, GSINames } from './table-names.js';
import { toISOString, requireDate, optionalDate, stripUndefined } from './codec.js';

/**
 * DynamoDB Pending Approval Repository implementation
 */
export class DynamoDBPendingApprovalRepository implements IPendingApprovalRepository {
  constructor(private readonly docClient: DynamoDBDocumentClient) {}

  async save(tracker: PendingApprovalTracker): Promise<void> {
    const command = new PutCommand({
      TableName: TableNames.PENDING_APPROVALS,
      Item: this.mapTrackerToDoc(tracker),
    });

    await this.docClient.send(command);
  }

  async findByRequestId(requestId: string): Promise<PendingApprovalTracker | null> {
    const command = new GetCommand({
      TableName: TableNames.PENDING_APPROVALS,
      Key: { requestId },
    });

    const result = await this.docClient.send(command);

    if (!result.Item) {
      return null;
    }

    return this.mapDocToTracker(result.Item);
  }

  async findPendingByRequestId(requestId: string): Promise<PendingApprovalTracker | null> {
    const tracker = await this.findByRequestId(requestId);

    if (!tracker || tracker.approvalStatus !== 'pending') {
      return null;
    }

    // Also check if expired
    if (new Date() > tracker.expiresAt) {
      return null;
    }

    return tracker;
  }

  async updateApprovalStatus(
    requestId: string,
    status: 'approved' | 'rejected',
    adminPhone: string
  ): Promise<void> {
    const now = new Date();

    const command = new UpdateCommand({
      TableName: TableNames.PENDING_APPROVALS,
      Key: { requestId },
      UpdateExpression:
        'SET #status = :status, respondingAdminPhone = :phone, responseReceivedAt = :responseAt, updatedAt = :now',
      ExpressionAttributeNames: {
        '#status': 'status',
      },
      ExpressionAttributeValues: {
        ':status': status,
        ':phone': adminPhone,
        ':responseAt': toISOString(now),
        ':now': toISOString(now),
      },
    });

    await this.docClient.send(command);
  }

  async findExpired(): Promise<PendingApprovalTracker[]> {
    const now = new Date();

    const command = new QueryCommand({
      TableName: TableNames.PENDING_APPROVALS,
      IndexName: GSINames.EXPIRED_APPROVALS,
      KeyConditionExpression: '#status = :pending AND expiresAt < :now',
      ExpressionAttributeNames: {
        '#status': 'status',
      },
      ExpressionAttributeValues: {
        ':pending': 'pending',
        ':now': toISOString(now),
      },
    });

    const result = await this.docClient.send(command);
    return (result.Items ?? []).map((item) => this.mapDocToTracker(item));
  }

  async markExpired(requestId: string): Promise<void> {
    const command = new UpdateCommand({
      TableName: TableNames.PENDING_APPROVALS,
      Key: { requestId },
      UpdateExpression: 'SET #status = :expired, updatedAt = :now',
      ExpressionAttributeNames: {
        '#status': 'status',
      },
      ExpressionAttributeValues: {
        ':expired': 'expired',
        ':now': toISOString(new Date()),
      },
    });

    await this.docClient.send(command);
  }

  async deleteAll(): Promise<number> {
    const command = new ScanCommand({
      TableName: TableNames.PENDING_APPROVALS,
    });

    const result = await this.docClient.send(command);
    const count = result.Items?.length ?? 0;

    for (const item of (result.Items ?? []) as Array<Record<string, unknown>>) {
      const requestId = item.requestId as string;
      const deleteCommand = new DeleteCommand({
        TableName: TableNames.PENDING_APPROVALS,
        Key: { requestId },
      });
      await this.docClient.send(deleteCommand);
    }

    return count;
  }

  /**
   * Map DynamoDB item to PendingApprovalTracker entity
   */
  private mapDocToTracker(item: Record<string, unknown>): PendingApprovalTracker {
    const tracker: PendingApprovalTracker = {
      requestId: item.requestId as string,
      ecosystemId: item.ecosystemId as string,
      notificationIds: (item.notificationIds as string[]) ?? [],
      approvalStatus: (item.status ?? item.approvalStatus) as ApprovalStatus,
      expiresAt: requireDate(item.expiresAt, 'expiresAt'),
      createdAt: requireDate(item.createdAt, 'createdAt'),
      updatedAt: requireDate(item.updatedAt, 'updatedAt'),
    };

    // Optional fields
    const notificationsSentAt = optionalDate(item.notificationsSentAt);
    if (notificationsSentAt) {
      tracker.notificationsSentAt = notificationsSentAt;
    }

    if (item.respondingAdminPhone !== undefined) {
      tracker.respondingAdminPhone = item.respondingAdminPhone as string;
    }

    const responseReceivedAt = optionalDate(item.responseReceivedAt);
    if (responseReceivedAt) {
      tracker.responseReceivedAt = responseReceivedAt;
    }

    return tracker;
  }

  /**
   * Map PendingApprovalTracker entity to DynamoDB item
   */
  private mapTrackerToDoc(tracker: PendingApprovalTracker): Record<string, unknown> {
    return stripUndefined({
      requestId: tracker.requestId,
      ecosystemId: tracker.ecosystemId,
      notificationIds: tracker.notificationIds,
      notificationsSentAt: tracker.notificationsSentAt
        ? toISOString(tracker.notificationsSentAt)
        : undefined,
      // Use 'status' for the GSI
      status: tracker.approvalStatus,
      approvalStatus: tracker.approvalStatus,
      respondingAdminPhone: tracker.respondingAdminPhone,
      responseReceivedAt: tracker.responseReceivedAt
        ? toISOString(tracker.responseReceivedAt)
        : undefined,
      expiresAt: toISOString(tracker.expiresAt),
      createdAt: toISOString(tracker.createdAt),
      updatedAt: toISOString(tracker.updatedAt),
    });
  }
}
