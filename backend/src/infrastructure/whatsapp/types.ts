/**
 * WhatsApp Infrastructure Types
 *
 * Type definitions for WPP-Connect API integration and WhatsApp messaging.
 */

// =====================================
// WPP-Connect Client Types
// =====================================

/**
 * Configuration for WPP-Connect client
 */
export interface WppClientConfig {
  /** Base URL of the WPP-Connect server (e.g., http://35.232.155.23:21465) */
  baseUrl: string;
  /** Secret key for authentication */
  secretKey: string;
  /** WhatsApp session name */
  sessionName: string;
}

/**
 * Response from token generation
 */
export interface WppTokenResponse {
  /** Bearer token for API calls */
  token: string;
  /** Status message */
  status?: string;
}

/**
 * Response from send-message endpoint
 */
export interface WppSendMessageResponse {
  /** Status of the operation */
  status: string;
  /** Message ID assigned by WhatsApp */
  id: string;
  /** Full message data */
  message?: WppMessageData;
}

/**
 * Session connection status
 */
export interface WppSessionStatus {
  /** Whether the session is connected */
  status: 'CONNECTED' | 'DISCONNECTED' | 'QRCODE' | 'STARTING';
  /** Session phone number */
  phone?: string;
  /** Session name */
  session?: string;
}

/**
 * Phone number status check result
 */
export interface WppNumberStatus {
  /** Whether the number is on WhatsApp */
  exists: boolean;
  /** Phone ID in WhatsApp format */
  id?: string;
  /** Status description */
  status?: string;
}

/**
 * Error response from WPP-Connect API
 */
export interface WppErrorResponse {
  /** Status text */
  status: 'error';
  /** Error message */
  message?: string;
  /** Error code */
  error?: string;
}

// =====================================
// Webhook Payload Types
// =====================================

/**
 * Webhook event types from WPP-Connect
 */
export type WppWebhookEventType =
  | 'onmessage'
  | 'onack'
  | 'onpresencechanged'
  | 'onparticipantschanged'
  | 'onreactionmessage'
  | 'onpollresponse'
  | 'onrevokedmessage'
  | 'onlabelupdated';

/**
 * Message data from WPP-Connect webhook
 */
export interface WppMessageData {
  /** WhatsApp message ID */
  id: string;
  /** Message body/text content */
  body: string;
  /** Sender ID (phone@c.us format) */
  from: string;
  /** Recipient ID (phone@c.us format) */
  to: string;
  /** Whether the message is from the session owner */
  fromMe: boolean;
  /** Whether this is a group message */
  isGroupMsg: boolean;
  /** Sender name (display name) */
  sender?: {
    id: string;
    name?: string;
    pushname?: string;
  };
  /** Message timestamp (Unix epoch in seconds) */
  t: number;
  /** Message type */
  type: 'chat' | 'image' | 'video' | 'audio' | 'document' | 'sticker' | 'location';
  /** Group ID if from group */
  chatId?: string;
  /** Quoted message if replying */
  quotedMsg?: {
    id: string;
    body: string;
    from: string;
  };
}

/**
 * Full webhook payload from WPP-Connect
 */
export interface WppWebhookPayload {
  /** Event type */
  event: WppWebhookEventType;
  /** Session name */
  session: string;
  /** Message data */
  data: WppMessageData;
}

// =====================================
// Domain Types
// =====================================

/**
 * Notification types
 */
export type WhatsAppNotificationType = 'card_request_approval' | 'payment_notification';

/**
 * Delivery status for outbound notifications
 */
export type WhatsAppDeliveryStatus = 'pending' | 'sent' | 'delivered' | 'failed' | 'dead_letter';

/**
 * Processing status for inbound messages
 */
export type InboundMessageStatus = 'received' | 'processing' | 'processed' | 'ignored' | 'error';

/**
 * Approval status for pending approval trackers
 */
export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'expired';

/**
 * Parsed command from admin message
 */
export interface ParsedCommand {
  /** Action to take */
  action: 'approve' | 'reject' | 'unknown';
  /** Request ID extracted from message */
  requestId: string;
  /** Original message text */
  rawInput: string;
}

// =====================================
// Webhook Response Types
// =====================================

/**
 * Reason for ignoring a webhook
 */
export type WebhookIgnoreReason =
  | 'not_whitelisted'
  | 'from_self'
  | 'group_message'
  | 'invalid_command'
  | 'request_not_found'
  | 'already_processed'
  | 'non_message_event';

/**
 * Response from webhook handler
 */
export interface WebhookResponse {
  /** Whether the webhook was processed successfully */
  ok: boolean;
  /** Action taken */
  action: 'approved' | 'rejected' | 'ignored' | 'error';
  /** Related request ID (if applicable) */
  requestId?: string;
  /** Reason for ignoring (if action is 'ignored') */
  reason?: WebhookIgnoreReason;
  /** Error message (if action is 'error') */
  error?: string;
}
