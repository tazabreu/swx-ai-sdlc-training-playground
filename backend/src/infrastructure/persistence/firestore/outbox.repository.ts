/**
 * Firestore Outbox Repository
 *
 * Firestore implementation for outbox event storage.
 */

import type { Firestore } from 'firebase-admin/firestore';
import type { IOutboxRepository } from '../interfaces/outbox.repository.js';
import type { OutboxEvent, EventType, EventStatus } from '../../../domain/entities/event.entity.js';
import { CollectionPaths } from './client.js';
import { createHash } from 'crypto';
import { requireDate, optionalDate, stripUndefined } from './codec.js';

/**
 * Firestore Outbox Repository implementation
 */
export class FirestoreOutboxRepository implements IOutboxRepository {
  constructor(private readonly db: Firestore) {}

  async save(event: OutboxEvent): Promise<void> {
    if (event.sequenceNumber === 0 && this.shouldAllocateSequence()) {
      await this.saveWithAllocatedSequence(event);
      return;
    }

    if (event.sequenceNumber === 0 && !this.shouldAllocateSequence()) {
      throw new Error(
        'Outbox event sequenceNumber must be provided when OUTBOX_SEQUENCE_STRATEGY=caller'
      );
    }

    await this.db
      .collection(CollectionPaths.OUTBOX)
      .doc(event.eventId)
      .set(this.mapEventToDoc(event));
  }

  async findPending(limit = 100): Promise<OutboxEvent[]> {
    const snapshot = await this.db
      .collection(CollectionPaths.OUTBOX)
      .where('status', '==', 'pending')
      .orderBy('createdAt', 'asc')
      .limit(limit)
      .get();

    return snapshot.docs.map((doc) => this.mapDocToEvent(doc.id, doc.data()));
  }

  async markSent(eventId: string): Promise<void> {
    const eventRef = this.db.collection(CollectionPaths.OUTBOX).doc(eventId);

    await eventRef.update({
      status: 'sent',
      sentAt: new Date(),
    });
  }

  async markFailed(eventId: string, error: string): Promise<void> {
    const eventRef = this.db.collection(CollectionPaths.OUTBOX).doc(eventId);

    await this.db.runTransaction(async (transaction) => {
      const eventDoc = await transaction.get(eventRef);

      if (!eventDoc.exists) {
        throw new Error(`Event not found: ${eventId}`);
      }

      const currentRetryCount = eventDoc.data()!.retryCount as number;
      const newRetryCount = currentRetryCount + 1;
      const nextRetryAt = new Date(Date.now() + this.calculateBackoff(newRetryCount));

      transaction.update(eventRef, {
        status: 'failed',
        retryCount: newRetryCount,
        lastError: error,
        nextRetryAt,
      });
    });
  }

  async markDeadLettered(eventId: string, error: string): Promise<void> {
    await this.db.collection(CollectionPaths.OUTBOX).doc(eventId).update({
      status: 'dead_letter',
      lastError: error,
    });
  }

  async findReadyForRetry(limit = 100): Promise<OutboxEvent[]> {
    const now = new Date();

    const snapshot = await this.db
      .collection(CollectionPaths.OUTBOX)
      .where('status', '==', 'failed')
      .where('nextRetryAt', '<=', now)
      .orderBy('nextRetryAt', 'asc')
      .limit(limit)
      .get();

    return snapshot.docs.map((doc) => this.mapDocToEvent(doc.id, doc.data()));
  }

  async clear(): Promise<number> {
    const snapshot = await this.db.collection(CollectionPaths.OUTBOX).get();
    const count = snapshot.size;

    // Delete in batches of 500
    const batchSize = 500;
    const docs = snapshot.docs;

    for (let i = 0; i < docs.length; i += batchSize) {
      const batch = this.db.batch();
      const batchDocs = docs.slice(i, i + batchSize);

      batchDocs.forEach((doc) => batch.delete(doc.ref));
      await batch.commit();
    }

    return count;
  }

  private shouldAllocateSequence(): boolean {
    return (process.env.OUTBOX_SEQUENCE_STRATEGY ?? 'repository') !== 'caller';
  }

  private entitySequenceKey(event: OutboxEvent): string {
    return `${event.ecosystemId}:${event.entityType}:${event.entityId}`;
  }

  private sequenceDocIdFor(entityKey: string): string {
    return createHash('sha256').update(entityKey).digest('hex');
  }

  private async saveWithAllocatedSequence(event: OutboxEvent): Promise<void> {
    const entityKey = this.entitySequenceKey(event);
    const sequenceId = this.sequenceDocIdFor(entityKey);

    const sequenceRef = this.db.collection(CollectionPaths.OUTBOX_SEQUENCES).doc(sequenceId);
    const outboxRef = this.db.collection(CollectionPaths.OUTBOX).doc(event.eventId);

    await this.db.runTransaction(async (transaction) => {
      const sequenceDoc = await transaction.get(sequenceRef);
      const current = sequenceDoc.exists ? (sequenceDoc.data()!.current as number) : 0;
      const next = current + 1;

      transaction.set(
        sequenceRef,
        {
          entityKey,
          current: next,
          updatedAt: new Date(),
        },
        { merge: true }
      );

      const withSequence: OutboxEvent = { ...event, sequenceNumber: next };
      transaction.set(outboxRef, this.mapEventToDoc(withSequence));
    });
  }

  /**
   * Map Firestore document to OutboxEvent entity
   */
  private mapDocToEvent(eventId: string, data: Record<string, unknown>): OutboxEvent {
    const event: OutboxEvent = {
      eventId,
      eventType: data.eventType as EventType,
      entityType: data.entityType as string,
      entityId: data.entityId as string,
      ecosystemId: data.ecosystemId as string,
      sequenceNumber: data.sequenceNumber as number,
      payload: data.payload as { [key: string]: unknown },
      status: data.status as EventStatus,
      retryCount: data.retryCount as number,
      nextRetryAt: requireDate(data.nextRetryAt, 'nextRetryAt'),
      createdAt: requireDate(data.createdAt, 'createdAt'),
    };

    if (data.lastError !== undefined) {
      event.lastError = data.lastError as string;
    }
    if (data.sentAt !== undefined) {
      const sentAt = optionalDate(data.sentAt, 'sentAt');
      if (sentAt !== undefined) {
        event.sentAt = sentAt;
      }
    }

    return event;
  }

  /**
   * Map OutboxEvent entity to Firestore document
   */
  private mapEventToDoc(event: OutboxEvent): Record<string, unknown> {
    const doc: Record<string, unknown> = {
      eventType: event.eventType,
      entityType: event.entityType,
      entityId: event.entityId,
      ecosystemId: event.ecosystemId,
      sequenceNumber: event.sequenceNumber,
      payload: stripUndefined(event.payload),
      status: event.status,
      retryCount: event.retryCount,
      nextRetryAt: event.nextRetryAt,
      createdAt: event.createdAt,
    };

    if (event.lastError !== undefined) {
      doc.lastError = event.lastError;
    }
    if (event.sentAt !== undefined) {
      doc.sentAt = event.sentAt;
    }

    return doc;
  }

  /**
   * Calculate exponential backoff delay
   */
  private calculateBackoff(retryCount: number): number {
    // Exponential backoff: 10s, 20s, 40s, 80s, 160s... capped at 5 minutes
    const baseDelayMs = 10000;
    const maxDelayMs = 5 * 60 * 1000;
    const delay = Math.min(baseDelayMs * Math.pow(2, retryCount - 1), maxDelayMs);
    return delay;
  }
}
