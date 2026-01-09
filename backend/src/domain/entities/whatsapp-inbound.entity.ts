/**
 * WhatsApp Inbound Message Entity
 *
 * Tracks inbound WhatsApp messages from admins.
 *
 * Firestore Path: whatsapp_inbound/{messageId}
 */

import { v7 as uuidv7 } from 'uuid';
import type { ParsedCommand, InboundMessageStatus } from '../../infrastructure/whatsapp/types.js';

/**
 * WhatsApp Inbound Message entity representing a message received from an admin
 */
export interface WhatsAppInboundMessage {
  /** UUID v7 message identifier (our ID, not wpp-connect's) */
  messageId: string;
  /** ID from wpp-connect webhook */
  wppMessageId?: string;
  /** Sender phone in E.164 format */
  senderPhone: string;
  /** Display name if available */
  senderName?: string;
  /** Whether sender is a whitelisted admin */
  isFromWhitelistedAdmin: boolean;
  /** Original message text */
  rawBody: string;
  /** Parsed command if recognized */
  parsedCommand?: ParsedCommand;
  /** Processing status */
  processedStatus: InboundMessageStatus;
  /** Action taken (e.g., "approved_request_12345") */
  processedAction?: string;
  /** Error message if processing failed */
  processingError?: string;
  /** Related card request ID */
  relatedRequestId?: string;
  /** Related user ecosystem ID */
  relatedEcosystemId?: string;
  /** When message was received */
  receivedAt: Date;
  /** When message was processed */
  processedAt?: Date;
}

/**
 * Input for creating a new inbound message
 */
export interface CreateWhatsAppInboundInput {
  wppMessageId?: string;
  senderPhone: string;
  senderName?: string;
  isFromWhitelistedAdmin: boolean;
  rawBody: string;
}

/**
 * Validation result for WhatsApp inbound message
 */
export interface WhatsAppInboundValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Brazilian E.164 phone pattern (13 digits)
 */
const BRAZILIAN_PHONE_PATTERN = /^55\d{11}$/;

/**
 * Max raw body length
 */
export const MAX_BODY_LENGTH = 4096;

/**
 * Create a new WhatsApp inbound message with default values
 */
export function createWhatsAppInboundMessage(
  input: CreateWhatsAppInboundInput
): WhatsAppInboundMessage {
  const now = new Date();

  const message: WhatsAppInboundMessage = {
    messageId: uuidv7(),
    senderPhone: input.senderPhone,
    isFromWhitelistedAdmin: input.isFromWhitelistedAdmin,
    rawBody: input.rawBody,
    processedStatus: 'received',
    receivedAt: now,
  };

  // Only assign optional properties if they are defined
  if (input.wppMessageId !== undefined) {
    message.wppMessageId = input.wppMessageId;
  }
  if (input.senderName !== undefined) {
    message.senderName = input.senderName;
  }

  return message;
}

/**
 * Validate WhatsApp inbound message data
 */
export function validateWhatsAppInboundMessage(
  message: WhatsAppInboundMessage
): WhatsAppInboundValidationResult {
  const errors: string[] = [];

  // Validate senderPhone
  if (!BRAZILIAN_PHONE_PATTERN.test(message.senderPhone)) {
    errors.push('senderPhone must be in Brazilian E.164 format (55 + 11 digits)');
  }

  // Validate rawBody length
  if (message.rawBody.length > MAX_BODY_LENGTH) {
    errors.push(`rawBody must be at most ${MAX_BODY_LENGTH} characters`);
  }

  // Validate required fields
  if (!message.messageId) {
    errors.push('messageId is required');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Mark message as processing
 */
export function markAsProcessing(message: WhatsAppInboundMessage): WhatsAppInboundMessage {
  return {
    ...message,
    processedStatus: 'processing',
  };
}

/**
 * Mark message as processed successfully
 */
export function markAsProcessed(
  message: WhatsAppInboundMessage,
  action: string,
  requestId?: string,
  ecosystemId?: string
): WhatsAppInboundMessage {
  const result: WhatsAppInboundMessage = {
    ...message,
    processedStatus: 'processed',
    processedAction: action,
    processedAt: new Date(),
  };

  // Only assign optional properties if they are defined
  if (requestId !== undefined) {
    result.relatedRequestId = requestId;
  }
  if (ecosystemId !== undefined) {
    result.relatedEcosystemId = ecosystemId;
  }

  return result;
}

/**
 * Mark message as ignored
 */
export function markAsIgnored(
  message: WhatsAppInboundMessage,
  reason: string
): WhatsAppInboundMessage {
  return {
    ...message,
    processedStatus: 'ignored',
    processedAction: reason,
    processedAt: new Date(),
  };
}

/**
 * Mark message as error
 */
export function markAsError(
  message: WhatsAppInboundMessage,
  error: string
): WhatsAppInboundMessage {
  return {
    ...message,
    processedStatus: 'error',
    processingError: error,
    processedAt: new Date(),
  };
}

/**
 * Type guard for WhatsAppInboundMessage
 */
export function isWhatsAppInboundMessage(value: unknown): value is WhatsAppInboundMessage {
  if (typeof value !== 'object' || value === null) return false;

  const m = value as Record<string, unknown>;
  return (
    typeof m.messageId === 'string' &&
    typeof m.senderPhone === 'string' &&
    typeof m.isFromWhitelistedAdmin === 'boolean' &&
    typeof m.rawBody === 'string' &&
    typeof m.processedStatus === 'string' &&
    m.receivedAt instanceof Date
  );
}
