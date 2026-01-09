/**
 * DynamoDB Transaction Repository
 *
 * DynamoDB implementation for transaction data persistence.
 */

import type { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import {
  GetCommand,
  PutCommand,
  DeleteCommand,
  QueryCommand,
  ScanCommand,
} from '@aws-sdk/lib-dynamodb';
import type {
  ITransactionRepository,
  TransactionFilter,
  TransactionPaginationOptions,
  PaginatedTransactions,
} from '../interfaces/transaction.repository.js';
import type {
  Transaction,
  TransactionType,
  PaymentStatus,
  TransactionStatus,
} from '../../../domain/entities/transaction.entity.js';
import { TableNames } from './table-names.js';
import {
  toISOString,
  requireDate,
  stripUndefined,
  compositeKey,
  encodeCursor,
  decodeCursor,
} from './codec.js';

/**
 * DynamoDB Transaction Repository implementation
 */
export class DynamoDBTransactionRepository implements ITransactionRepository {
  constructor(private readonly docClient: DynamoDBDocumentClient) {}

  async findByCard(
    ecosystemId: string,
    cardId: string,
    filter?: TransactionFilter,
    pagination?: TransactionPaginationOptions
  ): Promise<PaginatedTransactions> {
    const pk = compositeKey(ecosystemId, cardId);
    const limit = pagination?.limit ?? 20;
    const exclusiveStartKey = decodeCursor(pagination?.cursor);

    let filterExpression: string | undefined;
    const expressionAttributeValues: Record<string, unknown> = {
      ':pk': pk,
    };

    if (filter?.type) {
      filterExpression = '#type = :type';
      expressionAttributeValues[':type'] = filter.type;
    }

    const command = new QueryCommand({
      TableName: TableNames.TRANSACTIONS,
      KeyConditionExpression: 'ecosystemIdCardId = :pk',
      FilterExpression: filterExpression,
      ExpressionAttributeNames: filter?.type ? { '#type': 'type' } : undefined,
      ExpressionAttributeValues: expressionAttributeValues,
      ScanIndexForward: false, // Most recent first
      Limit: limit + 1,
      ExclusiveStartKey: exclusiveStartKey,
    });

    const result = await this.docClient.send(command);
    const items = result.Items ?? [];

    const hasMore = items.length > limit;
    const transactions = items.slice(0, limit).map((item) => this.mapDocToTransaction(item));

    return {
      transactions,
      nextCursor: hasMore ? encodeCursor(result.LastEvaluatedKey) : undefined,
      hasMore,
    };
  }

  async findById(
    ecosystemId: string,
    cardId: string,
    transactionId: string
  ): Promise<Transaction | null> {
    const pk = compositeKey(ecosystemId, cardId);

    const command = new GetCommand({
      TableName: TableNames.TRANSACTIONS,
      Key: {
        ecosystemIdCardId: pk,
        transactionId,
      },
    });

    const result = await this.docClient.send(command);

    if (!result.Item) {
      return null;
    }

    return this.mapDocToTransaction(result.Item);
  }

  async save(ecosystemId: string, cardId: string, transaction: Transaction): Promise<void> {
    const pk = compositeKey(ecosystemId, cardId);

    const command = new PutCommand({
      TableName: TableNames.TRANSACTIONS,
      Item: this.mapTransactionToDoc(pk, transaction),
    });

    await this.docClient.send(command);
  }

  async getRecent(ecosystemId: string, cardId: string, limit?: number): Promise<Transaction[]> {
    const pk = compositeKey(ecosystemId, cardId);

    const command = new QueryCommand({
      TableName: TableNames.TRANSACTIONS,
      KeyConditionExpression: 'ecosystemIdCardId = :pk',
      ExpressionAttributeValues: {
        ':pk': pk,
      },
      ScanIndexForward: false, // Most recent first
      Limit: limit ?? 10,
    });

    const result = await this.docClient.send(command);
    return (result.Items ?? []).map((item) => this.mapDocToTransaction(item));
  }

  async deleteAllForCard(ecosystemId: string, cardId: string): Promise<number> {
    const pk = compositeKey(ecosystemId, cardId);

    const command = new QueryCommand({
      TableName: TableNames.TRANSACTIONS,
      KeyConditionExpression: 'ecosystemIdCardId = :pk',
      ExpressionAttributeValues: {
        ':pk': pk,
      },
    });

    const result = await this.docClient.send(command);
    const count = result.Items?.length ?? 0;

    for (const item of (result.Items ?? []) as Array<Record<string, unknown>>) {
      const transactionId = item.transactionId as string;
      const deleteCommand = new DeleteCommand({
        TableName: TableNames.TRANSACTIONS,
        Key: { ecosystemIdCardId: pk, transactionId },
      });
      await this.docClient.send(deleteCommand);
    }

    return count;
  }

  async deleteAllForUser(ecosystemId: string): Promise<number> {
    // Scan for all transactions with ecosystemId prefix in the PK
    const scanCommand = new ScanCommand({
      TableName: TableNames.TRANSACTIONS,
      FilterExpression: 'begins_with(ecosystemIdCardId, :prefix)',
      ExpressionAttributeValues: {
        ':prefix': `${ecosystemId}#`,
      },
    });

    const scanResult = await this.docClient.send(scanCommand);
    const count = scanResult.Items?.length ?? 0;

    for (const item of (scanResult.Items ?? []) as Array<Record<string, unknown>>) {
      const ecosystemIdCardId = item.ecosystemIdCardId as string;
      const transactionId = item.transactionId as string;
      const deleteCommand = new DeleteCommand({
        TableName: TableNames.TRANSACTIONS,
        Key: { ecosystemIdCardId, transactionId },
      });
      await this.docClient.send(deleteCommand);
    }

    return count;
  }

  /**
   * Map DynamoDB item to Transaction entity
   */
  private mapDocToTransaction(item: Record<string, unknown>): Transaction {
    const transaction: Transaction = {
      transactionId: item.transactionId as string,
      type: item.type as TransactionType,
      amount: item.amount as number,
      idempotencyKey: item.idempotencyKey as string,
      status: item.status as TransactionStatus,
      timestamp: requireDate(item.timestamp, 'timestamp'),
      processedAt: requireDate(item.processedAt, 'processedAt'),
    };

    // Optional fields
    if (item.merchant !== undefined) {
      transaction.merchant = item.merchant as string;
    }
    if (item.paymentStatus !== undefined) {
      transaction.paymentStatus = item.paymentStatus as PaymentStatus;
    }
    if (item.daysOverdue !== undefined) {
      transaction.daysOverdue = item.daysOverdue as number;
    }
    if (item.scoreImpact !== undefined) {
      transaction.scoreImpact = item.scoreImpact as number;
    }
    if (item.failureReason !== undefined) {
      transaction.failureReason = item.failureReason as string;
    }

    return transaction;
  }

  /**
   * Map Transaction entity to DynamoDB item
   */
  private mapTransactionToDoc(pk: string, transaction: Transaction): Record<string, unknown> {
    return stripUndefined({
      ecosystemIdCardId: pk,
      transactionId: transaction.transactionId,
      type: transaction.type,
      amount: transaction.amount,
      merchant: transaction.merchant,
      paymentStatus: transaction.paymentStatus,
      daysOverdue: transaction.daysOverdue,
      scoreImpact: transaction.scoreImpact,
      idempotencyKey: transaction.idempotencyKey,
      status: transaction.status,
      failureReason: transaction.failureReason,
      timestamp: toISOString(transaction.timestamp),
      processedAt: toISOString(transaction.processedAt),
    });
  }
}
