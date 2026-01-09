/**
 * DynamoDB Audit Log Repository
 *
 * DynamoDB implementation for audit log data persistence.
 */

import type { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { PutCommand, DeleteCommand, QueryCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';
import type {
  IAuditLogRepository,
  AuditLogPaginationOptions,
  PaginatedAuditLogs,
} from '../interfaces/audit-log.repository.js';
import type { AuditLog, AuditAction } from '../../../domain/entities/audit-log.entity.js';
import { TableNames, GSINames } from './table-names.js';
import {
  toISOString,
  requireDate,
  stripUndefined,
  compositeKey,
  timestampSortKey,
  encodeCursor,
  decodeCursor,
} from './codec.js';

/**
 * DynamoDB Audit Log Repository implementation
 */
export class DynamoDBAuditLogRepository implements IAuditLogRepository {
  constructor(private readonly docClient: DynamoDBDocumentClient) {}

  async save(log: AuditLog): Promise<void> {
    const pk = compositeKey(log.targetType, log.targetId);
    const sk = timestampSortKey(log.timestamp, log.logId);

    const command = new PutCommand({
      TableName: TableNames.AUDIT_LOGS,
      Item: this.mapLogToDoc(pk, sk, log),
    });

    await this.docClient.send(command);
  }

  async findByTarget(
    targetType: string,
    targetId: string,
    pagination?: AuditLogPaginationOptions
  ): Promise<PaginatedAuditLogs> {
    const pk = compositeKey(targetType, targetId);
    const limit = pagination?.limit ?? 20;
    const exclusiveStartKey = decodeCursor(pagination?.cursor);

    const command = new QueryCommand({
      TableName: TableNames.AUDIT_LOGS,
      KeyConditionExpression: 'targetTypeTargetId = :pk',
      ExpressionAttributeValues: {
        ':pk': pk,
      },
      ScanIndexForward: false, // Most recent first
      Limit: limit + 1,
      ExclusiveStartKey: exclusiveStartKey,
    });

    const result = await this.docClient.send(command);
    const items = result.Items ?? [];

    const hasMore = items.length > limit;
    const logs = items.slice(0, limit).map((item) => this.mapDocToLog(item));

    return {
      logs,
      nextCursor: hasMore ? encodeCursor(result.LastEvaluatedKey) : undefined,
      hasMore,
    };
  }

  async findByActor(
    actorId: string,
    pagination?: AuditLogPaginationOptions
  ): Promise<PaginatedAuditLogs> {
    const limit = pagination?.limit ?? 20;
    const exclusiveStartKey = decodeCursor(pagination?.cursor);

    const command = new QueryCommand({
      TableName: TableNames.AUDIT_LOGS,
      IndexName: GSINames.LOGS_BY_ACTOR,
      KeyConditionExpression: 'actorId = :actorId',
      ExpressionAttributeValues: {
        ':actorId': actorId,
      },
      ScanIndexForward: false, // Most recent first
      Limit: limit + 1,
      ExclusiveStartKey: exclusiveStartKey,
    });

    const result = await this.docClient.send(command);
    const items = result.Items ?? [];

    const hasMore = items.length > limit;
    const logs = items.slice(0, limit).map((item) => this.mapDocToLog(item));

    return {
      logs,
      nextCursor: hasMore ? encodeCursor(result.LastEvaluatedKey) : undefined,
      hasMore,
    };
  }

  async clear(): Promise<number> {
    const command = new ScanCommand({
      TableName: TableNames.AUDIT_LOGS,
    });

    const result = await this.docClient.send(command);
    const count = result.Items?.length ?? 0;

    for (const item of (result.Items ?? []) as Array<Record<string, unknown>>) {
      const targetTypeTargetId = item.targetTypeTargetId as string;
      const timestampLogId = item.timestampLogId as string;
      const deleteCommand = new DeleteCommand({
        TableName: TableNames.AUDIT_LOGS,
        Key: { targetTypeTargetId, timestampLogId },
      });
      await this.docClient.send(deleteCommand);
    }

    return count;
  }

  /**
   * Map DynamoDB item to AuditLog entity
   */
  private mapDocToLog(item: Record<string, unknown>): AuditLog {
    const log: AuditLog = {
      logId: item.logId as string,
      adminEcosystemId: item.adminEcosystemId as string,
      adminEmail: item.adminEmail as string,
      action: item.action as AuditAction,
      targetType: item.targetType as string,
      targetId: item.targetId as string,
      reason: item.reason as string,
      requestId: item.requestId as string,
      timestamp: requireDate(item.createdAt, 'createdAt'),
    };

    // Optional fields
    if (item.targetEcosystemId !== undefined) {
      log.targetEcosystemId = item.targetEcosystemId as string;
    }
    if (item.previousValue !== undefined) {
      log.previousValue = item.previousValue;
    }
    if (item.newValue !== undefined) {
      log.newValue = item.newValue;
    }
    if (item.ipAddress !== undefined) {
      log.ipAddress = item.ipAddress as string;
    }
    if (item.userAgent !== undefined) {
      log.userAgent = item.userAgent as string;
    }

    return log;
  }

  /**
   * Map AuditLog entity to DynamoDB item
   */
  private mapLogToDoc(pk: string, sk: string, log: AuditLog): Record<string, unknown> {
    return stripUndefined({
      targetTypeTargetId: pk,
      timestampLogId: sk,
      logId: log.logId,
      actorId: log.adminEcosystemId, // For GSI
      adminEcosystemId: log.adminEcosystemId,
      adminEmail: log.adminEmail,
      action: log.action,
      targetType: log.targetType,
      targetId: log.targetId,
      targetEcosystemId: log.targetEcosystemId,
      previousValue: log.previousValue,
      newValue: log.newValue,
      reason: log.reason,
      requestId: log.requestId,
      ipAddress: log.ipAddress,
      userAgent: log.userAgent,
      createdAt: toISOString(log.timestamp),
    });
  }
}
