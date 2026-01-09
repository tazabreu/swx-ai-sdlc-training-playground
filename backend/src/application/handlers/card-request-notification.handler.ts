/**
 * Card Request Notification Handler
 *
 * Sends WhatsApp notifications to admins when card requests need approval.
 * Triggered by card.requested events for low/medium tier users.
 */

import type { IUserRepository } from '../../infrastructure/persistence/interfaces/user.repository.js';
import type { IPendingApprovalRepository } from '../../infrastructure/persistence/interfaces/pending-approval.repository.js';
import type { WhatsAppNotificationService } from '../../domain/services/whatsapp-notification.service.js';
import type { OutboxEvent } from '../../domain/entities/event.entity.js';
import type { CardRequest } from '../../domain/entities/card-request.entity.js';
import { createPendingApprovalTracker } from '../../domain/entities/pending-approval.entity.js';

/**
 * Handler dependencies
 */
export interface CardRequestNotificationHandlerDeps {
  notificationService: WhatsAppNotificationService;
  pendingApprovalRepo: IPendingApprovalRepository;
  userRepo: IUserRepository;
}

/**
 * Handler result
 */
export interface CardRequestNotificationResult {
  success: boolean;
  notificationIds: string[];
  requestId: string;
  skipped: boolean;
  reason?: string;
}

/**
 * Event payload for card.requested event
 */
interface CardRequestedEventPayload {
  requestId: string;
  ecosystemId: string;
  tierAtRequest: 'low' | 'medium' | 'high';
  scoreAtRequest: number;
  requestedLimit: number;
  createdAt: string;
}

/**
 * Handle card request notification
 *
 * Logic flow:
 * 1. Extract card request from event payload
 * 2. Check if tier requires approval (low/medium)
 * 3. Fetch user details for notification
 * 4. Send notification to both admins via NotificationService
 * 5. Create PendingApprovalTracker with notification IDs
 */
export async function handleCardRequestNotification(
  event: OutboxEvent,
  deps: CardRequestNotificationHandlerDeps
): Promise<CardRequestNotificationResult> {
  // Extract payload
  const payload = event.payload as unknown as CardRequestedEventPayload;

  // Check if this tier requires admin approval
  if (!requiresApproval(payload.tierAtRequest)) {
    return {
      success: true,
      notificationIds: [],
      requestId: payload.requestId,
      skipped: true,
      reason: `Tier '${payload.tierAtRequest}' does not require WhatsApp approval`,
    };
  }

  // Fetch user for notification
  const user = await deps.userRepo.findById(payload.ecosystemId);

  if (!user) {
    return {
      success: false,
      notificationIds: [],
      requestId: payload.requestId,
      skipped: false,
      reason: 'User not found',
    };
  }

  // Create card request object for notification service
  // Note: CardRequest requires productId and idempotencyKey, but for notification purposes
  // we only need the minimal fields. Using defaults for required fields.
  const cardRequest: CardRequest = {
    requestId: payload.requestId,
    productId: 'default-credit-card',
    idempotencyKey: payload.requestId, // Use requestId as idempotency key
    tierAtRequest: payload.tierAtRequest,
    scoreAtRequest: payload.scoreAtRequest,
    status: 'pending',
    createdAt: new Date(payload.createdAt),
    updatedAt: new Date(payload.createdAt),
  };

  try {
    // Send notifications to admins
    const notificationIds = await deps.notificationService.sendCardRequestNotification(
      cardRequest,
      user
    );

    // If no notifications were sent (e.g., notifications disabled), skip tracker
    if (notificationIds.length === 0) {
      return {
        success: true,
        notificationIds: [],
        requestId: payload.requestId,
        skipped: true,
        reason: 'Notifications disabled or no admin phones configured',
      };
    }

    // Create pending approval tracker
    const tracker = createPendingApprovalTracker({
      requestId: payload.requestId,
      ecosystemId: payload.ecosystemId,
      notificationIds,
    });

    // Mark notifications as sent
    tracker.notificationsSentAt = new Date();

    // Save tracker
    await deps.pendingApprovalRepo.save(tracker);

    return {
      success: true,
      notificationIds,
      requestId: payload.requestId,
      skipped: false,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    return {
      success: false,
      notificationIds: [],
      requestId: payload.requestId,
      skipped: false,
      reason: `Failed to send notification: ${errorMessage}`,
    };
  }
}

/**
 * Check if a tier requires WhatsApp approval notification
 *
 * Per spec: low and medium tier users require admin approval via WhatsApp.
 * High tier users are auto-approved.
 */
function requiresApproval(tier: string): boolean {
  return tier === 'low' || tier === 'medium';
}
