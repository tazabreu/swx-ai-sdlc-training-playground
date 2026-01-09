/**
 * Offers Service
 *
 * Pure business logic for generating personalized product offers.
 * No external dependencies - operates only on domain types.
 */

import type { User, UserTier } from '../entities/user.entity.js';
import type { Card } from '../entities/card.entity.js';
import type { CardRequest } from '../entities/card-request.entity.js';
import { CREDIT_LIMITS } from '../entities/card.entity.js';
import { CARD_REQUEST_RULES } from '../entities/card-request.entity.js';

/**
 * Product offer
 */
export interface Offer {
  productType: 'credit-card';
  productId: string;
  name: string;
  description: string;
  terms: OfferTerms;
  eligibility: OfferEligibility;
}

/**
 * Offer terms based on tier
 */
export interface OfferTerms {
  limit: number;
  apr: string;
  annualFee: number;
  features: string[];
}

/**
 * Eligibility status
 */
export interface OfferEligibility {
  eligible: boolean;
  requiresApproval: boolean;
  cooldownDaysRemaining?: number | undefined;
  reason?: string | undefined;
}

/**
 * Get terms for a given tier
 */
export function getTermsForTier(tier: UserTier): OfferTerms {
  switch (tier) {
    case 'high':
      return {
        limit: CREDIT_LIMITS.HIGH,
        apr: '12.99%',
        annualFee: 0,
        features: [
          'Premium rewards program',
          '2% cash back on all purchases',
          'No foreign transaction fees',
          'Travel insurance',
          'Concierge service',
        ],
      };

    case 'medium':
      return {
        limit: CREDIT_LIMITS.MEDIUM,
        apr: '18.99%',
        annualFee: 0,
        features: [
          '1% cash back on all purchases',
          'Fraud protection',
          'Online account management',
        ],
      };

    case 'low':
      return {
        limit: CREDIT_LIMITS.LOW,
        apr: '24.99%',
        annualFee: 29,
        features: ['Credit building program', 'Fraud protection', 'Online account management'],
      };
  }
}

/**
 * Check if user is within rejection cooldown period
 */
function getCooldownDaysRemaining(recentRejections: CardRequest[]): number | undefined {
  if (recentRejections.length === 0) return undefined;

  const now = new Date();
  const cooldownMs = CARD_REQUEST_RULES.COOLDOWN_DAYS_AFTER_REJECTION * 24 * 60 * 60 * 1000;

  for (const rejection of recentRejections) {
    if (rejection.status !== 'rejected' || rejection.decision === undefined) continue;

    const rejectionTime = rejection.decision.decidedAt.getTime();
    const timeSinceRejection = now.getTime() - rejectionTime;

    if (timeSinceRejection < cooldownMs) {
      return Math.ceil((cooldownMs - timeSinceRejection) / (24 * 60 * 60 * 1000));
    }
  }

  return undefined;
}

/**
 * Generate credit card offer
 */
function generateCreditCardOffer(
  user: User,
  hasActiveCard: boolean,
  hasPendingRequest: boolean,
  cooldownDaysRemaining: number | undefined
): Offer {
  const terms = getTermsForTier(user.tier);
  const requiresApproval = user.tier === 'low';

  let eligible = true;
  let reason: string | undefined;

  if (hasActiveCard) {
    eligible = false;
    reason = 'You already have an active credit card';
  } else if (hasPendingRequest) {
    eligible = false;
    reason = 'You have a pending card request';
  } else if (cooldownDaysRemaining !== undefined) {
    eligible = false;
    reason = `Please wait ${cooldownDaysRemaining} days before applying again`;
  }

  return {
    productType: 'credit-card',
    productId: 'default-credit-card',
    name: getCreditCardName(user.tier),
    description: getCreditCardDescription(user.tier),
    terms,
    eligibility: {
      eligible,
      requiresApproval,
      cooldownDaysRemaining,
      reason,
    },
  };
}

/**
 * Get credit card name based on tier
 */
function getCreditCardName(tier: UserTier): string {
  switch (tier) {
    case 'high':
      return 'Tazco Premium Rewards Card';
    case 'medium':
      return 'Tazco Standard Card';
    case 'low':
      return 'Tazco Starter Card';
  }
}

/**
 * Get credit card description based on tier
 */
function getCreditCardDescription(tier: UserTier): string {
  switch (tier) {
    case 'high':
      return 'Our premium card with the highest rewards and benefits for qualified members.';
    case 'medium':
      return 'A solid everyday card with competitive rates and cash back rewards.';
    case 'low':
      return 'Start building your credit with our secured card designed for credit builders.';
  }
}

/**
 * Generate personalized offers for a user
 *
 * Rules:
 * - Only offer credit card if user doesn't have one
 * - Show appropriate terms based on tier
 * - Indicate if approval is required (low tier)
 * - Show cooldown period if recently rejected
 */
export function generateOffers(
  user: User,
  existingCards: Card[],
  pendingRequests: CardRequest[],
  recentRejections: CardRequest[]
): Offer[] {
  const offers: Offer[] = [];

  // Check current status
  const hasActiveCard = existingCards.some((card) => card.status === 'active');
  const hasPendingRequest = pendingRequests.some((request) => request.status === 'pending');
  const cooldownDaysRemaining = getCooldownDaysRemaining(recentRejections);

  // Always include credit card offer (with eligibility status)
  const creditCardOffer = generateCreditCardOffer(
    user,
    hasActiveCard,
    hasPendingRequest,
    cooldownDaysRemaining
  );

  // Only include in offers if user doesn't have an active card
  // (shows offer with eligibility info even if not currently eligible)
  if (!hasActiveCard) {
    offers.push(creditCardOffer);
  }

  return offers;
}

/**
 * Get offer summary for dashboard
 */
export interface OfferSummary {
  hasOffers: boolean;
  creditCardAvailable: boolean;
  message?: string | undefined;
}

export function getOfferSummary(
  user: User,
  existingCards: Card[],
  pendingRequests: CardRequest[]
): OfferSummary {
  const hasActiveCard = existingCards.some((card) => card.status === 'active');
  const hasPendingRequest = pendingRequests.some((request) => request.status === 'pending');

  if (hasActiveCard) {
    return {
      hasOffers: false,
      creditCardAvailable: false,
      message: 'You already have an active credit card',
    };
  }

  if (hasPendingRequest) {
    return {
      hasOffers: false,
      creditCardAvailable: false,
      message: 'Your card request is being reviewed',
    };
  }

  return {
    hasOffers: true,
    creditCardAvailable: true,
    message: user.tier === 'low' ? 'Credit card available (subject to approval)' : undefined,
  };
}
