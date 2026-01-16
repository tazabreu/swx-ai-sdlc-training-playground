#!/usr/bin/env bun
/**
 * Enhanced dev server startup with health checks and logging
 */

const mode = process.argv[2] ?? 'in-memory';

const modes = {
  'in-memory': {
    name: 'In-Memory Mode',
    env: { USE_INMEMORY: 'true' },
    checks: [],
  },
  emulator: {
    name: 'Firebase Emulator Mode',
    env: {
      FIRESTORE_EMULATOR_HOST: 'localhost:8080',
      FIREBASE_AUTH_EMULATOR_HOST: 'localhost:9099',
    },
    checks: [
      { name: 'Firestore Emulator', url: 'http://localhost:8080' },
      { name: 'Auth Emulator', url: 'http://localhost:9099' },
      { name: 'Emulator UI', url: 'http://localhost:4000' },
    ],
  },
  cloud: {
    name: 'Production Firebase Mode',
    env: {},
    checks: [],
  },
  aws: {
    name: 'AWS LocalStack Mode',
    env: {
      USE_AWS: 'true',
      AWS_ENDPOINT_URL: 'http://localhost:4566',
      AWS_REGION: 'us-east-1',
      AWS_ACCESS_KEY_ID: 'test',
      AWS_SECRET_ACCESS_KEY: 'test',
      COGNITO_USER_POOL_ID: 'us-east-1_localstack',
      COGNITO_CLIENT_ID: 'localstack-client-id',
    },
    checks: [
      { name: 'LocalStack', url: 'http://localhost:4566/_localstack/health' },
    ],
  },
} as const;

type Mode = keyof typeof modes;

if (!(mode in modes)) {
  console.error(`❌ Invalid mode: ${mode}`);
  console.error(`   Valid modes: ${Object.keys(modes).join(', ')}`);
  process.exit(1);
}

const config = modes[mode as Mode];

// Banner
console.log('\n🚀 ACME Financial API');
console.log('━'.repeat(60));
console.log(`Mode: ${config.name}`);
console.log('━'.repeat(60));

// Environment variables
if (Object.keys(config.env).length > 0) {
  console.log('\n📋 Environment Variables:');
  for (const [key, value] of Object.entries(config.env)) {
    console.log(`   ${key}=${value}`);
    process.env[key] = value;
  }
}

// Health checks
if (config.checks.length > 0) {
  console.log('\n🔍 Checking dependencies...');

  let allHealthy = true;

  for (const check of config.checks) {
    try {
      const response = await fetch(check.url, {
        method: 'GET',
        signal: AbortSignal.timeout(2000),
      });

      if (response.ok || response.status === 400) {
        // 400 is ok for emulators (they just need to be running)
        console.log(`   ✅ ${check.name} (${check.url})`);
      } else {
        console.log(`   ⚠️  ${check.name} returned status ${response.status}`);
        allHealthy = false;
      }
    } catch (error) {
      console.log(`   ❌ ${check.name} - NOT RUNNING`);
      console.log(`      ${check.url}`);
      allHealthy = false;
    }
  }

  if (!allHealthy) {
    console.log('\n⚠️  Some dependencies are not running!');
    if (mode === 'emulator') {
      console.log('\n💡 To start emulators:');
      console.log('   bun run emulator:start');
      console.log('   docker ps  # Check status');
    } else if (mode === 'aws') {
      console.log('\n💡 To start LocalStack:');
      console.log('   bun run emulator:start:aws');
      console.log('   docker ps  # Check status');
    }
    console.log('\n❓ Continue anyway? (Ctrl+C to abort)');
    await new Promise(resolve => setTimeout(resolve, 3000));
  }
}

// Configuration summary
console.log('\n⚙️  Configuration:');
const authProvider = mode === 'in-memory' ? 'MockAuthProvider' : mode === 'aws' ? 'CognitoAuthProvider' : 'FirebaseAuthProvider';
const dataStorage = mode === 'in-memory' ? 'In-Memory Maps' : mode === 'emulator' ? 'Firestore Emulator' : mode === 'aws' ? 'DynamoDB (LocalStack)' : 'Production Firestore';
const tokenFormat = mode === 'in-memory' ? 'mock.* tokens' : mode === 'aws' ? 'Cognito JWT tokens' : 'Firebase JWT tokens';
console.log(`   Auth Provider: ${authProvider}`);
console.log(`   Data Storage: ${dataStorage}`);
console.log(`   Token Format: ${tokenFormat}`);

// Start server
console.log('\n🌐 Starting server...');
console.log('━'.repeat(60));

const proc = Bun.spawn(['bun', 'run', '--watch', 'src/functions/http.ts'], {
  env: { ...process.env, ...config.env },
  stdio: ['inherit', 'inherit', 'inherit'],
});

// Handle shutdown
process.on('SIGINT', () => {
  console.log('\n\n👋 Shutting down gracefully...');
  proc.kill();
  process.exit(0);
});

await proc.exited;
