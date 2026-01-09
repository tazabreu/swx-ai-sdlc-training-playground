/**
 * WhatsApp Entity Unit Tests
 *
 * Tests for WhatsApp notification and inbound message entities.
 */

import { describe, it, expect } from 'bun:test';
import {
  createWhatsAppNotification,
  isWhatsAppNotification,
  validateWhatsAppNotification,
  canRetry,
  calculateNextRetryTime,
  MAX_RETRY_COUNT,
  MAX_MESSAGE_LENGTH,
  type WhatsAppNotification,
} from '../../../../src/domain/entities/whatsapp-notification.entity';
import {
  createWhatsAppInboundMessage,
  isWhatsAppInboundMessage,
  validateWhatsAppInboundMessage,
  markAsProcessing,
  markAsProcessed,
  markAsIgnored,
  markAsError,
  MAX_BODY_LENGTH,
  type WhatsAppInboundMessage,
} from '../../../../src/domain/entities/whatsapp-inbound.entity';
import {
  createPendingApprovalTracker,
  validatePendingApprovalTracker,
  isPending,
  isExpired,
  canProcess,
  markAsApproved,
  markAsRejected,
  markTrackerAsExpired,
  addNotificationIds,
  isPendingApprovalTracker,
  DEFAULT_EXPIRATION_MS,
  type PendingApprovalTracker,
} from '../../../../src/domain/entities/pending-approval.entity';

