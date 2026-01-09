/**
 * WhatsApp Notification Entity
 *
 * Tracks outbound WhatsApp messages to admins.
 *
 * Firestore Path: whatsapp_notifications/{notificationId}
 */

import { v7 as uuidv7 } from 'uuid';
import type {
  WhatsAppNotificationType,
  WhatsAppDeliveryStatus,
} from '../../infrastructure/whatsapp/types.js';

/**
 * WhatsApp Notification entity representing an outbound notification to an admin
 */
export interface WhatsAppNotification {
  /** UUID v7 notification identifier */
  notificationId: string;
  /** Recipient phone in E.164 format (e.g., "5573981112636") */
  recipientPhone: string;
  /** Display name for logging */
  recipientName?: string;
  /** Full message text */
  messageContent: string;
  /** Type of notification */
  notificationType: WhatsAppNotificationType;
  /** Type of related entity */
  relatedEntityType: 'cardRequest' | 'payment';
  /** ID of the related entity (requestId or transactionId) */
  relatedEntityId: string;
  /** Owner user ID */
  ecosystemId: string;
  /** Delivery tracking status */
  deliveryStatus: WhatsAppDeliveryStatus;
  /** ID returned by wpp-connect */
  wppMessageId?: string;
  /** Retry count (0-3) */
  retryCount: number;
  /** Error message if failed */
  lastError?: string;
  /** When to retry */
  nextRetryAt?: Date;
  /** When notification was created */
  createdAt: Date;
  /** When notification was sent to wpp-connect */
  sentAt?: Date;
  /** When WhatsApp confirmed delivery */
  deliveredAt?: Date;
}

/**
 * Input for creating a new WhatsApp notification
 */
export interface CreateWhatsAppNotificationInput {
  recipientPhone: string;
  recipientName?: string;
  messageContent: string;
  notificationType: WhatsAppNotificationType;
  relatedEntityType: 'cardRequest' | 'payment';
  relatedEntityId: string;
  ecosystemId: string;
}

/**
 * Validation result for WhatsApp notification
 */
export interface WhatsAppNotificationValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Brazilian E.164 phone pattern (13 digits)
 */
const BRAZILIAN_PHONE_PATTERN = /^55\d{11}$/;

/**
 * Max retry count
 */
export const MAX_RETRY_COUNT = 3;

/**
 * Max message content length
 */
export const MAX_MESSAGE_LENGTH = 4096;

/**
 * Create a new WhatsApp notification with default values
 */
export function createWhatsAppNotification(
  input: CreateWhatsAppNotificationInput
): WhatsAppNotification {
  const now = new Date();

  const notification: WhatsAppNotification = {
    notificationId: uuidv7(),
    recipientPhone: input.recipientPhone,
    messageContent: input.messageContent,
    notificationType: input.notificationType,
    relatedEntityType: input.relatedEntityType,
    relatedEntityId: input.relatedEntityId,
    ecosystemId: input.ecosystemId,
    deliveryStatus: 'pending',
    retryCount: 0,
    createdAt: now,
  };

  // Only assign optional properties if they are defined
  if (input.recipientName !== undefined) {
    notification.recipientName = input.recipientName;
  }

  return notification;
}

/**
 * Validate WhatsApp notification data
 */
export function validateWhatsAppNotification(
  notification: WhatsAppNotification
): WhatsAppNotificationValidationResult {
  const errors: string[] = [];

  // Validate recipientPhone
  if (!BRAZILIAN_PHONE_PATTERN.test(notification.recipientPhone)) {
    errors.push('recipientPhone must be in Brazilian E.164 format (55 + 11 digits)');
  }

  // Validate messageContent length
  if (notification.messageContent.length > MAX_MESSAGE_LENGTH) {
    errors.push(`messageContent must be at most ${MAX_MESSAGE_LENGTH} characters`);
  }

  // Validate retryCount
  if (notification.retryCount > MAX_RETRY_COUNT) {
    errors.push(`retryCount must be at most ${MAX_RETRY_COUNT}`);
  }

  // Validate required fields
  if (!notification.notificationId) {
    errors.push('notificationId is required');
  }
  if (!notification.relatedEntityId) {
    errors.push('relatedEntityId is required');
  }
  if (!notification.ecosystemId) {
    errors.push('ecosystemId is required');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Check if notification can be retried
 */
export function canRetry(notification: WhatsAppNotification): boolean {
  return notification.deliveryStatus === 'failed' && notification.retryCount < MAX_RETRY_COUNT;
}

/**
 * Calculate next retry time with exponential backoff
 * Base delay: 1 minute, doubles each retry
 */
export function calculateNextRetryTime(retryCount: number): Date {
  const baseDelayMs = 60 * 1000; // 1 minute
  const delayMs = baseDelayMs * Math.pow(2, retryCount);
  return new Date(Date.now() + delayMs);
}

/**
 * Type guard for WhatsAppNotification
 */
export function isWhatsAppNotification(value: unknown): value is WhatsAppNotification {
  if (typeof value !== 'object' || value === null) return false;

  const n = value as Record<string, unknown>;
  return (
    typeof n.notificationId === 'string' &&
    typeof n.recipientPhone === 'string' &&
    typeof n.messageContent === 'string' &&
    typeof n.notificationType === 'string' &&
    typeof n.relatedEntityType === 'string' &&
    typeof n.relatedEntityId === 'string' &&
    typeof n.ecosystemId === 'string' &&
    typeof n.deliveryStatus === 'string' &&
    typeof n.retryCount === 'number' &&
    n.createdAt instanceof Date
  );
}
