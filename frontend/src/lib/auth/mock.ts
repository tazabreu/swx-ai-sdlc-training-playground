'use client';

import type { User, UserRole } from '@/contexts/auth-context';

// Default ecosystem IDs matching LOCAL_TESTING_GUIDE.md
export const DEFAULT_USER_ID = 'user-123';
export const DEFAULT_ADMIN_ID = 'admin-001';

export function getDefaultEmailForRole(role: UserRole): string {
  return role === 'admin' ? 'admin@example.com' : 'user@example.com';
}

export function getDefaultEcosystemId(role: UserRole): string {
  return role === 'admin' ? DEFAULT_ADMIN_ID : DEFAULT_USER_ID;
}

function getEnvTokenForRole(role: UserRole): string | null {
  // If provided, lets you paste tokens from LOCAL_TESTING_GUIDE.md without changing code.
  const env =
    role === 'admin'
      ? process.env.NEXT_PUBLIC_DEV_ADMIN_TOKEN
      : process.env.NEXT_PUBLIC_DEV_USER_TOKEN;
  return env !== undefined && env.trim().length > 0 ? env.trim() : null;
}

export function createMockUser(email: string, role: UserRole): User {
  const normalizedEmail = email.trim().toLowerCase();
  const name = normalizedEmail.split('@')[0] || (role === 'admin' ? 'Admin' : 'User');
  const ecosystemId = getDefaultEcosystemId(role);

  return {
    ecosystemId,
    email: normalizedEmail,
    name,
    role,
  };
}

// Mock token generator matching LOCAL_TESTING_GUIDE.md format:
// mock.<base64_json>.sig
export function generateMockToken(user: Pick<User, 'ecosystemId' | 'role' | 'email'>): string {
  const payload = {
    ecosystemId: user.ecosystemId,
    role: user.role,
    // Include email for AWS/LocalStack dev fallback (CognitoAuthProvider.decodeLocalStackToken reads payload.email)
    // In in-memory mode, MockAuthProvider ignores this field and derives its own email.
    email: user.email,
  };
  // Use standard btoa for base64 encoding
  const base64Payload = btoa(JSON.stringify(payload));
  return `mock.${base64Payload}.sig`;
}

/**
 * Returns a token for the given user. Uses env-provided tokens if present,
 * otherwise generates a compatible mock token.
 */
export function getAuthTokenForUser(user: Pick<User, 'ecosystemId' | 'role' | 'email'>): string {
  const envToken = getEnvTokenForRole(user.role);
  if (envToken !== null) return envToken;
  return generateMockToken(user);
}

export function decodeMockToken(token: string): { ecosystemId: string; role: UserRole } | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3 || parts[0] !== 'mock') {
      return null;
    }
    const payload = JSON.parse(atob(parts[1]));
    return {
      ecosystemId: payload.ecosystemId,
      role: payload.role,
    };
  } catch {
    return null;
  }
}
