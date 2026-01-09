/**
 * WPP-Connect HTTP Client
 *
 * HTTP client for WPP-Connect API with token caching and retry logic.
 */

import type {
  WppClientConfig,
  WppTokenResponse,
  WppSendMessageResponse,
  WppSessionStatus,
  WppNumberStatus,
  WppErrorResponse,
} from './types.js';

/**
 * Custom error for WPP-Connect API errors
 */
export class WppConnectError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly errorCode?: string
  ) {
    super(message);
    this.name = 'WppConnectError';
  }
}

/**
 * Custom error for session not connected
 */
export class WppSessionNotConnectedError extends WppConnectError {
  constructor() {
    super('WhatsApp session is not connected');
    this.name = 'WppSessionNotConnectedError';
  }
}

/**
 * Custom error for phone not on WhatsApp
 */
export class WppPhoneNotFoundError extends WppConnectError {
  constructor(public readonly phone: string) {
    super(`Phone number ${phone} is not on WhatsApp`);
    this.name = 'WppPhoneNotFoundError';
  }
}

/**
 * Retry configuration
 */
interface RetryConfig {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 10000,
};

/**
 * Token cache expiration (23 hours to be safe)
 */
const TOKEN_EXPIRATION_MS = 23 * 60 * 60 * 1000;

/**
 * WPP-Connect HTTP Client
 *
 * Handles authentication, message sending, and session management
 * with the wpp-connect server.
 */
export class WppConnectClient {
  private token: string | null = null;
  private tokenExpiresAt: Date | null = null;
  private readonly retryConfig: RetryConfig;

  constructor(
    private readonly config: WppClientConfig,
    retryConfig?: Partial<RetryConfig>
  ) {
    this.retryConfig = { ...DEFAULT_RETRY_CONFIG, ...retryConfig };
  }

  /**
   * Get or generate a bearer token for API calls
   *
   * Tokens are cached for 23 hours.
   */
  async getToken(): Promise<string> {
    // Return cached token if still valid
    if (this.token !== null && this.tokenExpiresAt !== null && new Date() < this.tokenExpiresAt) {
      return this.token;
    }

    // Generate new token
    const url = `${this.config.baseUrl}/api/${this.config.sessionName}/${this.config.secretKey}/generate-token`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new WppConnectError(`Failed to generate token: ${errorBody}`, response.status);
    }

    const data = (await response.json()) as WppTokenResponse;

    if (data.token === undefined || data.token === '') {
      throw new WppConnectError('Token response missing token field');
    }

    // Cache token
    this.token = data.token;
    this.tokenExpiresAt = new Date(Date.now() + TOKEN_EXPIRATION_MS);

    return this.token;
  }

  /**
   * Clear cached token (useful when token becomes invalid)
   */
  clearToken(): void {
    this.token = null;
    this.tokenExpiresAt = null;
  }

  /**
   * Send a WhatsApp message
   *
   * @param phone - Recipient phone in E.164 format (no + sign)
   * @param message - Message text content (max 4096 chars)
   * @returns Send message response with message ID
   */
  async sendMessage(phone: string, message: string): Promise<WppSendMessageResponse> {
    return this.withRetry(async () => {
      const token = await this.getToken();
      const url = `${this.config.baseUrl}/api/${this.config.sessionName}/send-message`;

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ phone, message }),
      });

      if (response.status === 401) {
        // Token expired, clear and retry
        this.clearToken();
        throw new WppConnectError('Token expired', 401, 'TOKEN_EXPIRED');
      }

      if (!response.ok) {
        const errorBody = (await response.json().catch(() => ({
          status: 'error' as const,
          message: 'Unknown error',
        }))) as WppErrorResponse;
        throw new WppConnectError(
          errorBody.message ?? 'Failed to send message',
          response.status,
          errorBody.error
        );
      }

      const data = (await response.json()) as WppSendMessageResponse;
      return data;
    });
  }

  /**
   * Check WhatsApp session connection status
   */
  async checkConnection(): Promise<WppSessionStatus> {
    const token = await this.getToken();
    const url = `${this.config.baseUrl}/api/${this.config.sessionName}/check-connection-session`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new WppConnectError('Failed to check connection', response.status);
    }

    const data = (await response.json()) as WppSessionStatus;
    return data;
  }

  /**
   * Check if a phone number is registered on WhatsApp
   */
  async checkNumberStatus(phone: string): Promise<WppNumberStatus> {
    const token = await this.getToken();
    const url = `${this.config.baseUrl}/api/${this.config.sessionName}/check-number-status`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ phone }),
    });

    if (!response.ok) {
      throw new WppConnectError('Failed to check number status', response.status);
    }

    const data = (await response.json()) as WppNumberStatus;
    return data;
  }

  /**
   * Start or restart a WhatsApp session
   */
  async startSession(webhookUrl?: string): Promise<{ status: string; qrcode?: string }> {
    const token = await this.getToken();
    const url = `${this.config.baseUrl}/api/${this.config.sessionName}/start-session`;

    const body: Record<string, unknown> = {
      waitQrCode: true,
    };

    if (webhookUrl !== undefined && webhookUrl !== '') {
      body.webhook = webhookUrl;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new WppConnectError('Failed to start session', response.status);
    }

    return (await response.json()) as { status: string; qrcode?: string };
  }

  /**
   * Execute a function with retry logic and exponential backoff
   */
  private async withRetry<T>(fn: () => Promise<T>): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.retryConfig.maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error as Error;

        // Check if error is retryable
        if (error instanceof WppConnectError) {
          // Don't retry on 4xx errors (except 401 which is handled above)
          if (
            error.statusCode !== undefined &&
            error.statusCode >= 400 &&
            error.statusCode < 500 &&
            error.statusCode !== 401
          ) {
            throw error;
          }
        }

        // Last attempt, throw the error
        if (attempt === this.retryConfig.maxRetries) {
          throw error;
        }

        // Calculate delay with exponential backoff
        const delay = Math.min(
          this.retryConfig.baseDelayMs * Math.pow(2, attempt),
          this.retryConfig.maxDelayMs
        );

        // Wait before retrying
        await this.sleep(delay);
      }
    }

    // This should never be reached, but TypeScript needs it
    throw lastError || new Error('Unknown error in retry loop');
  }

  /**
   * Sleep for a given number of milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
