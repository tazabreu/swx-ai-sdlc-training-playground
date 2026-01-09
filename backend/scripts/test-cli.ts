#!/usr/bin/env bun
/**
 * Interactive API Testing CLI
 *
 * A terminal-based tool for testing the Headless Financial API.
 * Run with: bun run scripts/test-cli.ts
 */

import * as readline from 'readline';

// Configuration
const BASE_URL = process.env.API_URL ?? 'http://localhost:3000';
let currentUser = 'test-user';
let currentRole: 'user' | 'admin' = 'user';
let lastCardId: string | null = null;
let lastRequestId: string | null = null;
let customToken: string | null = process.env.AUTH_TOKEN ?? null; // For Firebase emulator tokens
let authMode: 'mock' | 'emulator' = customToken ? 'emulator' : 'mock';

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  bgBlue: '\x1b[44m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m',
  bgRed: '\x1b[41m',
};

const c = colors;

// Helper functions
function log(message: string) {
  console.log(message);
}

function header(text: string) {
  console.log(`\n${c.bgBlue}${c.white}${c.bold} ${text} ${c.reset}\n`);
}

function success(text: string) {
  console.log(`${c.green}✓${c.reset} ${text}`);
}

function error(text: string) {
  console.log(`${c.red}✗${c.reset} ${text}`);
}

function info(text: string) {
  console.log(`${c.cyan}ℹ${c.reset} ${text}`);
}

function warn(text: string) {
  console.log(`${c.yellow}⚠${c.reset} ${text}`);
}

function divider() {
  console.log(`${c.dim}${'─'.repeat(60)}${c.reset}`);
}

function createAuthHeader(): string {
  // If using emulator mode with a custom token, use it directly
  if (authMode === 'emulator' && customToken) {
    return `Bearer ${customToken}`;
  }
  // Token format must match ContractAuthProvider: mock.<base64_json>.signature
  const payload = { ecosystemId: currentUser, role: currentRole, iat: Date.now() };
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64');
  return `Bearer mock.${encoded}.signature`;
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split('.');
    if (parts.length >= 2) {
      const payload = Buffer.from(parts[1], 'base64').toString('utf8');
      return JSON.parse(payload) as Record<string, unknown>;
    }
  } catch {
    // Not a valid JWT
  }
  return null;
}

