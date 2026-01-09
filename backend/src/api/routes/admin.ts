/**
 * Admin Routes
 *
 * Administrative operations (requires admin role).
 */

import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import type { Container } from '../../infrastructure/di/container.js';
import { ServiceNames } from '../../infrastructure/di/container.js';
import type { IUserRepository } from '../../infrastructure/persistence/interfaces/user.repository.js';
import type { ICardRepository } from '../../infrastructure/persistence/interfaces/card.repository.js';
import type { ICardRequestRepository } from '../../infrastructure/persistence/interfaces/card-request.repository.js';
import type { IAuditLogRepository } from '../../infrastructure/persistence/interfaces/audit-log.repository.js';
import type { IOutboxRepository } from '../../infrastructure/persistence/interfaces/outbox.repository.js';
import type { IIdempotencyRepository } from '../../infrastructure/persistence/interfaces/idempotency.repository.js';
import type {
  AdminScoreResponse,
  ScoreAdjustmentInput,
  AdminCardRequestsListResponse,
  AdminCardRequestResponse,
  CardApprovalInput,
  CardRejectionInput,
  CleanupInput,
  CleanupResponse,
  ScoreHistoryEntryDTO,
} from '../dto/admin.dto.js';
import type { CardSummaryDTO } from '../dto/cards.dto.js';
import type { CleanupConfirmationRequired } from '../dto/errors.dto.js';
import { AppError, ErrorCodes, Errors } from '../middleware/error-handler.js';
import { createAuthMiddleware } from '../middleware/auth.js';
import { adminMiddleware } from '../middleware/admin.js';
import type { IAuthProvider } from '../../infrastructure/auth/auth-provider.interface.js';
import { v4 as uuidv4 } from 'uuid';
import {
  hashIdempotencyKey,
  createIdempotencyRecord,
} from '../../domain/entities/idempotency-record.entity.js';
import { createAdminGetUserScoreQuery } from '../../application/queries/admin-get-user-score.query.js';
import { createAdminListPendingRequestsQuery } from '../../application/queries/admin-list-pending-requests.query.js';
import {
  handleAdminGetUserScore,
  AdminGetUserScoreError,
} from '../../application/handlers/admin-get-user-score.handler.js';
import { handleAdminListPendingRequests } from '../../application/handlers/admin-list-pending-requests.handler.js';
import { createAdminAdjustScoreCommand } from '../../application/commands/admin-adjust-score.command.js';
import {
  handleAdminAdjustScore,
  AdminAdjustScoreError,
} from '../../application/handlers/admin-adjust-score.handler.js';
import { createAdminApproveCardCommand } from '../../application/commands/admin-approve-card.command.js';
import {
  handleAdminApproveCard,
  AdminApproveCardError,
} from '../../application/handlers/admin-approve-card.handler.js';
import { createAdminRejectCardCommand } from '../../application/commands/admin-reject-card.command.js';
import {
  handleAdminRejectCard,
  AdminRejectCardError,
} from '../../application/handlers/admin-reject-card.handler.js';

// Store cleanup tokens temporarily (in production, use Redis)
const cleanupTokens = new Map<string, { expiresAt: Date; adminId: string }>();

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
 * Create admin router
 */
