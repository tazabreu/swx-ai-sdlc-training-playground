/**
 * WhatsApp Notification Firestore Repository
 *
 * Firestore implementation for WhatsApp notification persistence.
 */

import type { Firestore } from 'firebase-admin/firestore';
import type { IWhatsAppNotificationRepository } from '../interfaces/whatsapp-notification.repository.js';
import type { WhatsAppNotification } from '../../../domain/entities/whatsapp-notification.entity.js';
import type { WhatsAppDeliveryStatus } from '../../whatsapp/types.js';
import { requireDate, optionalDate } from './codec.js';

/**
 * Collection name for WhatsApp notifications
 */
const COLLECTION = 'whatsapp_notifications';

/**
 * Firestore WhatsApp Notification Repository implementation
 */
export class WhatsAppNotificationFirestoreRepository implements IWhatsAppNotificationRepository {
  constructor(private readonly db: Firestore) {}

  async save(notification: WhatsAppNotification): Promise<void> {
    await this.db
      .collection(COLLECTION)
      .doc(notification.notificationId)
      .set(this.mapToDoc(notification));
  }

  async findById(notificationId: string): Promise<WhatsAppNotification | null> {
    const doc = await this.db.collection(COLLECTION).doc(notificationId).get();

    if (!doc.exists) {
      return null;
    }

    return this.mapFromDoc(doc.id, doc.data()!);
  }

  async findByRelatedEntity(
    entityType: 'cardRequest' | 'payment',
    entityId: string
  ): Promise<WhatsAppNotification[]> {
    const snapshot = await this.db
      .collection(COLLECTION)
      .where('relatedEntityType', '==', entityType)
      .where('relatedEntityId', '==', entityId)
      .get();

    return snapshot.docs.map((doc) => this.mapFromDoc(doc.id, doc.data()));
  }

  async findPendingDelivery(limit = 100): Promise<WhatsAppNotification[]> {
    const snapshot = await this.db
      .collection(COLLECTION)
      .where('deliveryStatus', '==', 'pending')
      .orderBy('createdAt', 'asc')
      .limit(limit)
      .get();

    return snapshot.docs.map((doc) => this.mapFromDoc(doc.id, doc.data()));
  }

  async findReadyForRetry(limit = 100): Promise<WhatsAppNotification[]> {
    const now = new Date();
    const snapshot = await this.db
      .collection(COLLECTION)
      .where('deliveryStatus', '==', 'failed')
      .where('nextRetryAt', '<=', now)
      .orderBy('nextRetryAt', 'asc')
      .limit(limit)
      .get();

    return snapshot.docs.map((doc) => this.mapFromDoc(doc.id, doc.data()));
  }

  async updateDeliveryStatus(
    notificationId: string,
    status: WhatsAppDeliveryStatus,
    wppMessageId?: string,
    error?: string
  ): Promise<void> {
    const update: Record<string, unknown> = {
      deliveryStatus: status,
      updatedAt: new Date(),
    };

    if (status === 'sent') {
      update.sentAt = new Date();
    }
    if (status === 'delivered') {
      update.deliveredAt = new Date();
    }
    if (wppMessageId !== undefined) {
      update.wppMessageId = wppMessageId;
    }
    if (error !== undefined) {
      update.lastError = error;
    }

    await this.db.collection(COLLECTION).doc(notificationId).update(update);
  }

  async incrementRetry(notificationId: string, nextRetryAt: Date): Promise<void> {
    const docRef = this.db.collection(COLLECTION).doc(notificationId);

    await this.db.runTransaction(async (transaction) => {
      const doc = await transaction.get(docRef);
      if (!doc.exists) {
        throw new Error(`Notification not found: ${notificationId}`);
      }

      const currentRetryCount = (doc.data()!.retryCount as number) || 0;

      transaction.update(docRef, {
        retryCount: currentRetryCount + 1,
        nextRetryAt,
        updatedAt: new Date(),
      });
    });
  }

  async deleteAll(): Promise<number> {
    const snapshot = await this.db.collection(COLLECTION).get();
    const batch = this.db.batch();

    snapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });

    await batch.commit();
    return snapshot.size;
  }

  private mapToDoc(notification: WhatsAppNotification): Record<string, unknown> {
    const doc: Record<string, unknown> = {
      recipientPhone: notification.recipientPhone,
      messageContent: notification.messageContent,
      notificationType: notification.notificationType,
      relatedEntityType: notification.relatedEntityType,
      relatedEntityId: notification.relatedEntityId,
      ecosystemId: notification.ecosystemId,
      deliveryStatus: notification.deliveryStatus,
      retryCount: notification.retryCount,
      createdAt: notification.createdAt,
    };

    if (notification.recipientName !== undefined) {
      doc.recipientName = notification.recipientName;
    }
    if (notification.wppMessageId !== undefined) {
      doc.wppMessageId = notification.wppMessageId;
    }
    if (notification.lastError !== undefined) {
      doc.lastError = notification.lastError;
    }
    if (notification.nextRetryAt !== undefined) {
      doc.nextRetryAt = notification.nextRetryAt;
    }
    if (notification.sentAt !== undefined) {
      doc.sentAt = notification.sentAt;
    }
    if (notification.deliveredAt !== undefined) {
      doc.deliveredAt = notification.deliveredAt;
    }

    return doc;
  }

  private mapFromDoc(notificationId: string, data: Record<string, unknown>): WhatsAppNotification {
    const notification: WhatsAppNotification = {
      notificationId,
      recipientPhone: data.recipientPhone as string,
      messageContent: data.messageContent as string,
      notificationType: data.notificationType as 'card_request_approval' | 'payment_notification',
      relatedEntityType: data.relatedEntityType as 'cardRequest' | 'payment',
      relatedEntityId: data.relatedEntityId as string,
      ecosystemId: data.ecosystemId as string,
      deliveryStatus: data.deliveryStatus as WhatsAppDeliveryStatus,
      retryCount: data.retryCount as number,
      createdAt: requireDate(data.createdAt, 'createdAt'),
    };

    if (data.recipientName !== undefined) {
      notification.recipientName = data.recipientName as string;
    }
    if (data.wppMessageId !== undefined) {
      notification.wppMessageId = data.wppMessageId as string;
    }
    if (data.lastError !== undefined) {
      notification.lastError = data.lastError as string;
    }
    if (data.nextRetryAt !== undefined) {
      const nextRetryAtDate = optionalDate(data.nextRetryAt, 'nextRetryAt');
      if (nextRetryAtDate !== undefined) {
        notification.nextRetryAt = nextRetryAtDate;
      }
    }
    if (data.sentAt !== undefined) {
      const sentAtDate = optionalDate(data.sentAt, 'sentAt');
      if (sentAtDate !== undefined) {
        notification.sentAt = sentAtDate;
      }
    }
    if (data.deliveredAt !== undefined) {
      const deliveredAtDate = optionalDate(data.deliveredAt, 'deliveredAt');
      if (deliveredAtDate !== undefined) {
        notification.deliveredAt = deliveredAtDate;
      }
    }

    return notification;
  }
}
