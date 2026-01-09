/**
 * DynamoDB Backend Edge Case Tests
 *
 * Focused integration tests for DynamoDB-specific behaviors that are easy to
 * drift from other backends (optimistic locking, TTL semantics, outbox retries).
 */

import { describe, it, expect, beforeAll } from 'bun:test';
import {
  createTestContext,
  isBackendAvailable,
  type TestContext,
} from '../../../setup/test-container.factory.js';
import { createTestCard } from '../../../setup/fixtures/index.js';
import { createIdempotencyRecord } from '../../../../src/domain/entities/idempotency-record.entity.js';
import { createEvent } from '../../../../src/domain/entities/event.entity.js';
import { ConcurrencyError } from '../../../../src/infrastructure/persistence/interfaces/card.repository.js';
import { GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import {
  getDocumentClient,
  TableNames,
  toISOString,
} from '../../../../src/infrastructure/persistence/aws/index.js';

const describeDynamoDB = isBackendAvailable('dynamodb') ? describe : describe.skip;

describeDynamoDB('DynamoDB Backend Edge Cases', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestContext('dynamodb');
  });

  it('throws ConcurrencyError on stale card balance update version', async () => {
    const ecosystemId = `ddb-edge-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const card = createTestCard({
      cardId: `card-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    });

    await ctx.repositories.cardRepository.save(ecosystemId, card);

    await ctx.repositories.cardRepository.updateBalance(ecosystemId, card.cardId, {
      balance: 1000,
      availableCredit: card.limit - 1000,
      minimumPayment: 50,
      version: card.version + 1,
    });

    let caught: unknown = null;
    try {
      // Still using expectedVersion=1 even though current is 2
      await ctx.repositories.cardRepository.updateBalance(ecosystemId, card.cardId, {
        balance: 1500,
        availableCredit: card.limit - 1500,
        minimumPayment: 75,
        version: card.version + 1,
      });
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(ConcurrencyError);
    const err = caught as ConcurrencyError;
    expect(err.cardId).toBe(card.cardId);
    expect(err.expectedVersion).toBe(1);
    expect(err.actualVersion).toBe(2);
  });

  it('treats expired idempotency records as missing even if not yet deleted by TTL', async () => {
    const ecosystemId = `ddb-idem-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const key = `idem-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const base = createIdempotencyRecord({
      key,
      operation: 'test',
      response: { ok: true },
      statusCode: 200,
    });

    const expiredRecord = {
      ...base,
      expiresAt: new Date(Date.now() - 60_000),
    };

    await ctx.repositories.idempotencyRepository.save(ecosystemId, expiredRecord);

    const found = await ctx.repositories.idempotencyRepository.find(
      ecosystemId,
      expiredRecord.keyHash
    );
    expect(found).toBeNull();
  });

  it('allocates monotonic outbox sequence numbers per entity when sequenceNumber=0', async () => {
    const ecosystemId = `ddb-outbox-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const entityType = 'user';
    const entityId = `user-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const outboxRepo = ctx.repositories.outboxRepository;

    const event1 = createEvent({
      eventType: 'user.created',
      entityType,
      entityId,
      ecosystemId,
      payload: { n: 1 },
      sequenceNumber: 0,
    });

    const event2 = createEvent({
      eventType: 'user.updated',
      entityType,
      entityId,
      ecosystemId,
      payload: { n: 2 },
      sequenceNumber: 0,
    });

    await outboxRepo.save(event1);
    await outboxRepo.save(event2);

    const docClient = getDocumentClient({
      endpoint: process.env.AWS_ENDPOINT_URL,
      region: process.env.AWS_REGION,
    });

    const stored1 = await docClient.send(
      new GetCommand({
        TableName: TableNames.OUTBOX,
        Key: { eventId: event1.eventId },
      })
    );
    const stored2 = await docClient.send(
      new GetCommand({
        TableName: TableNames.OUTBOX,
        Key: { eventId: event2.eventId },
      })
    );

    expect(stored1.Item?.sequenceNumber).toBe(1);
    expect(stored2.Item?.sequenceNumber).toBe(2);
  });

  it('supports retry discovery when failed event nextRetryAt is in the past', async () => {
    const ecosystemId = `ddb-retry-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const entityId = `entity-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const outboxRepo = ctx.repositories.outboxRepository;

    const event = createEvent({
      eventType: 'transaction.payment',
      entityType: 'payment',
      entityId,
      ecosystemId,
      payload: { amount: 10 },
      sequenceNumber: 1,
    });

    await outboxRepo.save(event);
    await outboxRepo.markFailed(event.eventId, 'simulated failure');

    const docClient = getDocumentClient({
      endpoint: process.env.AWS_ENDPOINT_URL,
      region: process.env.AWS_REGION,
    });

    // Force nextRetryAt into the past so the repository should consider it ready.
    await docClient.send(
      new UpdateCommand({
        TableName: TableNames.OUTBOX,
        Key: { eventId: event.eventId },
        UpdateExpression: 'SET nextRetryAt = :past',
        ExpressionAttributeValues: {
          ':past': toISOString(new Date(Date.now() - 5_000)),
        },
      })
    );

    const ready = await outboxRepo.findReadyForRetry(50);
    expect(ready.some((e) => e.eventId === event.eventId)).toBe(true);
  });
});
