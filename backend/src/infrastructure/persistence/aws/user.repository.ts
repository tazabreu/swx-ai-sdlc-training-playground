/**
 * DynamoDB User Repository
 *
 * DynamoDB implementation for user data persistence.
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
import type { IUserRepository } from '../interfaces/user.repository.js';
import type { User, UserTier, UserRole, UserStatus } from '../../../domain/entities/user.entity.js';
import type { Score, ScoreChangeReason } from '../../../domain/entities/score.entity.js';
import { createScore } from '../../../domain/entities/score.entity.js';
import { deriveTier } from '../../../domain/entities/user.entity.js';
import { TableNames, GSINames } from './table-names.js';
import {
  toISOString,
  requireDate,
  stripUndefined,
  timestampSortKey,
  parseTimestampSortKey,
} from './codec.js';

/**
 * Card summary type
 */
interface CardSummary {
  activeCards: number;
  totalBalance: number;
  totalLimit: number;
}

/**
 * DynamoDB User Repository implementation
 */
export class DynamoDBUserRepository implements IUserRepository {
  constructor(private readonly docClient: DynamoDBDocumentClient) {}

  async findById(ecosystemId: string): Promise<User | null> {
    const command = new GetCommand({
      TableName: TableNames.USERS,
      Key: { ecosystemId },
    });

    const result = await this.docClient.send(command);

    if (!result.Item) {
      return null;
    }

    return this.mapDocToUser(result.Item);
  }

  async findByFirebaseUid(firebaseUid: string): Promise<User | null> {
    const command = new QueryCommand({
      TableName: TableNames.USERS,
      IndexName: GSINames.USER_BY_FIREBASE_UID,
      KeyConditionExpression: 'firebaseUid = :uid',
      ExpressionAttributeValues: {
        ':uid': firebaseUid,
      },
      Limit: 1,
    });

    const result = await this.docClient.send(command);

    if (!result.Items || result.Items.length === 0) {
      return null;
    }

    return this.mapDocToUser(result.Items[0]!);
  }

  async save(user: User): Promise<void> {
    const command = new PutCommand({
      TableName: TableNames.USERS,
      Item: this.mapUserToDoc(user),
    });

    await this.docClient.send(command);
  }

  async updateScore(
    ecosystemId: string,
    newScore: number,
    reason: string,
    source: 'system' | 'admin',
    adminId?: string,
    relatedEntityType?: string,
    relatedEntityId?: string
  ): Promise<Score> {
    // First get current user to get previous score
    const user = await this.findById(ecosystemId);
    if (!user) {
      throw new Error(`User not found: ${ecosystemId}`);
    }

    const previousValue = user.currentScore;

    // Create score record
    const scoreInput: Parameters<typeof createScore>[0] = {
      newValue: newScore,
      previousValue,
      reason: reason as ScoreChangeReason,
      source,
    };
    if (adminId !== undefined) {
      scoreInput.sourceId = adminId;
    }
    if (relatedEntityType !== undefined) {
      scoreInput.relatedEntityType = relatedEntityType;
    }
    if (relatedEntityId !== undefined) {
      scoreInput.relatedEntityId = relatedEntityId;
    }

    const score = createScore(scoreInput);

    // Update user with new score
    const updateCommand = new UpdateCommand({
      TableName: TableNames.USERS,
      Key: { ecosystemId },
      UpdateExpression: 'SET currentScore = :score, tier = :tier, updatedAt = :now',
      ExpressionAttributeValues: {
        ':score': newScore,
        ':tier': deriveTier(newScore),
        ':now': toISOString(new Date()),
      },
    });

    await this.docClient.send(updateCommand);

    // Save score to history
    const scoreSortKey = timestampSortKey(score.timestamp, score.scoreId);
    const scoreCommand = new PutCommand({
      TableName: TableNames.SCORES,
      Item: stripUndefined({
        ecosystemId,
        timestampScoreId: scoreSortKey,
        scoreId: score.scoreId,
        value: score.value,
        previousValue: score.previousValue,
        delta: score.delta,
        reason: score.reason,
        source: score.source,
        sourceId: score.sourceId,
        relatedEntityType: score.relatedEntityType,
        relatedEntityId: score.relatedEntityId,
        createdAt: toISOString(score.timestamp),
      }),
    });

    await this.docClient.send(scoreCommand);

    return score;
  }

