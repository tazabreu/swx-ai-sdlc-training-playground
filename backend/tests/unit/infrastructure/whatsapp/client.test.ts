/**
 * WPP-Connect Client Unit Tests
 *
 * Tests for WPP-Connect HTTP client with token caching and retry logic.
 */

import { describe, it, expect, beforeEach, mock } from 'bun:test';
import {
  WppConnectClient,
  WppConnectError,
  WppSessionNotConnectedError,
  WppPhoneNotFoundError,
} from '../../../../src/infrastructure/whatsapp/client';
import type { WppClientConfig } from '../../../../src/infrastructure/whatsapp/types';

/**
 * Create test client configuration
 */
function createTestConfig(): WppClientConfig {
  return {
    baseUrl: 'http://localhost:21465',
    secretKey: 'test-secret-key',
    sessionName: 'test-session',
  };
}

/**
 * Mock fetch response helper
 */
function mockFetchResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('WppConnectClient', () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  describe('constructor', () => {
    it('should create client with default retry config', () => {
      const config = createTestConfig();
      const client = new WppConnectClient(config);

      expect(client).toBeDefined();
    });

    it('should create client with custom retry config', () => {
      const config = createTestConfig();
      const client = new WppConnectClient(config, {
        maxRetries: 5,
        baseDelayMs: 500,
      });

      expect(client).toBeDefined();
    });
  });

  describe('getToken', () => {
    it('should generate new token on first call', async () => {
      const config = createTestConfig();
      const client = new WppConnectClient(config);

      globalThis.fetch = mock(() =>
        Promise.resolve(mockFetchResponse({ token: 'test-token-123' }))
      ) as typeof fetch;

      const token = await client.getToken();

      expect(token).toBe('test-token-123');
      expect(globalThis.fetch).toHaveBeenCalledTimes(1);

      globalThis.fetch = originalFetch;
    });

    it('should return cached token on subsequent calls', async () => {
      const config = createTestConfig();
      const client = new WppConnectClient(config);

      globalThis.fetch = mock(() =>
        Promise.resolve(mockFetchResponse({ token: 'cached-token' }))
      ) as typeof fetch;

      const token1 = await client.getToken();
      const token2 = await client.getToken();
      const token3 = await client.getToken();

      expect(token1).toBe('cached-token');
      expect(token2).toBe('cached-token');
      expect(token3).toBe('cached-token');
      // Should only call fetch once due to caching
      expect(globalThis.fetch).toHaveBeenCalledTimes(1);

      globalThis.fetch = originalFetch;
    });

    it('should throw WppConnectError when token generation fails', async () => {
      const config = createTestConfig();
      const client = new WppConnectClient(config);

      globalThis.fetch = mock(() =>
        Promise.resolve(new Response('Internal Server Error', { status: 500 }))
      ) as typeof fetch;

      try {
        await client.getToken();
        expect(true).toBe(false); // Should not reach here
      } catch (error) {
        expect(error).toBeInstanceOf(WppConnectError);
        expect((error as WppConnectError).message).toContain('Failed to generate token');
      }

      globalThis.fetch = originalFetch;
    });

    it('should throw WppConnectError when token response is missing token', async () => {
      const config = createTestConfig();
      const client = new WppConnectClient(config);

      globalThis.fetch = mock(() =>
        Promise.resolve(mockFetchResponse({ status: 'ok' }))
      ) as typeof fetch;

      try {
        await client.getToken();
        expect(true).toBe(false);
      } catch (error) {
        expect((error as Error).message).toContain('Token response missing token field');
      }

      globalThis.fetch = originalFetch;
    });

    it('should throw WppConnectError when token is empty string', async () => {
      const config = createTestConfig();
      const client = new WppConnectClient(config);

      globalThis.fetch = mock(() =>
        Promise.resolve(mockFetchResponse({ token: '' }))
      ) as typeof fetch;

      try {
        await client.getToken();
        expect(true).toBe(false);
      } catch (error) {
        expect((error as Error).message).toContain('Token response missing token field');
      }

      globalThis.fetch = originalFetch;
    });
  });

  describe('clearToken', () => {
    it('should clear cached token', async () => {
      const config = createTestConfig();
      const client = new WppConnectClient(config);
      let callCount = 0;

      globalThis.fetch = mock(() => {
        callCount++;
        return Promise.resolve(mockFetchResponse({ token: `token-${callCount}` }));
      }) as typeof fetch;

      const token1 = await client.getToken();
      expect(token1).toBe('token-1');

      client.clearToken();

      const token2 = await client.getToken();
      expect(token2).toBe('token-2');
      expect(callCount).toBe(2);

      globalThis.fetch = originalFetch;
    });
  });

  describe('sendMessage', () => {
    it('should send message successfully', async () => {
      const config = createTestConfig();
      const client = new WppConnectClient(config);
      let callCount = 0;

      globalThis.fetch = mock(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve(mockFetchResponse({ token: 'test-token' }));
        }
        return Promise.resolve(
          mockFetchResponse({
            status: 'success',
            id: 'msg-id-123',
            message: { id: 'msg-id-123', body: 'Test message' },
          })
        );
      }) as typeof fetch;

      const result = await client.sendMessage('5573981112636', 'Test message');

      expect(result.status).toBe('success');
      expect(result.id).toBe('msg-id-123');

      globalThis.fetch = originalFetch;
    });

    it('should retry on 401 and clear token', async () => {
      const config = createTestConfig();
      const client = new WppConnectClient(config, { maxRetries: 1 });
      let tokenCount = 0;
      let sendCount = 0;

      globalThis.fetch = mock((url: string) => {
        if (url.includes('generate-token')) {
          tokenCount++;
          return Promise.resolve(mockFetchResponse({ token: `token-${tokenCount}` }));
        }
        sendCount++;
        if (sendCount === 1) {
          return Promise.resolve(new Response('Unauthorized', { status: 401 }));
        }
        return Promise.resolve(mockFetchResponse({ status: 'success', id: 'msg-123' }));
      }) as typeof fetch;

      const result = await client.sendMessage('5573981112636', 'Test');

      expect(result.status).toBe('success');
      expect(tokenCount).toBe(2); // Token regenerated after 401

      globalThis.fetch = originalFetch;
    });

    it('should throw on 400 bad request without retry', async () => {
      const config = createTestConfig();
      const client = new WppConnectClient(config);

      globalThis.fetch = mock((url: string) => {
        if (url.includes('generate-token')) {
          return Promise.resolve(mockFetchResponse({ token: 'test-token' }));
        }
        return Promise.resolve(
          mockFetchResponse({ status: 'error', message: 'Invalid phone' }, 400)
        );
      }) as typeof fetch;

      try {
        await client.sendMessage('invalid', 'Test');
        expect(true).toBe(false);
      } catch (error) {
        expect((error as Error).message).toContain('Invalid phone');
      }

      globalThis.fetch = originalFetch;
    });

    it('should throw WppConnectError with error code', async () => {
      const config = createTestConfig();
      const client = new WppConnectClient(config);

      globalThis.fetch = mock((url: string) => {
        if (url.includes('generate-token')) {
          return Promise.resolve(mockFetchResponse({ token: 'test-token' }));
        }
        return Promise.resolve(
          mockFetchResponse(
            { status: 'error', message: 'Phone not found', error: 'PHONE_NOT_ON_WHATSAPP' },
            404
          )
        );
      }) as typeof fetch;

      try {
        await client.sendMessage('5573981112636', 'Test');
        expect(true).toBe(false); // Should not reach here
      } catch (error) {
        expect(error).toBeInstanceOf(WppConnectError);
        expect((error as WppConnectError).message).toBe('Phone not found');
        expect((error as WppConnectError).statusCode).toBe(404);
        expect((error as WppConnectError).errorCode).toBe('PHONE_NOT_ON_WHATSAPP');
      }

      globalThis.fetch = originalFetch;
    });
  });

  describe('checkConnection', () => {
    it('should return connected status', async () => {
      const config = createTestConfig();
      const client = new WppConnectClient(config);

      globalThis.fetch = mock((url: string) => {
        if (url.includes('generate-token')) {
          return Promise.resolve(mockFetchResponse({ token: 'test-token' }));
        }
        return Promise.resolve(
          mockFetchResponse({
            status: 'CONNECTED',
            phone: '5573981112636',
            session: 'test-session',
          })
        );
      }) as typeof fetch;

      const result = await client.checkConnection();

      expect(result.status).toBe('CONNECTED');
      expect(result.phone).toBe('5573981112636');

      globalThis.fetch = originalFetch;
    });

    it('should throw on connection check failure', async () => {
      const config = createTestConfig();
      const client = new WppConnectClient(config);

      globalThis.fetch = mock((url: string) => {
        if (url.includes('generate-token')) {
          return Promise.resolve(mockFetchResponse({ token: 'test-token' }));
        }
        return Promise.resolve(new Response('Server Error', { status: 500 }));
      }) as typeof fetch;

      try {
        await client.checkConnection();
        expect(true).toBe(false);
      } catch (error) {
        expect((error as Error).message).toContain('Failed to check connection');
      }

      globalThis.fetch = originalFetch;
    });
  });

  describe('checkNumberStatus', () => {
    it('should return true when number exists on WhatsApp', async () => {
      const config = createTestConfig();
      const client = new WppConnectClient(config);

      globalThis.fetch = mock((url: string) => {
        if (url.includes('generate-token')) {
          return Promise.resolve(mockFetchResponse({ token: 'test-token' }));
        }
        return Promise.resolve(
          mockFetchResponse({
            exists: true,
            id: '5573981112636@c.us',
            status: 'exists',
          })
        );
      }) as typeof fetch;

      const result = await client.checkNumberStatus('5573981112636');

      expect(result.exists).toBe(true);
      expect(result.id).toBe('5573981112636@c.us');

      globalThis.fetch = originalFetch;
    });

    it('should return false when number does not exist', async () => {
      const config = createTestConfig();
      const client = new WppConnectClient(config);

      globalThis.fetch = mock((url: string) => {
        if (url.includes('generate-token')) {
          return Promise.resolve(mockFetchResponse({ token: 'test-token' }));
        }
        return Promise.resolve(mockFetchResponse({ exists: false }));
      }) as typeof fetch;

      const result = await client.checkNumberStatus('5573000000000');

      expect(result.exists).toBe(false);

      globalThis.fetch = originalFetch;
    });

    it('should throw on check failure', async () => {
      const config = createTestConfig();
      const client = new WppConnectClient(config);

      globalThis.fetch = mock((url: string) => {
        if (url.includes('generate-token')) {
          return Promise.resolve(mockFetchResponse({ token: 'test-token' }));
        }
        return Promise.resolve(new Response('Error', { status: 500 }));
      }) as typeof fetch;

      try {
        await client.checkNumberStatus('5573981112636');
        expect(true).toBe(false);
      } catch (error) {
        expect((error as Error).message).toContain('Failed to check number status');
      }

      globalThis.fetch = originalFetch;
    });
  });

  describe('startSession', () => {
    it('should start session without webhook', async () => {
      const config = createTestConfig();
      const client = new WppConnectClient(config);

      globalThis.fetch = mock((url: string) => {
        if (url.includes('generate-token')) {
          return Promise.resolve(mockFetchResponse({ token: 'test-token' }));
        }
        return Promise.resolve(mockFetchResponse({ status: 'CONNECTED' }));
      }) as typeof fetch;

      const result = await client.startSession();

      expect(result.status).toBe('CONNECTED');

      globalThis.fetch = originalFetch;
    });

    it('should start session with webhook URL', async () => {
      const config = createTestConfig();
      const client = new WppConnectClient(config);
      let capturedBody: string | null = null;

      globalThis.fetch = mock((url: string, options?: RequestInit) => {
        if (url.includes('generate-token')) {
          return Promise.resolve(mockFetchResponse({ token: 'test-token' }));
        }
        if (options?.body !== undefined) {
          capturedBody = options.body as string;
        }
        return Promise.resolve(mockFetchResponse({ status: 'QRCODE', qrcode: 'base64-qr-data' }));
      }) as typeof fetch;

      const result = await client.startSession('https://example.com/webhook');

      expect(result.status).toBe('QRCODE');
      expect(result.qrcode).toBe('base64-qr-data');
      expect(capturedBody).toContain('webhook');
      expect(capturedBody).toContain('https://example.com/webhook');

      globalThis.fetch = originalFetch;
    });

    it('should throw on session start failure', async () => {
      const config = createTestConfig();
      const client = new WppConnectClient(config);

      globalThis.fetch = mock((url: string) => {
        if (url.includes('generate-token')) {
          return Promise.resolve(mockFetchResponse({ token: 'test-token' }));
        }
        return Promise.resolve(new Response('Error', { status: 500 }));
      }) as typeof fetch;

      try {
        await client.startSession();
        expect(true).toBe(false);
      } catch (error) {
        expect((error as Error).message).toContain('Failed to start session');
      }

      globalThis.fetch = originalFetch;
    });
  });

  describe('retry logic', () => {
    it('should retry on 5xx errors', async () => {
      const config = createTestConfig();
      const client = new WppConnectClient(config, {
        maxRetries: 2,
        baseDelayMs: 10, // Very short for tests
      });
      let sendAttempts = 0;

      globalThis.fetch = mock((url: string) => {
        if (url.includes('generate-token')) {
          return Promise.resolve(mockFetchResponse({ token: 'test-token' }));
        }
        sendAttempts++;
        if (sendAttempts < 3) {
          return Promise.resolve(new Response('Server Error', { status: 503 }));
        }
        return Promise.resolve(mockFetchResponse({ status: 'success', id: 'msg-123' }));
      }) as typeof fetch;

      const result = await client.sendMessage('5573981112636', 'Test');

      expect(result.status).toBe('success');
      expect(sendAttempts).toBe(3); // 1 initial + 2 retries

      globalThis.fetch = originalFetch;
    });

    it('should not retry on 403 forbidden', async () => {
      const config = createTestConfig();
      const client = new WppConnectClient(config, { maxRetries: 3, baseDelayMs: 10 });
      let sendAttempts = 0;

      globalThis.fetch = mock((url: string) => {
        if (url.includes('generate-token')) {
          return Promise.resolve(mockFetchResponse({ token: 'test-token' }));
        }
        sendAttempts++;
        return Promise.resolve(mockFetchResponse({ status: 'error', message: 'Forbidden' }, 403));
      }) as typeof fetch;

      try {
        await client.sendMessage('5573981112636', 'Test');
        expect(true).toBe(false);
      } catch (error) {
        expect((error as Error).message).toContain('Forbidden');
      }
      expect(sendAttempts).toBe(1); // No retry for 403

      globalThis.fetch = originalFetch;
    });

    it('should throw after max retries exceeded', async () => {
      const config = createTestConfig();
      const client = new WppConnectClient(config, {
        maxRetries: 2,
        baseDelayMs: 10,
      });
      let sendAttempts = 0;

      globalThis.fetch = mock((url: string) => {
        if (url.includes('generate-token')) {
          return Promise.resolve(mockFetchResponse({ token: 'test-token' }));
        }
        sendAttempts++;
        return Promise.resolve(new Response('Server Error', { status: 500 }));
      }) as typeof fetch;

      try {
        await client.sendMessage('5573981112636', 'Test');
        expect(true).toBe(false);
      } catch {
        // Expected to throw
      }
      expect(sendAttempts).toBe(3); // 1 initial + 2 retries

      globalThis.fetch = originalFetch;
    });
  });

  describe('error classes', () => {
    it('WppConnectError should have correct properties', () => {
      const error = new WppConnectError('Test error', 400, 'TEST_CODE');

      expect(error.name).toBe('WppConnectError');
      expect(error.message).toBe('Test error');
      expect(error.statusCode).toBe(400);
      expect(error.errorCode).toBe('TEST_CODE');
    });

    it('WppSessionNotConnectedError should have correct properties', () => {
      const error = new WppSessionNotConnectedError();

      expect(error.name).toBe('WppSessionNotConnectedError');
      expect(error.message).toBe('WhatsApp session is not connected');
    });

    it('WppPhoneNotFoundError should have correct properties', () => {
      const error = new WppPhoneNotFoundError('5573981112636');

      expect(error.name).toBe('WppPhoneNotFoundError');
      expect(error.message).toBe('Phone number 5573981112636 is not on WhatsApp');
      expect(error.phone).toBe('5573981112636');
    });
  });
});
