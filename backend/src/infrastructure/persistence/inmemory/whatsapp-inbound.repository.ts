/**
 * In-Memory WhatsApp Inbound Repository
 *
 * In-memory implementation for testing.
 */

/* eslint-disable @typescript-eslint/require-await */

import type { IWhatsAppInboundRepository } from '../interfaces/whatsapp-inbound.repository.js';
import type { WhatsAppInboundMessage } from '../../../domain/entities/whatsapp-inbound.entity.js';
import type { InboundMessageStatus } from '../../whatsapp/types.js';

/**
 * In-Memory WhatsApp Inbound Repository implementation
 */
export class InMemoryWhatsAppInboundRepository implements IWhatsAppInboundRepository {
  private messages: Map<string, WhatsAppInboundMessage> = new Map();

  async save(message: WhatsAppInboundMessage): Promise<void> {
    this.messages.set(message.messageId, { ...message });
  }

  async findById(messageId: string): Promise<WhatsAppInboundMessage | null> {
    return this.messages.get(messageId) ?? null;
  }

  async findByWppMessageId(wppMessageId: string): Promise<WhatsAppInboundMessage | null> {
    return Array.from(this.messages.values()).find((m) => m.wppMessageId === wppMessageId) ?? null;
  }

  async findBySenderPhone(phone: string, since?: Date): Promise<WhatsAppInboundMessage[]> {
    return Array.from(this.messages.values())
      .filter((m) => {
        if (m.senderPhone !== phone) return false;
        if (since && m.receivedAt < since) return false;
        return true;
      })
      .sort((a, b) => b.receivedAt.getTime() - a.receivedAt.getTime());
  }

  async updateProcessingStatus(
    messageId: string,
    status: InboundMessageStatus,
    action?: string,
    error?: string
  ): Promise<void> {
    const message = this.messages.get(messageId);
    if (!message) {
      throw new Error(`Message not found: ${messageId}`);
    }

    message.processedStatus = status;
    message.processedAt = new Date();
    if (action !== undefined) {
      message.processedAction = action;
    }
    if (error !== undefined) {
      message.processingError = error;
    }
  }

  async deleteAll(): Promise<number> {
    const count = this.messages.size;
    this.messages.clear();
    return count;
  }

  /**
   * Get all messages (for testing)
   */
  getAll(): WhatsAppInboundMessage[] {
    return Array.from(this.messages.values());
  }
}
