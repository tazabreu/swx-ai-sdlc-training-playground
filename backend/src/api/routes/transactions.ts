/**
 * Transactions Routes
 *
 * Purchase and payment endpoints.
 */

import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import type { Container } from '../../infrastructure/di/container.js';
import { ServiceNames } from '../../infrastructure/di/container.js';
import type { IUserRepository } from '../../infrastructure/persistence/interfaces/user.repository.js';
import type { ICardRepository } from '../../infrastructure/persistence/interfaces/card.repository.js';
import type { ITransactionRepository } from '../../infrastructure/persistence/interfaces/transaction.repository.js';
import type { IIdempotencyRepository } from '../../infrastructure/persistence/interfaces/idempotency.repository.js';
import type { IOutboxRepository } from '../../infrastructure/persistence/interfaces/outbox.repository.js';
import type {
  PurchaseInput,
  PaymentInput,
  TransactionResponse,
  PaymentResponse,
  TransactionsListResponse,
  TransactionDTO,
} from '../dto/transactions.dto.js';
import type { CardSummaryDTO } from '../dto/cards.dto.js';
import { ErrorCodes, Errors } from '../middleware/error-handler.js';
import { createAuthMiddleware } from '../middleware/auth.js';
import type { IAuthProvider } from '../../infrastructure/auth/auth-provider.interface.js';
import type { Transaction } from '../../domain/entities/transaction.entity.js';
import { createMakePurchaseCommand } from '../../application/commands/make-purchase.command.js';
import { createMakePaymentCommand } from '../../application/commands/make-payment.command.js';
import {
  handleMakePurchase,
  MakePurchaseError,
} from '../../application/handlers/make-purchase.handler.js';
import {
  handleMakePayment,
  MakePaymentError,
} from '../../application/handlers/make-payment.handler.js';
import { ConcurrencyError } from '../../infrastructure/persistence/interfaces/card.repository.js';

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
 * Map transaction to DTO
 */
function transactionToDTO(tx: Transaction): TransactionDTO {
  const result: TransactionDTO = {
    transactionId: tx.transactionId,
    type: tx.type,
    amount: tx.amount,
    status: tx.status,
    timestamp: tx.timestamp.toISOString(),
  };
  if (tx.type === 'purchase' && tx.merchant !== undefined) {
    result.merchant = tx.merchant;
  }
  if (tx.type === 'payment' && tx.paymentStatus !== undefined) {
    result.paymentStatus = tx.paymentStatus;
  }
  if (tx.scoreImpact !== undefined) {
    result.scoreImpact = tx.scoreImpact;
  }
  return result;
}

/**
 * Create transactions router
 */
