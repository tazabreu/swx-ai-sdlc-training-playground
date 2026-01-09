/**
 * WhatsApp Notification Repository Interface
 *
 * Defines persistence operations for WhatsApp notifications.
 */

import type { WhatsAppNotification } from '../../../domain/entities/whatsapp-notification.entity.js';
import type { WhatsAppDeliveryStatus } from '../../whatsapp/types.js';

/**
 * Repository interface for WhatsApp notification persistence
 */
export interface IWhatsAppNotificationRepository {
  /**
   * Save a new notification or update an existing one
   */
  save(notification: WhatsAppNotification): Promise<void>;

  /**
   * Find notification by ID
   */
  findById(notificationId: string): Promise<WhatsAppNotification | null>;

  /**
   * Find notifications by related entity
   */
  findByRelatedEntity(
    entityType: 'cardRequest' | 'payment',
    entityId: string
  ): Promise<WhatsAppNotification[]>;

  /**
   * Find notifications pending delivery
   */
  findPendingDelivery(limit?: number): Promise<WhatsAppNotification[]>;

  /**
   * Find notifications ready for retry
   */
  findReadyForRetry(limit?: number): Promise<WhatsAppNotification[]>;

  /**
   * Update delivery status
   */
  updateDeliveryStatus(
    notificationId: string,
    status: WhatsAppDeliveryStatus,
    wppMessageId?: string,
    error?: string
  ): Promise<void>;

  /**
   * Increment retry count and set next retry time
   */
  incrementRetry(notificationId: string, nextRetryAt: Date): Promise<void>;

  /**
   * Delete all notifications (for cleanup)
   */
  deleteAll(): Promise<number>;
}
