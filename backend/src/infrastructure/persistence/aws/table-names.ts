/**
 * DynamoDB Table Names
 *
 * Constants for all DynamoDB table names used by the Financial API.
 */

/**
 * DynamoDB table name constants
 */
export const TableNames = {
  USERS: 'acme-users',
  SCORES: 'acme-scores',
  CARDS: 'acme-cards',
  CARD_REQUESTS: 'acme-card-requests',
  TRANSACTIONS: 'acme-transactions',
  IDEMPOTENCY: 'acme-idempotency',
  OUTBOX: 'acme-outbox',
  OUTBOX_SEQUENCES: 'acme-outbox-sequences',
  AUDIT_LOGS: 'acme-audit-logs',
  WHATSAPP_NOTIFICATIONS: 'acme-whatsapp-notifications',
  WHATSAPP_INBOUND: 'acme-whatsapp-inbound',
  PENDING_APPROVALS: 'acme-pending-approvals',
} as const;

/**
 * GSI (Global Secondary Index) name constants
 */
export const GSINames = {
  // Users table
  USER_BY_FIREBASE_UID: 'UserByFirebaseUid',

  // Cards table
  CARDS_BY_STATUS: 'CardsByStatus',

  // Card requests table
  PENDING_REQUESTS: 'PendingRequests',

  // Outbox table
  PENDING_EVENTS: 'PendingEvents',
  RETRY_EVENTS: 'RetryEvents',

  // Audit logs table
  LOGS_BY_ACTOR: 'LogsByActor',

  // WhatsApp notifications table
  PENDING_NOTIFICATIONS: 'PendingNotifications',
  BY_RELATED_ENTITY: 'ByRelatedEntity',

  // WhatsApp inbound table
  BY_WPP_MESSAGE_ID: 'ByWppMessageId',
  BY_SENDER_PHONE: 'BySenderPhone',

  // Pending approvals table
  EXPIRED_APPROVALS: 'ExpiredApprovals',
} as const;

export type TableName = (typeof TableNames)[keyof typeof TableNames];
export type GSIName = (typeof GSINames)[keyof typeof GSINames];
