/**
 * DynamoDB WhatsApp Notification Repository
 *
 * DynamoDB implementation for WhatsApp notification data persistence.
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
import type { IWhatsAppNotificationRepository } from '../interfaces/whatsapp-notification.repository.js';
import type { WhatsAppNotification } from '../../../domain/entities/whatsapp-notification.entity.js';
import type { WhatsAppNotificationType, WhatsAppDeliveryStatus } from '../../whatsapp/types.js';
import { TableNames, GSINames } from './table-names.js';
import { toISOString, requireDate, optionalDate, stripUndefined } from './codec.js';

/**
 * DynamoDB WhatsApp Notification Repository implementation
 */
export class DynamoDBWhatsAppNotificationRepository implements IWhatsAppNotificationRepository {
  constructor(private readonly docClient: DynamoDBDocumentClient) {}

  async save(notification: WhatsAppNotification): Promise<void> {
    const command = new PutCommand({
      TableName: TableNames.WHATSAPP_NOTIFICATIONS,
      Item: this.mapNotificationToDoc(notification),
    });

    await this.docClient.send(command);
  }

  async findById(notificationId: string): Promise<WhatsAppNotification | null> {
    const command = new GetCommand({
      TableName: TableNames.WHATSAPP_NOTIFICATIONS,
      Key: { notificationId },
    });

    const result = await this.docClient.send(command);

    if (!result.Item) {
      return null;
    }

    return this.mapDocToNotification(result.Item);
  }

  async findByRelatedEntity(
    entityType: 'cardRequest' | 'payment',
    entityId: string
  ): Promise<WhatsAppNotification[]> {
    const command = new QueryCommand({
      TableName: TableNames.WHATSAPP_NOTIFICATIONS,
      IndexName: GSINames.BY_RELATED_ENTITY,
      KeyConditionExpression: 'relatedEntityType = :type AND relatedEntityId = :id',
      ExpressionAttributeValues: {
        ':type': entityType,
        ':id': entityId,
      },
    });

    const result = await this.docClient.send(command);
    return (result.Items ?? []).map((item) => this.mapDocToNotification(item));
  }