  async updateCardSummary(ecosystemId: string, cardSummary: CardSummary): Promise<void> {
    const command = new UpdateCommand({
      TableName: TableNames.USERS,
      Key: { ecosystemId },
      UpdateExpression: 'SET cardSummary = :summary, updatedAt = :now',
      ExpressionAttributeValues: {
        ':summary': cardSummary,
        ':now': toISOString(new Date()),
      },
    });

    await this.docClient.send(command);
  }

  async getScoreHistory(ecosystemId: string, limit?: number): Promise<Score[]> {
    const command = new QueryCommand({
      TableName: TableNames.SCORES,
      KeyConditionExpression: 'ecosystemId = :id',
      ExpressionAttributeValues: {
        ':id': ecosystemId,
      },
      ScanIndexForward: false, // Descending order
      Limit: limit,
    });

    const result = await this.docClient.send(command);

    return (result.Items ?? []).map((item) => this.mapDocToScore(item));
  }

  async delete(ecosystemId: string): Promise<void> {
    // Delete score history first
    const scoresCommand = new QueryCommand({
      TableName: TableNames.SCORES,
      KeyConditionExpression: 'ecosystemId = :id',
      ExpressionAttributeValues: {
        ':id': ecosystemId,
      },
    });

    const scoresResult = await this.docClient.send(scoresCommand);
    for (const item of (scoresResult.Items ?? []) as Array<Record<string, unknown>>) {
      const timestampScoreId = item.timestampScoreId as string;
      const deleteScoreCommand = new DeleteCommand({
        TableName: TableNames.SCORES,
        Key: { ecosystemId, timestampScoreId },
      });
      await this.docClient.send(deleteScoreCommand);
    }

    // Delete user
    const command = new DeleteCommand({
      TableName: TableNames.USERS,
      Key: { ecosystemId },
    });

    await this.docClient.send(command);
  }

  async deleteAll(): Promise<number> {
    const scanCommand = new ScanCommand({
      TableName: TableNames.USERS,
      ProjectionExpression: 'ecosystemId',
    });

    const result = await this.docClient.send(scanCommand);
    const count = result.Items?.length ?? 0;

    for (const item of result.Items ?? []) {
      await this.delete(item.ecosystemId as string);
    }

    return count;
  }

  /**
   * Map DynamoDB item to User entity
   */
  private mapDocToUser(item: Record<string, unknown>): User {
    return {
      ecosystemId: item.ecosystemId as string,
      firebaseUid: item.firebaseUid as string,
      email: item.email as string,
      role: item.role as UserRole,
      status: item.status as UserStatus,
      currentScore: item.currentScore as number,
      tier: item.tier as UserTier,
      cardSummary: item.cardSummary as CardSummary,
      createdAt: requireDate(item.createdAt, 'createdAt'),
      updatedAt: requireDate(item.updatedAt, 'updatedAt'),
      lastLoginAt: requireDate(item.lastLoginAt, 'lastLoginAt'),
    };
  }

  /**
   * Map User entity to DynamoDB item
   */
  private mapUserToDoc(user: User): Record<string, unknown> {
    return {
      ecosystemId: user.ecosystemId,
      firebaseUid: user.firebaseUid,
      email: user.email,
      role: user.role,
      status: user.status,
      currentScore: user.currentScore,
      tier: user.tier,
      cardSummary: user.cardSummary,
      createdAt: toISOString(user.createdAt),
      updatedAt: toISOString(user.updatedAt),
      lastLoginAt: toISOString(user.lastLoginAt),
    };
  }

  /**
   * Map DynamoDB item to Score entity
   */
  private mapDocToScore(item: Record<string, unknown>): Score {
    const { timestamp } = parseTimestampSortKey(item.timestampScoreId as string);

    const score: Score = {
      scoreId: item.scoreId as string,
      value: item.value as number,
      previousValue: item.previousValue as number,
      delta: item.delta as number,
      reason: item.reason as ScoreChangeReason,
      source: item.source as 'system' | 'admin',
      timestamp,
    };

    if (item.sourceId !== undefined) {
      score.sourceId = item.sourceId as string;
    }
    if (item.relatedEntityType !== undefined) {
      score.relatedEntityType = item.relatedEntityType as string;
    }
    if (item.relatedEntityId !== undefined) {
      score.relatedEntityId = item.relatedEntityId as string;
    }

    return score;
  }
}
