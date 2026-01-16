#!/usr/bin/env bun
/**
 * Generate Firebase Auth token from emulator
 *
 * Usage:
 *   bun run scripts/get-emulator-token.ts [email] [uid] [role]
 *   bun run scripts/get-emulator-token.ts user@example.com user-123
 *   bun run scripts/get-emulator-token.ts admin@example.com admin-001 admin
 *
 * Requires:
 *   FIREBASE_AUTH_EMULATOR_HOST=localhost:9099
 *   GCLOUD_PROJECT=demo-acme
 */

import { initializeApp, getApps } from 'firebase-admin/app';
import { getAuth, type Auth, type UserRecord } from 'firebase-admin/auth';

const EMULATOR_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST ?? 'localhost:9099';
const PROJECT_ID = process.env.GCLOUD_PROJECT ?? 'demo-acme';

// Ensure Firebase Admin SDK uses the emulator (must be set before initialization)
process.env.FIREBASE_AUTH_EMULATOR_HOST = EMULATOR_HOST;

interface SignInResponse {
  idToken: string;
  email: string;
  refreshToken: string;
  expiresIn: string;
  localId: string;
}

function initializeFirebaseAdmin(): Auth {
  if (getApps().length === 0) {
    initializeApp({
      projectId: PROJECT_ID,
    });
  }
  return getAuth();
}

async function createUser(email: string, uid?: string): Promise<UserRecord> {
  const auth = initializeFirebaseAdmin();

  try {
    return await auth.createUser({
      uid,
      email,
      password: 'password123',
    });
  } catch (error: unknown) {
    const firebaseError = error as { code?: string };
    if (
      firebaseError.code === 'auth/uid-already-exists' ||
      firebaseError.code === 'auth/email-already-exists'
    ) {
      if (uid) {
        return await auth.getUser(uid);
      }
      return await auth.getUserByEmail(email);
    }
    throw error;
  }
}

async function signIn(email: string, password: string): Promise<SignInResponse> {
  const url = `http://${EMULATOR_HOST}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=fake-api-key`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email,
      password,
      returnSecureToken: true,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to sign in: ${error}`);
  }

  return response.json() as Promise<SignInResponse>;
}

async function setCustomClaims(uid: string, claims: Record<string, unknown>): Promise<void> {
  const auth = initializeFirebaseAdmin();
  await auth.setCustomUserClaims(uid, claims);
}

async function main() {
  const email = process.argv[2] ?? 'user@example.com';
  const uid = process.argv[3];
  const role = process.argv[4] ?? 'user';

  console.log('🔥 Firebase Auth Emulator Token Generator');
  console.log('=========================================');
  console.log(`Emulator: ${EMULATOR_HOST}`);
  console.log(`Project: ${PROJECT_ID}`);
  console.log('');

  try {
    // Create or get existing user using Firebase Admin SDK
    console.log(`Creating user: ${email}${uid ? ` (uid: ${uid})` : ''}...`);
    const userRecord = await createUser(email, uid);
    console.log(`✅ User ready with UID: ${userRecord.uid}`);

    // Set custom claims using Firebase Admin SDK
    console.log(`Setting custom claims (role: ${role})...`);
    await setCustomClaims(userRecord.uid, {
      role,
      ecosystemId: uid ?? userRecord.uid,
    });
    console.log('✅ Custom claims set');

    // Sign in to get token (uses REST API which works correctly)
    console.log('Signing in to get token...');
    const signInResponse = await signIn(email, 'password123');
    console.log('✅ Token generated');
    console.log('');

    console.log('📋 Token Details:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`UID:         ${signInResponse.localId}`);
    console.log(`Email:       ${signInResponse.email}`);
    console.log(`Role:        ${role}`);
    console.log(`Expires In:  ${signInResponse.expiresIn}s`);
    console.log('');
    console.log('🎫 ID Token:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(signInResponse.idToken);
    console.log('');
    console.log('💡 Usage:');
    console.log(`export TOKEN="${signInResponse.idToken}"`);
    console.log(
      'curl -X POST http://localhost:3000/v1/users -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d \'{}\' | jq .'
    );
    console.log(
      'curl http://localhost:3000/v1/dashboard -H "Authorization: Bearer $TOKEN" | jq .'
    );
    console.log('');

  } catch (error) {
    console.error('❌ Error:', (error as Error).message);
    process.exit(1);
  }
}

main();
