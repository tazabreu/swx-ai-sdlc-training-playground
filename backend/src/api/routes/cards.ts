/**
 * Cards Routes
 *
 * Card management endpoints.
 */

import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import type { Container } from '../../infrastructure/di/container.js';
import { ServiceNames } from '../../infrastructure/di/container.js';
import type { IUserRepository } from '../../infrastructure/persistence/interfaces/user.repository.js';
import type { ICardRepository } from '../../infrastructure/persistence/interfaces/card.repository.js';
import type { ICardRequestRepository } from '../../infrastructure/persistence/interfaces/card-request.repository.js';
import type { IIdempotencyRepository } from '../../infrastructure/persistence/interfaces/idempotency.repository.js';
import type { IAuditLogRepository } from '../../infrastructure/persistence/interfaces/audit-log.repository.js';
import type { IOutboxRepository } from '../../infrastructure/persistence/interfaces/outbox.repository.js';
import type {
  CardsListResponse,
  CardResponse,
  CardRequestInput,
  CardRequestResponse,
  CancelCardResponse,
  CardSummaryDTO,
  CardDetailDTO,
} from '../dto/cards.dto.js';
import { AppError, ErrorCodes, Errors } from '../middleware/error-handler.js';
import { createAuthMiddleware } from '../middleware/auth.js';
import type { IAuthProvider } from '../../infrastructure/auth/auth-provider.interface.js';
import { createRequestCardCommand } from '../../application/commands/request-card.command.js';
import {
  handleRequestCard,
  RequestCardError,
} from '../../application/handlers/request-card.handler.js';
import { createCancelCardCommand } from '../../application/commands/cancel-card.command.js';
import {
  handleCancelCard,
  CancelCardError,
} from '../../application/handlers/cancel-card.handler.js';

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
 * Map card to detail DTO
 */
function cardToDetailDTO(card: {
  cardId: string;
  type: string;
  status: string;
  limit: number;
  balance: number;
  availableCredit: number;
  minimumPayment: number;
  nextDueDate?: Date | undefined;
  createdAt: Date;
  activatedAt?: Date | undefined;
  cancelledAt?: Date | undefined;
  approvedBy: 'auto' | 'admin';
  scoreAtApproval: number;
}): CardDetailDTO {
  const result: CardDetailDTO = {
    ...cardToSummaryDTO(card),
    createdAt: card.createdAt.toISOString(),
    approvedBy: card.approvedBy,
    scoreAtApproval: card.scoreAtApproval,
  };
  if (card.activatedAt !== undefined) {
    result.activatedAt = card.activatedAt.toISOString();
  }
  if (card.cancelledAt !== undefined) {
    result.cancelledAt = card.cancelledAt.toISOString();
  }
  return result;
}

/**
 * Create cards router
 */
