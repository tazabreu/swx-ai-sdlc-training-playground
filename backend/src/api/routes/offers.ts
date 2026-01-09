/**
 * Offers Routes
 *
 * Personalized product offers endpoint.
 */

import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import type { Container } from '../../infrastructure/di/container.js';
import { ServiceNames } from '../../infrastructure/di/container.js';
import type { IUserRepository } from '../../infrastructure/persistence/interfaces/user.repository.js';
import type { ICardRepository } from '../../infrastructure/persistence/interfaces/card.repository.js';
import type { ICardRequestRepository } from '../../infrastructure/persistence/interfaces/card-request.repository.js';
import type { OffersResponse, ProductOfferDTO } from '../dto/offers.dto.js';
import { Errors } from '../middleware/error-handler.js';
import { createAuthMiddleware } from '../middleware/auth.js';
import type { IAuthProvider } from '../../infrastructure/auth/auth-provider.interface.js';
import { generateOffers } from '../../domain/services/offers.service.js';

/**
 * Create offers router
 */
export function createOffersRouter(container: Container): Router {
  const router = Router();
  const authProvider = container.resolve<IAuthProvider>(ServiceNames.AuthProvider);
  const authMiddleware = createAuthMiddleware(authProvider);

  /**
   * GET /v1/offers
   * Returns personalized product offers based on user's profile
   */
  router.get(
    '/',
    authMiddleware,
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const ecosystemId = req.ecosystemId;
        if (ecosystemId === undefined) {
          throw Errors.unauthorized();
        }

        const userRepo = container.resolve<IUserRepository>(ServiceNames.UserRepository);
        const cardRepo = container.resolve<ICardRepository>(ServiceNames.CardRepository);
        const requestRepo = container.resolve<ICardRequestRepository>(
          ServiceNames.CardRequestRepository
        );

        // Fetch user
        const user = await userRepo.findById(ecosystemId);
        if (user === null) {
          throw Errors.notFound('User', ecosystemId);
        }

        // Fetch existing cards
        const existingCards = await cardRepo.findByUser(ecosystemId);

        // Check for pending requests
        const pendingRequest = await requestRepo.findPendingByUser(ecosystemId);
        const pendingRequests = pendingRequest !== null ? [pendingRequest] : [];

        // Check for recent rejections (last 30 days)
        const recentRejections = await requestRepo.findRejectedByUser(ecosystemId, 30);

        // Generate offers using domain service
        const domainOffers = generateOffers(user, existingCards, pendingRequests, recentRejections);

        // Map to DTOs
        const offers: ProductOfferDTO[] = domainOffers.map(
          (offer): ProductOfferDTO => ({
            productId: offer.productId,
            productType: offer.productType,
            name: offer.name,
            description: offer.description,
            terms: {
              creditLimit: offer.terms.limit,
              apr: offer.terms.apr,
              annualFee: offer.terms.annualFee,
            },
            eligibility: {
              eligible: offer.eligibility.eligible,
              subjectToApproval: offer.eligibility.requiresApproval,
              cooldownUntil:
                offer.eligibility.cooldownDaysRemaining !== undefined
                  ? new Date(
                      Date.now() + offer.eligibility.cooldownDaysRemaining * 24 * 60 * 60 * 1000
                    ).toISOString()
                  : null,
            },
          })
        );

        const response: OffersResponse = { offers };
        res.json(response);
      } catch (error) {
        next(error);
      }
    }
  );

  return router;
}
