/**
 * InMemory Outbox Repository
 *
 * In-memory implementation for outbox event storage.
 */

/* eslint-disable @typescript-eslint/require-await */

import type { IOutboxRepository } from '../interfaces/outbox.repository.js';
import type { OutboxEvent } from '../../../domain/entities/event.entity.js';

/**
 * InMemory Outbox Repository implementation
 */
export class InMemoryOutboxRepository implements IOutboxRepository {
  private events: Map<string, OutboxEvent> = new Map();
  private sequences: Map<string, number> = new Map();

  private shouldAllocateSequence(): boolean {
    return (process.env.OUTBOX_SEQUENCE_STRATEGY ?? 'repository') !== 'caller';
  }

  private entitySequenceKey(event: OutboxEvent): string {
    return `${event.ecosystemId}:${event.entityType}:${event.entityId}`;
  }

  async save(event: OutboxEvent): Promise<void> {
    let toSave = { ...event };

    if (toSave.sequenceNumber === 0) {
      if (!this.shouldAllocateSequence()) {
        throw new Error(
          'Outbox event sequenceNumber must be provided when OUTBOX_SEQUENCE_STRATEGY=caller'
        );
      }

      const key = this.entitySequenceKey(toSave);
      const next = (this.sequences.get(key) ?? 0) + 1;
      this.sequences.set(key, next);
      toSave = { ...toSave, sequenceNumber: next };
    }

    this.events.set(toSave.eventId, toSave);
  }

  async findPending(limit = 100): Promise<OutboxEvent[]> {
    const pending: OutboxEvent[] = [];

    for (const event of this.events.values()) {
      if (event.status === 'pending') {
        pending.push(event);
        if (pending.length >= limit) break;
      }
    }

    // Sort by createdAt ascending (oldest first)
    pending.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

    return pending;
  }

  async markSent(eventId: string): Promise<void> {
    const event = this.events.get(eventId);
    if (event === undefined) {
      throw new Error(`Event not found: ${eventId}`);
    }

    const updatedEvent: OutboxEvent = {
      ...event,
      status: 'sent',
      sentAt: new Date(),
    };
    this.events.set(eventId, updatedEvent);
  }

  async markFailed(eventId: string, error: string): Promise<void> {
    const event = this.events.get(eventId);
    if (event === undefined) {
      throw new Error(`Event not found: ${eventId}`);
    }

    const updatedEvent: OutboxEvent = {
      ...event,
      status: 'failed',
      retryCount: event.retryCount + 1,
      lastError: error,
      nextRetryAt: new Date(Date.now() + this.calculateBackoff(event.retryCount + 1)),
    };
    this.events.set(eventId, updatedEvent);
  }

  async markDeadLettered(eventId: string, error: string): Promise<void> {
    const event = this.events.get(eventId);
    if (event === undefined) {
      throw new Error(`Event not found: ${eventId}`);
    }

    const updatedEvent: OutboxEvent = {
      ...event,
      status: 'dead_letter',
      lastError: error,
    };
    this.events.set(eventId, updatedEvent);
  }

  async findReadyForRetry(limit = 100): Promise<OutboxEvent[]> {
    const now = Date.now();
    const readyForRetry: OutboxEvent[] = [];

    for (const event of this.events.values()) {
      if (
        event.status === 'failed' &&
        event.nextRetryAt !== undefined &&
        event.nextRetryAt.getTime() <= now
      ) {
        readyForRetry.push(event);
        if (readyForRetry.length >= limit) break;
      }
    }

    // Sort by nextRetryAt ascending (oldest first)
    readyForRetry.sort((a, b) => {
      const aTime = a.nextRetryAt?.getTime() ?? 0;
      const bTime = b.nextRetryAt?.getTime() ?? 0;
      return aTime - bTime;
    });

    return readyForRetry;
  }

  async clear(): Promise<number> {
    const count = this.events.size;
    this.events.clear();
    this.sequences.clear();
    return count;
  }

  // Test helper methods
  getAll(): OutboxEvent[] {
    return Array.from(this.events.values());
  }

  /**
   * Calculate exponential backoff delay
   */
  private calculateBackoff(retryCount: number): number {
    // Exponential backoff: 1s, 2s, 4s, 8s, 16s... capped at 5 minutes
    const baseDelayMs = 1000;
    const maxDelayMs = 5 * 60 * 1000;
    const delay = Math.min(baseDelayMs * Math.pow(2, retryCount - 1), maxDelayMs);
    return delay;
  }
}