describe('WhatsApp Notification Entity', () => {
  describe('createWhatsAppNotification', () => {
    it('should create notification with required fields', () => {
      const notification = createWhatsAppNotification({
        recipientPhone: '5573981112636',
        messageContent: 'Test message',
        notificationType: 'card_approval_request',
        relatedEntityType: 'cardRequest',
        relatedEntityId: 'request-123',
        ecosystemId: 'eco-123',
      });

      expect(notification.notificationId).toBeDefined();
      expect(notification.recipientPhone).toBe('5573981112636');
      expect(notification.messageContent).toBe('Test message');
      expect(notification.notificationType).toBe('card_approval_request');
      expect(notification.deliveryStatus).toBe('pending');
      expect(notification.retryCount).toBe(0);
      expect(notification.createdAt).toBeInstanceOf(Date);
    });

    it('should generate unique IDs', () => {
      const n1 = createWhatsAppNotification({
        recipientPhone: '5573981112636',
        messageContent: 'Test 1',
        notificationType: 'card_approval_request',
        relatedEntityType: 'cardRequest',
        relatedEntityId: 'id-1',
        ecosystemId: 'eco-1',
      });
      const n2 = createWhatsAppNotification({
        recipientPhone: '5573981112636',
        messageContent: 'Test 2',
        notificationType: 'card_approval_request',
        relatedEntityType: 'cardRequest',
        relatedEntityId: 'id-2',
        ecosystemId: 'eco-2',
      });

      expect(n1.notificationId).not.toBe(n2.notificationId);
    });

    it('should include optional recipientName when provided', () => {
      const notification = createWhatsAppNotification({
        recipientPhone: '5573981112636',
        recipientName: 'Admin User',
        messageContent: 'Test message',
        notificationType: 'card_approval_request',
        relatedEntityType: 'cardRequest',
        relatedEntityId: 'request-123',
        ecosystemId: 'eco-123',
      });

      expect(notification.recipientName).toBe('Admin User');
    });
  });

  describe('isWhatsAppNotification', () => {
    it('should return true for valid notification', () => {
      const notification = createWhatsAppNotification({
        recipientPhone: '5573981112636',
        messageContent: 'Test',
        notificationType: 'card_approval_request',
        relatedEntityType: 'cardRequest',
        relatedEntityId: 'request-123',
        ecosystemId: 'eco-123',
      });

      expect(isWhatsAppNotification(notification)).toBe(true);
    });

    it('should return false for null', () => {
      expect(isWhatsAppNotification(null)).toBe(false);
    });

    it('should return false for undefined', () => {
      expect(isWhatsAppNotification(undefined)).toBe(false);
    });

    it('should return false for non-object', () => {
      expect(isWhatsAppNotification('string')).toBe(false);
    });

    it('should return false for object missing required fields', () => {
      expect(isWhatsAppNotification({ notificationId: '123' })).toBe(false);
    });
  });

  describe('validateWhatsAppNotification', () => {
    it('should pass for valid notification', () => {
      const notification = createWhatsAppNotification({
        recipientPhone: '5573981112636',
        messageContent: 'Test message',
        notificationType: 'card_approval_request',
        relatedEntityType: 'cardRequest',
        relatedEntityId: 'request-123',
        ecosystemId: 'eco-123',
      });

      const result = validateWhatsAppNotification(notification);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should fail for invalid phone format', () => {
      const notification = createWhatsAppNotification({
        recipientPhone: '5573981112636',
        messageContent: 'Test message',
        notificationType: 'card_approval_request',
        relatedEntityType: 'cardRequest',
        relatedEntityId: 'request-123',
        ecosystemId: 'eco-123',
      });
      const invalid: WhatsAppNotification = { ...notification, recipientPhone: '123' };

      const result = validateWhatsAppNotification(invalid);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('E.164'))).toBe(true);
    });

    it('should fail for too long message content', () => {
      const notification = createWhatsAppNotification({
        recipientPhone: '5573981112636',
        messageContent: 'a'.repeat(MAX_MESSAGE_LENGTH + 1),
        notificationType: 'card_approval_request',
        relatedEntityType: 'cardRequest',
        relatedEntityId: 'request-123',
        ecosystemId: 'eco-123',
      });

      const result = validateWhatsAppNotification(notification);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('messageContent'))).toBe(true);
    });
  });

  describe('retry logic', () => {
    it('canRetry should return true for failed notification with retries left', () => {
      const notification = createWhatsAppNotification({
        recipientPhone: '5573981112636',
        messageContent: 'Test',
        notificationType: 'card_approval_request',
        relatedEntityType: 'cardRequest',
        relatedEntityId: 'request-123',
        ecosystemId: 'eco-123',
      });
      const failed: WhatsAppNotification = {
        ...notification,
        deliveryStatus: 'failed',
        retryCount: 1,
      };

      expect(canRetry(failed)).toBe(true);
    });

    it('canRetry should return false when max retries reached', () => {
      const notification = createWhatsAppNotification({
        recipientPhone: '5573981112636',
        messageContent: 'Test',
        notificationType: 'card_approval_request',
        relatedEntityType: 'cardRequest',
        relatedEntityId: 'request-123',
        ecosystemId: 'eco-123',
      });
      const failed: WhatsAppNotification = {
        ...notification,
        deliveryStatus: 'failed',
        retryCount: MAX_RETRY_COUNT,
      };

      expect(canRetry(failed)).toBe(false);
    });

    it('canRetry should return false for non-failed status', () => {
      const notification = createWhatsAppNotification({
        recipientPhone: '5573981112636',
        messageContent: 'Test',
        notificationType: 'card_approval_request',
        relatedEntityType: 'cardRequest',
        relatedEntityId: 'request-123',
        ecosystemId: 'eco-123',
      });

      expect(canRetry(notification)).toBe(false);
    });

    it('calculateNextRetryTime should apply exponential backoff', () => {
      const now = Date.now();
      const retry0 = calculateNextRetryTime(0);
      const retry1 = calculateNextRetryTime(1);
      const retry2 = calculateNextRetryTime(2);

      // Base delay is 1 minute (60000ms), doubles each retry
      expect(retry0.getTime()).toBeGreaterThan(now);
      expect(retry1.getTime()).toBeGreaterThan(retry0.getTime());
      expect(retry2.getTime()).toBeGreaterThan(retry1.getTime());
    });
  });
});

