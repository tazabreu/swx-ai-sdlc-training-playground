/**
 * Firestore Codecs
 *
 * Strict decoding helpers to avoid silently accepting malformed data.
 */

export function requireDate(value: unknown, fieldName: string): Date {
  const date = toDate(value);
  if (date === null) {
    throw new Error(`Invalid Firestore date for "${fieldName}"`);
  }
  return date;
}

export function optionalDate(value: unknown, fieldName: string): Date | undefined {
  if (value === null || value === undefined) return undefined;
  return requireDate(value, fieldName);
}

function toDate(value: unknown): Date | null {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return value;
  }

  if (typeof value === 'object' && value !== null) {
    const maybeTimestamp = value as { toDate?: unknown };
    if (typeof maybeTimestamp.toDate === 'function') {
      const d = (maybeTimestamp.toDate as () => Date)();
      if (!(d instanceof Date) || Number.isNaN(d.getTime())) return null;
      return d;
    }
  }

  return null;
}

/**
 * Recursively strip undefined values from an object.
 * Firestore does not accept undefined values in documents.
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
