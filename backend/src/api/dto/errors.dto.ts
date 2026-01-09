/**
 * Error DTOs
 *
 * Error response shapes per OpenAPI spec.
 */

/**
 * Standard error response
 */
export interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

/**
 * Cleanup confirmation required response
 */
export interface CleanupConfirmationRequired {
  message: string;
  confirmationToken: string;
  expiresAt: string;
}
