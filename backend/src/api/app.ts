/**
 * Express Application
 *
 * Main Express app setup with middleware chain and routes.
 */

import express, { type Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import type { Container } from '../infrastructure/di/container.js';
import { requestIdMiddleware, errorHandler, notFoundHandler } from './middleware/index.js';
import {
  createHealthRouter,
  createDashboardRouter,
  createOffersRouter,
  createUsersRouter,
  createCardsRouter,
  createTransactionsRouter,
  createAdminRouter,
  createWebhookRouter,
} from './routes/index.js';

/**
 * Create and configure Express application
 */
export function createApp(container: Container): Express {
  const app = express();

  // Security middleware
  app.use(
    helmet({
      contentSecurityPolicy: false, // Disable for API
    })
  );
  app.use(
    cors({
      // Allow all origins in development
      origin: true,
      // Allow custom headers (Idempotency-Key is required for write operations)
      allowedHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key', 'X-Request-ID'],
      // Expose headers to client
      exposedHeaders: ['X-Request-ID'],
    })
  );

  // Body parsing
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Request ID injection
  app.use(requestIdMiddleware);

  // Trust proxy for rate limiting (when behind load balancer)
  app.set('trust proxy', 1);

  // Health endpoints (no auth required)
  app.use('/health', createHealthRouter());

  // API v1 routes
  app.use('/v1/users', createUsersRouter(container));
  app.use('/v1/dashboard', createDashboardRouter(container));
  app.use('/v1/offers', createOffersRouter(container));
  app.use('/v1/cards', createCardsRouter(container));
  app.use('/v1/cards/:cardId/transactions', createTransactionsRouter(container));
  app.use('/v1/admin', createAdminRouter(container));

  // Webhook routes (no auth required - uses webhook secret)
  app.use('/webhooks', createWebhookRouter(container));

  // 404 handler
  app.use(notFoundHandler);

  // Error handler
  app.use(errorHandler);

  return app;
}

export type { Express };