  async findPendingDelivery(limit?: number): Promise<WhatsAppNotification[]> {
    const command = new QueryCommand({
      TableName: TableNames.WHATSAPP_NOTIFICATIONS,
      IndexName: GSINames.PENDING_NOTIFICATIONS,
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
    return (result.Items ?? []).map((item) => this.mapDocToNotification(item));
  }

  async findReadyForRetry(limit?: number): Promise<WhatsAppNotification[]> {
    const now = new Date();

    const command = new QueryCommand({
      TableName: TableNames.WHATSAPP_NOTIFICATIONS,
      IndexName: GSINames.PENDING_NOTIFICATIONS,
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
    return (result.Items ?? []).map((item) => this.mapDocToNotification(item));
  }

  async updateDeliveryStatus(
    notificationId: string,
    status: WhatsAppDeliveryStatus,
    wppMessageId?: string,
    error?: string
  ): Promise<void> {
    const now = new Date();
    let updateExpression = 'SET #status = :status, updatedAt = :now';
    const expressionAttributeValues: Record<string, unknown> = {
      ':status': status,
      ':now': toISOString(now),
    };

    if (status === 'sent' || status === 'delivered') {
      updateExpression += ', sentAt = :sentAt';
      expressionAttributeValues[':sentAt'] = toISOString(now);
    }

    if (status === 'delivered') {
      updateExpression += ', deliveredAt = :deliveredAt';
      expressionAttributeValues[':deliveredAt'] = toISOString(now);
    }

    if (wppMessageId !== undefined && wppMessageId !== '') {
      updateExpression += ', wppMessageId = :wppId';
      expressionAttributeValues[':wppId'] = wppMessageId;
    }

    if (error !== undefined && error !== '') {
      updateExpression += ', lastError = :error';
      expressionAttributeValues[':error'] = error;
    }

    const command = new UpdateCommand({
      TableName: TableNames.WHATSAPP_NOTIFICATIONS,
      Key: { notificationId },
      UpdateExpression: updateExpression,
      ExpressionAttributeNames: {
        '#status': 'status',
      },
      ExpressionAttributeValues: expressionAttributeValues,
    });

    await this.docClient.send(command);
  }

  async incrementRetry(notificationId: string, nextRetryAt: Date): Promise<void> {
    const command = new UpdateCommand({
      TableName: TableNames.WHATSAPP_NOTIFICATIONS,
      Key: { notificationId },
      UpdateExpression:
        'SET retryCount = retryCount + :one, nextRetryAt = :nextRetry, updatedAt = :now',
      ExpressionAttributeValues: {
        ':one': 1,
        ':nextRetry': toISOString(nextRetryAt),
        ':now': toISOString(new Date()),
      },
    });

    await this.docClient.send(command);
  }

  async deleteAll(): Promise<number> {
    const command = new ScanCommand({
      TableName: TableNames.WHATSAPP_NOTIFICATIONS,
    });

    const result = await this.docClient.send(command);
    const count = result.Items?.length ?? 0;

    for (const item of (result.Items ?? []) as Array<Record<string, unknown>>) {
      const notificationId = item.notificationId as string;
      const deleteCommand = new DeleteCommand({
        TableName: TableNames.WHATSAPP_NOTIFICATIONS,
        Key: { notificationId },
      });
      await this.docClient.send(deleteCommand);
    }

    return count;
  }

  /**
   * Map DynamoDB item to WhatsAppNotification entity
   */
  private mapDocToNotification(item: Record<string, unknown>): WhatsAppNotification {
    const notification: WhatsAppNotification = {
      notificationId: item.notificationId as string,
      recipientPhone: item.recipientPhone as string,
      messageContent: item.messageContent as string,
      notificationType: item.notificationType as WhatsAppNotificationType,
      relatedEntityType: item.relatedEntityType as 'cardRequest' | 'payment',
      relatedEntityId: item.relatedEntityId as string,
      ecosystemId: item.ecosystemId as string,
      deliveryStatus: (item.status ?? item.deliveryStatus) as WhatsAppDeliveryStatus,
      retryCount: item.retryCount as number,
      createdAt: requireDate(item.createdAt, 'createdAt'),
    };

    // Optional fields
    if (item.recipientName !== undefined) {
      notification.recipientName = item.recipientName as string;
    }
    if (item.wppMessageId !== undefined) {
      notification.wppMessageId = item.wppMessageId as string;
    }
    if (item.lastError !== undefined) {
      notification.lastError = item.lastError as string;
    }

    const nextRetryAt = optionalDate(item.nextRetryAt);
    if (nextRetryAt) {
      notification.nextRetryAt = nextRetryAt;
    }

    const sentAt = optionalDate(item.sentAt);
    if (sentAt) {
      notification.sentAt = sentAt;
    }

    const deliveredAt = optionalDate(item.deliveredAt);
    if (deliveredAt) {
      notification.deliveredAt = deliveredAt;
    }

    return notification;
  }

  /**
   * Map WhatsAppNotification entity to DynamoDB item
   */
  private mapNotificationToDoc(notification: WhatsAppNotification): Record<string, unknown> {
    return stripUndefined({
      notificationId: notification.notificationId,
      recipientPhone: notification.recipientPhone,
      recipientName: notification.recipientName,
      messageContent: notification.messageContent,
      notificationType: notification.notificationType,
      relatedEntityType: notification.relatedEntityType,
      relatedEntityId: notification.relatedEntityId,
      ecosystemId: notification.ecosystemId,
      // Use 'status' as the attribute name for GSI
      status: notification.deliveryStatus,
      deliveryStatus: notification.deliveryStatus,
      wppMessageId: notification.wppMessageId,
      retryCount: notification.retryCount,
      lastError: notification.lastError,
      nextRetryAt: notification.nextRetryAt ? toISOString(notification.nextRetryAt) : undefined,
      createdAt: toISOString(notification.createdAt),
      sentAt: notification.sentAt ? toISOString(notification.sentAt) : undefined,
      deliveredAt: notification.deliveredAt ? toISOString(notification.deliveredAt) : undefined,
    });
  }
}
