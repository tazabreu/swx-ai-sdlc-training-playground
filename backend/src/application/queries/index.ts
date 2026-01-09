/**
 * Application Queries - Re-exports
 *
 * Central export point for all application queries.
 */

export {
  type GetDashboardQuery,
  type DashboardResult,
  createGetDashboardQuery,
  generateDashboardEtag,
} from './get-dashboard.query.js';

export {
  type GetOffersQuery,
  type OffersResult,
  createGetOffersQuery,
} from './get-offers.query.js';

export {
  type ListCardsQuery,
  type CardListItem,
  type ListCardsResult,
  createListCardsQuery,
  calculateUtilization,
  isNearLimit,
} from './list-cards.query.js';

export { type GetCardQuery, type CardDetailResult, createGetCardQuery } from './get-card.query.js';

export {
  type ListTransactionsQuery,
  type TransactionListItem,
  type ListTransactionsResult,
  createListTransactionsQuery,
  normalizePageSize,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
} from './list-transactions.query.js';

export {
  type AdminGetUserScoreQuery,
  type ScoreHistoryEntry,
  type AdminUserScoreResult,
  createAdminGetUserScoreQuery,
  calculateScoreStatistics,
} from './admin-get-user-score.query.js';

export {
  type AdminListPendingRequestsQuery,
  type PendingRequestListItem,
  type AdminListPendingRequestsResult,
  type PendingRequestSortField,
  type SortOrder,
  createAdminListPendingRequestsQuery,
  calculateDaysPending,
  requestRequiresAttention,
} from './admin-list-pending-requests.query.js';
