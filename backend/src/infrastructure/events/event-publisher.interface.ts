/**
 * Event Publisher Interface
 *
 * Contract for event publishing implementations.
 * Abstracts the publishing mechanism (Pub/Sub, in-memory, etc.)
 */

import type { OutboxEvent } from '../../domain/entities/event.entity.js';

/**
 * Event handler callback type
 */
export type EventHandler = (event: OutboxEvent) => Promise<void>;

/**
 * Event publisher interface
 */
export interface IEventPublisher {
  /**
   * Publish an event to the message stream
   */
  publish(event: OutboxEvent): Promise<void>;

  /**
   * Subscribe to events (for testing or local processing)
   * Use '*' for wildcard subscriptions
   */
  subscribe(eventType: string, handler: EventHandler): void;

  /**
   * Unsubscribe from events
   * Use '*' for wildcard subscriptions
   */
  unsubscribe(eventType: string, handler: EventHandler): void;
}
