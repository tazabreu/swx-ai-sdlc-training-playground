import { beforeAll, describe, expect, test } from 'bun:test';
import {
  createMockUser,
  decodeMockToken,
  generateMockToken,
  getDefaultEcosystemId,
  DEFAULT_USER_ID,
  DEFAULT_ADMIN_ID,
} from '../src/lib/auth/mock';

beforeAll(() => {
  if (typeof globalThis.btoa !== 'function') {
    globalThis.btoa = (input: string) => Buffer.from(input, 'utf8').toString('base64');
  }
  if (typeof globalThis.atob !== 'function') {
    globalThis.atob = (input: string) => Buffer.from(input, 'base64').toString('utf8');
  }
});

describe('mock auth helpers', () => {
  test('getDefaultEcosystemId returns expected IDs', () => {
    expect(getDefaultEcosystemId('user')).toBe(DEFAULT_USER_ID);
    expect(getDefaultEcosystemId('admin')).toBe(DEFAULT_ADMIN_ID);
  });

  test('createMockUser normalizes email and uses default ecosystemId', () => {
    const user = createMockUser(' Alice@Example.com ', 'user');
    expect(user.email).toBe('alice@example.com');
    expect(user.name).toBe('alice');
    expect(user.ecosystemId).toBe(DEFAULT_USER_ID);
    expect(user.role).toBe('user');
  });

  test('createMockUser uses admin ecosystemId for admin role', () => {
    const admin = createMockUser('admin@example.com', 'admin');
    expect(admin.ecosystemId).toBe(DEFAULT_ADMIN_ID);
    expect(admin.role).toBe('admin');
  });

  test('generateMockToken encodes expected claims', () => {
    const user = createMockUser('user@example.com', 'user');
    const token = generateMockToken(user);
    const payload = decodeMockToken(token);

    expect(payload).not.toBeNull();
    expect(payload?.ecosystemId).toBe(user.ecosystemId);
    expect(payload?.role).toBe(user.role);
  });

  test('token format is mock.<base64>.sig', () => {
    const user = createMockUser('test@example.com', 'user');
    const token = generateMockToken(user);
    const parts = token.split('.');

    expect(parts.length).toBe(3);
    expect(parts[0]).toBe('mock');
    expect(parts[2]).toBe('sig');
  });

  test('decodeMockToken returns null for invalid tokens', () => {
    expect(decodeMockToken('invalid')).toBeNull();
    expect(decodeMockToken('not.a.valid.token')).toBeNull();
    expect(decodeMockToken('')).toBeNull();
  });
});
