/**
 * IdempotencyRecord Entity
 *
 * Cached responses for idempotent operations.
 *
 * Firestore Path: users/{ecosystemId}/idempotencyKeys/{keyHash}
 */

import { createHash } from 'crypto';

/**
 * IdempotencyRecord entity
 */
export interface IdempotencyRecord {
  keyHash: string; // SHA-256 hash of idempotency key

  // Operation Context
  operation: string; // 'request-card', 'make-payment', etc.

  // Cached Response
  response: unknown; // Stored response to return
  statusCode: number; // HTTP status code

  // TTL
  expiresAt: Date; // 24 hours from creation
  createdAt: Date;
}

/**
 * Input for creating an idempotency record
 */
export interface CreateIdempotencyRecordInput {
  key: string; // Original idempotency key
  operation: string;
  response: unknown;
  statusCode: number;
}

/**
 * Hash an idempotency key using SHA-256
 */
export function hashIdempotencyKey(key: string): string {
  return createHash('sha256').update(key).digest('hex');
}

/**
 * Create a new idempotency record
 */
export function createIdempotencyRecord(input: CreateIdempotencyRecordInput): IdempotencyRecord {
  const now = new Date();

  // Calculate expiration (24 hours from now)
  const expiresAt = new Date(now);
  expiresAt.setHours(expiresAt.getHours() + 24);

  return {
    keyHash: hashIdempotencyKey(input.key),
    operation: input.operation,
    response: input.response,
    statusCode: input.statusCode,
    expiresAt,
    createdAt: now,
  };
}

/**
 * Type guard to check if value is an IdempotencyRecord
 */
export function isIdempotencyRecord(value: unknown): value is IdempotencyRecord {
  if (typeof value !== 'object' || value === null) return false;

  const record = value as Record<string, unknown>;

  return (
    typeof record.keyHash === 'string' &&
    typeof record.operation === 'string' &&
    typeof record.statusCode === 'number' &&
    record.expiresAt instanceof Date &&
    record.createdAt instanceof Date
  );
}

/**
 * Check if idempotency record is expired
 */
export function isExpired(record: IdempotencyRecord): boolean {
  return new Date() > record.expiresAt;
}

/**
 * Validate idempotency record data
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateIdempotencyRecord(record: IdempotencyRecord): ValidationResult {
  const errors: string[] = [];

  // Validate keyHash (SHA-256 produces 64 hex characters)
  if (record.keyHash.length !== 64) {
    errors.push('keyHash must be a valid SHA-256 hash (64 characters)');
  }

  // Validate operation
  if (record.operation.length === 0) {
    errors.push('operation is required');
  }

  // Validate statusCode
  if (record.statusCode < 100 || record.statusCode > 599) {
    errors.push('statusCode must be a valid HTTP status code');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validate idempotency key operation mismatch
 */
export function checkOperationMismatch(
  record: IdempotencyRecord,
  expectedOperation: string
): boolean {
  return record.operation !== expectedOperation;
}

/**
 * Idempotency rules per spec
 */
export const IDEMPOTENCY_RULES = {
  TTL_HOURS: 24,
  KEY_MAX_LENGTH: 64,
} as const;
