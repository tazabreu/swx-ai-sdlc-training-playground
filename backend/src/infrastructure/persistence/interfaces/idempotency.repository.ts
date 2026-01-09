/**
 * Idempotency Repository Interface
 *
 * Contract for idempotency key data access operations.
 */

import type { IdempotencyRecord } from '../../../domain/entities/idempotency-record.entity.js';

/**
 * Idempotency repository interface
 */
export interface IIdempotencyRepository {
  /**
   * Find idempotency record by key hash
   */
  find(ecosystemId: string, keyHash: string): Promise<IdempotencyRecord | null>;

  /**
   * Save idempotency record
   */
  save(ecosystemId: string, record: IdempotencyRecord): Promise<void>;

  /**
   * Delete expired records
   * @returns Number of deleted records
   */
  deleteExpired(): Promise<number>;

  /**
   * Delete all records for user
   */
  deleteAllForUser(ecosystemId: string): Promise<number>;
}