describe('WhatsApp Inbound Message Entity', () => {
  describe('createWhatsAppInboundMessage', () => {
    it('should create inbound message with required fields', () => {
      const message = createWhatsAppInboundMessage({
        senderPhone: '5573981112636',
        isFromWhitelistedAdmin: true,
        rawBody: 'y abc12345',
      });

      expect(message.messageId).toBeDefined();
      expect(message.senderPhone).toBe('5573981112636');
      expect(message.isFromWhitelistedAdmin).toBe(true);
      expect(message.rawBody).toBe('y abc12345');
      expect(message.processedStatus).toBe('received');
      expect(message.receivedAt).toBeInstanceOf(Date);
    });

    it('should include optional fields when provided', () => {
      const message = createWhatsAppInboundMessage({
        wppMessageId: 'wpp-123',
        senderPhone: '5573981112636',
        senderName: 'John Admin',
        isFromWhitelistedAdmin: true,
        rawBody: 'y abc12345',
      });

      expect(message.wppMessageId).toBe('wpp-123');
      expect(message.senderName).toBe('John Admin');
    });
  });

  describe('isWhatsAppInboundMessage', () => {
    it('should return true for valid inbound message', () => {
      const message = createWhatsAppInboundMessage({
        senderPhone: '5573981112636',
        isFromWhitelistedAdmin: true,
        rawBody: 'y abc12345',
      });

      expect(isWhatsAppInboundMessage(message)).toBe(true);
    });

    it('should return false for null', () => {
      expect(isWhatsAppInboundMessage(null)).toBe(false);
    });

    it('should return false for missing required fields', () => {
      expect(isWhatsAppInboundMessage({ messageId: '123' })).toBe(false);
    });
  });

  describe('validateWhatsAppInboundMessage', () => {
    it('should pass for valid message', () => {
      const message = createWhatsAppInboundMessage({
        senderPhone: '5573981112636',
        isFromWhitelistedAdmin: true,
        rawBody: 'y abc12345',
      });

      const result = validateWhatsAppInboundMessage(message);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should fail for invalid phone format', () => {
      const message = createWhatsAppInboundMessage({
        senderPhone: '5573981112636',
        isFromWhitelistedAdmin: true,
        rawBody: 'y abc12345',
      });
      const invalid: WhatsAppInboundMessage = { ...message, senderPhone: '123' };

      const result = validateWhatsAppInboundMessage(invalid);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('E.164'))).toBe(true);
    });

    it('should fail for too long raw body', () => {
      const message = createWhatsAppInboundMessage({
        senderPhone: '5573981112636',
        isFromWhitelistedAdmin: true,
        rawBody: 'a'.repeat(MAX_BODY_LENGTH + 1),
      });

      const result = validateWhatsAppInboundMessage(message);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('rawBody'))).toBe(true);
    });
  });

  describe('status transitions', () => {
    it('markAsProcessing should update status', () => {
      const message = createWhatsAppInboundMessage({
        senderPhone: '5573981112636',
        isFromWhitelistedAdmin: true,
        rawBody: 'y abc12345',
      });

      const processing = markAsProcessing(message);

      expect(processing.processedStatus).toBe('processing');
    });

    it('markAsProcessed should update status and action', () => {
      const message = createWhatsAppInboundMessage({
        senderPhone: '5573981112636',
        isFromWhitelistedAdmin: true,
        rawBody: 'y abc12345',
      });

      const processed = markAsProcessed(message, 'approved', 'request-123', 'eco-123');

      expect(processed.processedStatus).toBe('processed');
      expect(processed.processedAction).toBe('approved');
      expect(processed.relatedRequestId).toBe('request-123');
      expect(processed.relatedEcosystemId).toBe('eco-123');
      expect(processed.processedAt).toBeInstanceOf(Date);
    });

    it('markAsIgnored should update status with reason', () => {
      const message = createWhatsAppInboundMessage({
        senderPhone: '5573981112636',
        isFromWhitelistedAdmin: true,
        rawBody: 'hello',
      });

      const ignored = markAsIgnored(message, 'invalid_command');

      expect(ignored.processedStatus).toBe('ignored');
      expect(ignored.processedAction).toBe('invalid_command');
      expect(ignored.processedAt).toBeInstanceOf(Date);
    });

    it('markAsError should update status with error', () => {
      const message = createWhatsAppInboundMessage({
        senderPhone: '5573981112636',
        isFromWhitelistedAdmin: true,
        rawBody: 'y abc12345',
      });

      const error = markAsError(message, 'Database error');

      expect(error.processedStatus).toBe('error');
      expect(error.processingError).toBe('Database error');
      expect(error.processedAt).toBeInstanceOf(Date);
    });
  });
});

