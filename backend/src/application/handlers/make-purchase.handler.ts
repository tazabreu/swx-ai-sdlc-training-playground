/**
 * Make Purchase Handler
 *
 * Orchestrates purchase transaction flow.
 */

import type { MakePurchaseCommand } from '../commands/make-purchase.command.js';
import { validateMakePurchaseCommand } from '../commands/make-purchase.command.js';
import type { IUserRepository } from '../../infrastructure/persistence/interfaces/user.repository.js';
import type { ICardRepository } from '../../infrastructure/persistence/interfaces/card.repository.js';
import type { ITransactionRepository } from '../../infrastructure/persistence/interfaces/transaction.repository.js';
import type { IIdempotencyRepository } from '../../infrastructure/persistence/interfaces/idempotency.repository.js';
import type { IOutboxRepository } from '../../infrastructure/persistence/interfaces/outbox.repository.js';
import {
  createPurchase,
  createFailedTransaction,
} from '../../domain/entities/transaction.entity.js';
import {
  createIdempotencyRecord,
  hashIdempotencyKey,
  isExpired,
  checkOperationMismatch,
} from '../../domain/entities/idempotency-record.entity.js';

/**
 * Cached idempotency response shape for make-purchase
 */
interface MakePurchaseCachedResponse {
  success: boolean;
  transactionId: string;
  newBalance: number;
  newAvailableCredit: number;
  message: string;
}
import {
  validatePurchase,
  applyPurchase,
  calculateMinimumPayment,
} from '../../domain/services/payment.service.js';
import { createPurchaseEvent } from '../../domain/events/event.factory.js';

/**
 * Handler result
 */
export interface MakePurchaseResult {
  success: boolean;
  transactionId?: string | undefined;
  newBalance?: number | undefined;
  newAvailableCredit?: number | undefined;
  message: string;
  fromIdempotency?: boolean | undefined;
}

/**
 * Handler error
 */
export class MakePurchaseError extends Error {
  constructor(
    message: string,
    public readonly code:
      | 'VALIDATION_ERROR'
      | 'USER_NOT_FOUND'
      | 'CARD_NOT_FOUND'
      | 'INSUFFICIENT_CREDIT'
      | 'CARD_NOT_ACTIVE'
      | 'IDEMPOTENCY_MISMATCH'
      | 'CONCURRENCY_ERROR'
  ) {
    super(message);
    this.name = 'MakePurchaseError';
  }
}

/**
 * Handler dependencies
 */
export interface MakePurchaseHandlerDeps {
  userRepository: IUserRepository;
  cardRepository: ICardRepository;
  transactionRepository: ITransactionRepository;
  idempotencyRepository: IIdempotencyRepository;
  outboxRepository: IOutboxRepository;
}

/**
 * Handle make purchase command
 */
export async function handleMakePurchase(
  command: MakePurchaseCommand,
  deps: MakePurchaseHandlerDeps
): Promise<MakePurchaseResult> {
  // Validate command
  const validation = validateMakePurchaseCommand(command);
  if (!validation.valid) {
    throw new MakePurchaseError(validation.errors.join(', '), 'VALIDATION_ERROR');
  }

  // Check idempotency
  const keyHash = hashIdempotencyKey(command.idempotencyKey);
  const existingRecord = await deps.idempotencyRepository.find(command.ecosystemId, keyHash);

  if (existingRecord && !isExpired(existingRecord)) {
    // Check for operation mismatch
    if (checkOperationMismatch(existingRecord, 'make-purchase')) {
      throw new MakePurchaseError(
        'Idempotency key used for different operation',
        'IDEMPOTENCY_MISMATCH'
      );
    }

    // Return cached result
    const cachedResponse = existingRecord.response as MakePurchaseCachedResponse;
    return {
      success: cachedResponse.success,
      transactionId: cachedResponse.transactionId,
      newBalance: cachedResponse.newBalance,
      newAvailableCredit: cachedResponse.newAvailableCredit,
      message: cachedResponse.message,
      fromIdempotency: true,
    };
  }

  // Get user
  const user = await deps.userRepository.findById(command.ecosystemId);
  if (!user) {
    throw new MakePurchaseError('User not found', 'USER_NOT_FOUND');
  }

  // Get card
  const card = await deps.cardRepository.findById(command.ecosystemId, command.cardId);
  if (!card) {
    throw new MakePurchaseError('Card not found', 'CARD_NOT_FOUND');
  }

  // Validate purchase
  const purchaseValidation = validatePurchase(command.amount, card.availableCredit, card.status);

  if (!purchaseValidation.valid) {
    // Create failed transaction for audit
    const failedTx = createFailedTransaction(
      'purchase',
      command.amount,
      command.idempotencyKey,
      purchaseValidation.error ?? 'Unknown error'
    );

    await deps.transactionRepository.save(command.ecosystemId, command.cardId, failedTx);

    if (card.status !== 'active') {
      throw new MakePurchaseError(purchaseValidation.error ?? 'Card not active', 'CARD_NOT_ACTIVE');
    }
    throw new MakePurchaseError(
      purchaseValidation.error ?? 'Insufficient credit',
      'INSUFFICIENT_CREDIT'
    );
  }

  // Create purchase transaction
  const transaction = createPurchase({
    amount: command.amount,
    idempotencyKey: command.idempotencyKey,
    merchant: command.merchant,
  });

  // Calculate new balance
  const update = applyPurchase(card, command.amount);

  // Save transaction and update card balance
  const newMinimumPayment = calculateMinimumPayment(update.balance);
  await Promise.all([
    deps.transactionRepository.save(command.ecosystemId, command.cardId, transaction),
    deps.cardRepository.updateBalance(command.ecosystemId, command.cardId, {
      balance: update.balance,
      availableCredit: update.availableCredit,
      minimumPayment: newMinimumPayment,
      version: card.version + 1,
    }),
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

  // Queue event
  await deps.outboxRepository.save(
    createPurchaseEvent(
      transaction,
      command.cardId,
      command.ecosystemId,
      update.balance,
      update.availableCredit
    )
  );

  const result: MakePurchaseResult = {
    success: true,
    transactionId: transaction.transactionId,
    newBalance: update.balance,
    newAvailableCredit: update.availableCredit,
    message: `Purchase of $${command.amount} processed successfully`,
  };

  // Save idempotency record
  const cachedResponse: MakePurchaseCachedResponse = {
    success: true,
    transactionId: transaction.transactionId,
    newBalance: update.balance,
    newAvailableCredit: update.availableCredit,
    message: result.message,
  };
  const idempotencyRecord = createIdempotencyRecord({
    key: command.idempotencyKey,
    operation: 'make-purchase',
    response: cachedResponse,
    statusCode: 200,
  });
  await deps.idempotencyRepository.save(command.ecosystemId, idempotencyRecord);

  return result;
}
