/**
 * Provider Selection Configuration
 *
 * This module determines which implementations to use based on environment variables.
 * - USE_INMEMORY=true  → InMemory providers (testing/development)
 * - USE_INMEMORY=false → Firestore providers (production)
 */

export interface ProviderConfig {
  useInMemory: boolean;
  firebaseProjectId: string;
  environment: 'development' | 'test' | 'production';
}

/**
 * Get the current provider configuration from environment variables
 */
export function getProviderConfig(): ProviderConfig {
  const useInMemory = process.env.USE_INMEMORY !== 'false';
  const firebaseProjectId = process.env.FIREBASE_PROJECT_ID ?? 'tazco-financial-dev';
  const nodeEnv = process.env.NODE_ENV ?? 'development';

  let environment: 'development' | 'test' | 'production';
  switch (nodeEnv) {
    case 'production':
      environment = 'production';
      break;
    case 'test':
      environment = 'test';
      break;
    default:
      environment = 'development';
  }

  return {
    useInMemory,
    firebaseProjectId,
    environment,
  };
}

/**
 * Check if we should use InMemory providers
 */
export function shouldUseInMemory(): boolean {
  return getProviderConfig().useInMemory;
}
