/**
 * OutboxEvent Entity
 *
 * Domain events queued for publishing to message stream.
 *
 * Firestore Path: outbox/{eventId}
 */

import { v7 as uuidv7 } from 'uuid';

/**
 * Event types for all significant state changes
 */
export type EventType =
  | 'user.created'
  | 'user.updated'
  | 'score.changed'
  | 'score.adjusted'
  | 'card.requested'
  | 'card.approved'
  | 'card.rejected'
  | 'card.activated'
  | 'card.suspended'
  | 'card.cancelled'
  | 'card_request.created'
  | 'card_request.rejected'
  | 'transaction.purchase'
  | 'transaction.payment'
  | 'system.cleanup';

/**
 * Event processing status
 */
export type EventStatus = 'pending' | 'sent' | 'failed' | 'dead_letter';

/**
 * OutboxEvent entity
 */
export interface OutboxEvent {
  eventId: string; // Auto-generated (UUID v7)

  // Event Metadata
  eventType: EventType;
  entityType: string; // 'user', 'card', 'payment', etc.
  entityId: string;
  ecosystemId: string; // For routing/filtering
  sequenceNumber: number; // Monotonically increasing per entity

  // Payload (typed as Record for flexibility)
  payload: { [key: string]: unknown };

  // Processing State
  status: EventStatus;
  retryCount: number;
  lastError?: string;
  nextRetryAt: Date;

  // Timestamps
  createdAt: Date;
  sentAt?: Date;
}

/**
 * Input for creating an event
 */
export interface CreateEventInput {
  eventType: EventType;
  entityType: string;
  entityId: string;
  ecosystemId: string;
  /**
   * Monotonically increasing per-entity sequence number.
   *
   * Use `0` (or omit) to request repository allocation.
   */
  sequenceNumber?: number | undefined;
  payload: { [key: string]: unknown };
}

/**
 * Create a new outbox event
 */
export function createEvent(input: CreateEventInput): OutboxEvent {
  const now = new Date();

  return {
    eventId: uuidv7(),
    eventType: input.eventType,
    entityType: input.entityType,
    entityId: input.entityId,
    ecosystemId: input.ecosystemId,
    sequenceNumber: input.sequenceNumber ?? 0,
    payload: input.payload,
    status: 'pending',
    retryCount: 0,
    nextRetryAt: now,
    createdAt: now,
  };
}

/**
 * Type guard to check if value is an OutboxEvent
 */
export function isOutboxEvent(value: unknown): value is OutboxEvent {
  if (typeof value !== 'object' || value === null) return false;

  const event = value as Record<string, unknown>;
  const validStatuses: EventStatus[] = ['pending', 'sent', 'failed', 'dead_letter'];

  return (
    typeof event.eventId === 'string' &&
    typeof event.eventType === 'string' &&
    typeof event.entityType === 'string' &&
    typeof event.entityId === 'string' &&
    typeof event.ecosystemId === 'string' &&
    typeof event.sequenceNumber === 'number' &&
    typeof event.payload === 'object' &&
    validStatuses.includes(event.status as EventStatus) &&
    typeof event.retryCount === 'number' &&
    event.createdAt instanceof Date
  );
}

/**
 * Calculate next retry time with exponential backoff
 * Backoff schedule: 10s, 20s, 40s, 80s, 160s
 */
export function calculateNextRetryTime(retryCount: number): Date {
  const baseDelay = 10000; // 10 seconds
  const delay = baseDelay * Math.pow(2, retryCount);
  const maxDelay = 160000; // 160 seconds

  return new Date(Date.now() + Math.min(delay, maxDelay));
}

/**
 * Check if event should be moved to dead letter queue
 */
export function shouldDeadLetter(event: OutboxEvent): boolean {
  return event.retryCount >= EVENT_PROCESSING_RULES.MAX_RETRIES;
}

/**
 * Event processing rules per spec
 */
export const EVENT_PROCESSING_RULES = {
  MAX_RETRIES: 5,
  PROCESSOR_INTERVAL_MS: 60000, // 1 minute
  BASE_RETRY_DELAY_MS: 10000, // 10 seconds
  MAX_RETRY_DELAY_MS: 160000, // 160 seconds
  TARGET_DELIVERY_MS: 5000, // 5 seconds under normal conditions
} as const;
