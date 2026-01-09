/**
 * Webhook Auth Middleware
 *
 * Validates X-Webhook-Secret header for webhook endpoints.
 */

import type { Request, Response, NextFunction } from 'express';
import { AppError, ErrorCodes } from './error-handler.js';

/**
 * Error codes for webhook auth
 */
export const WebhookErrorCodes = {
  UNAUTHORIZED: 'UNAUTHORIZED' as const,
  INVALID_SECRET: 'INVALID_SECRET' as const,
};

/**
 * Create webhook auth middleware with secret
 *
 * @param webhookSecret - The secret to validate against
 * @returns Express middleware function
 */
export function createWebhookAuthMiddleware(webhookSecret: string) {
  return function webhookAuthMiddleware(req: Request, res: Response, next: NextFunction): void {
    // Get secret from header (case-insensitive header lookup)
    const providedSecret = req.headers['x-webhook-secret'];

    // Check if header is missing
    if (providedSecret === undefined) {
      res.status(401).json({
        error: {
          code: WebhookErrorCodes.UNAUTHORIZED,
          message: 'Missing webhook secret header',
        },
      });
      return;
    }

    // Handle array case (shouldn't happen but TypeScript requires it)
    const secretValue = Array.isArray(providedSecret) ? providedSecret[0] : providedSecret;

    // Validate secret
    if (secretValue !== webhookSecret) {
      res.status(401).json({
        error: {
          code: WebhookErrorCodes.INVALID_SECRET,
          message: 'Invalid webhook secret',
        },
      });
      return;
    }

    next();
  };
}

/**
 * Create webhook auth middleware from environment variable
 *
 * Uses WEBHOOK_SECRET from environment.
 */
export function webhookAuthMiddleware(req: Request, res: Response, next: NextFunction): void {
  const webhookSecret = process.env.WEBHOOK_SECRET;

  if (webhookSecret === undefined || webhookSecret === '') {
    // In production, this should fail
    // In development, allow requests without validation
    if (process.env.NODE_ENV === 'production') {
      throw new AppError(ErrorCodes.INTERNAL_ERROR, 'Webhook secret not configured', 500);
    }

    // Development mode - skip validation
    console.warn('[WARN] Webhook secret not configured - skipping validation');
    next();
    return;
  }

  const middleware = createWebhookAuthMiddleware(webhookSecret);
  middleware(req, res, next);
}
