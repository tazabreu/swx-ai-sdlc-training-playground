/**
 * Get Offers Query
 *
 * Query to retrieve personalized product offers.
 */

import type { Offer } from '../../domain/services/offers.service.js';

/**
 * Query to get offers
 */
export interface GetOffersQuery {
  /** User's ecosystem ID */
  ecosystemId: string;
}

/**
 * Offers response
 */
export interface OffersResult {
  /** Available offers */
  offers: Offer[];
  /** Summary of offer availability */
  summary: {
    hasOffers: boolean;
    creditCardAvailable: boolean;
    message?: string | undefined;
  };
}

/**
 * Create a get offers query
 */
export function createGetOffersQuery(ecosystemId: string): GetOffersQuery {
  return { ecosystemId };
}
