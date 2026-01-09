/**
 * InMemory Event Publisher
 *
 * In-memory event publisher for testing and local development.
 */

import type { IEventPublisher, EventHandler } from './event-publisher.interface.js';
import type { OutboxEvent } from '../../domain/entities/event.entity.js';

/**
 * InMemory Event Publisher implementation
 */
export class InMemoryEventPublisher implements IEventPublisher {
  private handlers: Map<string, Set<EventHandler>> = new Map();
  private publishedEvents: OutboxEvent[] = [];

  async publish(event: OutboxEvent): Promise<void> {
    // Store the event for inspection
    this.publishedEvents.push(event);

    // Notify specific type handlers
    const typeHandlers = this.handlers.get(event.eventType);
    if (typeHandlers !== undefined) {
      for (const handler of typeHandlers) {
        await handler(event);
      }
    }

    // Notify wildcard handlers
    const wildcardHandlers = this.handlers.get('*');
    if (wildcardHandlers !== undefined) {
      for (const handler of wildcardHandlers) {
        await handler(event);
      }
    }
  }

  subscribe(eventType: string, handler: EventHandler): void {
    let handlers = this.handlers.get(eventType);
    if (handlers === undefined) {
      handlers = new Set();
      this.handlers.set(eventType, handlers);
    }
    handlers.add(handler);
  }

  unsubscribe(eventType: string, handler: EventHandler): void {
    const handlers = this.handlers.get(eventType);
    if (handlers !== undefined) {
      handlers.delete(handler);
    }
  }

  // Test helper methods
  clear(): void {
    this.publishedEvents = [];
  }

  clearHandlers(): void {
    this.handlers.clear();
  }

  getPublishedEvents(): OutboxEvent[] {
    return [...this.publishedEvents];
  }

  getPublishedEventsByType(eventType: string): OutboxEvent[] {
    return this.publishedEvents.filter((e) => e.eventType === eventType);
  }
}
