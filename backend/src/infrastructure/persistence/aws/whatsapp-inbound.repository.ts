/**
 * DynamoDB WhatsApp Inbound Repository
 *
 * DynamoDB implementation for WhatsApp inbound message data persistence.
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
import type { IWhatsAppInboundRepository } from '../interfaces/whatsapp-inbound.repository.js';
import type { WhatsAppInboundMessage } from '../../../domain/entities/whatsapp-inbound.entity.js';
import type { ParsedCommand, InboundMessageStatus } from '../../whatsapp/types.js';
import { TableNames, GSINames } from './table-names.js';
import { toISOString, requireDate, optionalDate, stripUndefined } from './codec.js';

/**
 * DynamoDB WhatsApp Inbound Repository implementation
 */
export class DynamoDBWhatsAppInboundRepository implements IWhatsAppInboundRepository {
  constructor(private readonly docClient: DynamoDBDocumentClient) {}

  async save(message: WhatsAppInboundMessage): Promise<void> {
    const command = new PutCommand({
      TableName: TableNames.WHATSAPP_INBOUND,
      Item: this.mapMessageToDoc(message),
    });

    await this.docClient.send(command);
  }

  async findById(messageId: string): Promise<WhatsAppInboundMessage | null> {
    const command = new GetCommand({
      TableName: TableNames.WHATSAPP_INBOUND,
      Key: { messageId },
    });

    const result = await this.docClient.send(command);

    if (!result.Item) {
      return null;
    }

    return this.mapDocToMessage(result.Item);
  }

  async findByWppMessageId(wppMessageId: string): Promise<WhatsAppInboundMessage | null> {
    const command = new QueryCommand({
      TableName: TableNames.WHATSAPP_INBOUND,
      IndexName: GSINames.BY_WPP_MESSAGE_ID,
      KeyConditionExpression: 'wppMessageId = :id',
      ExpressionAttributeValues: {
        ':id': wppMessageId,
      },
      Limit: 1,
    });

    const result = await this.docClient.send(command);

    if (!result.Items || result.Items.length === 0) {
      return null;
    }

    return this.mapDocToMessage(result.Items[0]!);
  }

  async findBySenderPhone(phone: string, since?: Date): Promise<WhatsAppInboundMessage[]> {
    let keyConditionExpression = 'senderPhone = :phone';
    const expressionAttributeValues: Record<string, unknown> = {
      ':phone': phone,
    };

    if (since) {
      keyConditionExpression += ' AND receivedAt >= :since';
      expressionAttributeValues[':since'] = toISOString(since);
    }

    const command = new QueryCommand({
      TableName: TableNames.WHATSAPP_INBOUND,
      IndexName: GSINames.BY_SENDER_PHONE,
      KeyConditionExpression: keyConditionExpression,
      ExpressionAttributeValues: expressionAttributeValues,
      ScanIndexForward: false, // Most recent first
    });

    const result = await this.docClient.send(command);
    return (result.Items ?? []).map((item) => this.mapDocToMessage(item));
  }

  async updateProcessingStatus(
    messageId: string,
    status: InboundMessageStatus,
    action?: string,
    error?: string
  ): Promise<void> {
    let updateExpression = 'SET processedStatus = :status, processedAt = :now';
    const expressionAttributeValues: Record<string, unknown> = {
      ':status': status,
      ':now': toISOString(new Date()),
    };

    if (action !== undefined && action !== '') {
      updateExpression += ', processedAction = :action';
      expressionAttributeValues[':action'] = action;
    }

    if (error !== undefined && error !== '') {
      updateExpression += ', processingError = :error';
      expressionAttributeValues[':error'] = error;
    }

    const command = new UpdateCommand({
      TableName: TableNames.WHATSAPP_INBOUND,
      Key: { messageId },
      UpdateExpression: updateExpression,
      ExpressionAttributeValues: expressionAttributeValues,
    });

    await this.docClient.send(command);
  }

  async deleteAll(): Promise<number> {
    const command = new ScanCommand({
      TableName: TableNames.WHATSAPP_INBOUND,
    });

    const result = await this.docClient.send(command);
    const count = result.Items?.length ?? 0;

    for (const item of (result.Items ?? []) as Array<Record<string, unknown>>) {
      const messageId = item.messageId as string;
      const deleteCommand = new DeleteCommand({
        TableName: TableNames.WHATSAPP_INBOUND,
        Key: { messageId },
      });
      await this.docClient.send(deleteCommand);
    }

    return count;
  }

  /**
   * Map DynamoDB item to WhatsAppInboundMessage entity
   */
  private mapDocToMessage(item: Record<string, unknown>): WhatsAppInboundMessage {
    const message: WhatsAppInboundMessage = {
      messageId: item.messageId as string,
      senderPhone: item.senderPhone as string,
      isFromWhitelistedAdmin: item.isFromWhitelistedAdmin as boolean,
      rawBody: item.rawBody as string,
      processedStatus: item.processedStatus as InboundMessageStatus,
      receivedAt: requireDate(item.receivedAt, 'receivedAt'),
    };

    // Optional fields
    if (item.wppMessageId !== undefined) {
      message.wppMessageId = item.wppMessageId as string;
    }
    if (item.senderName !== undefined) {
      message.senderName = item.senderName as string;
    }
    if (item.parsedCommand !== undefined) {
      message.parsedCommand = item.parsedCommand as ParsedCommand;
    }
    if (item.processedAction !== undefined) {
      message.processedAction = item.processedAction as string;
    }
    if (item.processingError !== undefined) {
      message.processingError = item.processingError as string;
    }
    if (item.relatedRequestId !== undefined) {
      message.relatedRequestId = item.relatedRequestId as string;
    }
    if (item.relatedEcosystemId !== undefined) {
      message.relatedEcosystemId = item.relatedEcosystemId as string;
    }

    const processedAt = optionalDate(item.processedAt);
    if (processedAt) {
      message.processedAt = processedAt;
    }

    return message;
  }

  /**
   * Map WhatsAppInboundMessage entity to DynamoDB item
   */
  private mapMessageToDoc(message: WhatsAppInboundMessage): Record<string, unknown> {
    return stripUndefined({
      messageId: message.messageId,
      wppMessageId: message.wppMessageId,
      senderPhone: message.senderPhone,
      senderName: message.senderName,
      isFromWhitelistedAdmin: message.isFromWhitelistedAdmin,
      rawBody: message.rawBody,
      parsedCommand: message.parsedCommand,
      processedStatus: message.processedStatus,
      processedAction: message.processedAction,
      processingError: message.processingError,
      relatedRequestId: message.relatedRequestId,
      relatedEcosystemId: message.relatedEcosystemId,
      receivedAt: toISOString(message.receivedAt),
      processedAt: message.processedAt ? toISOString(message.processedAt) : undefined,
    });
  }
}
