/**
 * WhatsApp Notification Service
 *
 * Sends WhatsApp notifications to admins for card requests and payments.
 */

import type { WppConnectClient } from '../../infrastructure/whatsapp/client.js';
import type { WhatsAppConfig } from '../../infrastructure/whatsapp/config.js';
import { getAdminPhones } from '../../infrastructure/whatsapp/config.js';
import type { IWhatsAppNotificationRepository } from '../../infrastructure/persistence/interfaces/whatsapp-notification.repository.js';
import type { CardRequest } from '../entities/card-request.entity.js';
import type { User } from '../entities/user.entity.js';
import type { Transaction } from '../entities/transaction.entity.js';
import type { Card } from '../entities/card.entity.js';
import {
  createWhatsAppNotification,
  type WhatsAppNotification,
} from '../entities/whatsapp-notification.entity.js';

/**
 * Notification send result
 */
export interface NotificationSendResult {
  notificationId: string;
  recipientPhone: string;
  success: boolean;
  wppMessageId?: string;
  error?: string;
}

/**
 * WhatsApp Notification Service
 *
 * Handles sending notifications to admin phones and tracking delivery.
 */
export class WhatsAppNotificationService {
  constructor(
    private readonly wppClient: WppConnectClient,
    private readonly notificationRepo: IWhatsAppNotificationRepository,
    private readonly config: WhatsAppConfig
  ) {}

  /**
   * Send card request approval notification to all admins
   *
   * @param request - The card request requiring approval
   * @param user - The user who submitted the request
   * @returns Array of notification IDs that were created
   */
  async sendCardRequestNotification(request: CardRequest, user: User): Promise<string[]> {
    if (!this.config.notificationsEnabled) {
      return [];
    }

    const message = this.formatCardRequestMessage(request, user);
    const adminPhones = getAdminPhones(this.config);
    const notificationIds: string[] = [];

    for (const phone of adminPhones) {
      const result = await this.sendNotification({
        recipientPhone: phone,
        messageContent: message,
        notificationType: 'card_request_approval',
        relatedEntityType: 'cardRequest',
        relatedEntityId: request.requestId,
        ecosystemId: user.ecosystemId,
      });

      notificationIds.push(result.notificationId);
    }

    return notificationIds;
  }

  /**
   * Send payment notification to all admins
   *
   * @param payment - The payment transaction
   * @param card - The card that received the payment
   * @returns Array of notification IDs that were created
   */
  async sendPaymentNotification(
    payment: Transaction,
    card: Card,
    ecosystemId: string
  ): Promise<string[]> {
    if (!this.config.notificationsEnabled) {
      return [];
    }

    const message = this.formatPaymentMessage(payment, card);
    const adminPhones = getAdminPhones(this.config);
    const notificationIds: string[] = [];

    for (const phone of adminPhones) {
      const result = await this.sendNotification({
        recipientPhone: phone,
        messageContent: message,
        notificationType: 'payment_notification',
        relatedEntityType: 'payment',
        relatedEntityId: payment.transactionId,
        ecosystemId,
      });

      notificationIds.push(result.notificationId);
    }

    return notificationIds;
  }

