/**
 * Application Handlers - Re-exports
 *
 * Central export point for all application handlers.
 */

// Command handlers
export {
  handleRequestCard,
  type RequestCardResult,
  type RequestCardHandlerDeps,
  RequestCardError,
} from './request-card.handler.js';

export {
  handleMakePurchase,
  type MakePurchaseResult,
  type MakePurchaseHandlerDeps,
  MakePurchaseError,
} from './make-purchase.handler.js';

export {
  handleMakePayment,
  type MakePaymentResult,
  type MakePaymentHandlerDeps,
  MakePaymentError,
} from './make-payment.handler.js';

export {
  handleAdminApproveCard,
  type AdminApproveCardResult,
  type AdminApproveCardHandlerDeps,
  AdminApproveCardError,
} from './admin-approve-card.handler.js';

export {
  handleAdminRejectCard,
  type AdminRejectCardResult,
  type AdminRejectCardHandlerDeps,
  AdminRejectCardError,
} from './admin-reject-card.handler.js';

export {
  handleAdminAdjustScore,
  type AdminAdjustScoreResult,
  type AdminAdjustScoreHandlerDeps,
  AdminAdjustScoreError,
} from './admin-adjust-score.handler.js';

export {
  handleSystemCleanup,
  type SystemCleanupResult,
  type SystemCleanupHandlerDeps,
  SystemCleanupError,
} from './system-cleanup.handler.js';

// Query handlers
export {
  handleGetDashboard,
  type GetDashboardHandlerDeps,
  GetDashboardError,
} from './get-dashboard.handler.js';

export {
  handleGetOffers,
  type GetOffersHandlerDeps,
  GetOffersError,
} from './get-offers.handler.js';

export {
  handleListCards,
  type ListCardsHandlerDeps,
  ListCardsError,
} from './list-cards.handler.js';

export {
  handleAdminGetUserScore,
  type AdminGetUserScoreHandlerDeps,
  AdminGetUserScoreError,
} from './admin-get-user-score.handler.js';

export {
  handleAdminListPendingRequests,
  type AdminListPendingRequestsHandlerDeps,
} from './admin-list-pending-requests.handler.js';

// WhatsApp handlers
export {
  handleWhatsAppApproval,
  type WhatsAppApprovalHandlerDeps,
} from './whatsapp-approval.handler.js';

export {
  handleCardRequestNotification,
  type CardRequestNotificationHandlerDeps,
  type CardRequestNotificationResult,
} from './card-request-notification.handler.js';

export {
  handlePaymentNotification,
  type PaymentNotificationHandlerDeps,
  type PaymentNotificationResult,
} from './payment-notification.handler.js';

export {
  handleExpiredApprovals,
  type ApprovalExpirationHandlerDeps,
  type ApprovalExpirationResult,
} from './approval-expiration.handler.js';
