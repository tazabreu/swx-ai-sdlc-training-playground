/**
 * Make Payment Handler
 *
 * Orchestrates payment transaction flow with score impact.
 */

import type { MakePaymentCommand } from '../commands/make-payment.command.js';
import { validateMakePaymentCommand } from '../commands/make-payment.command.js';
import type { IUserRepository } from '../../infrastructure/persistence/interfaces/user.repository.js';
import type { ICardRepository } from '../../infrastructure/persistence/interfaces/card.repository.js';
import type { ITransactionRepository } from '../../infrastructure/persistence/interfaces/transaction.repository.js';
import type { IIdempotencyRepository } from '../../infrastructure/persistence/interfaces/idempotency.repository.js';
import type { IOutboxRepository } from '../../infrastructure/persistence/interfaces/outbox.repository.js';
import {
  createPayment,
  createFailedTransaction,
} from '../../domain/entities/transaction.entity.js';
import {
  createIdempotencyRecord,
  hashIdempotencyKey,
  isExpired,
  checkOperationMismatch,
} from '../../domain/entities/idempotency-record.entity.js';

/**
 * Cached idempotency response shape for make-payment
 */
interface MakePaymentCachedResponse {
  success: boolean;
  transactionId: string;
  newBalance: number;
  newAvailableCredit: number;
  newScore: number;
  scoreImpact: number;
  paymentStatus: 'on_time' | 'late';
  message: string;
}
import {
  validatePayment,
  applyPayment,
  isPaymentOnTime,
  calculateDaysOverdue,
} from '../../domain/services/payment.service.js';
import {
  calculatePaymentScoreImpact,
  applyScoreDelta,
} from '../../domain/services/scoring.service.js';
import { createPaymentEvent, createScoreChangedEvent } from '../../domain/events/event.factory.js';

/**
 * Handler result
 */
export interface MakePaymentResult {
  success: boolean;
  transactionId?: string | undefined;
  newBalance?: number | undefined;
  newAvailableCredit?: number | undefined;
  newScore?: number | undefined;
  scoreImpact?: number | undefined;
  paymentStatus?: 'on_time' | 'late' | undefined;
  message: string;
  fromIdempotency?: boolean | undefined;
}

/**
 * Handler error
 */
export class MakePaymentError extends Error {
  constructor(
    message: string,
    public readonly code:
      | 'VALIDATION_ERROR'
      | 'USER_NOT_FOUND'
      | 'CARD_NOT_FOUND'
      | 'INVALID_AMOUNT'
      | 'IDEMPOTENCY_MISMATCH'
      | 'CONCURRENCY_ERROR'
  ) {
    super(message);
    this.name = 'MakePaymentError';
  }
}

/**
 * Handler dependencies
 */
export interface MakePaymentHandlerDeps {
  userRepository: IUserRepository;
  cardRepository: ICardRepository;
  transactionRepository: ITransactionRepository;
  idempotencyRepository: IIdempotencyRepository;
  outboxRepository: IOutboxRepository;
}

/**
 * Handle make payment command
 */
