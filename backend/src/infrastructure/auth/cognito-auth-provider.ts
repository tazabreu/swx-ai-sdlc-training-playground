/**
 * Cognito Auth Provider
 *
 * AWS Cognito implementation of the auth provider interface.
 * Supports LocalStack for local development.
 */

import {
  CognitoIdentityProviderClient,
  AdminGetUserCommand,
  AdminUpdateUserAttributesCommand,
  type AttributeType,
} from '@aws-sdk/client-cognito-identity-provider';
import { CognitoJwtVerifier } from 'aws-jwt-verify';
import type { IAuthProvider, AuthTokenClaims, UserStatus } from './auth-provider.interface.js';

function normalizeBase64(input: string): string {
  // Accept base64url and unpadded base64
  const base64 = input.replace(/-/g, '+').replace(/_/g, '/');
  const padLength = base64.length % 4;
  if (padLength === 0) return base64;
  return base64 + '='.repeat(4 - padLength);
}

function decodeBase64Json(input: string): Record<string, unknown> | null {
  try {
    const decoded = Buffer.from(normalizeBase64(input), 'base64').toString('utf8');
    return JSON.parse(decoded) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/**
 * Configuration for Cognito auth provider
 */
export interface CognitoAuthConfig {
  region?: string;
  userPoolId: string;
  clientId: string;
  endpoint?: string; // LocalStack endpoint override
}

/**
 * Cognito Auth Provider implementation
 */
export class CognitoAuthProvider implements IAuthProvider {
  private readonly client: CognitoIdentityProviderClient;
  private readonly userPoolId: string;
  private readonly isLocalStack: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private verifier: ReturnType<typeof CognitoJwtVerifier.create> | null = null;

  constructor(config: CognitoAuthConfig) {
    this.userPoolId = config.userPoolId;
    const endpoint = config.endpoint ?? '';
    this.isLocalStack =
      endpoint !== '' && (endpoint.includes('localhost') || endpoint.includes('localstack'));

    // Initialize Cognito client with optional endpoint override
    const clientConfig: {
      region: string;
      endpoint?: string;
      credentials?: { accessKeyId: string; secretAccessKey: string };
    } = {
      region: config.region ?? process.env.AWS_REGION ?? 'us-east-1',
    };

    if (config.endpoint !== undefined && config.endpoint !== '') {
      clientConfig.endpoint = config.endpoint;
      // LocalStack requires credentials even if they're fake
      clientConfig.credentials = {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID ?? 'test',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? 'test',
      };
    }

    this.client = new CognitoIdentityProviderClient(clientConfig);

    // Initialize JWT verifier for non-LocalStack environments
    if (!this.isLocalStack) {
      this.verifier = CognitoJwtVerifier.create({
        userPoolId: config.userPoolId,
        clientId: config.clientId,
        tokenUse: 'access',
      });
    }
  }

  async verifyToken(idToken: string): Promise<AuthTokenClaims> {
    if (this.isLocalStack) {
      // LocalStack doesn't support proper JWT verification
      // Decode the token without verification for local development
      return this.decodeLocalStackToken(idToken);
    }

    if (!this.verifier) {
      throw new Error('JWT verifier not initialized');
    }

    try {
      const payload = await this.verifier.verify(idToken);

      return {
        uid: payload.sub,
        email: payload['email'] as string | undefined,
        emailVerified: payload['email_verified'] as boolean | undefined,
        role: payload['custom:role'] as 'user' | 'admin' | undefined,
        ecosystemId: payload['custom:ecosystemId'] as string | undefined,
      };
    } catch (error) {
      throw new Error(
        `Token verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  async getUser(uid: string): Promise<AuthTokenClaims | null> {
    if (this.isLocalStack) {
      // LocalStack fallback: we don't require a real Cognito user for local dev.
      return null;
    }

    try {
      const command = new AdminGetUserCommand({
        UserPoolId: this.userPoolId,
        Username: uid,
      });

      const response = await this.client.send(command);

      if (!response.UserAttributes) {
        return null;
      }

      const attributes = this.parseUserAttributes(response.UserAttributes);

      return {
        uid,
        email: attributes.email,
        emailVerified: attributes.email_verified === 'true',
        role: attributes['custom:role'] as 'user' | 'admin' | undefined,
        ecosystemId: attributes['custom:ecosystemId'],
      };
    } catch (error) {
      // User not found errors should return null
      const errorName = (error as { name?: string })?.name;
      if (errorName === 'UserNotFoundException') {
        return null;
      }
      throw error;
    }
  }

  async getUserStatus(uid: string): Promise<UserStatus> {
    if (this.isLocalStack) {
      // LocalStack fallback: treat all users as active to avoid requiring
      // Cognito Admin APIs (which may be unstable in LocalStack).
      return 'active';
    }

    try {
      const command = new AdminGetUserCommand({
        UserPoolId: this.userPoolId,
        Username: uid,
      });

      const response = await this.client.send(command);

      if (response.Enabled === false) {
        return 'disabled';
      }

      return 'active';
    } catch (error) {
      const errorName = (error as { name?: string })?.name;
      if (errorName === 'UserNotFoundException') {
        return null;
      }
      throw error;
    }
  }

  async setCustomClaims(uid: string, claims: Record<string, unknown>): Promise<void> {
    if (this.isLocalStack) {
      // LocalStack fallback: no-op (dev-only).
      return;
    }

    const userAttributes = Object.entries(claims).map(([key, value]) => ({
      Name: key.startsWith('custom:') ? key : `custom:${key}`,
      Value: String(value),
    }));

    const command = new AdminUpdateUserAttributesCommand({
      UserPoolId: this.userPoolId,
      Username: uid,
      UserAttributes: userAttributes,
    });

    await this.client.send(command);
  }

  /**
   * Decode a LocalStack token without verification
   * LocalStack's Cognito implementation uses simpler tokens
   */
  private decodeLocalStackToken(token: string): AuthTokenClaims {
    // Supported dev-only formats:
    // - mock.<base64_json>.sig (matches LOCAL_TESTING_GUIDE.md)
    // - header.<base64_json>.sig (JWT-like without verification)
    // - <base64_json> (raw base64/base64url JSON payload)
    // - <opaque> (fallback to using the token as uid)

    const parts = token.split('.');

    const candidatePayload =
      // mock.<payload>.*
      token.startsWith('mock.') && parts.length >= 2
        ? parts[1]
        : // jwt-like <header>.<payload>.<sig>
          parts.length >= 3
          ? parts[1]
          : // raw base64 json
            token;

    const payload =
      candidatePayload !== undefined && candidatePayload !== ''
        ? decodeBase64Json(candidatePayload)
        : null;
    if (payload === null) {
      return { uid: token };
    }

    const roleCandidate =
      (payload['custom:role'] ?? payload.role) === 'admin'
        ? 'admin'
        : (payload['custom:role'] ?? payload.role) === 'user'
          ? 'user'
          : undefined;

    const ecosystemId =
      (typeof payload['custom:ecosystemId'] === 'string'
        ? payload['custom:ecosystemId']
        : undefined) ?? (typeof payload.ecosystemId === 'string' ? payload.ecosystemId : undefined);

    const uid =
      (typeof payload.sub === 'string' ? payload.sub : undefined) ??
      (typeof payload.username === 'string' ? payload.username : undefined) ??
      (typeof payload['cognito:username'] === 'string' ? payload['cognito:username'] : undefined) ??
      ecosystemId ??
      token;

    const email = typeof payload.email === 'string' ? payload.email : undefined;
    const emailVerifiedRaw = payload.email_verified;
    const emailVerified =
      typeof emailVerifiedRaw === 'boolean'
        ? emailVerifiedRaw
        : typeof emailVerifiedRaw === 'string'
          ? emailVerifiedRaw === 'true'
          : undefined;

    return {
      uid,
      email,
      emailVerified,
      role: roleCandidate,
      ecosystemId: ecosystemId ?? uid,
    };
  }

  /**
   * Parse Cognito user attributes into a key-value map
   */
  private parseUserAttributes(attributes: AttributeType[]): Record<string, string | undefined> {
    const result: Record<string, string | undefined> = {};

    for (const attr of attributes) {
      if (attr.Name !== undefined && attr.Name !== '') {
        result[attr.Name] = attr.Value;
      }
    }

    return result;
  }
}
