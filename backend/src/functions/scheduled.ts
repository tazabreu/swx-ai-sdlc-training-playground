/**
 * Scheduled Firebase Functions
 *
 * Scheduled functions for periodic tasks.
 */

import { createContainer } from '../infrastructure/di/container-factory.js';
import { ServiceNames } from '../infrastructure/di/container.js';
import type { IIdempotencyRepository } from '../infrastructure/persistence/interfaces/idempotency.repository.js';
import { processOutbox } from './pubsub.js';

/**
 * Process outbox every minute
 * Publishes pending events to the message stream
 */
export async function outboxProcessor(): Promise<void> {
  console.log('Starting outbox processor...');
  const startTime = Date.now();

  try {
    const result = await processOutbox();
    const duration = Date.now() - startTime;

    console.log(
      `Outbox processor complete in ${duration}ms: ${result.processed} processed, ${result.failed} failed`
    );
  } catch (error) {
    console.error('Outbox processor failed:', error);
    throw error;
  }
}

/**
 * Cleanup expired idempotency keys daily
 * Removes keys older than 24 hours
 */
export async function idempotencyCleanup(): Promise<{ deleted: number }> {
  console.log('Starting idempotency cleanup...');
  const startTime = Date.now();

  const container = createContainer();
  const idempotencyRepo = container.resolve<IIdempotencyRepository>(
    ServiceNames.IdempotencyRepository
  );

  try {
    const deleted = await idempotencyRepo.deleteExpired();
    const duration = Date.now() - startTime;

    console.log(`Idempotency cleanup complete in ${duration}ms: ${deleted} keys deleted`);

    return { deleted };
  } catch (error) {
    console.error('Idempotency cleanup failed:', error);
    throw error;
  }
}

// For direct execution
if (import.meta.main) {
  const command = process.argv[2];

  switch (command) {
    case 'outbox':
      outboxProcessor()
        .then(() => process.exit(0))
        .catch(() => process.exit(1));
      break;

    case 'idempotency':
      idempotencyCleanup()
        .then(() => process.exit(0))
        .catch(() => process.exit(1));
      break;

    default:
      console.log('Usage: bun src/functions/scheduled.ts [outbox|idempotency]');
      process.exit(1);
  }
}