export function createTransactionsRouter(container: Container): Router {
  const router = Router({ mergeParams: true });
  const authProvider = container.resolve<IAuthProvider>(ServiceNames.AuthProvider);
  const authMiddleware = createAuthMiddleware(authProvider);

  /**
   * POST /v1/cards/:cardId/purchases
   * Simulate a purchase
   */
  router.post(
    '/purchases',
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

        const input = req.body as PurchaseInput;
        if (input.amount === undefined || input.amount <= 0) {
          throw Errors.badRequest('amount must be a positive number');
        }

        const userRepo = container.resolve<IUserRepository>(ServiceNames.UserRepository);
        const cardRepo = container.resolve<ICardRepository>(ServiceNames.CardRepository);
        const txRepo = container.resolve<ITransactionRepository>(
          ServiceNames.TransactionRepository
        );
        const idempotencyRepo = container.resolve<IIdempotencyRepository>(
          ServiceNames.IdempotencyRepository
        );
        const outboxRepo = container.resolve<IOutboxRepository>(ServiceNames.OutboxRepository);

        const command = createMakePurchaseCommand(
          ecosystemId,
          cardId,
          input.amount,
          input.merchant ?? 'Unknown Merchant',
          idempotencyKey
        );

        const result = await handleMakePurchase(command, {
          userRepository: userRepo,
          cardRepository: cardRepo,
          transactionRepository: txRepo,
          idempotencyRepository: idempotencyRepo,
          outboxRepository: outboxRepo,
        });

        const txResult = await txRepo.findByCard(ecosystemId, cardId, undefined, { limit: 50 });
        const transaction = txResult.transactions.find(
          (t) => t.transactionId === result.transactionId
        );
        if (transaction === undefined) {
          throw Errors.internal('Transaction not found after creation');
        }

        const updatedCard = await cardRepo.findById(ecosystemId, cardId);
        if (updatedCard === null) {
          throw Errors.notFound('Card', cardId);
        }

        const response: TransactionResponse = {
          transaction: transactionToDTO(transaction),
          card: cardToSummaryDTO(updatedCard),
        };

        res.status(result.fromIdempotency === true ? 200 : 201).json(response);
      } catch (error) {
        if (error instanceof MakePurchaseError) {
          if (error.code === 'VALIDATION_ERROR') {
            next(Errors.badRequest(error.message));
            return;
          }
          if (error.code === 'USER_NOT_FOUND') {
            next(Errors.notFound('User'));
            return;
          }
          if (error.code === 'CARD_NOT_FOUND') {
            next(Errors.notFound('Card'));
            return;
          }
          if (error.code === 'INSUFFICIENT_CREDIT') {
            next(Errors.insufficientCredit(0, 0));
            return;
          }
          if (error.code === 'CARD_NOT_ACTIVE') {
            next(Errors.badRequest(error.message));
            return;
          }
          if (error.code === 'IDEMPOTENCY_MISMATCH') {
            next(Errors.conflict(ErrorCodes.REQUEST_ALREADY_PROCESSED, error.message));
            return;
          }
          if (error.code === 'CONCURRENCY_ERROR') {
            next(Errors.conflict(ErrorCodes.VERSION_CONFLICT, error.message));
            return;
          }
        }
        if (error instanceof ConcurrencyError) {
          next(
            Errors.conflict(ErrorCodes.VERSION_CONFLICT, error.message, {
              cardId: error.cardId,
              expectedVersion: error.expectedVersion,
              actualVersion: error.actualVersion,
            })
          );
          return;
        }

        next(error);
      }
    }
  );

  /**
   * POST /v1/cards/:cardId/payments
   * Make a payment
   */
  router.post(
    '/payments',
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

        const input = req.body as PaymentInput;
        if (input.amount === undefined || input.amount <= 0) {
          throw Errors.badRequest('amount must be a positive number');
        }

        const userRepo = container.resolve<IUserRepository>(ServiceNames.UserRepository);
        const cardRepo = container.resolve<ICardRepository>(ServiceNames.CardRepository);
        const txRepo = container.resolve<ITransactionRepository>(
          ServiceNames.TransactionRepository
        );
        const idempotencyRepo = container.resolve<IIdempotencyRepository>(
          ServiceNames.IdempotencyRepository
        );
        const outboxRepo = container.resolve<IOutboxRepository>(ServiceNames.OutboxRepository);

        const userBefore = await userRepo.findById(ecosystemId);
        if (userBefore === null) {
          throw Errors.notFound('User', ecosystemId);
        }

        const command = createMakePaymentCommand(ecosystemId, cardId, input.amount, idempotencyKey);

        const result = await handleMakePayment(command, {
          userRepository: userRepo,
          cardRepository: cardRepo,
          transactionRepository: txRepo,
          idempotencyRepository: idempotencyRepo,
          outboxRepository: outboxRepo,
        });

        const txResult = await txRepo.findByCard(ecosystemId, cardId, undefined, { limit: 50 });
        const transaction = txResult.transactions.find(
          (t) => t.transactionId === result.transactionId
        );
        if (transaction === undefined) {
          throw Errors.internal('Transaction not found after creation');
        }

        const updatedCard = await cardRepo.findById(ecosystemId, cardId);
        if (updatedCard === null) {
          throw Errors.notFound('Card', cardId);
        }

        const response: PaymentResponse = {
          transaction: transactionToDTO(transaction),
          card: cardToSummaryDTO(updatedCard),
          scoreImpact: {
            previousScore: userBefore.currentScore,
            newScore: result.newScore ?? userBefore.currentScore,
            delta: result.scoreImpact ?? 0,
            reason: result.paymentStatus === 'late' ? 'late' : 'on_time',
          },
        };

        res.status(result.fromIdempotency === true ? 200 : 201).json(response);
      } catch (error) {
        if (error instanceof MakePaymentError) {
          if (error.code === 'VALIDATION_ERROR') {
            next(Errors.badRequest(error.message));
            return;
          }
          if (error.code === 'USER_NOT_FOUND') {
            next(Errors.notFound('User'));
            return;
          }
          if (error.code === 'CARD_NOT_FOUND') {
            next(Errors.notFound('Card'));
            return;
          }
          if (error.code === 'INVALID_AMOUNT') {
            next(Errors.badRequest(error.message));
            return;
          }
          if (error.code === 'IDEMPOTENCY_MISMATCH') {
            next(Errors.conflict(ErrorCodes.REQUEST_ALREADY_PROCESSED, error.message));
            return;
          }
          if (error.code === 'CONCURRENCY_ERROR') {
            next(Errors.conflict(ErrorCodes.VERSION_CONFLICT, error.message));
            return;
          }
        }
        if (error instanceof ConcurrencyError) {
          next(
            Errors.conflict(ErrorCodes.VERSION_CONFLICT, error.message, {
              cardId: error.cardId,
              expectedVersion: error.expectedVersion,
              actualVersion: error.actualVersion,
            })
          );
          return;
        }

        next(error);
      }
    }
  );

  /**
   * GET /v1/cards/:cardId/transactions
   * List card transactions
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

        const cardId = req.params.cardId;
        if (cardId === undefined) {
          throw Errors.badRequest('cardId parameter is required');
        }

        const cardRepo = container.resolve<ICardRepository>(ServiceNames.CardRepository);
        const txRepo = container.resolve<ITransactionRepository>(
          ServiceNames.TransactionRepository
        );

        // Verify card exists and belongs to user
        const card = await cardRepo.findById(ecosystemId, cardId);
        if (card === null) {
          throw Errors.notFound('Card', cardId);
        }

        // Parse query parameters
        const type = req.query.type as 'purchase' | 'payment' | undefined;
        const cursor = req.query.cursor as string | undefined;
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10) || 20));

        const result = await txRepo.findByCard(
          ecosystemId,
          cardId,
          type !== undefined ? { type } : undefined,
          { cursor, limit }
        );

        const response: TransactionsListResponse = {
          transactions: result.transactions.map(transactionToDTO),
          pagination: {
            nextCursor: result.nextCursor ?? null,
            hasMore: result.hasMore,
          },
        };

        res.json(response);
      } catch (error) {
        next(error);
      }
    }
  );

  return router;
}
