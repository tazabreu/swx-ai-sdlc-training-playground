/**
 * WhatsApp Approval Handler
 *
 * Handles admin approval/rejection commands received via WhatsApp webhook.
 */

import type { WppWebhookPayload, WebhookResponse } from '../../infrastructure/whatsapp/types.js';
import type { WhatsAppConfig } from '../../infrastructure/whatsapp/config.js';
import type { IPendingApprovalRepository } from '../../infrastructure/persistence/interfaces/pending-approval.repository.js';
import type { ICardRequestRepository } from '../../infrastructure/persistence/interfaces/card-request.repository.js';
import type { IUserRepository } from '../../infrastructure/persistence/interfaces/user.repository.js';
import type { IWhatsAppInboundRepository } from '../../infrastructure/persistence/interfaces/whatsapp-inbound.repository.js';
import type { IAuditLogRepository } from '../../infrastructure/persistence/interfaces/audit-log.repository.js';
import type { ICardRepository } from '../../infrastructure/persistence/interfaces/card.repository.js';
import type { IOutboxRepository } from '../../infrastructure/persistence/interfaces/outbox.repository.js';
import { MessageParserService } from '../../domain/services/message-parser.service.js';
import {
  extractPhoneFromWppId,
  isWhitelistedAdmin,
} from '../../infrastructure/whatsapp/phone-utils.js';
import { getAdminPhones } from '../../infrastructure/whatsapp/config.js';
import { createWhatsAppInboundMessage } from '../../domain/entities/whatsapp-inbound.entity.js';
import { handleAdminApproveCard } from './admin-approve-card.handler.js';
import { handleAdminRejectCard } from './admin-reject-card.handler.js';

/**
 * Handler dependencies
 */
export interface WhatsAppApprovalHandlerDeps {
  pendingApprovalRepo: IPendingApprovalRepository;
  cardRequestRepo: ICardRequestRepository;
  userRepo: IUserRepository;
  inboundRepo: IWhatsAppInboundRepository;
  cardRepo: ICardRepository;
  outboxRepo: IOutboxRepository;
  auditLogRepo: IAuditLogRepository;
  config: WhatsAppConfig;
}

/**
 * WhatsApp Approval Handler
 *
 * Processes incoming WhatsApp messages from admins to approve or reject
 * pending card requests.
 *
 * Logic flow:
 * 1. Validate event is a message event
 * 2. Skip self-messages and group messages
 * 3. Extract sender phone and validate against whitelist
 * 4. Parse command from message body
 * 5. Find pending approval tracker by request ID
 * 6. Execute approve/reject using existing handlers
 * 7. Record inbound message for audit
 */
