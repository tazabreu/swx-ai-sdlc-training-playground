/**
 * Dashboard Routes
 *
 * User financial overview endpoint.
 */

import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import type { Container } from '../../infrastructure/di/container.js';
import { ServiceNames } from '../../infrastructure/di/container.js';
import type { IUserRepository } from '../../infrastructure/persistence/interfaces/user.repository.js';
import type { ICardRepository } from '../../infrastructure/persistence/interfaces/card.repository.js';
import type { ICardRequestRepository } from '../../infrastructure/persistence/interfaces/card-request.repository.js';
import type { DashboardResponse, SuggestedActionDTO } from '../dto/dashboard.dto.js';
import type { CardSummaryDTO } from '../dto/cards.dto.js';
import { Errors } from '../middleware/error-handler.js';
import { createAuthMiddleware } from '../middleware/auth.js';
import type { IAuthProvider } from '../../infrastructure/auth/auth-provider.interface.js';

/**
 * Map card to summary DTO
 */
function cardToSummaryDTO(card: {
  cardId: string;
  type: string;
  status: string;
  limit: number;
  balance: number;
  availableCredit: number;
  minimumPayment: number;
  nextDueDate?: Date | undefined;
}): CardSummaryDTO {
  const result: CardSummaryDTO = {
    cardId: card.cardId,
    type: card.type,
    status: card.status as 'active' | 'suspended' | 'cancelled',
    limit: card.limit,
    balance: card.balance,
    availableCredit: card.availableCredit,
    minimumPayment: card.minimumPayment,
    nearLimit: card.balance / card.limit > 0.9,
  };
  if (card.nextDueDate !== undefined) {
    result.nextDueDate = card.nextDueDate.toISOString();
  }
  return result;
}

/**
 * Create dashboard router
 */
export function createDashboardRouter(container: Container): Router {
  const router = Router();
  const authProvider = container.resolve<IAuthProvider>(ServiceNames.AuthProvider);
  const authMiddleware = createAuthMiddleware(authProvider);

  /**
   * GET /v1/dashboard
   * Returns the authenticated user's financial summary
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

        // Fetch cards
        const cards = await cardRepo.findByUser(ecosystemId);

        // Fetch pending requests
        const pendingRequest = await requestRepo.findPendingByUser(ecosystemId);

        // Build suggested actions for new users
        const suggestedActions: SuggestedActionDTO[] = [];
        if (cards.length === 0 && pendingRequest === null) {
          suggestedActions.push({
            type: 'apply_for_card',
            message: 'Apply for your first credit card to start building credit',
            link: '/v1/offers',
          });
        }

        // Check for ETag/conditional request
        const etag = `"${user.updatedAt.getTime()}"`;
        const ifNoneMatch = req.headers['if-none-match'];
        if (ifNoneMatch === etag) {
          res.status(304).end();
          return;
        }

        const response: DashboardResponse = {
          user: {
            ecosystemId: user.ecosystemId,
            email: user.email,
            score: user.currentScore,
            tier: user.tier,
            status: user.status,
          },
          cards: cards.map(cardToSummaryDTO),
          pendingRequests:
            pendingRequest !== null
              ? [
                  {
                    requestId: pendingRequest.requestId,
                    productId: pendingRequest.productId,
                    status: pendingRequest.status,
                    submittedAt: pendingRequest.createdAt.toISOString(),
                    estimatedReviewTime:
                      pendingRequest.status === 'pending' ? '1-2 business days' : undefined,
                  },
                ]
              : [],
          suggestedActions: suggestedActions.length > 0 ? suggestedActions : undefined,
          lastUpdated: user.updatedAt.toISOString(),
        };

        res.setHeader('ETag', etag);
        res.setHeader('Last-Modified', user.updatedAt.toUTCString());
        res.json(response);
      } catch (error) {
        next(error);
      }
    }
  );

  return router;
}
