/**
 * DynamoDB Card Repository
 *
 * DynamoDB implementation for card data persistence with optimistic locking.
 */

import type { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import {
  GetCommand,
  PutCommand,
  UpdateCommand,
  DeleteCommand,
  QueryCommand,
} from '@aws-sdk/lib-dynamodb';
import { ConditionalCheckFailedException } from '@aws-sdk/client-dynamodb';
import type {
  ICardRepository,
  CardFilter,
  CardBalanceUpdate,
} from '../interfaces/card.repository.js';
import { ConcurrencyError } from '../interfaces/card.repository.js';
import type { Card, CardStatus, ApprovalSource } from '../../../domain/entities/card.entity.js';
import { TableNames, GSINames } from './table-names.js';
import { toISOString, requireDate, optionalDate, stripUndefined } from './codec.js';

/**
 * DynamoDB Card Repository implementation
 */
export class DynamoDBCardRepository implements ICardRepository {
  constructor(private readonly docClient: DynamoDBDocumentClient) {}

  async findById(ecosystemId: string, cardId: string): Promise<Card | null> {
    const command = new GetCommand({
      TableName: TableNames.CARDS,
      Key: { ecosystemId, cardId },
    });

    const result = await this.docClient.send(command);

    if (!result.Item) {
      return null;
    }

    return this.mapDocToCard(result.Item);
  }

  async findByUser(ecosystemId: string, filter?: CardFilter): Promise<Card[]> {
    // If filtering by status, use the GSI
    if (filter?.status) {
      const command = new QueryCommand({
        TableName: TableNames.CARDS,
        IndexName: GSINames.CARDS_BY_STATUS,
        KeyConditionExpression: 'ecosystemId = :id AND #status = :status',
        ExpressionAttributeNames: {
          '#status': 'status',
        },
        ExpressionAttributeValues: {
          ':id': ecosystemId,
          ':status': filter.status,
        },
      });

      const result = await this.docClient.send(command);
      return (result.Items ?? []).map((item) => this.mapDocToCard(item));
    }

    // No filter - get all cards for user
    const command = new QueryCommand({
      TableName: TableNames.CARDS,
      KeyConditionExpression: 'ecosystemId = :id',
      ExpressionAttributeValues: {
        ':id': ecosystemId,
      },
    });

    const result = await this.docClient.send(command);
    return (result.Items ?? []).map((item) => this.mapDocToCard(item));
  }

  async save(ecosystemId: string, card: Card): Promise<void> {
    const command = new PutCommand({
      TableName: TableNames.CARDS,
      Item: this.mapCardToDoc(ecosystemId, card),
    });

    await this.docClient.send(command);
  }

  async updateBalance(
    ecosystemId: string,
    cardId: string,
    update: CardBalanceUpdate
  ): Promise<void> {
    const expectedVersion = update.version - 1;

    const command = new UpdateCommand({
      TableName: TableNames.CARDS,
      Key: { ecosystemId, cardId },
      UpdateExpression:
        'SET balance = :bal, availableCredit = :credit, minimumPayment = :minPay, version = :newVer, updatedAt = :now',
      ConditionExpression: 'version = :expectedVer',
      ExpressionAttributeValues: {
        ':bal': update.balance,
        ':credit': update.availableCredit,
        ':minPay': update.minimumPayment,
        ':newVer': update.version,
        ':expectedVer': expectedVersion,
        ':now': toISOString(new Date()),
      },
    });

    try {
      await this.docClient.send(command);
    } catch (error) {
      if (error instanceof ConditionalCheckFailedException) {
        // Fetch current version for error message
        const current = await this.findById(ecosystemId, cardId);
        throw new ConcurrencyError(cardId, expectedVersion, current?.version ?? -1);
      }
      throw error;
    }
  }

  async updateStatus(ecosystemId: string, cardId: string, status: CardStatus): Promise<void> {
    const now = new Date();

    // Build update expression based on status
    let updateExpression = 'SET #status = :status, updatedAt = :now';
    const expressionAttributeValues: Record<string, unknown> = {
      ':status': status,
      ':now': toISOString(now),
    };

    if (status === 'cancelled') {
      updateExpression += ', cancelledAt = :cancelledAt';
      expressionAttributeValues[':cancelledAt'] = toISOString(now);
    }

    const command = new UpdateCommand({
      TableName: TableNames.CARDS,
      Key: { ecosystemId, cardId },
      UpdateExpression: updateExpression,
      ExpressionAttributeNames: {
        '#status': 'status',
      },
      ExpressionAttributeValues: expressionAttributeValues,
    });

    await this.docClient.send(command);
  }

  async delete(ecosystemId: string, cardId: string): Promise<void> {
    const command = new DeleteCommand({
      TableName: TableNames.CARDS,
      Key: { ecosystemId, cardId },
    });

    await this.docClient.send(command);
  }

  async deleteAllForUser(ecosystemId: string): Promise<number> {
    const cards = await this.findByUser(ecosystemId);

    for (const card of cards) {
      await this.delete(ecosystemId, card.cardId);
    }

    return cards.length;
  }

  /**
   * Map DynamoDB item to Card entity
   */
  private mapDocToCard(item: Record<string, unknown>): Card {
    const card: Card = {
      cardId: item.cardId as string,
      type: item.type as 'credit-card',
      productId: item.productId as string,
      status: item.status as CardStatus,
      limit: item.limit as number,
      balance: item.balance as number,
      availableCredit: item.availableCredit as number,
      minimumPayment: item.minimumPayment as number,
      nextDueDate: requireDate(item.nextDueDate, 'nextDueDate'),
      version: item.version as number,
      approvedBy: item.approvedBy as ApprovalSource,
      scoreAtApproval: item.scoreAtApproval as number,
      createdAt: requireDate(item.createdAt, 'createdAt'),
      updatedAt: requireDate(item.updatedAt, 'updatedAt'),
    };

    // Optional fields
    if (item.statusReason !== undefined) {
      card.statusReason = item.statusReason as string;
    }
    if (item.approvedByAdminId !== undefined) {
      card.approvedByAdminId = item.approvedByAdminId as string;
    }
    const activatedAt = optionalDate(item.activatedAt);
    if (activatedAt) {
      card.activatedAt = activatedAt;
    }
    const cancelledAt = optionalDate(item.cancelledAt);
    if (cancelledAt) {
      card.cancelledAt = cancelledAt;
    }

    return card;
  }

  /**
   * Map Card entity to DynamoDB item
   */
  private mapCardToDoc(ecosystemId: string, card: Card): Record<string, unknown> {
    return stripUndefined({
      ecosystemId,
      cardId: card.cardId,
      type: card.type,
      productId: card.productId,
      status: card.status,
      statusReason: card.statusReason,
      limit: card.limit,
      balance: card.balance,
      availableCredit: card.availableCredit,
      minimumPayment: card.minimumPayment,
      nextDueDate: toISOString(card.nextDueDate),
      version: card.version,
      approvedBy: card.approvedBy,
      approvedByAdminId: card.approvedByAdminId,
      scoreAtApproval: card.scoreAtApproval,
      createdAt: toISOString(card.createdAt),
      updatedAt: toISOString(card.updatedAt),
      activatedAt: card.activatedAt ? toISOString(card.activatedAt) : undefined,
      cancelledAt: card.cancelledAt ? toISOString(card.cancelledAt) : undefined,
    });
  }
}
