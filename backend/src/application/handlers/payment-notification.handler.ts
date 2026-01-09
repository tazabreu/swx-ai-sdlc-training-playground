/**
 * Payment Notification Handler
 *
 * Sends WhatsApp notifications to admins when payments are completed.
 * Triggered by transaction.payment events.
 */

import type { ICardRepository } from '../../infrastructure/persistence/interfaces/card.repository.js';
import type { WhatsAppNotificationService } from '../../domain/services/whatsapp-notification.service.js';
import type { OutboxEvent } from '../../domain/entities/event.entity.js';
import type { Transaction } from '../../domain/entities/transaction.entity.js';

/**
 * Handler dependencies
 */
export interface PaymentNotificationHandlerDeps {
  notificationService: WhatsAppNotificationService;
  cardRepo: ICardRepository;
}

/**
 * Handler result
 */
export interface PaymentNotificationResult {
  success: boolean;
  notificationIds: string[];
  transactionId: string;
  skipped: boolean;
  reason?: string;
}

/**
 * Event payload for transaction.payment event
 */
interface PaymentEventPayload {
  transactionId: string;
  cardId: string;
  ecosystemId: string;
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  createdAt: string;
}

/**
 * Handle payment notification
 *
 * Logic flow:
 * 1. Extract transaction from event payload
 * 2. Fetch card details for notification
 * 3. Send informational notification to both admins
 */
export async function handlePaymentNotification(
  event: OutboxEvent,
  deps: PaymentNotificationHandlerDeps
): Promise<PaymentNotificationResult> {
  // Extract payload
  const payload = event.payload as unknown as PaymentEventPayload;

  // Fetch card for notification
  const card = await deps.cardRepo.findById(payload.ecosystemId, payload.cardId);

  if (!card) {
    return {
      success: false,
      notificationIds: [],
      transactionId: payload.transactionId,
      skipped: false,
      reason: 'Card not found',
    };
  }

  // Create transaction object for notification service
  const createdAtDate = new Date(payload.createdAt);
  const transaction: Transaction = {
    transactionId: payload.transactionId,
    type: 'payment',
    amount: payload.amount,
    idempotencyKey: payload.transactionId, // Use transactionId as idempotency key
    status: 'completed',
    timestamp: createdAtDate,
    processedAt: createdAtDate,
  };

  try {
    // Send notifications to admins
    const notificationIds = await deps.notificationService.sendPaymentNotification(
      transaction,
      card,
      payload.ecosystemId
    );

    // If no notifications were sent (e.g., notifications disabled), log and return success
    if (notificationIds.length === 0) {
      return {
        success: true,
        notificationIds: [],
        transactionId: payload.transactionId,
        skipped: true,
        reason: 'Notifications disabled or no admin phones configured',
      };
    }

    return {
      success: true,
      notificationIds,
      transactionId: payload.transactionId,
      skipped: false,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    // Payment notifications are informational - log error but consider it handled
    return {
      success: false,
      notificationIds: [],
      transactionId: payload.transactionId,
      skipped: false,
      reason: `Failed to send notification: ${errorMessage}`,
    };
  }
}
