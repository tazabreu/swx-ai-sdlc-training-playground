/**
 * Error Handler Middleware
 *
 * Global error handling with structured error responses.
 */

import type { Request, Response, NextFunction } from 'express';

/**
 * Application error codes
 */
export const ErrorCodes = {
  // Auth errors
  INVALID_TOKEN: 'INVALID_TOKEN',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  ACCOUNT_DISABLED: 'ACCOUNT_DISABLED',
  FORBIDDEN: 'FORBIDDEN',

  // Resource errors
  NOT_FOUND: 'NOT_FOUND',
  USER_NOT_FOUND: 'USER_NOT_FOUND',
  CARD_NOT_FOUND: 'CARD_NOT_FOUND',
  REQUEST_NOT_FOUND: 'REQUEST_NOT_FOUND',

  // Business errors
  INSUFFICIENT_CREDIT: 'INSUFFICIENT_CREDIT',
  CARD_REQUEST_EXISTS: 'CARD_REQUEST_EXISTS',
  CARD_ALREADY_EXISTS: 'CARD_ALREADY_EXISTS',
  REQUEST_ALREADY_PROCESSED: 'REQUEST_ALREADY_PROCESSED',
  INVALID_PAYMENT: 'INVALID_PAYMENT',
  LIMIT_EXCEEDS_POLICY: 'LIMIT_EXCEEDS_POLICY',
  CLEANUP_IN_PROGRESS: 'CLEANUP_IN_PROGRESS',
  CONFIRMATION_REQUIRED: 'CONFIRMATION_REQUIRED',

  // Validation errors
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INVALID_SCORE: 'INVALID_SCORE',

  // Concurrency errors
  VERSION_CONFLICT: 'VERSION_CONFLICT',

  // System errors
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];

/**
 * Application error class
 */
export class AppError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string,
    public readonly statusCode: number = 500,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'AppError';
  }

  toJSON(): { error: { code: string; message: string; details?: Record<string, unknown> } } {
    const response: {
      error: { code: string; message: string; details?: Record<string, unknown> };
    } = {
      error: {
        code: this.code,
        message: this.message,
      },
    };
    if (this.details !== undefined) {
      response.error.details = this.details;
    }
    return response;
  }
}

/**
 * Error factory functions
 */
export const Errors = {
  unauthorized: (code: ErrorCode = ErrorCodes.INVALID_TOKEN, message = 'Unauthorized'): AppError =>
    new AppError(code, message, 401),

  forbidden: (message = 'Forbidden'): AppError => new AppError(ErrorCodes.FORBIDDEN, message, 403),

  notFound: (resource: string, id?: string): AppError =>
    new AppError(
      ErrorCodes.NOT_FOUND,
      id !== undefined ? `${resource} not found: ${id}` : `${resource} not found`,
      404
    ),

  conflict: (code: ErrorCode, message: string, details?: Record<string, unknown>): AppError =>
    new AppError(code, message, 409, details),

  badRequest: (message: string, details?: Record<string, unknown>): AppError =>
    new AppError(ErrorCodes.VALIDATION_ERROR, message, 400, details),

  insufficientCredit: (requestedAmount: number, availableCredit: number): AppError =>
    new AppError(ErrorCodes.INSUFFICIENT_CREDIT, 'Purchase amount exceeds available credit', 402, {
      requestedAmount,
      availableCredit,
    }),

  internal: (message = 'Internal server error'): AppError =>
    new AppError(ErrorCodes.INTERNAL_ERROR, message, 500),
};

/**
 * Error handler middleware
 */
export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
): void {
  const requestId = req.requestId ?? 'unknown';
  const traceId = req.traceId;

  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      ...err.toJSON(),
      meta: {
        requestId,
        ...(traceId !== undefined ? { traceId } : {}),
      },
    });
    return;
  }

  // Log unexpected errors
  console.error(`[${requestId}] Unexpected error:`, err);

  res.status(500).json({
    error: {
      code: ErrorCodes.INTERNAL_ERROR,
      message: 'An unexpected error occurred',
    },
    meta: {
      requestId,
      ...(traceId !== undefined ? { traceId } : {}),
    },
  });
}

/**
 * Not found handler for unmatched routes
 */
export function notFoundHandler(req: Request, res: Response): void {
  const requestId = req.requestId ?? 'unknown';
  const traceId = req.traceId;
  res.status(404).json({
    error: {
      code: ErrorCodes.NOT_FOUND,
      message: `Route not found: ${req.method} ${req.path}`,
    },
    meta: {
      requestId,
      ...(traceId !== undefined ? { traceId } : {}),
    },
  });
}
