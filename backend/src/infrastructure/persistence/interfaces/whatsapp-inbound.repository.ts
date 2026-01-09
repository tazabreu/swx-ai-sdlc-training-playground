/**
 * WhatsApp Inbound Repository Interface
 *
 * Defines persistence operations for inbound WhatsApp messages.
 */

import type { WhatsAppInboundMessage } from '../../../domain/entities/whatsapp-inbound.entity.js';
import type { InboundMessageStatus } from '../../whatsapp/types.js';

/**
 * Repository interface for WhatsApp inbound message persistence
 */
export interface IWhatsAppInboundRepository {
  /**
   * Save a new inbound message
   */
  save(message: WhatsAppInboundMessage): Promise<void>;

  /**
   * Find message by our internal ID
   */
  findById(messageId: string): Promise<WhatsAppInboundMessage | null>;

  /**
   * Find message by WPP-Connect message ID (for deduplication)
   */
  findByWppMessageId(wppMessageId: string): Promise<WhatsAppInboundMessage | null>;

  /**
   * Find messages by sender phone
   */
  findBySenderPhone(phone: string, since?: Date): Promise<WhatsAppInboundMessage[]>;

  /**
   * Update processing status
   */
  updateProcessingStatus(
    messageId: string,
    status: InboundMessageStatus,
    action?: string,
    error?: string
  ): Promise<void>;

  /**
   * Delete all messages (for cleanup)
   */
  deleteAll(): Promise<number>;
}
