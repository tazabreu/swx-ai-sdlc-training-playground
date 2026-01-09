/**
 * Firestore Idempotency Repository
 *
 * Firestore implementation for idempotency key storage.
 */

import type { Firestore } from 'firebase-admin/firestore';
import type { IIdempotencyRepository } from '../interfaces/idempotency.repository.js';
import type { IdempotencyRecord } from '../../../domain/entities/idempotency-record.entity.js';
import { CollectionPaths } from './client.js';
import { requireDate, stripUndefined } from './codec.js';

/**
 * Firestore Idempotency Repository implementation
 */
export class FirestoreIdempotencyRepository implements IIdempotencyRepository {
  constructor(private readonly db: Firestore) {}

  async find(ecosystemId: string, keyHash: string): Promise<IdempotencyRecord | null> {
    const doc = await this.db
      .collection(CollectionPaths.IDEMPOTENCY_KEYS(ecosystemId))
      .doc(keyHash)
      .get();

    if (!doc.exists) {
      return null;
    }

    const record = this.mapDocToRecord(doc.id, doc.data()!);

    // Check if expired
    if (record.expiresAt.getTime() < Date.now()) {
      // Clean up expired record
      await this.db.collection(CollectionPaths.IDEMPOTENCY_KEYS(ecosystemId)).doc(keyHash).delete();
      return null;
    }

    return record;
  }

  async save(ecosystemId: string, record: IdempotencyRecord): Promise<void> {
    await this.db
      .collection(CollectionPaths.IDEMPOTENCY_KEYS(ecosystemId))
      .doc(record.keyHash)
      .set(this.mapRecordToDoc(record));
  }

  async deleteExpired(): Promise<number> {
    const now = new Date();
    let totalDeleted = 0;

    // Query across all users' idempotency keys (collection group query)
    const snapshot = await this.db
      .collectionGroup('idempotencyKeys')
      .where('expiresAt', '<', now)
      .get();

    // Delete in batches of 500 (Firestore limit)
    const batchSize = 500;
    const docs = snapshot.docs;

    for (let i = 0; i < docs.length; i += batchSize) {
      const batch = this.db.batch();
      const batchDocs = docs.slice(i, i + batchSize);

      batchDocs.forEach((doc) => batch.delete(doc.ref));
      await batch.commit();

      totalDeleted += batchDocs.length;
    }

    return totalDeleted;
  }

  async deleteAllForUser(ecosystemId: string): Promise<number> {
    const snapshot = await this.db.collection(CollectionPaths.IDEMPOTENCY_KEYS(ecosystemId)).get();

    const count = snapshot.size;

    const batch = this.db.batch();
    snapshot.docs.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();

    return count;
  }

  /**
   * Map Firestore document to IdempotencyRecord entity
   */
  private mapDocToRecord(keyHash: string, data: Record<string, unknown>): IdempotencyRecord {
    return {
      keyHash,
      operation: data.operation as string,
      response: data.response,
      statusCode: data.statusCode as number,
      createdAt: requireDate(data.createdAt, 'createdAt'),
      expiresAt: requireDate(data.expiresAt, 'expiresAt'),
    };
  }

  /**
   * Map IdempotencyRecord entity to Firestore document
   */
  private mapRecordToDoc(record: IdempotencyRecord): Record<string, unknown> {
    return {
      operation: record.operation,
      response: stripUndefined(record.response),
      statusCode: record.statusCode,
      createdAt: record.createdAt,
      expiresAt: record.expiresAt,
    };
  }
}
