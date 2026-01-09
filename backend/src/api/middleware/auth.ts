/**
 * Auth Middleware
 *
 * Validates Bearer tokens and extracts user claims.
 */

import type { Request, Response, NextFunction } from 'express';
import type {
  IAuthProvider,
  AuthClaims,
} from '../../infrastructure/auth/auth-provider.interface.js';
import { AppError, ErrorCodes } from './error-handler.js';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthClaims;
      ecosystemId?: string;
    }
  }
}

/**
 * Create auth middleware with injected auth provider
 */
export function createAuthMiddleware(authProvider: IAuthProvider) {
  return async function authMiddleware(
    req: Request,
    _res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const authHeader = req.headers.authorization;

      if (authHeader === undefined || !authHeader.startsWith('Bearer ')) {
        throw new AppError(
          ErrorCodes.INVALID_TOKEN,
          'Missing or invalid authorization header',
          401
        );
      }

      const token = authHeader.substring(7); // Remove 'Bearer ' prefix

      const tokenClaims = await authProvider.verifyToken(token);

      // Check user status
      const status = await authProvider.getUserStatus(tokenClaims.uid);
      if (status === 'disabled') {
        throw new AppError(ErrorCodes.ACCOUNT_DISABLED, 'Account has been disabled', 403);
      }

      // Build auth claims
      const claims: AuthClaims = {
        uid: tokenClaims.uid,
        email: tokenClaims.email ?? '',
        role: tokenClaims.role ?? 'user',
        ecosystemId: tokenClaims.ecosystemId ?? tokenClaims.uid,
      };

      // Attach user claims to request
      req.user = claims;
      req.ecosystemId = claims.ecosystemId;

      next();
    } catch (error) {
      if (error instanceof AppError) {
        next(error);
        return;
      }

      // Handle token verification errors
      const message = error instanceof Error ? error.message : 'Token verification failed';
      if (message.includes('expired')) {
        next(new AppError(ErrorCodes.TOKEN_EXPIRED, 'Authentication token has expired', 401));
        return;
      }

      next(new AppError(ErrorCodes.INVALID_TOKEN, 'Authentication token is invalid', 401));
    }
  };
}

/**
 * Optional auth middleware - doesn't fail if no token provided
 */
export function createOptionalAuthMiddleware(authProvider: IAuthProvider) {
  const authMiddleware = createAuthMiddleware(authProvider);

  return async function optionalAuthMiddleware(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    const authHeader = req.headers.authorization;

    if (authHeader === undefined || !authHeader.startsWith('Bearer ')) {
      next();
      return;
    }

    await authMiddleware(req, res, next);
  };
}
