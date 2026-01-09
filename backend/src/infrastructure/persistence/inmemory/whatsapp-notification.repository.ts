/**
 * In-Memory WhatsApp Notification Repository
 *
 * In-memory implementation for testing.
 */

/* eslint-disable @typescript-eslint/require-await */

import type { IWhatsAppNotificationRepository } from '../interfaces/whatsapp-notification.repository.js';
import type { WhatsAppNotification } from '../../../domain/entities/whatsapp-notification.entity.js';
import type { WhatsAppDeliveryStatus } from '../../whatsapp/types.js';

/**
 * In-Memory WhatsApp Notification Repository implementation
 */
export class InMemoryWhatsAppNotificationRepository implements IWhatsAppNotificationRepository {
  private notifications: Map<string, WhatsAppNotification> = new Map();

  async save(notification: WhatsAppNotification): Promise<void> {
    this.notifications.set(notification.notificationId, { ...notification });
  }

  async findById(notificationId: string): Promise<WhatsAppNotification | null> {
    return this.notifications.get(notificationId) ?? null;
  }

  async findByRelatedEntity(
    entityType: 'cardRequest' | 'payment',
    entityId: string
  ): Promise<WhatsAppNotification[]> {
    return Array.from(this.notifications.values()).filter(
      (n) => n.relatedEntityType === entityType && n.relatedEntityId === entityId
    );
  }

  async findPendingDelivery(limit = 100): Promise<WhatsAppNotification[]> {
    return Array.from(this.notifications.values())
      .filter((n) => n.deliveryStatus === 'pending')
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
      .slice(0, limit);
  }

  async findReadyForRetry(limit = 100): Promise<WhatsAppNotification[]> {
    const now = new Date();
    return Array.from(this.notifications.values())
      .filter((n) => n.deliveryStatus === 'failed' && n.nextRetryAt && n.nextRetryAt <= now)
      .sort((a, b) => (a.nextRetryAt?.getTime() ?? 0) - (b.nextRetryAt?.getTime() ?? 0))
      .slice(0, limit);
  }

  async updateDeliveryStatus(
    notificationId: string,
    status: WhatsAppDeliveryStatus,
    wppMessageId?: string,
    error?: string
  ): Promise<void> {
    const notification = this.notifications.get(notificationId);
    if (!notification) {
      throw new Error(`Notification not found: ${notificationId}`);
    }

    notification.deliveryStatus = status;
    if (status === 'sent') {
      notification.sentAt = new Date();
    }
    if (status === 'delivered') {
      notification.deliveredAt = new Date();
    }
    if (wppMessageId !== undefined) {
      notification.wppMessageId = wppMessageId;
    }
    if (error !== undefined) {
      notification.lastError = error;
    }
  }

  async incrementRetry(notificationId: string, nextRetryAt: Date): Promise<void> {
    const notification = this.notifications.get(notificationId);
    if (!notification) {
      throw new Error(`Notification not found: ${notificationId}`);
    }

    notification.retryCount += 1;
    notification.nextRetryAt = nextRetryAt;
  }

  async deleteAll(): Promise<number> {
    const count = this.notifications.size;
    this.notifications.clear();
    return count;
  }

  /**
   * Get all notifications (for testing)
   */
  getAll(): WhatsAppNotification[] {
    return Array.from(this.notifications.values());
  }
}
