/**
 * WhatsApp Inbound Firestore Repository
 *
 * Firestore implementation for WhatsApp inbound message persistence.
 */

import type { Firestore } from 'firebase-admin/firestore';
import type { IWhatsAppInboundRepository } from '../interfaces/whatsapp-inbound.repository.js';
import type { WhatsAppInboundMessage } from '../../../domain/entities/whatsapp-inbound.entity.js';
import type { InboundMessageStatus, ParsedCommand } from '../../whatsapp/types.js';
import { requireDate, optionalDate } from './codec.js';

/**
 * Collection name for WhatsApp inbound messages
 */
const COLLECTION = 'whatsapp_inbound';

/**
 * Firestore WhatsApp Inbound Repository implementation
 */
export class WhatsAppInboundFirestoreRepository implements IWhatsAppInboundRepository {
  constructor(private readonly db: Firestore) {}

  async save(message: WhatsAppInboundMessage): Promise<void> {
    await this.db.collection(COLLECTION).doc(message.messageId).set(this.mapToDoc(message));
  }

  async findById(messageId: string): Promise<WhatsAppInboundMessage | null> {
    const doc = await this.db.collection(COLLECTION).doc(messageId).get();

    if (!doc.exists) {
      return null;
    }

    return this.mapFromDoc(doc.id, doc.data()!);
  }

  async findByWppMessageId(wppMessageId: string): Promise<WhatsAppInboundMessage | null> {
    const snapshot = await this.db
      .collection(COLLECTION)
      .where('wppMessageId', '==', wppMessageId)
      .limit(1)
      .get();

    if (snapshot.empty) {
      return null;
    }

    const doc = snapshot.docs[0];
    if (!doc) {
      return null;
    }
    return this.mapFromDoc(doc.id, doc.data());
  }

  async findBySenderPhone(phone: string, since?: Date): Promise<WhatsAppInboundMessage[]> {
    let query = this.db.collection(COLLECTION).where('senderPhone', '==', phone);

    if (since !== undefined) {
      query = query.where('receivedAt', '>=', since);
    }

    const snapshot = await query.orderBy('receivedAt', 'desc').get();

    return snapshot.docs.map((doc) => this.mapFromDoc(doc.id, doc.data()));
  }

  async updateProcessingStatus(
    messageId: string,
    status: InboundMessageStatus,
    action?: string,
    error?: string
  ): Promise<void> {
    const update: Record<string, unknown> = {
      processedStatus: status,
      processedAt: new Date(),
    };

    if (action !== undefined) {
      update.processedAction = action;
    }
    if (error !== undefined) {
      update.processingError = error;
    }

    await this.db.collection(COLLECTION).doc(messageId).update(update);
  }

  async deleteAll(): Promise<number> {
    const snapshot = await this.db.collection(COLLECTION).get();
    const batch = this.db.batch();

    snapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });

    await batch.commit();
    return snapshot.size;
  }

  private mapToDoc(message: WhatsAppInboundMessage): Record<string, unknown> {
    const doc: Record<string, unknown> = {
      senderPhone: message.senderPhone,
      isFromWhitelistedAdmin: message.isFromWhitelistedAdmin,
      rawBody: message.rawBody,
      processedStatus: message.processedStatus,
      receivedAt: message.receivedAt,
    };

    if (message.wppMessageId !== undefined) {
      doc.wppMessageId = message.wppMessageId;
    }
    if (message.senderName !== undefined) {
      doc.senderName = message.senderName;
    }
    if (message.parsedCommand !== undefined) {
      doc.parsedCommand = message.parsedCommand;
    }
    if (message.processedAction !== undefined) {
      doc.processedAction = message.processedAction;
    }
    if (message.processingError !== undefined) {
      doc.processingError = message.processingError;
    }
    if (message.relatedRequestId !== undefined) {
      doc.relatedRequestId = message.relatedRequestId;
    }
    if (message.relatedEcosystemId !== undefined) {
      doc.relatedEcosystemId = message.relatedEcosystemId;
    }
    if (message.processedAt !== undefined) {
      doc.processedAt = message.processedAt;
    }

    return doc;
  }

  private mapFromDoc(messageId: string, data: Record<string, unknown>): WhatsAppInboundMessage {
    const message: WhatsAppInboundMessage = {
      messageId,
      senderPhone: data.senderPhone as string,
      isFromWhitelistedAdmin: data.isFromWhitelistedAdmin as boolean,
      rawBody: data.rawBody as string,
      processedStatus: data.processedStatus as InboundMessageStatus,
      receivedAt: requireDate(data.receivedAt, 'receivedAt'),
    };

    if (data.wppMessageId !== undefined) {
      message.wppMessageId = data.wppMessageId as string;
    }
    if (data.senderName !== undefined) {
      message.senderName = data.senderName as string;
    }
    if (data.parsedCommand !== undefined) {
      message.parsedCommand = data.parsedCommand as ParsedCommand;
    }
    if (data.processedAction !== undefined) {
      message.processedAction = data.processedAction as string;
    }
    if (data.processingError !== undefined) {
      message.processingError = data.processingError as string;
    }
    if (data.relatedRequestId !== undefined) {
      message.relatedRequestId = data.relatedRequestId as string;
    }
    if (data.relatedEcosystemId !== undefined) {
      message.relatedEcosystemId = data.relatedEcosystemId as string;
    }
    if (data.processedAt !== undefined) {
      const processedAtDate = optionalDate(data.processedAt, 'processedAt');
      if (processedAtDate !== undefined) {
        message.processedAt = processedAtDate;
      }
    }

    return message;
  }
}
