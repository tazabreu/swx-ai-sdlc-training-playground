/**
 * Offers DTOs
 *
 * Product offers response shapes per OpenAPI spec.
 */

/**
 * Product offer terms
 */
export interface OfferTermsDTO {
  creditLimit: number;
  apr: string;
  annualFee: number;
}

/**
 * Eligibility info
 */
export interface EligibilityDTO {
  eligible: boolean;
  subjectToApproval: boolean;
  cooldownUntil?: string | null;
}

/**
 * Product offer
 */
export interface ProductOfferDTO {
  productId: string;
  productType: 'credit-card';
  name: string;
  description?: string;
  terms: OfferTermsDTO;
  eligibility: EligibilityDTO;
}

/**
 * Offers response
 */
export interface OffersResponse {
  offers: ProductOfferDTO[];
}
