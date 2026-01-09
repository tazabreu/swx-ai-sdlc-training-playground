/**
 * InMemory Idempotency Repository
 *
 * In-memory implementation for idempotency key storage.
 */

/* eslint-disable @typescript-eslint/require-await */

import type { IIdempotencyRepository } from '../interfaces/idempotency.repository.js';
import type { IdempotencyRecord } from '../../../domain/entities/idempotency-record.entity.js';

/**
 * InMemory Idempotency Repository implementation
 */
export class InMemoryIdempotencyRepository implements IIdempotencyRepository {
  // Map<ecosystemId, Map<keyHash, IdempotencyRecord>>
  private records: Map<string, Map<string, IdempotencyRecord>> = new Map();

  async find(ecosystemId: string, keyHash: string): Promise<IdempotencyRecord | null> {
    const userRecords = this.records.get(ecosystemId);
    if (userRecords === undefined) return null;

    const record = userRecords.get(keyHash);
    if (record === undefined) return null;

    // Check if expired
    if (record.expiresAt.getTime() < Date.now()) {
      userRecords.delete(keyHash);
      return null;
    }

    return record;
  }

  async save(ecosystemId: string, record: IdempotencyRecord): Promise<void> {
    let userRecords = this.records.get(ecosystemId);
    if (userRecords === undefined) {
      userRecords = new Map();
      this.records.set(ecosystemId, userRecords);
    }
    userRecords.set(record.keyHash, { ...record });
  }

  async deleteExpired(): Promise<number> {
    const now = Date.now();
    let count = 0;

    for (const userRecords of this.records.values()) {
      for (const [keyHash, record] of userRecords.entries()) {
        if (record.expiresAt.getTime() < now) {
          userRecords.delete(keyHash);
          count++;
        }
      }
    }

    return count;
  }

  async deleteAllForUser(ecosystemId: string): Promise<number> {
    const userRecords = this.records.get(ecosystemId);
    if (userRecords === undefined) return 0;
    const count = userRecords.size;
    this.records.delete(ecosystemId);
    return count;
  }

  // Test helper methods
  clear(): void {
    this.records.clear();
  }

  getAll(): IdempotencyRecord[] {
    const allRecords: IdempotencyRecord[] = [];
    for (const userRecords of this.records.values()) {
      allRecords.push(...userRecords.values());
    }
    return allRecords;
  }
}
