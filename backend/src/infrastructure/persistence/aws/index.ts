/**
 * AWS Persistence Module
 *
 * DynamoDB repository implementations for the Financial API.
 */

// Client and configuration
export {
  getDynamoDBClient,
  getDocumentClient,
  resetDynamoDBClients,
  isLocalStack,
  type DynamoDBConfig,
} from './client.js';

// Table names
export { TableNames, GSINames, type TableName, type GSIName } from './table-names.js';

// Codec utilities
export {
  toISOString,
  fromISOString,
  requireDate,
  optionalDate,
  stripUndefined,
  compositeKey,
  parseCompositeKey,
  timestampSortKey,
  parseTimestampSortKey,
  encodeCursor,
  decodeCursor,
  calculateTTL,
  fromTTL,
} from './codec.js';

// Repository implementations
export { DynamoDBUserRepository } from './user.repository.js';
export { DynamoDBCardRepository } from './card.repository.js';
export { DynamoDBCardRequestRepository } from './card-request.repository.js';
export { DynamoDBTransactionRepository } from './transaction.repository.js';
export { DynamoDBIdempotencyRepository } from './idempotency.repository.js';
export { DynamoDBOutboxRepository } from './outbox.repository.js';
export { DynamoDBAuditLogRepository } from './audit-log.repository.js';
export { DynamoDBWhatsAppNotificationRepository } from './whatsapp-notification.repository.js';
export { DynamoDBWhatsAppInboundRepository } from './whatsapp-inbound.repository.js';
export { DynamoDBPendingApprovalRepository } from './pending-approval.repository.js';
