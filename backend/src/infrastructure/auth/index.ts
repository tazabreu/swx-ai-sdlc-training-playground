/**
 * Auth Infrastructure
 *
 * Re-exports all auth provider implementations.
 */

export type { IAuthProvider, AuthTokenClaims } from './auth-provider.interface.js';
export { MockAuthProvider } from './mock-auth-provider.js';
export type { MockUser } from './mock-auth-provider.js';
export { FirebaseAuthProvider } from './firebase-auth-provider.js';
export { CognitoAuthProvider } from './cognito-auth-provider.js';
export type { CognitoAuthConfig } from './cognito-auth-provider.js';
