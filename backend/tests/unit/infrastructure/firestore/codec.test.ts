/**
 * Firestore Codec Tests
 *
 * Tests for Firestore encoding/decoding utilities.
 */

import { describe, it, expect } from 'bun:test';
import { stripUndefined } from '../../../../src/infrastructure/persistence/firestore/codec.js';

describe('stripUndefined', () => {
  it('should return null for null input', () => {
    expect(stripUndefined(null)).toBeNull();
  });

  it('should return undefined for undefined input', () => {
    expect(stripUndefined(undefined)).toBeUndefined();
  });

  it('should return primitive values unchanged', () => {
    expect(stripUndefined('hello')).toBe('hello');
    expect(stripUndefined(42)).toBe(42);
    expect(stripUndefined(true)).toBe(true);
    expect(stripUndefined(false)).toBe(false);
  });

  it('should preserve Date objects', () => {
    const date = new Date('2024-01-01T00:00:00Z');
    expect(stripUndefined(date)).toBe(date);
  });

  it('should remove undefined values from objects', () => {
    const input = {
      name: 'test',
      value: undefined,
      count: 0,
    };
    const result = stripUndefined(input);
    expect(result).toEqual({ name: 'test', count: 0 });
    expect('value' in result).toBe(false);
  });

  it('should handle nested objects with undefined values', () => {
    const input = {
      user: {
        name: 'John',
        email: undefined,
        metadata: {
          role: 'admin',
          permissions: undefined,
        },
      },
      timestamp: new Date('2024-01-01'),
    };
    const result = stripUndefined(input);
    expect(result).toEqual({
      user: {
        name: 'John',
        metadata: {
          role: 'admin',
        },
      },
      timestamp: input.timestamp,
    });
  });

  it('should handle arrays', () => {
    const input = ['a', 'b', 'c'];
    expect(stripUndefined(input)).toEqual(['a', 'b', 'c']);
  });

  it('should handle arrays with objects containing undefined', () => {
    const input = [
      { id: 1, name: 'first', extra: undefined },
      { id: 2, name: 'second' },
    ];
    const result = stripUndefined(input);
    expect(result).toEqual([
      { id: 1, name: 'first' },
      { id: 2, name: 'second' },
    ]);
  });

  it('should preserve null values in objects', () => {
    const input = {
      name: 'test',
      nullValue: null,
      undefinedValue: undefined,
    };
    const result = stripUndefined(input);
    expect(result).toEqual({ name: 'test', nullValue: null });
  });

  it('should handle empty objects', () => {
    expect(stripUndefined({})).toEqual({});
  });

  it('should handle objects with all undefined values', () => {
    const input = {
      a: undefined,
      b: undefined,
    };
    expect(stripUndefined(input)).toEqual({});
  });

  it('should handle score change event payload correctly', () => {
    // This mirrors the actual use case in createScoreChangedEvent
    const payload = {
      ecosystemId: 'user-123',
      previousScore: 500,
      newScore: 600,
      delta: 100,
      previousTier: 'medium',
      newTier: 'high',
      reason: 'Manual adjustment',
      source: 'admin',
      adminId: 'admin-001',
      relatedEntityType: undefined,
      relatedEntityId: undefined,
    };
    const result = stripUndefined(payload);
    expect(result).toEqual({
      ecosystemId: 'user-123',
      previousScore: 500,
      newScore: 600,
      delta: 100,
      previousTier: 'medium',
      newTier: 'high',
      reason: 'Manual adjustment',
      source: 'admin',
      adminId: 'admin-001',
    });
    expect('relatedEntityType' in result).toBe(false);
    expect('relatedEntityId' in result).toBe(false);
  });

  it('should handle idempotency cached response correctly', () => {
    // This mirrors the actual use case in request-card handler
    const cachedResponse = {
      status: 'pending',
      requestId: 'req-123',
      limit: undefined,
      cardId: undefined,
    };
    const result = stripUndefined(cachedResponse);
    expect(result).toEqual({
      status: 'pending',
      requestId: 'req-123',
    });
    expect('limit' in result).toBe(false);
    expect('cardId' in result).toBe(false);
  });
});
