/**
 * Users Routes
 *
 * Explicit user registration endpoint.
 */

import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import type { Container } from '../../infrastructure/di/container.js';
import { ServiceNames } from '../../infrastructure/di/container.js';
import type { IUserRepository } from '../../infrastructure/persistence/interfaces/user.repository.js';
import type { CreateUserRequest, CreateUserResponse } from '../dto/users.dto.js';
import { Errors } from '../middleware/error-handler.js';
import { createAuthMiddleware } from '../middleware/auth.js';
import type { IAuthProvider } from '../../infrastructure/auth/auth-provider.interface.js';
import type { User } from '../../domain/entities/user.entity.js';
import { createUser } from '../../domain/entities/user.entity.js';

/**
 * Map user entity to API response
 */
function toUserResponse(user: User): CreateUserResponse['user'] {
  return {
    ecosystemId: user.ecosystemId,
    firebaseUid: user.firebaseUid,
    email: user.email,
    role: user.role,
    status: user.status,
    currentScore: user.currentScore,
    tier: user.tier,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
    lastLoginAt: user.lastLoginAt.toISOString(),
  };
}

/**
 * Create users router
 */
export function createUsersRouter(container: Container): Router {
  const router = Router();
  const authProvider = container.resolve<IAuthProvider>(ServiceNames.AuthProvider);
  const authMiddleware = createAuthMiddleware(authProvider);

  /**
   * POST /v1/users
   * Explicitly create the authenticated user
   */
  router.post(
    '/',
    authMiddleware,
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const ecosystemId = req.ecosystemId;
        const claims = req.user;
        if (ecosystemId === undefined || claims === undefined) {
          throw Errors.unauthorized();
        }

        const userRepo = container.resolve<IUserRepository>(ServiceNames.UserRepository);

        const existingUser = await userRepo.findById(ecosystemId);
        if (existingUser !== null) {
          const response: CreateUserResponse = {
            created: false,
            user: toUserResponse(existingUser),
          };
          res.status(200).json(response);
          return;
        }

        const input = req.body as CreateUserRequest;
        const emailFromToken = claims.email?.trim();
        const emailFromBody = typeof input?.email === 'string' ? input.email.trim() : '';

        if (emailFromToken !== undefined && emailFromToken.length > 0) {
          if (emailFromBody.length > 0 && emailFromBody !== emailFromToken) {
            throw Errors.badRequest('email must match the authenticated user');
          }
        }

        const email = emailFromToken?.length ? emailFromToken : emailFromBody;
        if (email.length === 0) {
          throw Errors.badRequest('email is required');
        }

        const user: User = createUser({
          ecosystemId,
          firebaseUid: claims.uid,
          email,
          role: claims.role,
        });

        await userRepo.save(user);

        const response: CreateUserResponse = {
          created: true,
          user: toUserResponse(user),
        };
        res.status(201).json(response);
      } catch (error) {
        next(error);
      }
    }
  );

  return router;
}
