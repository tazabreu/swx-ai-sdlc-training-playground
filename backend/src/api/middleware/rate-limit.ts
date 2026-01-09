/**
 * Rate Limit Middleware
 *
 * Simple in-memory rate limiting.
 * Note: For production, use Redis-based rate limiting for distributed systems.
 */

import type { Request, Response, NextFunction } from 'express';
import { AppError, ErrorCodes } from './error-handler.js';

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  message?: string;
}

/**
 * In-memory rate limit store
 */
const rateLimitStore = new Map<string, RateLimitEntry>();

/**
 * Cleanup expired entries periodically
 */
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.resetAt < now) {
      rateLimitStore.delete(key);
    }
  }
}, 60000); // Cleanup every minute

/**
 * Create rate limit middleware
 */
export function createRateLimiter(config: RateLimitConfig) {
  return function rateLimitMiddleware(req: Request, res: Response, next: NextFunction): void {
    // Use user ID if authenticated, otherwise use IP
    const identifier = req.user?.uid ?? req.ip ?? 'unknown';
    const key = `${identifier}:${req.path}`;
    const now = Date.now();

    let entry = rateLimitStore.get(key);

    // Reset if window expired
    if (entry === undefined || entry.resetAt < now) {
      entry = {
        count: 0,
        resetAt: now + config.windowMs,
      };
    }

    entry.count++;
    rateLimitStore.set(key, entry);

    // Set rate limit headers
    const remaining = Math.max(0, config.maxRequests - entry.count);
    res.setHeader('X-RateLimit-Limit', config.maxRequests);
    res.setHeader('X-RateLimit-Remaining', remaining);
    res.setHeader('X-RateLimit-Reset', Math.ceil(entry.resetAt / 1000));

    if (entry.count > config.maxRequests) {
      res.setHeader('Retry-After', Math.ceil((entry.resetAt - now) / 1000));
      next(
        new AppError(
          ErrorCodes.SERVICE_UNAVAILABLE,
          config.message ?? 'Too many requests, please try again later',
          429
        )
      );
      return;
    }

    next();
  };
}

/**
 * Pre-configured rate limiters
 */
export const rateLimiters = {
  // 10 auth requests per minute
  auth: createRateLimiter({
    windowMs: 60 * 1000,
    maxRequests: 10,
    message: 'Too many authentication attempts, please try again later',
  }),

  // 100 API requests per minute
  api: createRateLimiter({
    windowMs: 60 * 1000,
    maxRequests: 100,
    message: 'Rate limit exceeded, please slow down',
  }),

  // Strict limit for admin cleanup (1 per minute)
  cleanup: createRateLimiter({
    windowMs: 60 * 1000,
    maxRequests: 1,
    message: 'Cleanup can only be performed once per minute',
  }),
};

/**
 * Clear rate limit store (for testing)
 */
export function clearRateLimitStore(): void {
  rateLimitStore.clear();
}
