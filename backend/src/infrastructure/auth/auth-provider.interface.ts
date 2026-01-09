/**
 * Auth Provider Interface
 *
 * Contract for authentication provider implementations.
 * Abstracts Firebase Auth or other auth providers.
 */

/**
 * Decoded token claims from authentication provider
 */
export interface AuthTokenClaims {
  uid: string;
  email?: string | undefined;
  emailVerified?: boolean | undefined;
  role?: 'user' | 'admin' | undefined;
  ecosystemId?: string | undefined;
}

/**
 * Auth claims used in request context
 */
export interface AuthClaims {
  uid: string;
  email: string;
  role: 'user' | 'admin';
  ecosystemId: string;
}

/**
 * User status
 */
export type UserStatus = 'active' | 'disabled' | null;

/**
 * Auth provider interface
 */
export interface IAuthProvider {
  /**
   * Verify an ID token and return decoded claims
   */
  verifyToken(idToken: string): Promise<AuthTokenClaims>;

  /**
   * Get user by UID from auth provider
   */
  getUser(uid: string): Promise<AuthTokenClaims | null>;

  /**
   * Get user status
   */
  getUserStatus(uid: string): Promise<UserStatus>;

  /**
   * Set custom claims for a user (admin, etc.)
   */
  setCustomClaims(uid: string, claims: Record<string, unknown>): Promise<void>;
}
