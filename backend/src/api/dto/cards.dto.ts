/**
 * Cards DTOs
 *
 * Card response shapes per OpenAPI spec.
 */

/**
 * Card summary
 */
export interface CardSummaryDTO {
  cardId: string;
  type: string;
  status: 'active' | 'suspended' | 'cancelled';
  limit: number;
  balance: number;
  availableCredit: number;
  minimumPayment: number;
  nextDueDate?: string | undefined;
  nearLimit: boolean;
}

/**
 * Card detail (extends summary)
 */
export interface CardDetailDTO extends CardSummaryDTO {
  createdAt: string;
  activatedAt?: string | undefined;
  cancelledAt?: string | undefined;
  approvedBy: 'auto' | 'admin';
  scoreAtApproval: number;
}

/**
 * Cards list response
 */
export interface CardsListResponse {
  cards: CardSummaryDTO[];
  suggestion?: string;
}

/**
 * Single card response
 */
export interface CardResponse {
  card: CardDetailDTO;
}

/**
 * Card request input
 */
export interface CardRequestInput {
  productId: string;
}

/**
 * Card request decision
 */
export interface CardRequestDecisionDTO {
  outcome: 'approved' | 'rejected';
  source: 'auto' | 'admin';
  approvedLimit?: number;
  reason?: string;
}

/**
 * Card request response
 */
export interface CardRequestResponse {
  request: {
    requestId: string;
    status: 'pending' | 'approved' | 'rejected';
    scoreAtRequest: number;
    decision?: CardRequestDecisionDTO;
    card?: CardSummaryDTO;
  };
}

/**
 * Cancel card response
 */
export interface CancelCardResponse {
  card: CardDetailDTO;
  alreadyCancelled?: boolean;
}
