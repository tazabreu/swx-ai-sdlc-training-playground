/**
 * Firebase Auth Provider
 *
 * Firebase Admin SDK implementation for authentication.
 */

import { getAuth, type Auth } from 'firebase-admin/auth';
import type { IAuthProvider, AuthTokenClaims, UserStatus } from './auth-provider.interface.js';

/**
 * Firebase Auth Provider implementation
 */
export class FirebaseAuthProvider implements IAuthProvider {
  private readonly auth: Auth;

  constructor() {
    this.auth = getAuth();
  }

  async verifyToken(idToken: string): Promise<AuthTokenClaims> {
    const decodedToken = await this.auth.verifyIdToken(idToken);

    return {
      uid: decodedToken.uid,
      email: decodedToken.email,
      emailVerified: decodedToken.email_verified,
      role: decodedToken.role as 'user' | 'admin' | undefined,
      ecosystemId: (decodedToken.ecosystemId as string | undefined) ?? decodedToken.uid,
    };
  }

  async getUser(uid: string): Promise<AuthTokenClaims | null> {
    try {
      const userRecord = await this.auth.getUser(uid);

      return {
        uid: userRecord.uid,
        email: userRecord.email,
        emailVerified: userRecord.emailVerified,
        role: userRecord.customClaims?.role as 'user' | 'admin' | undefined,
        ecosystemId: (userRecord.customClaims?.ecosystemId as string | undefined) ?? userRecord.uid,
      };
    } catch (error) {
      // User not found
      if ((error as { code?: string }).code === 'auth/user-not-found') {
        return null;
      }
      throw error;
    }
  }

  async getUserStatus(uid: string): Promise<UserStatus> {
    try {
      const userRecord = await this.auth.getUser(uid);
      return userRecord.disabled ? 'disabled' : 'active';
    } catch (error) {
      if ((error as { code?: string }).code === 'auth/user-not-found') {
        return null;
      }
      throw error;
    }
  }

  async setCustomClaims(uid: string, claims: Record<string, unknown>): Promise<void> {
    await this.auth.setCustomUserClaims(uid, claims);
  }
}
