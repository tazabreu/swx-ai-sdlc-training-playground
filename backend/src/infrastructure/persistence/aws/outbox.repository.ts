/**
 * DynamoDB Outbox Repository
 *
 * DynamoDB implementation for outbox event data persistence with atomic sequence allocation.
 */

import type { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import {
  GetCommand,
  PutCommand,
  UpdateCommand,
  DeleteCommand,
  QueryCommand,
  ScanCommand,
  TransactWriteCommand,
} from '@aws-sdk/lib-dynamodb';
import type { IOutboxRepository } from '../interfaces/outbox.repository.js';
import type { OutboxEvent, EventType, EventStatus } from '../../../domain/entities/event.entity.js';
import { calculateNextRetryTime } from '../../../domain/entities/event.entity.js';
import { TableNames, GSINames } from './table-names.js';
import { toISOString, requireDate, optionalDate, stripUndefined } from './codec.js';

/**
 * DynamoDB Outbox Repository implementation
 */
export class DynamoDBOutboxRepository implements IOutboxRepository {
  constructor(private readonly docClient: DynamoDBDocumentClient) {}

  async save(event: OutboxEvent): Promise<void> {
    if (event.sequenceNumber === 0) {
      if (!this.shouldAllocateSequence()) {
        throw new Error(
          'Outbox event sequenceNumber must be provided when OUTBOX_SEQUENCE_STRATEGY=caller'
        );
      }

      await this.saveWithAllocatedSequence(event);
      return;
    }

    const command = new PutCommand({
      TableName: TableNames.OUTBOX,
      Item: this.mapEventToDoc(event),
    });

    await this.docClient.send(command);
  }

  async findPending(limit?: number): Promise<OutboxEvent[]> {
    const command = new QueryCommand({
      TableName: TableNames.OUTBOX,
      IndexName: GSINames.PENDING_EVENTS,
      KeyConditionExpression: '#status = :pending',
      ExpressionAttributeNames: {
        '#status': 'status',
      },
      ExpressionAttributeValues: {
        ':pending': 'pending',
      },
      Limit: limit ?? 100,
    });

    const result = await this.docClient.send(command);
    return (result.Items ?? []).map((item) => this.mapDocToEvent(item));
  }

  async markSent(eventId: string): Promise<void> {
    const command = new UpdateCommand({
      TableName: TableNames.OUTBOX,
      Key: { eventId },
      UpdateExpression: 'SET #status = :sent, sentAt = :now, updatedAt = :now',
      ExpressionAttributeNames: {
        '#status': 'status',
      },
      ExpressionAttributeValues: {
        ':sent': 'sent',
        ':now': toISOString(new Date()),
      },
    });

    await this.docClient.send(command);
  }

  async markFailed(eventId: string, error: string): Promise<void> {
    // Get current event to calculate retry count
    const getCommand = new GetCommand({
      TableName: TableNames.OUTBOX,
      Key: { eventId },
    });

    const result = await this.docClient.send(getCommand);
    if (!result.Item) {
      throw new Error(`Event not found: ${eventId}`);
    }

    const retryCount = (result.Item.retryCount as number) + 1;
    const nextRetryAt = calculateNextRetryTime(retryCount);

    const command = new UpdateCommand({
      TableName: TableNames.OUTBOX,
      Key: { eventId },
      UpdateExpression:
        'SET #status = :failed, lastError = :error, retryCount = :retryCount, nextRetryAt = :nextRetryAt, updatedAt = :now',
      ExpressionAttributeNames: {
        '#status': 'status',
      },
      ExpressionAttributeValues: {
        ':failed': 'failed',
        ':error': error,
        ':retryCount': retryCount,
        ':nextRetryAt': toISOString(nextRetryAt),
        ':now': toISOString(new Date()),
      },
    });

    await this.docClient.send(command);
  }

  async markDeadLettered(eventId: string, error: string): Promise<void> {
    const command = new UpdateCommand({
      TableName: TableNames.OUTBOX,
      Key: { eventId },
      UpdateExpression: 'SET #status = :deadLetter, lastError = :error, updatedAt = :now',
      ExpressionAttributeNames: {
        '#status': 'status',
      },
      ExpressionAttributeValues: {
        ':deadLetter': 'dead_letter',
        ':error': error,
        ':now': toISOString(new Date()),
      },
    });

    await this.docClient.send(command);
  }

  async findReadyForRetry(limit?: number): Promise<OutboxEvent[]> {
    const now = new Date();

    const command = new QueryCommand({
      TableName: TableNames.OUTBOX,
      IndexName: GSINames.RETRY_EVENTS,
      KeyConditionExpression: '#status = :failed',
      FilterExpression: 'nextRetryAt <= :now',
      ExpressionAttributeNames: {
        '#status': 'status',
      },
      ExpressionAttributeValues: {
        ':failed': 'failed',
        ':now': toISOString(now),
      },
      Limit: limit ?? 100,
    });

    const result = await this.docClient.send(command);

    // Need to fetch full items since GSI has KEYS_ONLY projection
    const events: OutboxEvent[] = [];
    for (const item of (result.Items ?? []) as Array<Record<string, unknown>>) {
      const eventId = item.eventId as string;
      const getCommand = new GetCommand({
        TableName: TableNames.OUTBOX,
        Key: { eventId },
      });
      const eventResult = await this.docClient.send(getCommand);
      if (eventResult.Item) {
        events.push(this.mapDocToEvent(eventResult.Item));
      }
    }

    return events;
  }

  async clear(): Promise<number> {
    const command = new ScanCommand({
      TableName: TableNames.OUTBOX,
    });

    const result = await this.docClient.send(command);
    const count = result.Items?.length ?? 0;

    for (const item of (result.Items ?? []) as Array<Record<string, unknown>>) {
      const eventId = item.eventId as string;
      const deleteCommand = new DeleteCommand({
        TableName: TableNames.OUTBOX,
        Key: { eventId },
      });
      await this.docClient.send(deleteCommand);
    }

    // Also clear sequences
    const sequencesCommand = new ScanCommand({
      TableName: TableNames.OUTBOX_SEQUENCES,
    });

    const sequencesResult = await this.docClient.send(sequencesCommand);
    for (const item of (sequencesResult.Items ?? []) as Array<Record<string, unknown>>) {
      const entityKey = item.entityKey as string;
      const deleteCommand = new DeleteCommand({
        TableName: TableNames.OUTBOX_SEQUENCES,
        Key: { entityKey },
      });
      await this.docClient.send(deleteCommand);
    }

    return count;
  }

  private shouldAllocateSequence(): boolean {
    return (process.env.OUTBOX_SEQUENCE_STRATEGY ?? 'repository') !== 'caller';
  }

  private entitySequenceKey(event: OutboxEvent): string {
    return `${event.ecosystemId}:${event.entityType}:${event.entityId}`;
  }

  private async getCurrentSequence(entityKey: string): Promise<number> {
    const command = new GetCommand({
      TableName: TableNames.OUTBOX_SEQUENCES,
      Key: { entityKey },
      ConsistentRead: true,
    });

    const result = await this.docClient.send(command);
    const raw: unknown = (result.Item as Record<string, unknown> | undefined)?.sequence;
    return typeof raw === 'number' ? raw : 0;
  }

  private isSequenceConflict(error: unknown): boolean {
    const name = (error as { name?: string } | null)?.name;
    if (name !== 'TransactionCanceledException') {
      return false;
    }

    const message = (error as { message?: string } | null)?.message ?? '';
    return (
      message.includes('ConditionalCheckFailed') || message.includes('conditional request failed')
    );
  }

  private async saveWithAllocatedSequence(event: OutboxEvent): Promise<void> {
    const entityKey = this.entitySequenceKey(event);
    const maxAttempts = 10;

    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      const current = await this.getCurrentSequence(entityKey);
      const next = current + 1;
      const now = toISOString(new Date());

      const updateExpressionAttributeValues: Record<string, unknown> = {
        ':next': next,
        ':now': now,
      };

      const updateConditionExpression =
        current === 0 ? 'attribute_not_exists(#seq)' : '#seq = :current';
      if (current !== 0) {
        updateExpressionAttributeValues[':current'] = current;
      }

      const toSave: OutboxEvent = { ...event, sequenceNumber: next };

      const transactCommand = new TransactWriteCommand({
        TransactItems: [
          {
            Update: {
              TableName: TableNames.OUTBOX_SEQUENCES,
              Key: { entityKey },
              UpdateExpression: 'SET #seq = :next, updatedAt = :now',
              ConditionExpression: updateConditionExpression,
              ExpressionAttributeNames: {
                '#seq': 'sequence',
              },
              ExpressionAttributeValues: updateExpressionAttributeValues,
            },
          },
          {
            Put: {
              TableName: TableNames.OUTBOX,
              Item: this.mapEventToDoc(toSave),
            },
          },
        ],
      });

      try {
        await this.docClient.send(transactCommand);
        return;
      } catch (error) {
        if (this.isSequenceConflict(error) && attempt < maxAttempts - 1) {
          continue;
        }
        throw error;
      }
    }

    throw new Error(`Failed to allocate outbox sequence for ${entityKey}`);
  }

  /**
   * Map DynamoDB item to OutboxEvent entity
   */
  private mapDocToEvent(item: Record<string, unknown>): OutboxEvent {
    const event: OutboxEvent = {
      eventId: item.eventId as string,
      eventType: item.eventType as EventType,
      entityType: item.entityType as string,
      entityId: item.entityId as string,
      ecosystemId: item.ecosystemId as string,
      sequenceNumber: item.sequenceNumber as number,
      payload: item.payload as Record<string, unknown>,
      status: item.status as EventStatus,
      retryCount: item.retryCount as number,
      nextRetryAt: requireDate(item.nextRetryAt, 'nextRetryAt'),
      createdAt: requireDate(item.createdAt, 'createdAt'),
    };

    if (item.lastError !== undefined) {
      event.lastError = item.lastError as string;
    }

    const sentAt = optionalDate(item.sentAt);
    if (sentAt) {
      event.sentAt = sentAt;
    }

    return event;
  }

  /**
   * Map OutboxEvent entity to DynamoDB item
   */
  private mapEventToDoc(event: OutboxEvent): Record<string, unknown> {
    return stripUndefined({
      eventId: event.eventId,
      eventType: event.eventType,
      entityType: event.entityType,
      entityId: event.entityId,
      ecosystemId: event.ecosystemId,
      sequenceNumber: event.sequenceNumber,
      payload: event.payload,
      status: event.status,
      retryCount: event.retryCount,
      lastError: event.lastError,
      nextRetryAt: toISOString(event.nextRetryAt),
      createdAt: toISOString(event.createdAt),
      updatedAt: toISOString(new Date()),
      sentAt: event.sentAt ? toISOString(event.sentAt) : undefined,
    });
  }
}