function generateIdempotencyKey(): string {
  return `idem-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

async function fetchApi(
  method: string,
  path: string,
  body?: object,
  extraHeaders?: Record<string, string>
): Promise<{ status: number; data: unknown }> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: createAuthHeader(),
    ...extraHeaders,
  };

  const options: RequestInit = {
    method,
    headers,
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  try {
    const response = await fetch(`${BASE_URL}${path}`, options);
    const data = await response.json();
    return { status: response.status, data };
  } catch (err) {
    return { status: 0, data: { error: { message: (err as Error).message } } };
  }
}

function printResponse(result: { status: number; data: unknown }) {
  const statusColor = result.status >= 200 && result.status < 300 ? c.green : c.red;
  console.log(`\n${c.dim}Status:${c.reset} ${statusColor}${result.status}${c.reset}`);
  console.log(`${c.dim}Response:${c.reset}`);
  console.log(JSON.stringify(result.data, null, 2));
}

// Menu actions
const actions: Record<string, { name: string; fn: () => Promise<void>; category: string }> = {
  // Health & Status
  '1': {
    name: 'Health Check (liveness)',
    category: 'Health',
    fn: async () => {
      const result = await fetchApi('GET', '/health/liveness');
      printResponse(result);
    },
  },
  '2': {
    name: 'Health Check (readiness)',
    category: 'Health',
    fn: async () => {
      const result = await fetchApi('GET', '/health/readiness');
      printResponse(result);
    },
  },

  // User flows
  '3': {
    name: 'Get Dashboard',
    category: 'User',
    fn: async () => {
      const result = await fetchApi('GET', '/v1/dashboard');
      printResponse(result);
    },
  },
  '4': {
    name: 'Get Available Offers',
    category: 'User',
    fn: async () => {
      const result = await fetchApi('GET', '/v1/offers');
      printResponse(result);
    },
  },
  '5': {
    name: 'List My Cards',
    category: 'User',
    fn: async () => {
      const result = await fetchApi('GET', '/v1/cards');
      printResponse(result);
      // Store first card ID for later use
      const data = result.data as { cards?: Array<{ cardId: string }> };
      if (data.cards && data.cards.length > 0) {
        lastCardId = data.cards[0].cardId;
        info(`Stored card ID: ${lastCardId}`);
      }
    },
  },
  '6': {
    name: 'Request New Card',
    category: 'User',
    fn: async () => {
      const result = await fetchApi(
        'POST',
        '/v1/cards/requests',
        { productId: 'prod-standard' },
        { 'Idempotency-Key': generateIdempotencyKey() }
      );
      printResponse(result);
      // Store request ID
      const data = result.data as { request?: { requestId: string } };
      if (data.request?.requestId) {
        lastRequestId = data.request.requestId;
        info(`Stored request ID: ${lastRequestId}`);
      }
    },
  },
  '7': {
    name: 'Get Card Request Status',
    category: 'User',
    fn: async () => {
      if (!lastRequestId) {
        warn('No request ID stored. Request a card first.');
        return;
      }
      const result = await fetchApi('GET', `/v1/cards/requests/${lastRequestId}`);
      printResponse(result);
    },
  },
  '8': {
    name: 'Get Card Details',
    category: 'User',
    fn: async () => {
      if (!lastCardId) {
        warn('No card ID stored. List cards first or request a card.');
        return;
      }
      const result = await fetchApi('GET', `/v1/cards/${lastCardId}`);
      printResponse(result);
    },
  },
  '9': {
    name: 'Make Purchase ($50)',
    category: 'User',
    fn: async () => {
      if (!lastCardId) {
        warn('No card ID stored. List cards first.');
        return;
      }
      const result = await fetchApi(
        'POST',
        `/v1/cards/${lastCardId}/transactions/purchases`,
        { amount: 50, merchant: 'Test Store', category: 'shopping' },
        { 'Idempotency-Key': generateIdempotencyKey() }
      );
      printResponse(result);
    },
  },
  '10': {
    name: 'Make Payment ($100)',
    category: 'User',
    fn: async () => {
      if (!lastCardId) {
        warn('No card ID stored. List cards first.');
        return;
      }
      const result = await fetchApi(
        'POST',
        `/v1/cards/${lastCardId}/transactions/payments`,
        { amount: 100 },
        { 'Idempotency-Key': generateIdempotencyKey() }
      );
      printResponse(result);
    },
  },
  '11': {
    name: 'List Transactions',
    category: 'User',
    fn: async () => {
      if (!lastCardId) {
        warn('No card ID stored. List cards first.');
        return;
      }
      const result = await fetchApi('GET', `/v1/cards/${lastCardId}/transactions`);
      printResponse(result);
    },
  },

  // Admin flows
  '20': {
    name: 'List Pending Card Requests',
    category: 'Admin',
    fn: async () => {
      currentRole = 'admin';
      const result = await fetchApi('GET', '/v1/admin/card-requests');
      printResponse(result);
      currentRole = 'user';
      // Store first pending request ID
      const data = result.data as { requests?: Array<{ requestId: string }> };
      if (data.requests && data.requests.length > 0) {
        lastRequestId = data.requests[0].requestId;
        info(`Stored pending request ID: ${lastRequestId}`);
      }
    },
  },
  '21': {
    name: 'Get User Score',
    category: 'Admin',
    fn: async () => {
      currentRole = 'admin';
      const result = await fetchApi('GET', `/v1/admin/users/${currentUser}/score`);
      printResponse(result);
      currentRole = 'user';
    },
  },
  '22': {
    name: 'Adjust User Score (+50)',
    category: 'Admin',
    fn: async () => {
      currentRole = 'admin';
      // First get current score
      const scoreResult = await fetchApi('GET', `/v1/admin/users/${currentUser}/score`);
      const scoreData = scoreResult.data as { user?: { currentScore: number } };
      const currentScore = scoreData.user?.currentScore ?? 500;

      const result = await fetchApi('PATCH', `/v1/admin/users/${currentUser}/score`, {
        score: Math.min(1000, currentScore + 50),
        reason: 'Manual adjustment via test CLI',
      });
      printResponse(result);
      currentRole = 'user';
    },
  },
  '23': {
    name: 'Approve Pending Request',
    category: 'Admin',
    fn: async () => {
      if (!lastRequestId) {
        warn('No request ID stored. List pending requests first.');
        return;
      }
      currentRole = 'admin';
      const result = await fetchApi(
        'POST',
        `/v1/admin/card-requests/${lastRequestId}/approve`,
        { creditLimit: 2000, reason: 'Approved via test CLI' }
      );
      printResponse(result);
      currentRole = 'user';
    },
  },
  '24': {
    name: 'Reject Pending Request',
    category: 'Admin',
    fn: async () => {
      if (!lastRequestId) {
        warn('No request ID stored. List pending requests first.');
        return;
      }
      currentRole = 'admin';
      const result = await fetchApi(
        'POST',
        `/v1/admin/card-requests/${lastRequestId}/reject`,
        { reason: 'Rejected via test CLI' }
      );
      printResponse(result);
      currentRole = 'user';
    },
  },

  // Test flows
  '30': {
    name: 'Run Unit Tests',
    category: 'Tests',
    fn: async () => {
      header('Running Unit Tests...');
      const proc = Bun.spawn(['bun', 'test', 'tests/unit'], {
        cwd: process.cwd(),
        stdout: 'inherit',
        stderr: 'inherit',
      });
      await proc.exited;
    },
  },
  '31': {
    name: 'Run Contract Tests',
    category: 'Tests',
    fn: async () => {
      header('Running Contract Tests...');
      const proc = Bun.spawn(['bun', 'test', 'tests/contract'], {
        cwd: process.cwd(),
        stdout: 'inherit',
        stderr: 'inherit',
      });
      await proc.exited;
    },
  },
  '32': {
    name: 'Run All Tests',
    category: 'Tests',
    fn: async () => {
      header('Running All Tests...');
      const proc = Bun.spawn(['bun', 'test'], {
        cwd: process.cwd(),
        stdout: 'inherit',
        stderr: 'inherit',
      });
      await proc.exited;
    },
  },
  '33': {
    name: 'Run Tests with Coverage',
    category: 'Tests',
    fn: async () => {
      header('Running Tests with Coverage...');
      const proc = Bun.spawn(['bun', 'test', '--coverage'], {
        cwd: process.cwd(),
        stdout: 'inherit',
        stderr: 'inherit',
      });
      await proc.exited;
    },
  },

  // Scenarios
  '40': {
    name: '🔄 Full User Journey (auto-approval)',
    category: 'Scenarios',
    fn: async () => {
      header('Full User Journey - Auto-Approval Flow');

      // Step 1: Check dashboard
      info('Step 1: Checking dashboard...');
      let result = await fetchApi('GET', '/v1/dashboard');
      if (result.status !== 200) {
        error('Failed to get dashboard');
        printResponse(result);
        return;
      }
      success('Dashboard retrieved');

      // Step 2: Request a card
      info('Step 2: Requesting a card...');
      result = await fetchApi(
        'POST',
        '/v1/cards/requests',
        { productId: 'prod-standard' },
        { 'Idempotency-Key': generateIdempotencyKey() }
      );
      if (result.status !== 201 && result.status !== 200) {
        error('Failed to request card');
        printResponse(result);
        return;
      }
      const requestData = result.data as { request?: { status: string; requestId: string; card?: { cardId: string } } };
      success(`Card request: ${requestData.request?.status}`);

      if (requestData.request?.status === 'approved' && requestData.request?.card) {
        lastCardId = requestData.request.card.cardId;
        success(`Auto-approved! Card ID: ${lastCardId}`);
      } else {
        lastRequestId = requestData.request?.requestId ?? null;
        warn(`Request is pending. ID: ${lastRequestId}`);
        return;
      }

      // Step 3: Make a purchase
      info('Step 3: Making a purchase...');
      result = await fetchApi(
        'POST',
        `/v1/cards/${lastCardId}/transactions/purchases`,
        { amount: 75.50, merchant: 'Coffee Shop', category: 'food' },
        { 'Idempotency-Key': generateIdempotencyKey() }
      );
      if (result.status !== 201) {
        error('Failed to make purchase');
        printResponse(result);
        return;
      }
      success('Purchase completed');

      // Step 4: Make a payment
      info('Step 4: Making a payment...');
      result = await fetchApi(
        'POST',
        `/v1/cards/${lastCardId}/transactions/payments`,
        { amount: 75.50 },
        { 'Idempotency-Key': generateIdempotencyKey() }
      );
      if (result.status !== 201) {
        error('Failed to make payment');
        printResponse(result);
        return;
      }
      const paymentData = result.data as { transaction?: { paymentStatus: string }; scoreImpact?: number };
      success(`Payment completed: ${paymentData.transaction?.paymentStatus}, Score impact: ${paymentData.scoreImpact ?? 0}`);

      // Step 5: Check final state
      info('Step 5: Final dashboard...');
      result = await fetchApi('GET', '/v1/dashboard');
      printResponse(result);

      success('User journey completed!');
    },
  },
  '41': {
    name: '🔄 Admin Review Flow (low score user)',
    category: 'Scenarios',
    fn: async () => {
      header('Admin Review Flow - Pending Request');
      const originalUser = currentUser;

      // Step 1: Switch to low-score user
      currentUser = `low-score-user-${Date.now()}`;
      info(`Step 1: Using new low-score user: ${currentUser}`);

      // Step 2: Request a card (should go pending)
      info('Step 2: Requesting card (should go pending)...');
      let result = await fetchApi(
        'POST',
        '/v1/cards/requests',
        { productId: 'prod-standard' },
        { 'Idempotency-Key': generateIdempotencyKey() }
      );
      const requestData = result.data as { request?: { status: string; requestId: string } };

      if (requestData.request?.status === 'pending') {
        success(`Request is pending as expected. ID: ${requestData.request.requestId}`);
        lastRequestId = requestData.request.requestId;
      } else if (requestData.request?.status === 'approved') {
        warn('Request was auto-approved (user score may be high)');
        currentUser = originalUser;
        return;
      } else {
        error('Unexpected status');
        printResponse(result);
        currentUser = originalUser;
        return;
      }

      // Step 3: Admin lists pending requests
      info('Step 3: Admin listing pending requests...');
      currentRole = 'admin';
      result = await fetchApi('GET', '/v1/admin/card-requests');
      success('Pending requests retrieved');
      const pendingData = result.data as { requests?: Array<{ requestId: string }> };
      console.log(`Found ${pendingData.requests?.length ?? 0} pending requests`);

      // Step 4: Admin approves the request
      if (lastRequestId) {
        info('Step 4: Admin approving request...');
        result = await fetchApi(
          'POST',
          `/v1/admin/card-requests/${lastRequestId}/approve`,
          { creditLimit: 1500, reason: 'Approved in admin review flow' }
        );
        if (result.status === 200) {
          const approveData = result.data as { card?: { cardId: string } };
          success(`Request approved! Card ID: ${approveData.card?.cardId}`);
          lastCardId = approveData.card?.cardId ?? null;
        } else {
          error('Failed to approve');
          printResponse(result);
        }
      }

      currentRole = 'user';
      currentUser = originalUser;
      success('Admin review flow completed!');
    },
  },

  // Configuration
  '50': {
    name: 'Switch User',
    category: 'Config',
    fn: async () => {
      info(`Current user: ${currentUser}`);
      info('Use "user <name>" command to switch');
    },
  },
  '51': {
    name: 'Show Current Context',
    category: 'Config',
    fn: async () => {
      console.log(`\n${c.bold}Current Context:${c.reset}`);
      console.log(`  Auth Mode: ${authMode === 'emulator' ? c.green + 'emulator (Firebase token)' : c.yellow + 'mock (test tokens)'}${c.reset}`);
      console.log(`  User: ${c.cyan}${currentUser}${c.reset}`);
      console.log(`  Role: ${c.cyan}${currentRole}${c.reset}`);
      console.log(`  API:  ${c.cyan}${BASE_URL}${c.reset}`);
      console.log(`  Card: ${lastCardId ? c.green + lastCardId : c.dim + 'none'}${c.reset}`);
      console.log(`  Request: ${lastRequestId ? c.green + lastRequestId : c.dim + 'none'}${c.reset}`);
      if (customToken) {
        const decoded = decodeJwtPayload(customToken);
        if (decoded) {
          console.log(`  Token Email: ${c.cyan}${decoded.email ?? 'unknown'}${c.reset}`);
          console.log(`  Token UID: ${c.cyan}${decoded.user_id ?? decoded.sub ?? 'unknown'}${c.reset}`);
        }
      }
    },
  },
  '52': {
    name: 'Set Auth Token (emulator)',
    category: 'Config',
    fn: async () => {
      info('Use "token <jwt>" command to set a Firebase emulator token');
      info('Example: token eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0...');
      info('Or run: AUTH_TOKEN=<token> bun run cli');
    },
  },
  '53': {
    name: 'Clear Token (use mock)',
    category: 'Config',
    fn: async () => {
      customToken = null;
      authMode = 'mock';
      success('Cleared custom token, using mock auth mode');
    },
  },
};

function printMenu() {
  console.clear();
  console.log(`${c.bgGreen}${c.white}${c.bold} 🏦 Headless Financial API - Interactive Test CLI ${c.reset}`);
  const modeStr = authMode === 'emulator' ? `${c.green}emulator${c.reset}` : `${c.yellow}mock${c.reset}`;
  console.log(`${c.dim}API: ${BASE_URL} | User: ${currentUser} | Role: ${currentRole} | Auth: ${c.reset}${modeStr}\n`);

  const categories = ['Health', 'User', 'Admin', 'Tests', 'Scenarios', 'Config'];

  for (const category of categories) {
    console.log(`${c.bold}${c.yellow}${category}${c.reset}`);
    for (const [key, action] of Object.entries(actions)) {
      if (action.category === category) {
        console.log(`  ${c.cyan}[${key}]${c.reset} ${action.name}`);
      }
    }
    console.log();
  }

  console.log(`${c.dim}[q] Quit  [m] Menu  [h] Help${c.reset}\n`);
}

async function main() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const prompt = () => {
    rl.question(`${c.bold}>${c.reset} `, async (answer) => {
      const trimmed = answer.trim().toLowerCase();

      if (trimmed === 'q' || trimmed === 'quit' || trimmed === 'exit') {
        console.log('\nGoodbye! 👋');
        rl.close();
        process.exit(0);
      }

      if (trimmed === 'm' || trimmed === 'menu') {
        printMenu();
        prompt();
        return;
      }

      if (trimmed === 'h' || trimmed === 'help') {
        console.log(`\n${c.bold}Commands:${c.reset}`);
        console.log('  Number keys - Execute action from menu');
        console.log('  m/menu     - Show menu');
        console.log('  q/quit     - Exit');
        console.log('  user <name> - Switch to user');
        console.log('  admin      - Toggle admin mode');
        console.log('  token <jwt> - Set Firebase emulator token');
        console.log('  mock       - Switch back to mock auth mode');
        console.log();
        prompt();
        return;
      }

      if (trimmed.startsWith('user ')) {
        currentUser = trimmed.slice(5).trim() || 'test-user';
        success(`Switched to user: ${currentUser}`);
        prompt();
        return;
      }

      if (trimmed.startsWith('token ')) {
        const token = answer.trim().slice(6).trim(); // Preserve case for JWT
        if (!token) {
          warn('Usage: token <jwt>');
          prompt();
          return;
        }
        customToken = token;
        authMode = 'emulator';
        const decoded = decodeJwtPayload(token);
        if (decoded) {
          currentUser = (decoded.user_id as string) ?? (decoded.sub as string) ?? 'emulator-user';
          success(`Token set! Email: ${decoded.email ?? 'unknown'}, UID: ${currentUser}`);
        } else {
          success('Token set (could not decode payload)');
        }
        prompt();
        return;
      }

      if (trimmed === 'mock') {
        customToken = null;
        authMode = 'mock';
        success('Switched to mock auth mode');
        prompt();
        return;
      }

      if (trimmed === 'admin') {
        currentRole = currentRole === 'admin' ? 'user' : 'admin';
        info(`Role toggled to: ${currentRole}`);
        prompt();
        return;
      }

      const action = actions[trimmed];
      if (action) {
        divider();
        console.log(`${c.bold}${action.name}${c.reset}`);
        divider();
        try {
          await action.fn();
        } catch (err) {
          error(`Error: ${(err as Error).message}`);
        }
      } else if (trimmed) {
        warn(`Unknown command: ${trimmed}. Type 'm' for menu.`);
      }

      prompt();
    });
  };

  printMenu();
  prompt();
}

main().catch(console.error);
