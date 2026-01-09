/**
 * Persistence Interfaces - Re-exports
 *
 * Central export point for all repository interfaces.
 */

export { type IUserRepository } from './user.repository.js';

export {
  type ICardRepository,
  type CardFilter,
  type CardBalanceUpdate,
  ConcurrencyError,
} from './card.repository.js';

export {
  type ICardRequestRepository,
  type PaginationOptions,
  type PendingRequestSortOptions,
  type PendingRequestFilter,
  type PaginatedCardRequests,
} from './card-request.repository.js';

export {
  type ITransactionRepository,
  type TransactionFilter,
  type TransactionPaginationOptions,
  type PaginatedTransactions,
} from './transaction.repository.js';

export { type IIdempotencyRepository } from './idempotency.repository.js';

export { type IOutboxRepository } from './outbox.repository.js';

export {
  type IAuditLogRepository,
  type AuditLogPaginationOptions,
  type PaginatedAuditLogs,
} from './audit-log.repository.js';

export { type IWhatsAppNotificationRepository } from './whatsapp-notification.repository.js';

export { type IWhatsAppInboundRepository } from './whatsapp-inbound.repository.js';

export { type IPendingApprovalRepository } from './pending-approval.repository.js';
