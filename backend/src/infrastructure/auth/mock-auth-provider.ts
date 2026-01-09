/**
 * Mock Auth Provider
 *
 * In-memory authentication provider for testing.
 */

/* eslint-disable @typescript-eslint/require-await */

import type { IAuthProvider, AuthTokenClaims, UserStatus } from './auth-provider.interface.js';

/**
 * Mock user configuration for testing
 */
export interface MockUser {
  uid: string;
  email?: string | undefined;
  emailVerified?: boolean | undefined;
  role?: 'user' | 'admin' | undefined;
  ecosystemId?: string | undefined;
  status?: 'active' | 'disabled' | undefined;
  customClaims?: Record<string, unknown> | undefined;
}

/**
 * Mock Auth Provider implementation for testing
 */
export class MockAuthProvider implements IAuthProvider {
  private users: Map<string, MockUser> = new Map();
  private tokens: Map<string, string> = new Map(); // token -> uid

  /**
   * Register a mock user for testing
   */
  registerUser(user: MockUser): void {
    this.users.set(user.uid, user);
  }

  /**
   * Register a token for a user
   */
  registerToken(token: string, uid: string): void {
    this.tokens.set(token, uid);
  }

  async verifyToken(idToken: string): Promise<AuthTokenClaims> {
    // Support convention-based mock tokens: mock.<base64_json>.signature
    if (idToken.startsWith('mock.')) {
      const parts = idToken.split('.');
      const payloadEncoded = parts[1];
      if (payloadEncoded !== undefined) {
        try {
          const payload = JSON.parse(Buffer.from(payloadEncoded, 'base64').toString()) as {
            ecosystemId?: string;
            role?: 'user' | 'admin';
            email?: string;
          };
          const ecosystemId = payload.ecosystemId;
          if (ecosystemId !== undefined && ecosystemId.length > 0) {
            // Use email from payload if provided, otherwise generate default
            const email = payload.email?.trim() || `${ecosystemId}@test.local`;
            return {
              uid: ecosystemId,
              ecosystemId,
              email,
              emailVerified: true,
              role: payload.role ?? 'user',
            };
          }
        } catch {
          // Fall through to registered token lookup
        }
      }
    }

    // Fall back to explicitly registered tokens
    const uid = this.tokens.get(idToken);
    if (uid === undefined) {
      throw new Error('Invalid token');
    }

    const user = this.users.get(uid);
    if (user === undefined) {
      throw new Error('User not found');
    }

    return {
      uid: user.uid,
      email: user.email,
      emailVerified: user.emailVerified,
      role: user.role,
      ecosystemId: user.ecosystemId ?? user.uid,
    };
  }

  async getUser(uid: string): Promise<AuthTokenClaims | null> {
    const user = this.users.get(uid);
    if (user === undefined) return null;

    return {
      uid: user.uid,
      email: user.email,
      emailVerified: user.emailVerified,
      role: user.role,
      ecosystemId: user.ecosystemId ?? user.uid,
    };
  }

  async getUserStatus(uid: string): Promise<UserStatus> {
    const user = this.users.get(uid);
    if (user === undefined) return null;
    return user.status ?? 'active';
  }

  async setCustomClaims(uid: string, claims: Record<string, unknown>): Promise<void> {
    const user = this.users.get(uid);
    if (user === undefined) {
      throw new Error(`User not found: ${uid}`);
    }

    user.customClaims = { ...user.customClaims, ...claims };
    if ('role' in claims && (claims.role === 'user' || claims.role === 'admin')) {
      user.role = claims.role;
    }
  }

  // Test helper methods
  clear(): void {
    this.users.clear();
    this.tokens.clear();
  }

  getAllUsers(): MockUser[] {
    return Array.from(this.users.values());
  }
}
