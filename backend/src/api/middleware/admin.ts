/**
 * Admin Middleware
 *
 * Validates admin role for protected endpoints.
 */

import type { Request, Response, NextFunction } from 'express';
import { AppError, ErrorCodes } from './error-handler.js';

/**
 * Admin role check middleware
 * Must be used after auth middleware
 */
export function adminMiddleware(req: Request, _res: Response, next: NextFunction): void {
  if (req.user === undefined) {
    next(new AppError(ErrorCodes.INVALID_TOKEN, 'Authentication required', 401));
    return;
  }

  if (req.user.role !== 'admin') {
    next(new AppError(ErrorCodes.FORBIDDEN, 'Admin access required', 403));
    return;
  }

  next();
}
