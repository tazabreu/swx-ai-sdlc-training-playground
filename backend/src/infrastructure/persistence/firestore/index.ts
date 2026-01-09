/**
 * Firestore Persistence Layer
 *
 * Re-exports all Firestore repository implementations and client utilities.
 */

export {
  initializeFirestore,
  getFirestoreDb,
  resetFirestore,
  CollectionPaths,
  timestampToDate,
  dateToTimestamp,
} from './client.js';
export type { FirestoreConfig } from './client.js';

export { FirestoreUserRepository } from './user.repository.js';
export { FirestoreCardRepository } from './card.repository.js';
export { FirestoreCardRequestRepository } from './card-request.repository.js';
export { FirestoreTransactionRepository } from './transaction.repository.js';
export { FirestoreIdempotencyRepository } from './idempotency.repository.js';
export { FirestoreOutboxRepository } from './outbox.repository.js';
export { FirestoreAuditLogRepository } from './audit-log.repository.js';
export { WhatsAppNotificationFirestoreRepository } from './whatsapp-notification.repository.js';
export { WhatsAppInboundFirestoreRepository } from './whatsapp-inbound.repository.js';
export { PendingApprovalFirestoreRepository } from './pending-approval.repository.js';
