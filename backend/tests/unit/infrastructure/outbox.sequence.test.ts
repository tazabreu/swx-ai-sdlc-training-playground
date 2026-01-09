import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { InMemoryOutboxRepository } from '../../../src/infrastructure/persistence/inmemory/outbox.repository.js';
import { createEvent } from '../../../src/domain/entities/event.entity.js';

describe('InMemoryOutboxRepository sequencing', () => {
  const originalStrategy = process.env.OUTBOX_SEQUENCE_STRATEGY;

  beforeEach(() => {
    process.env.OUTBOX_SEQUENCE_STRATEGY = originalStrategy;
  });

  afterEach(() => {
    process.env.OUTBOX_SEQUENCE_STRATEGY = originalStrategy;
  });

  it('allocates monotonically increasing sequence numbers when omitted', async () => {
    const repo = new InMemoryOutboxRepository();

    const e1 = createEvent({
      eventType: 'transaction.purchase',
      entityType: 'transaction',
      entityId: 'tx-1',
      ecosystemId: 'eco-1',
      payload: { amount: 1 },
    });

    const e2 = createEvent({
      eventType: 'transaction.purchase',
      entityType: 'transaction',
      entityId: 'tx-1',
      ecosystemId: 'eco-1',
      payload: { amount: 2 },
    });

    await repo.save(e1);
    await repo.save(e2);

    const stored = repo.getAll();
    const s1 = stored.find((e) => e.eventId === e1.eventId);
    const s2 = stored.find((e) => e.eventId === e2.eventId);

    expect(s1?.sequenceNumber).toBe(1);
    expect(s2?.sequenceNumber).toBe(2);
  });

  it('requires caller-provided sequence numbers when configured', async () => {
    process.env.OUTBOX_SEQUENCE_STRATEGY = 'caller';

    const repo = new InMemoryOutboxRepository();
    const e1 = createEvent({
      eventType: 'transaction.purchase',
      entityType: 'transaction',
      entityId: 'tx-1',
      ecosystemId: 'eco-1',
      payload: { amount: 1 },
    });

    let threw = false;
    try {
      await repo.save(e1);
    } catch {
      threw = true;
    }
    expect(threw).toBe(true);
  });
});