export function createCardsRouter(container: Container): Router {
  const router = Router();
  const authProvider = container.resolve<IAuthProvider>(ServiceNames.AuthProvider);
  const authMiddleware = createAuthMiddleware(authProvider);

  /**
   * GET /v1/cards
   * List user's cards
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

        const cardRepo = container.resolve<ICardRepository>(ServiceNames.CardRepository);

        // Parse filters
        const statusFilter = req.query.status as string | undefined;
        const typeFilter = req.query.type as string | undefined;

        const filter: { status?: 'active' | 'suspended' | 'cancelled'; type?: string } = {};
        if (statusFilter !== undefined) {
          filter.status = statusFilter as 'active' | 'suspended' | 'cancelled';
        }
        if (typeFilter !== undefined) {
          filter.type = typeFilter;
        }

        const cards = await cardRepo.findByUser(ecosystemId, filter);

        const response: CardsListResponse = {
          cards: cards.map(cardToSummaryDTO),
        };

        if (cards.length === 0) {
          response.suggestion = 'No cards found. Visit /v1/offers to see available products.';
        }

        res.json(response);
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * GET /v1/cards/:cardId
   * Get card details
   */
  router.get(
    '/:cardId',
    authMiddleware,
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const ecosystemId = req.ecosystemId;
        if (ecosystemId === undefined) {
          throw Errors.unauthorized();
        }

        const cardId = req.params.cardId;
        if (cardId === undefined) {
          throw Errors.badRequest('cardId parameter is required');
        }

        const cardRepo = container.resolve<ICardRepository>(ServiceNames.CardRepository);

        const card = await cardRepo.findById(ecosystemId, cardId);
        if (card === null) {
          throw Errors.notFound('Card', cardId);
        }

        const response: CardResponse = {
          card: cardToDetailDTO(card),
        };

        res.json(response);
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * POST /v1/cards/requests
   * Request a new card (plural path per REST conventions)
   */
  router.post(
    '/requests',
    authMiddleware,
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const ecosystemId = req.ecosystemId;
        if (ecosystemId === undefined) {
          throw Errors.unauthorized();
        }

        // Get idempotency key
        const idempotencyKey = req.headers['idempotency-key'] as string | undefined;
        if (idempotencyKey === undefined) {
          throw Errors.badRequest('Idempotency-Key header is required');
        }

        const input = req.body as CardRequestInput;
        if (input.productId === undefined) {
          throw Errors.badRequest('productId is required');
        }

        const userRepo = container.resolve<IUserRepository>(ServiceNames.UserRepository);
        const cardRepo = container.resolve<ICardRepository>(ServiceNames.CardRepository);
        const requestRepo = container.resolve<ICardRequestRepository>(
          ServiceNames.CardRequestRepository
        );
        const idempotencyRepo = container.resolve<IIdempotencyRepository>(
          ServiceNames.IdempotencyRepository
        );
        const outboxRepo = container.resolve<IOutboxRepository>(ServiceNames.OutboxRepository);

        const command = createRequestCardCommand(ecosystemId, idempotencyKey, input.productId);

        const result = await handleRequestCard(command, {
          userRepository: userRepo,
          cardRepository: cardRepo,
          cardRequestRepository: requestRepo,
          idempotencyRepository: idempotencyRepo,
          outboxRepository: outboxRepo,
        });

        const request = await requestRepo.findById(ecosystemId, result.requestId ?? '');
        const scoreAtRequest = request?.scoreAtRequest ?? 0;

        const response: CardRequestResponse = {
          request: {
            requestId: result.requestId ?? 'unknown',
            status: result.status,
            scoreAtRequest,
          },
        };

        if (request?.decision !== undefined) {
          const decision: {
            outcome: 'approved' | 'rejected';
            source: 'auto' | 'admin';
            approvedLimit?: number;
            reason?: string;
          } = {
            outcome: request.decision.outcome,
            source: request.decision.source,
          };
          if (request.decision.approvedLimit !== undefined) {
            decision.approvedLimit = request.decision.approvedLimit;
          }
          if (request.decision.reason !== undefined) {
            decision.reason = request.decision.reason;
          }
          response.request.decision = decision;
        }

        if (request?.resultingCardId !== undefined) {
          const card = await cardRepo.findById(ecosystemId, request.resultingCardId);
          if (card !== null) {
            response.request.card = cardToSummaryDTO(card);
          }
        }

        res.status(result.fromIdempotency === true ? 200 : 201).json(response);
      } catch (error) {
        if (error instanceof RequestCardError) {
          if (error.code === 'VALIDATION_ERROR') {
            next(Errors.badRequest(error.message));
            return;
          }
          if (error.code === 'USER_NOT_FOUND') {
            next(Errors.notFound('User'));
            return;
          }
          if (error.code === 'IDEMPOTENCY_MISMATCH') {
            next(new AppError(ErrorCodes.REQUEST_ALREADY_PROCESSED, error.message, 409));
            return;
          }
          if (error.code === 'NOT_ELIGIBLE') {
            const msg = error.message.toLowerCase();
            if (msg.includes('pending')) {
              next(new AppError(ErrorCodes.CARD_REQUEST_EXISTS, error.message, 409));
              return;
            }
            if (msg.includes('active')) {
              next(new AppError(ErrorCodes.CARD_ALREADY_EXISTS, error.message, 409));
              return;
            }
            next(Errors.badRequest(error.message));
            return;
          }
        }
        next(error);
      }
    }
  );

  /**
   * GET /v1/cards/requests/:requestId
   * Get card request status
   */
  router.get(
    '/requests/:requestId',
    authMiddleware,
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const ecosystemId = req.ecosystemId;
        if (ecosystemId === undefined) {
          throw Errors.unauthorized();
        }

        const requestId = req.params.requestId;
        if (requestId === undefined) {
          throw Errors.badRequest('requestId parameter is required');
        }

        const cardRepo = container.resolve<ICardRepository>(ServiceNames.CardRepository);
        const requestRepo = container.resolve<ICardRequestRepository>(
          ServiceNames.CardRequestRepository
        );

        const request = await requestRepo.findById(ecosystemId, requestId);
        if (request === null) {
          throw Errors.notFound('CardRequest', requestId);
        }

        const response: CardRequestResponse = {
          request: {
            requestId: request.requestId,
            status: request.status,
            scoreAtRequest: request.scoreAtRequest,
          },
        };

        if (request.decision !== undefined) {
          const decision: {
            outcome: 'approved' | 'rejected';
            source: 'auto' | 'admin';
            approvedLimit?: number;
            reason?: string;
          } = {
            outcome: request.decision.outcome,
            source: request.decision.source,
          };
          if (request.decision.approvedLimit !== undefined) {
            decision.approvedLimit = request.decision.approvedLimit;
          }
          if (request.decision.reason !== undefined) {
            decision.reason = request.decision.reason;
          }
          response.request.decision = decision;
        }

        if (request.resultingCardId !== undefined) {
          const card = await cardRepo.findById(ecosystemId, request.resultingCardId);
          if (card !== null) {
            response.request.card = cardToSummaryDTO(card);
          }
        }

        res.json(response);
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * POST /v1/cards/:cardId/cancel
   * Cancel a credit card (soft-delete)
   */
  router.post(
    '/:cardId/cancel',
    authMiddleware,
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const ecosystemId = req.ecosystemId;
        if (ecosystemId === undefined) {
          throw Errors.unauthorized();
        }

        const cardId = req.params.cardId;
        if (cardId === undefined) {
          throw Errors.badRequest('cardId parameter is required');
        }

        // Get idempotency key
        const idempotencyKey = req.headers['idempotency-key'] as string | undefined;
        if (idempotencyKey === undefined) {
          throw Errors.badRequest('Idempotency-Key header is required');
        }

        const cardRepo = container.resolve<ICardRepository>(ServiceNames.CardRepository);
        const idempotencyRepo = container.resolve<IIdempotencyRepository>(
          ServiceNames.IdempotencyRepository
        );
        const auditLogRepo = container.resolve<IAuditLogRepository>(
          ServiceNames.AuditLogRepository
        );
        const outboxRepo = container.resolve<IOutboxRepository>(ServiceNames.OutboxRepository);

        // Generate request ID for audit trail
        const requestId = `cancel-${cardId}-${Date.now()}`;

        const command = createCancelCardCommand(
          ecosystemId,
          cardId,
          idempotencyKey,
          ecosystemId, // Actor is the card owner
          requestId
        );

        const result = await handleCancelCard(command, {
          cardRepository: cardRepo,
          idempotencyRepository: idempotencyRepo,
          auditLogRepository: auditLogRepo,
          outboxRepository: outboxRepo,
        });

        // Get updated card to return full details
        const card = await cardRepo.findById(ecosystemId, cardId);
        if (card === null) {
          throw Errors.notFound('Card', cardId);
        }

        const response: CancelCardResponse = {
          card: cardToDetailDTO(card),
        };

        if (result.alreadyCancelled) {
          response.alreadyCancelled = true;
        }

        res.json(response);
      } catch (error) {
        if (error instanceof CancelCardError) {
          if (error.code === 'NOT_FOUND') {
            next(Errors.notFound('Card', req.params.cardId ?? 'unknown'));
            return;
          }
          if (error.code === 'UNAUTHORIZED') {
            next(Errors.forbidden(error.message));
            return;
          }
          if (error.code === 'ALREADY_CANCELLED') {
            // Return 200 with alreadyCancelled flag (idempotent success)
            const cardRepo = container.resolve<ICardRepository>(ServiceNames.CardRepository);
            const card = await cardRepo.findById(req.ecosystemId ?? '', req.params.cardId ?? '');
            if (card !== null) {
              const response: CancelCardResponse = {
                card: cardToDetailDTO(card),
                alreadyCancelled: true,
              };
              res.json(response);
              return;
            }
          }
          if (error.code === 'INVALID_TRANSITION') {
            next(Errors.badRequest(error.message));
            return;
          }
        }
        next(error);
      }
    }
  );

  return router;
}