export async function handleWhatsAppApproval(
  payload: WppWebhookPayload,
  deps: WhatsAppApprovalHandlerDeps
): Promise<WebhookResponse> {
  const messageParser = new MessageParserService();

  // 1. Check event type is a message
  if (payload.event !== 'onmessage') {
    return {
      ok: true,
      action: 'ignored',
      reason: 'non_message_event',
    };
  }

  const { data } = payload;

  // 2. Skip self-messages
  if (data.fromMe) {
    return {
      ok: true,
      action: 'ignored',
      reason: 'from_self',
    };
  }

  // 3. Skip group messages
  if (data.isGroupMsg) {
    return {
      ok: true,
      action: 'ignored',
      reason: 'group_message',
    };
  }

  // 4. Extract sender phone from WPP ID format (phone@c.us)
  const senderPhone = extractPhoneFromWppId(data.from);
  const senderName = data.sender?.pushname ?? data.sender?.name;

  // 5. Check if sender is whitelisted admin
  const adminPhones = getAdminPhones(deps.config);
  if (!isWhitelistedAdmin(senderPhone, adminPhones)) {
    // Record the message but mark as not from whitelisted admin
    await recordInboundMessage(deps, {
      wppMessageId: data.id,
      senderPhone,
      senderName,
      rawBody: data.body,
      isFromWhitelistedAdmin: false,
      status: 'ignored',
      action: 'not_whitelisted',
    });

    return {
      ok: true,
      action: 'ignored',
      reason: 'not_whitelisted',
    };
  }

  // 6. Parse command from message body
  const command = messageParser.parseCommand(data.body);

  if (!messageParser.isValidCommand(command)) {
    // Record the message with invalid command status
    await recordInboundMessage(deps, {
      wppMessageId: data.id,
      senderPhone,
      senderName,
      rawBody: data.body,
      isFromWhitelistedAdmin: true,
      parsedCommand: command,
      status: 'ignored',
      action: 'invalid_command',
    });

    return {
      ok: true,
      action: 'ignored',
      reason: 'invalid_command',
    };
  }

  // 7. Find pending approval tracker - try both full ID and short ID (first 8 chars)
  let pendingApproval = await deps.pendingApprovalRepo.findPendingByRequestId(command.requestId);

  // If not found with exact ID, try as short ID prefix
  if (!pendingApproval) {
    // Look up card request by short ID prefix
    const cardRequest = await findCardRequestByShortId(deps.cardRequestRepo, command.requestId);

    if (cardRequest) {
      pendingApproval = await deps.pendingApprovalRepo.findPendingByRequestId(
        cardRequest.requestId
      );
    }
  }

  if (!pendingApproval) {
    await recordInboundMessage(deps, {
      wppMessageId: data.id,
      senderPhone,
      senderName,
      rawBody: data.body,
      isFromWhitelistedAdmin: true,
      parsedCommand: command,
      status: 'processed',
      action: 'request_not_found',
    });

    return {
      ok: true,
      action: 'ignored',
      reason: 'request_not_found',
    };
  }

  // 8. Get card request details
  const cardRequest = await deps.cardRequestRepo.findById(
    pendingApproval.ecosystemId,
    pendingApproval.requestId
  );

  if (!cardRequest) {
    return {
      ok: true,
      action: 'ignored',
      reason: 'request_not_found',
    };
  }

  // 9. Check if already processed
  if (cardRequest.status !== 'pending') {
    await recordInboundMessage(deps, {
      wppMessageId: data.id,
      senderPhone,
      senderName,
      rawBody: data.body,
      isFromWhitelistedAdmin: true,
      parsedCommand: command,
      status: 'processed',
      action: 'already_processed',
      relatedRequestId: pendingApproval.requestId,
      relatedEcosystemId: pendingApproval.ecosystemId,
    });

    return {
      ok: true,
      action: 'ignored',
      reason: 'already_processed',
      requestId: pendingApproval.requestId,
    };
  }

  // 10. Execute the approval or rejection
  try {
    if (command.action === 'approve') {
      // Use default limit based on score tier
      const defaultLimit = getDefaultLimitForTier(cardRequest.tierAtRequest);

      await handleAdminApproveCard(
        {
          adminId: senderPhone,
          adminEmail: `whatsapp:${senderPhone}`,
          ecosystemId: pendingApproval.ecosystemId,
          requestId: pendingApproval.requestId,
          limit: defaultLimit,
          reason: `Approved via WhatsApp by ${senderName ?? senderPhone}`,
        },
        {
          userRepository: deps.userRepo,
          cardRepository: deps.cardRepo,
          cardRequestRepository: deps.cardRequestRepo,
          outboxRepository: deps.outboxRepo,
          auditLogRepository: deps.auditLogRepo,
        }
      );

      // Update pending approval tracker
      await deps.pendingApprovalRepo.updateApprovalStatus(
        pendingApproval.requestId,
        'approved',
        senderPhone
      );

      // Record inbound message
      await recordInboundMessage(deps, {
        wppMessageId: data.id,
        senderPhone,
        senderName,
        rawBody: data.body,
        isFromWhitelistedAdmin: true,
        parsedCommand: command,
        status: 'processed',
        action: 'approved',
        relatedRequestId: pendingApproval.requestId,
        relatedEcosystemId: pendingApproval.ecosystemId,
      });

      return {
        ok: true,
        action: 'approved',
        requestId: pendingApproval.requestId,
      };
    } else if (command.action === 'reject') {
      await handleAdminRejectCard(
        {
          adminId: senderPhone,
          adminEmail: `whatsapp:${senderPhone}`,
          ecosystemId: pendingApproval.ecosystemId,
          requestId: pendingApproval.requestId,
          reason: `Rejected via WhatsApp by ${senderName ?? senderPhone}`,
        },
        {
          userRepository: deps.userRepo,
          cardRequestRepository: deps.cardRequestRepo,
          outboxRepository: deps.outboxRepo,
          auditLogRepository: deps.auditLogRepo,
        }
      );

      // Update pending approval tracker
      await deps.pendingApprovalRepo.updateApprovalStatus(
        pendingApproval.requestId,
        'rejected',
        senderPhone
      );

      // Record inbound message
      await recordInboundMessage(deps, {
        wppMessageId: data.id,
        senderPhone,
        senderName,
        rawBody: data.body,
        isFromWhitelistedAdmin: true,
        parsedCommand: command,
        status: 'processed',
        action: 'rejected',
        relatedRequestId: pendingApproval.requestId,
        relatedEcosystemId: pendingApproval.ecosystemId,
      });

      return {
        ok: true,
        action: 'rejected',
        requestId: pendingApproval.requestId,
      };
    }

    // Unknown action (should not happen due to earlier validation)
    return {
      ok: true,
      action: 'ignored',
      reason: 'invalid_command',
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    // Record error in inbound message
    await recordInboundMessage(deps, {
      wppMessageId: data.id,
      senderPhone,
      senderName,
      rawBody: data.body,
      isFromWhitelistedAdmin: true,
      parsedCommand: command,
      status: 'error',
      action: 'error',
      error: errorMessage,
      relatedRequestId: pendingApproval.requestId,
      relatedEcosystemId: pendingApproval.ecosystemId,
    });

    return {
      ok: false,
      action: 'error',
      requestId: pendingApproval.requestId,
      error: errorMessage,
    };
  }
}

/**
 * Record inbound message for audit trail
 */
async function recordInboundMessage(
  deps: WhatsAppApprovalHandlerDeps,
  params: {
    wppMessageId: string;
    senderPhone: string;
    senderName?: string | undefined;
    rawBody: string;
    isFromWhitelistedAdmin: boolean;
    parsedCommand?: { action: string; requestId: string; rawInput: string } | undefined;
    status: 'received' | 'processing' | 'processed' | 'ignored' | 'error';
    action?: string | undefined;
    error?: string | undefined;
    relatedRequestId?: string | undefined;
    relatedEcosystemId?: string | undefined;
  }
): Promise<void> {
  // Build the input for createWhatsAppInboundMessage, excluding undefined optional properties
  const createInput: {
    wppMessageId?: string;
    senderPhone: string;
    senderName?: string;
    isFromWhitelistedAdmin: boolean;
    rawBody: string;
  } = {
    wppMessageId: params.wppMessageId,
    senderPhone: params.senderPhone,
    isFromWhitelistedAdmin: params.isFromWhitelistedAdmin,
    rawBody: params.rawBody,
  };

  // Only include senderName if defined
  if (params.senderName !== undefined) {
    createInput.senderName = params.senderName;
  }

  const inbound = createWhatsAppInboundMessage(createInput);

  // Update with processing result - only assign if values are defined
  inbound.processedStatus = params.status;

  if (params.action !== undefined) {
    inbound.processedAction = params.action;
  }
  if (params.error !== undefined) {
    inbound.processingError = params.error;
  }
  if (params.relatedRequestId !== undefined) {
    inbound.relatedRequestId = params.relatedRequestId;
  }
  if (params.relatedEcosystemId !== undefined) {
    inbound.relatedEcosystemId = params.relatedEcosystemId;
  }
  if (params.parsedCommand !== undefined) {
    inbound.parsedCommand = params.parsedCommand as {
      action: 'approve' | 'reject' | 'unknown';
      requestId: string;
      rawInput: string;
    };
  }

  inbound.processedAt = new Date();

  await deps.inboundRepo.save(inbound);
}

/**
 * Find card request by short ID prefix
 *
 * Short IDs are the first 8 characters of the UUID, used in WhatsApp messages
 * for easier admin typing.
 */
async function findCardRequestByShortId(
  cardRequestRepo: ICardRequestRepository,
  shortId: string
): Promise<{ requestId: string; ecosystemId: string } | null> {
  // Fetch pending requests and filter by short ID prefix
  const result = await cardRequestRepo.findAllPending(
    { field: 'createdAt', order: 'desc' },
    { status: 'pending' },
    { limit: 100 }
  );

  const normalizedShortId = shortId.toUpperCase();

  const match = result.requests.find(
    (r) => r.requestId.slice(0, 8).toUpperCase() === normalizedShortId
  );

  if (match) {
    return {
      requestId: match.requestId,
      ecosystemId: match.ecosystemId,
    };
  }

  return null;
}

/**
 * Get default credit limit for a tier
 *
 * These are conservative defaults - admins can use the dashboard
 * for custom limits.
 */
function getDefaultLimitForTier(tier: string): number {
  switch (tier) {
    case 'low':
      return 500;
    case 'medium':
      return 1500;
    case 'high':
      return 3000;
    default:
      return 500;
  }
}