  /**
   * Send a single notification and track it
   */
  private async sendNotification(params: {
    recipientPhone: string;
    messageContent: string;
    notificationType: 'card_request_approval' | 'payment_notification';
    relatedEntityType: 'cardRequest' | 'payment';
    relatedEntityId: string;
    ecosystemId: string;
  }): Promise<NotificationSendResult> {
    // Create notification record
    const notification = createWhatsAppNotification({
      recipientPhone: params.recipientPhone,
      messageContent: params.messageContent,
      notificationType: params.notificationType,
      relatedEntityType: params.relatedEntityType,
      relatedEntityId: params.relatedEntityId,
      ecosystemId: params.ecosystemId,
    });

    // Save the notification
    await this.notificationRepo.save(notification);

    try {
      // Send via WPP-Connect
      const response = await this.wppClient.sendMessage(
        params.recipientPhone,
        params.messageContent
      );

      // Update status to sent
      await this.notificationRepo.updateDeliveryStatus(
        notification.notificationId,
        'sent',
        response.id
      );

      return {
        notificationId: notification.notificationId,
        recipientPhone: params.recipientPhone,
        success: true,
        wppMessageId: response.id,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      // Update status to failed
      await this.notificationRepo.updateDeliveryStatus(
        notification.notificationId,
        'failed',
        undefined,
        errorMessage
      );

      return {
        notificationId: notification.notificationId,
        recipientPhone: params.recipientPhone,
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Format card request notification message
   *
   * Template:
   * [Card Request #ABC123]
   * Customer: user@example.com
   * Tier: medium
   * Score: 550
   *
   * Reply: "y ABC123" to approve
   * Reply: "n ABC123" to reject
   */
  formatCardRequestMessage(request: CardRequest, user: User): string {
    // Use short ID for easier admin response (first 8 chars of UUID)
    const shortId = request.requestId.slice(0, 8).toUpperCase();

    return [
      `[Card Request #${shortId}]`,
      `Customer: ${user.email}`,
      `Tier: ${request.tierAtRequest}`,
      `Score: ${request.scoreAtRequest}`,
      '',
      `Reply: "y ${shortId}" to approve`,
      `Reply: "n ${shortId}" to reject`,
    ].join('\n');
  }

  /**
   * Format payment notification message
   *
   * Template:
   * [Payment Received]
   * Card: **** 1234
   * Amount: R$ 500.00
   * Time: 2026-01-04 14:30
   *
   * (No action required)
   */
  formatPaymentMessage(payment: Transaction, card: Card): string {
    // Mask card ID (show last 4)
    const maskedCard = `**** ${card.cardId.slice(-4)}`;

    // Format amount as BRL
    const formattedAmount = new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(payment.amount);

    // Format timestamp
    const timestamp = payment.timestamp.toLocaleString('pt-BR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });

    return [
      '[Payment Received]',
      `Card: ${maskedCard}`,
      `Amount: ${formattedAmount}`,
      `Time: ${timestamp}`,
      '',
      '(No action required)',
    ].join('\n');
  }

  /**
   * Retry failed notifications
   */
  async retryFailedNotifications(limit = 10): Promise<NotificationSendResult[]> {
    const notifications = await this.notificationRepo.findReadyForRetry(limit);
    const results: NotificationSendResult[] = [];

    for (const notification of notifications) {
      const result = await this.retrySingleNotification(notification);
      results.push(result);
    }

    return results;
  }

  /**
   * Retry a single notification
   */
  private async retrySingleNotification(
    notification: WhatsAppNotification
  ): Promise<NotificationSendResult> {
    try {
      // Send via WPP-Connect
      const response = await this.wppClient.sendMessage(
        notification.recipientPhone,
        notification.messageContent
      );

      // Update status to sent
      await this.notificationRepo.updateDeliveryStatus(
        notification.notificationId,
        'sent',
        response.id
      );

      return {
        notificationId: notification.notificationId,
        recipientPhone: notification.recipientPhone,
        success: true,
        wppMessageId: response.id,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const newRetryCount = notification.retryCount + 1;

      if (newRetryCount >= 3) {
        // Move to dead letter
        await this.notificationRepo.updateDeliveryStatus(
          notification.notificationId,
          'dead_letter',
          undefined,
          errorMessage
        );
      } else {
        // Schedule next retry
        const nextRetryAt = new Date(Date.now() + 60000 * Math.pow(2, newRetryCount));
        await this.notificationRepo.incrementRetry(notification.notificationId, nextRetryAt);
      }

      return {
        notificationId: notification.notificationId,
        recipientPhone: notification.recipientPhone,
        success: false,
        error: errorMessage,
      };
    }
  }
}
