export interface User {
  ecosystemId: string;
  role: 'user' | 'admin';
  email?: string;
  createdAt: string;
}

// Card summary from backend (matches CardSummaryDTO)
export interface Card {
  cardId: string;
  type: string;
  status: 'active' | 'suspended' | 'cancelled';
  limit: number;
  balance: number;
  availableCredit: number;
  minimumPayment: number;
  nearLimit?: boolean;
  nextDueDate?: string;
}

export interface CardRequest {
  requestId: string;
  user: { ecosystemId: string; email?: string };
  status: 'pending' | 'approved' | 'rejected';
  productId: string;
  card?: Card;
  createdAt: string;
  scoreAtRequest?: number;
  currentScore?: number; // User's current score (for admin view)
  tierAtRequest?: 'high' | 'medium' | 'low'; // User's tier at request time (for admin view)
  daysPending?: number;
  requiresAttention?: boolean;
  decision?: {
    outcome: 'approved' | 'rejected';
    source: 'auto' | 'admin';
    approvedLimit?: number;
    reason?: string;
  };
}

// Credit limits by tier (must match backend CREDIT_LIMITS)
export const CREDIT_LIMITS = {
  high: 10000,
  medium: 5000,
  low: 2000,
} as const;

// Transaction from backend (matches TransactionDTO)
export interface Transaction {
  transactionId: string;
  type: 'purchase' | 'payment';
  amount: number;
  merchant?: string;
  status: 'completed' | 'failed';
  timestamp: string; // backend uses timestamp, not createdAt
  paymentStatus?: 'on_time' | 'late';
  scoreImpact?: number;
}

// Admin score lookup response
export interface Score {
  ecosystemId: string;
  score: number;
  tier: string;
}

// Dashboard user info (matches DashboardUserDTO)
export interface DashboardUser {
  ecosystemId: string;
  email: string;
  score: number;
  tier: 'high' | 'medium' | 'low';
  status: 'active' | 'disabled';
}

// Dashboard response (matches DashboardResponse)
export interface Dashboard {
  user: DashboardUser;
  cards: Card[];
  pendingRequests: Array<{
    requestId: string;
    productId: string;
    status: 'pending' | 'approved' | 'rejected';
    submittedAt: string;
    estimatedReviewTime?: string;
  }>;
  suggestedActions?: Array<{
    type: string;
    message: string;
    link?: string;
  }>;
  lastUpdated: string;
}

// Product offer (matches ProductOfferDTO)
export interface Offer {
  productId: string;
  productType: 'credit_card';
  name: string;
  description: string;
  terms: {
    creditLimit: number;
    apr: number;
    annualFee: number;
  };
  eligibility: {
    eligible: boolean;
    subjectToApproval: boolean;
    cooldownUntil: string | null;
  };
}
