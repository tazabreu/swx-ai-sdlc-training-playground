/**
 * Webhook Routes
 *
 * Routes for handling WhatsApp webhooks from wpp-connect.
 */

import { Router, type Request, type Response, type NextFunction } from 'express';
import { type Container, ServiceNames } from '../../infrastructure/di/container.js';
import { webhookAuthMiddleware } from '../middleware/webhook-auth.js';
import { handleWhatsAppApproval } from '../../application/handlers/whatsapp-approval.handler.js';
import {
  validateWppWebhookPayload,
  toWebhookResponseDto,
  type WebhookHealthResponse,
} from '../dto/webhooks.dto.js';
import type { WppConnectClient } from '../../infrastructure/whatsapp/client.js';

/**
 * Create webhook router
 *
 * @param container - DI container for resolving dependencies
 * @returns Express router
 */
export function createWebhookRouter(container: Container): Router {
  const router = Router();

  /**
   * GET /webhooks/wpp-connect/health
   *
   * Health check for webhook endpoint.
   * Optionally checks WhatsApp session connection.
   */
  router.get('/wpp-connect/health', async (_req: Request, res: Response): Promise<void> => {
    const response: WebhookHealthResponse = {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };

    // Optionally check WhatsApp connection if client is available
    try {
      if (container.has(ServiceNames.WppClient)) {
        const wppClient = container.resolve<WppConnectClient>(ServiceNames.WppClient);
        const status = await wppClient.checkConnection();
        const whatsAppStatus: { connected: boolean; session?: string } = {
          connected: status.status === 'CONNECTED',
        };
        if (status.session !== undefined) {
          whatsAppStatus.session = status.session;
        }
        response.whatsapp = whatsAppStatus;
      }
    } catch {
      // WhatsApp client not available or connection check failed
      response.whatsapp = {
        connected: false,
      };
    }

    res.json(response);
  });

  /**
   * POST /webhooks/wpp-connect
   *
   * Receive WhatsApp messages from wpp-connect server.
   * Protected by webhook secret header.
   */
  router.post(
    '/wpp-connect',
    webhookAuthMiddleware,
    async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
      try {
        // Validate request body
        const validation = validateWppWebhookPayload(req.body);

        if (!validation.valid) {
          res.status(400).json({
            ok: false,
            action: 'error',
            error: validation.error,
          });
          return;
        }

        // Process the webhook
        const result = await handleWhatsAppApproval(validation.payload, {
          pendingApprovalRepo: container.resolve(ServiceNames.PendingApprovalRepository),
          cardRequestRepo: container.resolve(ServiceNames.CardRequestRepository),
          userRepo: container.resolve(ServiceNames.UserRepository),
          inboundRepo: container.resolve(ServiceNames.WhatsAppInboundRepository),
          cardRepo: container.resolve(ServiceNames.CardRepository),
          outboxRepo: container.resolve(ServiceNames.OutboxRepository),
          auditLogRepo: container.resolve(ServiceNames.AuditLogRepository),
          config: container.resolve(ServiceNames.WhatsAppConfig),
        });

        res.json(toWebhookResponseDto(result));
      } catch (error) {
        // Log the error
        console.error('[Webhook] Error processing webhook:', error);

        // Return error response
        res.status(500).json({
          ok: false,
          action: 'error',
          error: error instanceof Error ? error.message : 'Internal server error',
        });
      }
    }
  );

  return router;
}