export async function handleMakePayment(
  command: MakePaymentCommand,
  deps: MakePaymentHandlerDeps
): Promise<MakePaymentResult> {
  // Validate command
  const validation = validateMakePaymentCommand(command);
  if (!validation.valid) {
    throw new MakePaymentError(validation.errors.join(', '), 'VALIDATION_ERROR');
  }

  // Check idempotency
  const keyHash = hashIdempotencyKey(command.idempotencyKey);
  const existingRecord = await deps.idempotencyRepository.find(command.ecosystemId, keyHash);

  if (existingRecord && !isExpired(existingRecord)) {
    // Check for operation mismatch
    if (checkOperationMismatch(existingRecord, 'make-payment')) {
      throw new MakePaymentError(
        'Idempotency key used for different operation',
        'IDEMPOTENCY_MISMATCH'
      );
    }

    // Return cached result
    const cachedResponse = existingRecord.response as MakePaymentCachedResponse;
    return {
      success: cachedResponse.success,
      transactionId: cachedResponse.transactionId,
      newBalance: cachedResponse.newBalance,
      newAvailableCredit: cachedResponse.newAvailableCredit,
      newScore: cachedResponse.newScore,
      scoreImpact: cachedResponse.scoreImpact,
      paymentStatus: cachedResponse.paymentStatus,
      message: cachedResponse.message,
      fromIdempotency: true,
    };
  }

  // Get user
  const user = await deps.userRepository.findById(command.ecosystemId);
  if (!user) {
    throw new MakePaymentError('User not found', 'USER_NOT_FOUND');
  }

  // Get card
  const card = await deps.cardRepository.findById(command.ecosystemId, command.cardId);
  if (!card) {
    throw new MakePaymentError('Card not found', 'CARD_NOT_FOUND');
  }

  // Validate payment
  const paymentValidation = validatePayment(command.amount, card.balance);

  if (!paymentValidation.valid) {
    // Create failed transaction for audit
    const failedTx = createFailedTransaction(
      'payment',
      command.amount,
      command.idempotencyKey,
      paymentValidation.error ?? 'Unknown error'
    );

    await deps.transactionRepository.save(command.ecosystemId, command.cardId, failedTx);

    throw new MakePaymentError(paymentValidation.error ?? 'Invalid payment', 'INVALID_AMOUNT');
  }

  // Determine payment timing
  const paymentDate = command.simulatedPaymentDate ?? new Date();
  const dueDate = card.nextDueDate;
  const onTime = isPaymentOnTime(paymentDate, dueDate);
  const daysOverdue = calculateDaysOverdue(paymentDate, dueDate);

  // Calculate score impact
  const scoreImpactResult = calculatePaymentScoreImpact(
    command.amount,
    card.balance,
    onTime,
    daysOverdue
  );
  const newScore = applyScoreDelta(user.currentScore, scoreImpactResult.delta);

  // Create payment transaction
  const paymentInput = {
    amount: command.amount,
    idempotencyKey: command.idempotencyKey,
    paymentStatus: onTime ? ('on_time' as const) : ('late' as const),
    scoreImpact: scoreImpactResult.delta,
    ...(onTime ? {} : { daysOverdue }),
  };
  const transaction = createPayment(paymentInput);

  // Calculate new balance
  const update = applyPayment(card, command.amount);

  // Save transaction, update card balance, and update score
  await Promise.all([
    deps.transactionRepository.save(command.ecosystemId, command.cardId, transaction),
    deps.cardRepository.updateBalance(command.ecosystemId, command.cardId, {
      balance: update.balance,
      availableCredit: update.availableCredit,
      minimumPayment: update.minimumPayment,
      version: card.version + 1,
    }),
    deps.userRepository.updateScore(
      command.ecosystemId,
      newScore,
      scoreImpactResult.reason,
      'system',
      undefined,
      'transaction',
      transaction.transactionId
    ),
  ]);

  // Update user's card summary
  const allCards = await deps.cardRepository.findByUser(command.ecosystemId);
  const totalBalance = allCards.reduce((sum, c) => {
    if (c.cardId === command.cardId) return sum + update.balance;
    return sum + c.balance;
  }, 0);

  await deps.userRepository.updateCardSummary(command.ecosystemId, {
    activeCards: allCards.filter((c) => c.status === 'active').length,
    totalBalance,
    totalLimit: allCards.reduce((sum, c) => sum + c.limit, 0),
  });

  // Queue events
  await Promise.all([
    deps.outboxRepository.save(
      createPaymentEvent(
        transaction,
        command.cardId,
        command.ecosystemId,
        update.balance,
        update.availableCredit,
        newScore
      )
    ),
    deps.outboxRepository.save(
      createScoreChangedEvent(
        command.ecosystemId,
        user.currentScore,
        newScore,
        scoreImpactResult.reason,
        'system',
        undefined,
        'transaction',
        transaction.transactionId
      )
    ),
  ]);

  const result: MakePaymentResult = {
    success: true,
    transactionId: transaction.transactionId,
    newBalance: update.balance,
    newAvailableCredit: update.availableCredit,
    newScore,
    scoreImpact: scoreImpactResult.delta,
    paymentStatus: onTime ? 'on_time' : 'late',
    message: onTime
      ? `Payment of $${command.amount} processed. Score ${scoreImpactResult.delta >= 0 ? '+' : ''}${scoreImpactResult.delta}`
      : `Late payment of $${command.amount} processed. Score ${scoreImpactResult.delta}`,
  };

  // Save idempotency record
  const cachedResponse: MakePaymentCachedResponse = {
    success: true,
    transactionId: transaction.transactionId,
    newBalance: update.balance,
    newAvailableCredit: update.availableCredit,
    newScore,
    scoreImpact: scoreImpactResult.delta,
    paymentStatus: onTime ? 'on_time' : 'late',
    message: result.message,
  };
  const idempotencyRecord = createIdempotencyRecord({
    key: command.idempotencyKey,
    operation: 'make-payment',
    response: cachedResponse,
    statusCode: 200,
  });
  await deps.idempotencyRepository.save(command.ecosystemId, idempotencyRecord);

  return result;
}
