/**
 * Webhook DTOs
 *
 * Request and response types for webhook endpoints.
 */

import type {
  WppWebhookPayload,
  WebhookResponse,
  WppWebhookEventType,
  WppMessageData,
} from '../../infrastructure/whatsapp/types.js';

/**
 * WhatsApp webhook request body
 *
 * Matches the payload sent by wpp-connect server.
 */
export interface WppWebhookRequest {
  event: WppWebhookEventType;
  session: string;
  data: WppMessageData;
}

/**
 * WhatsApp webhook response
 *
 * Matches the response expected by the spec.
 */
export interface WppWebhookResponseDto {
  ok: boolean;
  action: 'approved' | 'rejected' | 'ignored' | 'error';
  requestId?: string;
  reason?:
    | 'not_whitelisted'
    | 'from_self'
    | 'group_message'
    | 'invalid_command'
    | 'request_not_found'
    | 'already_processed'
    | 'non_message_event';
  error?: string;
}

/**
 * Health check response for webhook endpoint
 */
export interface WebhookHealthResponse {
  status: 'ok' | 'error';
  whatsapp?: {
    connected: boolean;
    session?: string;
  };
  timestamp: string;
}

/**
 * Validate WPP webhook payload
 *
 * Basic validation for required fields.
 */
export function validateWppWebhookPayload(
  body: unknown
): { valid: true; payload: WppWebhookPayload } | { valid: false; error: string } {
  if (typeof body !== 'object' || body === null) {
    return { valid: false, error: 'Request body must be an object' };
  }

  const payload = body as Record<string, unknown>;

  // Check required fields
  if (typeof payload.event !== 'string') {
    return { valid: false, error: 'Missing or invalid event field' };
  }

  if (typeof payload.session !== 'string') {
    return { valid: false, error: 'Missing or invalid session field' };
  }

  if (typeof payload.data !== 'object' || payload.data === null) {
    return { valid: false, error: 'Missing or invalid data field' };
  }

  const data = payload.data as Record<string, unknown>;

  // Validate data fields for message events
  if (payload.event === 'onmessage') {
    if (typeof data.id !== 'string') {
      return { valid: false, error: 'Missing or invalid data.id field' };
    }

    if (typeof data.body !== 'string') {
      return { valid: false, error: 'Missing or invalid data.body field' };
    }

    if (typeof data.from !== 'string') {
      return { valid: false, error: 'Missing or invalid data.from field' };
    }

    if (typeof data.fromMe !== 'boolean') {
      return { valid: false, error: 'Missing or invalid data.fromMe field' };
    }

    if (typeof data.isGroupMsg !== 'boolean') {
      return { valid: false, error: 'Missing or invalid data.isGroupMsg field' };
    }
  }

  return {
    valid: true,
    payload: payload as unknown as WppWebhookPayload,
  };
}

/**
 * Convert internal WebhookResponse to DTO
 */
export function toWebhookResponseDto(response: WebhookResponse): WppWebhookResponseDto {
  return {
    ok: response.ok,
    action: response.action,
    ...(response.requestId !== undefined ? { requestId: response.requestId } : {}),
    ...(response.reason !== undefined ? { reason: response.reason } : {}),
    ...(response.error !== undefined ? { error: response.error } : {}),
  };
}
