/**
 * Firestore Client
 *
 * Initializes and exports Firestore database instance.
 * Supports both production and emulator environments.
 */

import {
  initializeApp,
  cert,
  getApps,
  deleteApp,
  type App,
  type AppOptions,
} from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';

let app: App | undefined;
let db: Firestore | undefined;
let settingsApplied = false;

/**
 * Firestore client configuration
 */
export interface FirestoreConfig {
  projectId?: string | undefined;
  emulatorHost?: string | undefined;
  serviceAccountPath?: string | undefined;
}

/**
 * Initialize Firestore client
 */
export function initializeFirestore(config?: FirestoreConfig): Firestore {
  if (db !== undefined) {
    return db;
  }

  // Check if already initialized
  if (getApps().length === 0) {
    if (config?.serviceAccountPath !== undefined) {
      // Production with service account
      const appOptions: AppOptions = {
        credential: cert(config.serviceAccountPath),
      };
      if (config.projectId !== undefined) {
        appOptions.projectId = config.projectId;
      }
      app = initializeApp(appOptions);
    } else if (config?.projectId !== undefined) {
      // Emulator or default credentials
      app = initializeApp({
        projectId: config.projectId,
      });
    } else {
      // Default initialization (uses GOOGLE_APPLICATION_CREDENTIALS)
      app = initializeApp();
    }
  } else {
    app = getApps()[0];
  }

  db = getFirestore(app!);

  // Configure emulator if specified (only once)
  if (!settingsApplied) {
    const emulatorHost = config?.emulatorHost ?? process.env.FIRESTORE_EMULATOR_HOST;
    if (emulatorHost !== undefined) {
      const [host, portStr] = emulatorHost.split(':');
      const port = parseInt(portStr ?? '8080', 10);
      db.settings({
        host: `${host}:${port}`,
        ssl: false,
      });
      settingsApplied = true;
    }
  }

  return db;
}

/**
 * Get the Firestore instance (must be initialized first)
 */
export function getFirestoreDb(): Firestore {
  if (db === undefined) {
    throw new Error('Firestore not initialized. Call initializeFirestore() first.');
  }
  return db;
}

/**
 * Reset Firestore instance (for testing)
 * Note: Due to Firebase Admin SDK limitations, this only clears local references.
 * The Firestore connection persists for the process lifetime.
 */
export async function resetFirestore(): Promise<void> {
  if (app !== undefined) {
    try {
      await deleteApp(app);
    } catch {
      // App may already be deleted or in inconsistent state
    }
  }
  db = undefined;
  app = undefined;
  // Note: settingsApplied is NOT reset because Firestore instance persists
}

/**
 * Firestore collection paths
 */
export const CollectionPaths = {
  USERS: 'users',
  CARDS: (ecosystemId: string) => `users/${ecosystemId}/cards`,
  CARD_REQUESTS: (ecosystemId: string) => `users/${ecosystemId}/cardRequests`,
  TRANSACTIONS: (ecosystemId: string, cardId: string) =>
    `users/${ecosystemId}/cards/${cardId}/transactions`,
  SCORES: (ecosystemId: string) => `users/${ecosystemId}/scores`,
  IDEMPOTENCY_KEYS: (ecosystemId: string) => `users/${ecosystemId}/idempotencyKeys`,
  OUTBOX: 'outbox',
  OUTBOX_SEQUENCES: 'outboxSequences',
  AUDIT_LOGS: 'auditLogs',
} as const;

/**
 * Convert Firestore Timestamp to Date
 */
export function timestampToDate(timestamp: unknown): Date {
  if (timestamp === null || timestamp === undefined) {
    return new Date();
  }
  if (timestamp instanceof Date) {
    return timestamp;
  }
  if (typeof timestamp === 'object' && 'toDate' in timestamp) {
    return (timestamp as { toDate: () => Date }).toDate();
  }
  return new Date();
}

/**
 * Convert Date to Firestore-safe format
 */
export function dateToTimestamp(date: Date): Date {
  return date;
}
