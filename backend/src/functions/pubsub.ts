/**
 * Pub/Sub Firebase Function
 *
 * Pub/Sub trigger for outbox processing.
 * Publishes pending events from the outbox to the message stream.
 */

import { createContainer } from '../infrastructure/di/container-factory.js';
import { ServiceNames } from '../infrastructure/di/container.js';
import type { IOutboxRepository } from '../infrastructure/persistence/interfaces/outbox.repository.js';
import type { IEventPublisher } from '../infrastructure/events/event-publisher.interface.js';

/**
 * Process pending outbox events
 */
export async function processOutbox(): Promise<{ processed: number; failed: number }> {
  const container = createContainer();

  const outboxRepo = container.resolve<IOutboxRepository>(ServiceNames.OutboxRepository);
  const eventPublisher = container.resolve<IEventPublisher>(ServiceNames.EventPublisher);

  let processed = 0;
  let failed = 0;

  try {
    // Get pending events
    const pendingEvents = await outboxRepo.findPending(100);

    for (const event of pendingEvents) {
      try {
        // Publish event
        await eventPublisher.publish(event);

        // Mark as sent
        await outboxRepo.markSent(event.eventId);
        processed++;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error(`Failed to process event ${event.eventId}:`, errorMessage);

        // Mark as failed with retry
        if (event.retryCount < 5) {
          await outboxRepo.markFailed(event.eventId, errorMessage);
        } else {
          // Move to dead letter after max retries
          await outboxRepo.markDeadLettered(event.eventId, errorMessage);
        }
        failed++;
      }
    }

    // Also process events ready for retry
    const retryEvents = await outboxRepo.findReadyForRetry(50);
    for (const event of retryEvents) {
      try {
        await eventPublisher.publish(event);
        await outboxRepo.markSent(event.eventId);
        processed++;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error(`Failed to retry event ${event.eventId}:`, errorMessage);

        if (event.retryCount < 5) {
          await outboxRepo.markFailed(event.eventId, errorMessage);
        } else {
          await outboxRepo.markDeadLettered(event.eventId, errorMessage);
        }
        failed++;
      }
    }
  } catch (error) {
    console.error('Failed to process outbox:', error);
    throw error;
  }

  return { processed, failed };
}

// For direct execution
if (import.meta.main) {
  processOutbox()
    .then((result) => {
      console.log(
        `Outbox processing complete: ${result.processed} processed, ${result.failed} failed`
      );
    })
    .catch((error) => {
      console.error('Outbox processing error:', error);
      process.exit(1);
    });
}
