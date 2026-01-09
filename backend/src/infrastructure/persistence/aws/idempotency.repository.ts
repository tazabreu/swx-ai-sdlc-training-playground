/**
 * DynamoDB Idempotency Repository
 *
 * DynamoDB implementation for idempotency key data persistence with TTL support.
 */

import type { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import {
  GetCommand,
  PutCommand,
  DeleteCommand,
  QueryCommand,
  ScanCommand,
} from '@aws-sdk/lib-dynamodb';
import type { IIdempotencyRepository } from '../interfaces/idempotency.repository.js';
import type { IdempotencyRecord } from '../../../domain/entities/idempotency-record.entity.js';
import { TableNames } from './table-names.js';
import { toISOString, requireDate, stripUndefined, calculateTTL } from './codec.js';

/**
 * DynamoDB Idempotency Repository implementation
 */
export class DynamoDBIdempotencyRepository implements IIdempotencyRepository {
  constructor(private readonly docClient: DynamoDBDocumentClient) {}

  async find(ecosystemId: string, keyHash: string): Promise<IdempotencyRecord | null> {
    const command = new GetCommand({
      TableName: TableNames.IDEMPOTENCY,
      Key: { ecosystemId, keyHash },
    });

    const result = await this.docClient.send(command);

    if (!result.Item) {
      return null;
    }

    const record = this.mapDocToRecord(result.Item);

    // Check if expired (TTL is handled by DynamoDB but we double-check)
    if (new Date() > record.expiresAt) {
      return null;
    }

    return record;
  }

  async save(ecosystemId: string, record: IdempotencyRecord): Promise<void> {
    const command = new PutCommand({
      TableName: TableNames.IDEMPOTENCY,
      Item: this.mapRecordToDoc(ecosystemId, record),
    });

    await this.docClient.send(command);
  }

  async deleteExpired(): Promise<number> {
    // DynamoDB handles TTL-based deletion automatically
    // This is a manual cleanup for any records that might have been missed
    const now = new Date();

    const command = new ScanCommand({
      TableName: TableNames.IDEMPOTENCY,
      FilterExpression: 'expiresAt < :now',
      ExpressionAttributeValues: {
        ':now': calculateTTL(now),
      },
    });

    const result = await this.docClient.send(command);
    const count = result.Items?.length ?? 0;

    for (const item of (result.Items ?? []) as Array<Record<string, unknown>>) {
      const ecosystemId = item.ecosystemId as string;
      const keyHash = item.keyHash as string;
      const deleteCommand = new DeleteCommand({
        TableName: TableNames.IDEMPOTENCY,
        Key: { ecosystemId, keyHash },
      });
      await this.docClient.send(deleteCommand);
    }

    return count;
  }

  async deleteAllForUser(ecosystemId: string): Promise<number> {
    const command = new QueryCommand({
      TableName: TableNames.IDEMPOTENCY,
      KeyConditionExpression: 'ecosystemId = :id',
      ExpressionAttributeValues: {
        ':id': ecosystemId,
      },
    });

    const result = await this.docClient.send(command);
    const count = result.Items?.length ?? 0;

    for (const item of result.Items ?? []) {
      const deleteCommand = new DeleteCommand({
        TableName: TableNames.IDEMPOTENCY,
        Key: {
          ecosystemId,
          keyHash: item.keyHash as string,
        },
      });
      await this.docClient.send(deleteCommand);
    }

    return count;
  }

  /**
   * Map DynamoDB item to IdempotencyRecord entity
   */
  private mapDocToRecord(item: Record<string, unknown>): IdempotencyRecord {
    return {
      keyHash: item.keyHash as string,
      operation: item.operation as string,
      response: item.response,
      statusCode: item.statusCode as number,
      expiresAt: requireDate(item.expiresAtDate, 'expiresAtDate'),
      createdAt: requireDate(item.createdAt, 'createdAt'),
    };
  }

  /**
   * Map IdempotencyRecord entity to DynamoDB item
   */
  private mapRecordToDoc(ecosystemId: string, record: IdempotencyRecord): Record<string, unknown> {
    return stripUndefined({
      ecosystemId,
      keyHash: record.keyHash,
      operation: record.operation,
      response: record.response,
      statusCode: record.statusCode,
      // Store TTL as Unix timestamp for DynamoDB TTL feature
      expiresAt: calculateTTL(record.expiresAt),
      // Also store ISO date for easier querying
      expiresAtDate: toISOString(record.expiresAt),
      createdAt: toISOString(record.createdAt),
    });
  }
}
