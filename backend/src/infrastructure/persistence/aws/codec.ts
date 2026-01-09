/**
 * DynamoDB Codec Utilities
 *
 * Date serialization (ISO 8601) and type conversion utilities for DynamoDB.
 */

/**
 * Convert a Date to ISO 8601 string for DynamoDB storage
 */
export function toISOString(date: Date): string {
  return date.toISOString();
}

/**
 * Convert an ISO 8601 string from DynamoDB to a Date object
 */
export function fromISOString(isoString: string): Date {
  return new Date(isoString);
}

/**
 * Require a date field, throwing if missing or invalid
 */
export function requireDate(value: unknown, fieldName: string): Date {
  if (value === null || value === undefined) {
    throw new Error(`Required date field "${fieldName}" is missing`);
  }

  if (value instanceof Date) {
    return value;
  }

  if (typeof value === 'string') {
    const date = new Date(value);
    if (isNaN(date.getTime())) {
      throw new Error(`Invalid date value for field "${fieldName}": ${value}`);
    }
    return date;
  }

  throw new Error(`Unexpected type for date field "${fieldName}": ${typeof value}`);
}

/**
 * Optional date field - returns undefined if missing
 */
export function optionalDate(value: unknown): Date | undefined {
  if (value === null || value === undefined) {
    return undefined;
  }

  if (value instanceof Date) {
    return value;
  }

  if (typeof value === 'string') {
    const date = new Date(value);
    if (isNaN(date.getTime())) {
      return undefined;
    }
    return date;
  }

  return undefined;
}

/**
 * Strip undefined values from an object recursively.
 * DynamoDB DocumentClient can't handle undefined values.
 */
export function stripUndefined<T>(obj: T): T {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item: unknown) => stripUndefined(item)) as T;
  }

  if (typeof obj === 'object' && !(obj instanceof Date)) {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      if (value !== undefined) {
        result[key] = stripUndefined(value);
      }
    }
    return result as T;
  }

  return obj;
}

/**
 * Create a composite key for DynamoDB (e.g., "ecosystemId#cardId")
 */
export function compositeKey(...parts: string[]): string {
  return parts.join('#');
}

/**
 * Parse a composite key into its parts
 */
export function parseCompositeKey(key: string): string[] {
  return key.split('#');
}

/**
 * Create a timestamp-prefixed sort key for chronological ordering
 * Format: "ISO_TIMESTAMP#ID" ensures lexicographic sorting matches chronological order
 */
export function timestampSortKey(date: Date, id: string): string {
  return `${toISOString(date)}#${id}`;
}

/**
 * Parse a timestamp sort key into date and ID components
 */
export function parseTimestampSortKey(key: string): { timestamp: Date; id: string } {
  const parts = key.split('#');
  if (parts.length < 2) {
    throw new Error(`Invalid timestamp sort key: ${key}`);
  }
  return {
    timestamp: fromISOString(parts[0]!),
    id: parts.slice(1).join('#'), // Handle IDs that might contain #
  };
}

/**
 * Encode a DynamoDB LastEvaluatedKey to a base64 cursor string
 */
export function encodeCursor(
  lastEvaluatedKey: Record<string, unknown> | undefined
): string | undefined {
  if (!lastEvaluatedKey) {
    return undefined;
  }
  return Buffer.from(JSON.stringify(lastEvaluatedKey)).toString('base64');
}

/**
 * Decode a base64 cursor string to a DynamoDB ExclusiveStartKey
 */
export function decodeCursor(cursor: string | undefined): Record<string, unknown> | undefined {
  if (cursor === undefined || cursor === '') {
    return undefined;
  }
  try {
    return JSON.parse(Buffer.from(cursor, 'base64').toString('utf8')) as Record<string, unknown>;
  } catch {
    return undefined;
  }
}

/**
 * Calculate TTL timestamp for idempotency records (Unix epoch seconds)
 */
export function calculateTTL(expirationDate: Date): number {
  return Math.floor(expirationDate.getTime() / 1000);
}

/**
 * Convert Unix epoch seconds to Date
 */
export function fromTTL(ttl: number): Date {
  return new Date(ttl * 1000);
}
