/**
 * Request ID Middleware
 *
 * Injects a unique request ID for tracing and logging.
 * Uses X-Request-ID header if provided, otherwise generates UUID.
 */

import type { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      requestId: string;
      traceId?: string | undefined;
      spanId?: string | undefined;
    }
  }
}

export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const requestId = (req.headers['x-request-id'] as string | undefined) ?? uuidv4();
  req.requestId = requestId;
  res.setHeader('X-Request-ID', requestId);

  const traceparent = req.headers['traceparent'];
  if (typeof traceparent === 'string') {
    const parsed = parseTraceparent(traceparent);
    if (parsed !== null) {
      req.traceId = parsed.traceId;
      req.spanId = parsed.spanId;
    }
  }

  next();
}

function parseTraceparent(value: string): { traceId: string; spanId: string } | null {
  // W3C traceparent: version-traceid-spanid-flags
  const parts = value.trim().split('-');
  if (parts.length !== 4) return null;

  const traceId = parts[1];
  const spanId = parts[2];
  if (traceId === undefined || spanId === undefined) return null;

  if (!/^[0-9a-f]{32}$/i.test(traceId)) return null;
  if (!/^[0-9a-f]{16}$/i.test(spanId)) return null;

  // Disallow all-zero IDs
  if (/^0{32}$/i.test(traceId)) return null;
  if (/^0{16}$/i.test(spanId)) return null;

  return { traceId: traceId.toLowerCase(), spanId: spanId.toLowerCase() };
}
