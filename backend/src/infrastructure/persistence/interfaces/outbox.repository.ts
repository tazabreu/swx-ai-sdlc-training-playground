/**
 * Outbox Repository Interface
 *
 * Contract for outbox event data access operations.
 */

import type { OutboxEvent } from '../../../domain/entities/event.entity.js';

/**
 * Outbox repository interface
 */
export interface IOutboxRepository {
  /**
   * Save event to outbox
   */
  save(event: OutboxEvent): Promise<void>;

  /**
   * Find pending events (for processing)
   */
  findPending(limit?: number): Promise<OutboxEvent[]>;

  /**
   * Mark event as sent
   */
  markSent(eventId: string): Promise<void>;

  /**
   * Mark event as failed
   */
  markFailed(eventId: string, error: string): Promise<void>;

  /**
   * Mark event as dead-lettered
   */
  markDeadLettered(eventId: string, error: string): Promise<void>;

  /**
   * Get events ready for retry
   */
  findReadyForRetry(limit?: number): Promise<OutboxEvent[]>;

  /**
   * Clear all events (for cleanup)
   */
  clear(): Promise<number>;
}
