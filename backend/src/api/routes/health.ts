/**
 * Health Routes
 *
 * Liveness and readiness probes for service orchestration.
 */

import { Router } from 'express';
import type { Request, Response } from 'express';
import type { HealthResponse, ReadinessResponse, DependencyStatus } from '../dto/health.dto.js';

/**
 * Create health router
 */
export function createHealthRouter(): Router {
  const router = Router();

  /**
   * GET /health/liveness
   * Basic alive check - always returns 200 if process is running
   */
  router.get('/liveness', (_req: Request, res: Response) => {
    const response: HealthResponse = {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
    res.json(response);
  });

  /**
   * GET /health/readiness
   * Dependency health check - returns 503 if any dependency is unhealthy
   */
  router.get('/readiness', (_req: Request, res: Response) => {
    const warnings: string[] = [];

    // Check database (Firestore) - for now, assume healthy
    // In production, would actually ping Firestore
    const databaseStatus: DependencyStatus = 'healthy';

    // Check message stream (Pub/Sub) - for now, assume healthy
    // In production, would check Pub/Sub topic
    const messageStreamStatus: DependencyStatus = 'healthy';

    // Check auth provider (Firebase Auth) - for now, assume healthy
    // In production, would verify Firebase Auth is reachable
    const authProviderStatus: DependencyStatus = 'healthy';

    const allHealthy =
      databaseStatus === 'healthy' &&
      messageStreamStatus === 'healthy' &&
      authProviderStatus === 'healthy';

    const response: ReadinessResponse = {
      status: allHealthy ? 'healthy' : 'unhealthy',
      dependencies: {
        database: databaseStatus,
        message_stream: messageStreamStatus,
        auth_provider: authProviderStatus,
      },
    };

    if (warnings.length > 0) {
      response.warnings = warnings;
    }

    res.status(allHealthy ? 200 : 503).json(response);
  });

  return router;
}