describe('Pending Approval Tracker Entity', () => {
  describe('createPendingApprovalTracker', () => {
    it('should create tracker with default expiration', () => {
      const tracker = createPendingApprovalTracker({
        requestId: 'request-123',
        ecosystemId: 'eco-123',
      });

      expect(tracker.requestId).toBe('request-123');
      expect(tracker.ecosystemId).toBe('eco-123');
      expect(tracker.notificationIds).toEqual([]);
      expect(tracker.approvalStatus).toBe('pending');
      expect(tracker.createdAt).toBeInstanceOf(Date);
      expect(tracker.expiresAt).toBeInstanceOf(Date);

      // Verify 24-hour expiration
      const expectedExpiry = tracker.createdAt.getTime() + DEFAULT_EXPIRATION_MS;
      expect(tracker.expiresAt.getTime()).toBe(expectedExpiry);
    });

    it('should accept custom expiration', () => {
      const oneHourMs = 60 * 60 * 1000;
      const tracker = createPendingApprovalTracker({
        requestId: 'request-123',
        ecosystemId: 'eco-123',
        expirationMs: oneHourMs,
      });

      const expectedExpiry = tracker.createdAt.getTime() + oneHourMs;
      expect(tracker.expiresAt.getTime()).toBe(expectedExpiry);
    });

    it('should accept initial notification IDs', () => {
      const tracker = createPendingApprovalTracker({
        requestId: 'request-123',
        ecosystemId: 'eco-123',
        notificationIds: ['notif-1', 'notif-2'],
      });

      expect(tracker.notificationIds).toEqual(['notif-1', 'notif-2']);
    });
  });

  describe('validatePendingApprovalTracker', () => {
    it('should pass for valid tracker', () => {
      const tracker = createPendingApprovalTracker({
        requestId: 'request-123',
        ecosystemId: 'eco-123',
      });

      const result = validatePendingApprovalTracker(tracker);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should fail for empty requestId', () => {
      const tracker = createPendingApprovalTracker({
        requestId: 'request-123',
        ecosystemId: 'eco-123',
      });
      const invalid: PendingApprovalTracker = { ...tracker, requestId: '' };

      const result = validatePendingApprovalTracker(invalid);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('requestId is required');
    });

    it('should fail for empty ecosystemId', () => {
      const tracker = createPendingApprovalTracker({
        requestId: 'request-123',
        ecosystemId: 'eco-123',
      });
      const invalid: PendingApprovalTracker = { ...tracker, ecosystemId: '' };

      const result = validatePendingApprovalTracker(invalid);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('ecosystemId is required');
    });
  });

  describe('status helpers', () => {
    it('isPending should return true for pending status', () => {
      const tracker = createPendingApprovalTracker({
        requestId: 'request-123',
        ecosystemId: 'eco-123',
      });

      expect(isPending(tracker)).toBe(true);
    });

    it('isPending should return false for non-pending status', () => {
      const tracker = createPendingApprovalTracker({
        requestId: 'request-123',
        ecosystemId: 'eco-123',
      });
      const approved = markAsApproved(tracker, '5573981112636');

      expect(isPending(approved)).toBe(false);
    });

    it('isExpired should return true for expired tracker', () => {
      const tracker = createPendingApprovalTracker({
        requestId: 'request-123',
        ecosystemId: 'eco-123',
        expirationMs: -1000, // Already expired
      });

      expect(isExpired(tracker)).toBe(true);
    });

    it('isExpired should return true for expired status', () => {
      const tracker = createPendingApprovalTracker({
        requestId: 'request-123',
        ecosystemId: 'eco-123',
      });
      const expired = markTrackerAsExpired(tracker);

      expect(isExpired(expired)).toBe(true);
    });

    it('isExpired should return false for valid non-expired tracker', () => {
      const tracker = createPendingApprovalTracker({
        requestId: 'request-123',
        ecosystemId: 'eco-123',
      });

      expect(isExpired(tracker)).toBe(false);
    });

    it('canProcess should return true for pending and not expired', () => {
      const tracker = createPendingApprovalTracker({
        requestId: 'request-123',
        ecosystemId: 'eco-123',
      });

      expect(canProcess(tracker)).toBe(true);
    });

    it('canProcess should return false for expired tracker', () => {
      const tracker = createPendingApprovalTracker({
        requestId: 'request-123',
        ecosystemId: 'eco-123',
        expirationMs: -1000,
      });

      expect(canProcess(tracker)).toBe(false);
    });

    it('canProcess should return false for already approved tracker', () => {
      const tracker = createPendingApprovalTracker({
        requestId: 'request-123',
        ecosystemId: 'eco-123',
      });
      const approved = markAsApproved(tracker, '5573981112636');

      expect(canProcess(approved)).toBe(false);
    });
  });

  describe('status transitions', () => {
    it('markAsApproved should update status and record admin', () => {
      const tracker = createPendingApprovalTracker({
        requestId: 'request-123',
        ecosystemId: 'eco-123',
      });

      const approved = markAsApproved(tracker, '5573981112636');

      expect(approved.approvalStatus).toBe('approved');
      expect(approved.respondingAdminPhone).toBe('5573981112636');
      expect(approved.responseReceivedAt).toBeInstanceOf(Date);
    });

    it('markAsRejected should update status and record admin', () => {
      const tracker = createPendingApprovalTracker({
        requestId: 'request-123',
        ecosystemId: 'eco-123',
      });

      const rejected = markAsRejected(tracker, '5573981112636');

      expect(rejected.approvalStatus).toBe('rejected');
      expect(rejected.respondingAdminPhone).toBe('5573981112636');
      expect(rejected.responseReceivedAt).toBeInstanceOf(Date);
    });

    it('markTrackerAsExpired should update status', () => {
      const tracker = createPendingApprovalTracker({
        requestId: 'request-123',
        ecosystemId: 'eco-123',
      });

      const expired = markTrackerAsExpired(tracker);

      expect(expired.approvalStatus).toBe('expired');
      expect(expired.updatedAt).toBeInstanceOf(Date);
    });

    it('addNotificationIds should append IDs and set sentAt', () => {
      const tracker = createPendingApprovalTracker({
        requestId: 'request-123',
        ecosystemId: 'eco-123',
        notificationIds: ['notif-1'],
      });

      const updated = addNotificationIds(tracker, ['notif-2', 'notif-3']);

      expect(updated.notificationIds).toEqual(['notif-1', 'notif-2', 'notif-3']);
      expect(updated.notificationsSentAt).toBeInstanceOf(Date);
    });
  });

  describe('isPendingApprovalTracker', () => {
    it('should return true for valid tracker', () => {
      const tracker = createPendingApprovalTracker({
        requestId: 'request-123',
        ecosystemId: 'eco-123',
      });

      expect(isPendingApprovalTracker(tracker)).toBe(true);
    });

    it('should return false for null', () => {
      expect(isPendingApprovalTracker(null)).toBe(false);
    });

    it('should return false for non-object', () => {
      expect(isPendingApprovalTracker('string')).toBe(false);
    });

    it('should return false for missing required fields', () => {
      expect(isPendingApprovalTracker({ requestId: '123' })).toBe(false);
    });
  });
});