export function createAdminRouter(container: Container): Router {
  const router = Router();
  const authProvider = container.resolve<IAuthProvider>(ServiceNames.AuthProvider);
  const authMiddleware = createAuthMiddleware(authProvider);

  // Apply auth + admin middleware to all routes
  router.use(authMiddleware, adminMiddleware);

  /**
   * GET /v1/admin/users/:userSlug/score
   * Get user score details
   */
  router.get(
    '/users/:userSlug/score',
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const userSlug = req.params.userSlug;
        if (userSlug === undefined) {
          throw Errors.badRequest('userSlug parameter is required');
        }

        const adminId = req.user?.ecosystemId ?? 'unknown';
        const userRepo = container.resolve<IUserRepository>(ServiceNames.UserRepository);

        const result = await handleAdminGetUserScore(
          createAdminGetUserScoreQuery(adminId, userSlug),
          { userRepository: userRepo }
        );

        const response: AdminScoreResponse = {
          user: {
            ecosystemId: result.ecosystemId,
            email: result.email,
            currentScore: result.currentScore,
            tier: result.tier,
          },
          history: result.scoreHistory.map(
            (h): ScoreHistoryEntryDTO => ({
              value: h.newScore,
              previousValue: h.previousScore,
              delta: h.delta,
              reason: h.reason,
              source: h.source,
              timestamp: h.createdAt.toISOString(),
            })
          ),
        };

        res.json(response);
      } catch (error) {
        if (error instanceof AdminGetUserScoreError) {
          next(Errors.notFound('User'));
          return;
        }
        next(error);
      }
    }
  );

  /**
   * PATCH /v1/admin/users/:userSlug/score
   * Adjust user score
   */
  router.patch(
    '/users/:userSlug/score',
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const userSlug = req.params.userSlug;
        if (userSlug === undefined) {
          throw Errors.badRequest('userSlug parameter is required');
        }
        const adminId = req.user?.ecosystemId ?? 'unknown';
        const adminEmail = req.user?.email ?? 'unknown';

        const input = req.body as ScoreAdjustmentInput;

        // Check for idempotency key
        const idempotencyKey = req.headers['idempotency-key'] as string | undefined;
        if (idempotencyKey === undefined) {
          throw Errors.badRequest('Idempotency-Key header is required');
        }

        const userRepo = container.resolve<IUserRepository>(ServiceNames.UserRepository);
        const auditRepo = container.resolve<IAuditLogRepository>(ServiceNames.AuditLogRepository);
        const outboxRepo = container.resolve<IOutboxRepository>(ServiceNames.OutboxRepository);
        const idempotencyRepo = container.resolve<IIdempotencyRepository>(
          ServiceNames.IdempotencyRepository
        );

        // Check for cached response
        const keyHash = hashIdempotencyKey(idempotencyKey);
        const cached = await idempotencyRepo.find(adminId, keyHash);
        if (cached !== null) {
          res.status(cached.statusCode).json(cached.response);
          return;
        }

        const command = createAdminAdjustScoreCommand(
          adminId,
          adminEmail,
          userSlug,
          input.score,
          input.reason
        );

        await handleAdminAdjustScore(command, {
          userRepository: userRepo,
          outboxRepository: outboxRepo,
          auditLogRepository: auditRepo,
        });

        const result = await handleAdminGetUserScore(
          createAdminGetUserScoreQuery(adminId, userSlug),
          { userRepository: userRepo }
        );

        const response: AdminScoreResponse = {
          user: {
            ecosystemId: result.ecosystemId,
            email: result.email,
            currentScore: result.currentScore,
            tier: result.tier,
          },
          history: result.scoreHistory.map(
            (h): ScoreHistoryEntryDTO => ({
              value: h.newScore,
              previousValue: h.previousScore,
              delta: h.delta,
              reason: h.reason,
              source: h.source,
              timestamp: h.createdAt.toISOString(),
            })
          ),
        };

        // Save idempotency record
        const idempotencyRecord = createIdempotencyRecord({
          key: idempotencyKey,
          operation: 'admin-operation',
          response,
          statusCode: 200,
        });
        await idempotencyRepo.save(adminId, idempotencyRecord);

        res.json(response);
      } catch (error) {
        if (error instanceof AdminAdjustScoreError) {
          if (error.code === 'VALIDATION_ERROR') {
            next(Errors.badRequest(error.message));
            return;
          }
          if (error.code === 'USER_NOT_FOUND') {
            next(Errors.notFound('User'));
            return;
          }
        }
        next(error);
      }
    }
  );

  /**
   * GET /v1/admin/card-requests
   * List pending card requests
   */
  router.get(
    '/card-requests',
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const userRepo = container.resolve<IUserRepository>(ServiceNames.UserRepository);
        const requestRepo = container.resolve<ICardRequestRepository>(
          ServiceNames.CardRequestRepository
        );

        const adminId = req.user?.ecosystemId ?? 'unknown';

        // Parse query parameters
        const sort = (req.query.sort as 'oldest' | 'newest') ?? 'oldest';
        const cursor = req.query.cursor as string | undefined;
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10) || 20));

        const result = await handleAdminListPendingRequests(
          createAdminListPendingRequestsQuery(adminId, {
            sortBy: 'createdAt',
            sortOrder: sort === 'newest' ? 'desc' : 'asc',
            limit,
            ...(cursor !== undefined ? { cursor } : {}),
          }),
          { userRepository: userRepo, cardRequestRepository: requestRepo }
        );

        const requests = result.requests.map((r) => ({
          requestId: r.requestId,
          user: {
            ecosystemId: r.ecosystemId,
            email: r.userEmail,
          },
          scoreAtRequest: r.scoreAtRequest,
          currentScore: r.currentScore,
          tierAtRequest: r.tierAtRequest,
          daysPending: r.daysPending,
          requiresAttention: r.requiresAttention,
          productId: r.productId,
          status: 'pending' as const,
          createdAt: r.createdAt.toISOString(),
        }));

        const response: AdminCardRequestsListResponse = {
          requests,
          pagination: {
            nextCursor: result.nextCursor ?? null,
            hasMore: result.hasMore,
            totalCount: result.totalCount,
          },
        };

        res.json(response);
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * POST /v1/admin/card-requests/:requestId/approve
   * Approve card request
   */
  router.post(
    '/card-requests/:requestId/approve',
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const cardRequestId = req.params.requestId;
        console.log(`[APPROVE] requestId=${cardRequestId}, body=${JSON.stringify(req.body)}, user=${req.user?.ecosystemId}`);
        if (cardRequestId === undefined) {
          throw Errors.badRequest('requestId parameter is required');
        }
        const adminId = req.user?.ecosystemId ?? 'unknown';
        const adminEmail = req.user?.email ?? 'unknown';

        const input = req.body as CardApprovalInput;
        if (
          input.creditLimit === undefined ||
          input.creditLimit < 100 ||
          input.creditLimit > 10000
        ) {
          console.log(`[APPROVE] Invalid creditLimit: ${input.creditLimit}`);
          throw Errors.badRequest('Credit limit must be between 100 and 10000');
        }

        // Check for idempotency key
        const idempotencyKey = req.headers['idempotency-key'] as string | undefined;
        if (idempotencyKey === undefined) {
          throw Errors.badRequest('Idempotency-Key header is required');
        }

        const requestRepo = container.resolve<ICardRequestRepository>(
          ServiceNames.CardRequestRepository
        );
        const userRepo = container.resolve<IUserRepository>(ServiceNames.UserRepository);
        const cardRepo = container.resolve<ICardRepository>(ServiceNames.CardRepository);
        const auditRepo = container.resolve<IAuditLogRepository>(ServiceNames.AuditLogRepository);
        const outboxRepo = container.resolve<IOutboxRepository>(ServiceNames.OutboxRepository);
        const idempotencyRepo = container.resolve<IIdempotencyRepository>(
          ServiceNames.IdempotencyRepository
        );

        // Check for cached response
        const keyHash = hashIdempotencyKey(idempotencyKey);
        const cached = await idempotencyRepo.find(adminId, keyHash);
        if (cached !== null) {
          console.log(`[APPROVE] Returning cached response with status ${cached.statusCode}`);
          res.status(cached.statusCode).json(cached.response);
          return;
        }

        // Find request (repo is sharded by ecosystemId)
        const allRequests = await requestRepo.findAllPending(undefined, { status: 'pending' });
        console.log(`[APPROVE] Found ${allRequests.requests.length} pending requests`);
        const request = allRequests.requests.find((r) => r.requestId === cardRequestId);
        if (request === undefined) {
          console.log(`[APPROVE] Request not found. Available IDs: ${allRequests.requests.map((r) => r.requestId).join(', ')}`);
          throw Errors.notFound('Card request', cardRequestId);
        }
        console.log(`[APPROVE] Found request for ecosystemId=${request.ecosystemId}`);

        const ecosystemId = request.ecosystemId;

        const command = createAdminApproveCardCommand(
          adminId,
          adminEmail,
          ecosystemId,
          cardRequestId,
          input.creditLimit
        );

        const result = await handleAdminApproveCard(command, {
          userRepository: userRepo,
          cardRepository: cardRepo,
          cardRequestRepository: requestRepo,
          outboxRepository: outboxRepo,
          auditLogRepository: auditRepo,
        });

        const updatedRequest = await requestRepo.findById(ecosystemId, cardRequestId);
        const updatedCard = await cardRepo.findById(ecosystemId, result.cardId);
        const user = await userRepo.findById(ecosystemId);

        if (updatedRequest === null || updatedCard === null) {
          throw Errors.internal('Approved request or card not found after processing');
        }

        const daysPending = Math.floor(
          (Date.now() - updatedRequest.createdAt.getTime()) / (1000 * 60 * 60 * 24)
        );

        const response: AdminCardRequestResponse = {
          request: {
            requestId: updatedRequest.requestId,
            user: {
              ecosystemId,
              email: user?.email ?? 'unknown',
            },
            scoreAtRequest: updatedRequest.scoreAtRequest,
            currentScore: user?.currentScore ?? updatedRequest.scoreAtRequest,
            tierAtRequest: updatedRequest.tierAtRequest,
            daysPending,
            requiresAttention: daysPending > 7,
            productId: updatedRequest.productId,
            status: updatedRequest.status,
            createdAt: updatedRequest.createdAt.toISOString(),
          },
          card: cardToSummaryDTO(updatedCard),
        };

        // Save idempotency record
        const idempotencyRecord = createIdempotencyRecord({
          key: idempotencyKey,
          operation: 'admin-operation',
          response,
          statusCode: 200,
        });
        await idempotencyRepo.save(adminId, idempotencyRecord);

        res.json(response);
      } catch (error) {
        console.log(`[APPROVE] Error caught:`, error instanceof Error ? `${error.name}: ${error.message}` : error);
        if (error instanceof AdminApproveCardError) {
          console.log(`[APPROVE] AdminApproveCardError code=${error.code}`);
          if (error.code === 'VALIDATION_ERROR') {
            next(Errors.badRequest(error.message));
            return;
          }
          if (error.code === 'USER_NOT_FOUND') {
            next(Errors.notFound('User'));
            return;
          }
          if (error.code === 'REQUEST_NOT_FOUND') {
            next(Errors.notFound('Card request'));
            return;
          }
          if (error.code === 'REQUEST_NOT_PENDING') {
            next(Errors.conflict(ErrorCodes.REQUEST_ALREADY_PROCESSED, error.message));
            return;
          }
          if (error.code === 'LIMIT_EXCEEDS_POLICY') {
            next(new AppError(ErrorCodes.LIMIT_EXCEEDS_POLICY, error.message, 400));
            return;
          }
        }
        next(error);
      }
    }
  );

  /**
   * POST /v1/admin/card-requests/:requestId/reject
   * Reject card request
   */
  router.post(
    '/card-requests/:requestId/reject',
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const cardRequestId = req.params.requestId;
        if (cardRequestId === undefined) {
          throw Errors.badRequest('requestId parameter is required');
        }
        const adminId = req.user?.ecosystemId ?? 'unknown';
        const adminEmail = req.user?.email ?? 'unknown';

        const input = req.body as CardRejectionInput;
        if (input.reason === undefined) {
          throw Errors.badRequest('reason is required');
        }

        // Check for idempotency key
        const idempotencyKey = req.headers['idempotency-key'] as string | undefined;
        if (idempotencyKey === undefined) {
          throw Errors.badRequest('Idempotency-Key header is required');
        }

        const requestRepo = container.resolve<ICardRequestRepository>(
          ServiceNames.CardRequestRepository
        );
        const userRepo = container.resolve<IUserRepository>(ServiceNames.UserRepository);
        const auditRepo = container.resolve<IAuditLogRepository>(ServiceNames.AuditLogRepository);
        const outboxRepo = container.resolve<IOutboxRepository>(ServiceNames.OutboxRepository);
        const idempotencyRepo = container.resolve<IIdempotencyRepository>(
          ServiceNames.IdempotencyRepository
        );

        // Check for cached response
        const keyHash = hashIdempotencyKey(idempotencyKey);
        const cached = await idempotencyRepo.find(adminId, keyHash);
        if (cached !== null) {
          res.status(cached.statusCode).json(cached.response);
          return;
        }

        // Find request (repo is sharded by ecosystemId)
        const allRequests = await requestRepo.findAllPending(undefined, { status: 'pending' });
        const request = allRequests.requests.find((r) => r.requestId === cardRequestId);
        if (request === undefined) {
          throw Errors.notFound('Card request', cardRequestId);
        }

        const ecosystemId = request.ecosystemId;

        const command = createAdminRejectCardCommand(
          adminId,
          adminEmail,
          ecosystemId,
          cardRequestId,
          input.reason
        );

        await handleAdminRejectCard(command, {
          userRepository: userRepo,
          cardRequestRepository: requestRepo,
          outboxRepository: outboxRepo,
          auditLogRepository: auditRepo,
        });

        const updatedRequest = await requestRepo.findById(ecosystemId, cardRequestId);
        const user = await userRepo.findById(ecosystemId);

        if (updatedRequest === null) {
          throw Errors.internal('Rejected request not found after processing');
        }

        const daysPending = Math.floor(
          (Date.now() - updatedRequest.createdAt.getTime()) / (1000 * 60 * 60 * 24)
        );

        const response: AdminCardRequestResponse = {
          request: {
            requestId: updatedRequest.requestId,
            user: {
              ecosystemId,
              email: user?.email ?? 'unknown',
            },
            scoreAtRequest: updatedRequest.scoreAtRequest,
            currentScore: user?.currentScore ?? updatedRequest.scoreAtRequest,
            tierAtRequest: updatedRequest.tierAtRequest,
            daysPending,
            requiresAttention: daysPending > 7,
            productId: updatedRequest.productId,
            status: updatedRequest.status,
            createdAt: updatedRequest.createdAt.toISOString(),
          },
        };

        // Save idempotency record
        const idempotencyRecord = createIdempotencyRecord({
          key: idempotencyKey,
          operation: 'admin-operation',
          response,
          statusCode: 200,
        });
        await idempotencyRepo.save(adminId, idempotencyRecord);

        res.json(response);
      } catch (error) {
        if (error instanceof AdminRejectCardError) {
          if (error.code === 'VALIDATION_ERROR') {
            next(Errors.badRequest(error.message));
            return;
          }
          if (error.code === 'USER_NOT_FOUND') {
            next(Errors.notFound('User'));
            return;
          }
          if (error.code === 'REQUEST_NOT_FOUND') {
            next(Errors.notFound('Card request'));
            return;
          }
          if (error.code === 'REQUEST_NOT_PENDING') {
            next(Errors.conflict(ErrorCodes.REQUEST_ALREADY_PROCESSED, error.message));
            return;
          }
        }
        next(error);
      }
    }
  );

  /**
   * POST /v1/admin/cleanup
   * Reset system data
   */
  router.post(
    '/cleanup',
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const adminId = req.user?.ecosystemId ?? 'unknown';
        const input = (req.body ?? {}) as CleanupInput;

        // Check for confirmation token
        if (input.confirmationToken === undefined) {
          // Generate new token
          const token = uuidv4();
          cleanupTokens.set(token, {
            expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes
            adminId,
          });

          const response: CleanupConfirmationRequired = {
            message: 'Confirmation required. Include the token in your next request.',
            confirmationToken: token,
            expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
          };

          res.status(400).json(response);
          return;
        }

        // Validate token
        const tokenData = cleanupTokens.get(input.confirmationToken);
        if (tokenData === undefined) {
          throw Errors.badRequest('Invalid confirmation token');
        }
        if (tokenData.expiresAt < new Date()) {
          cleanupTokens.delete(input.confirmationToken);
          throw Errors.badRequest('Confirmation token has expired');
        }
        if (tokenData.adminId !== adminId) {
          throw Errors.badRequest('Confirmation token was issued to a different admin');
        }

        // Remove used token
        cleanupTokens.delete(input.confirmationToken);

        const startTime = Date.now();

        const userRepo = container.resolve<IUserRepository>(ServiceNames.UserRepository);
        const outboxRepo = container.resolve<IOutboxRepository>(ServiceNames.OutboxRepository);

        // Delete all users (cascades to cards, requests, transactions)
        const usersDeleted = await userRepo.deleteAll();

        // Clear outbox
        const eventsDeleted = await outboxRepo.clear();

        const duration = `${((Date.now() - startTime) / 1000).toFixed(1)}s`;

        const response: CleanupResponse = {
          status: 'completed',
          deletedCounts: {
            users: usersDeleted,
            cards: 0, // Cascaded
            transactions: 0, // Cascaded
            cardRequests: 0, // Cascaded
            events: eventsDeleted,
          },
          duration,
        };

        res.json(response);
      } catch (error) {
        next(error);
      }
    }
  );

  return router;
}
