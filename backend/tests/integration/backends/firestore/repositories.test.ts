/**
 * Firestore Backend Integration Tests
 *
 * Tests all repository implementations using the Firestore Emulator.
 * Requires: FIRESTORE_EMULATOR_HOST=localhost:8080 GCLOUD_PROJECT=demo-acme
 *
 * These tests run against the Firebase Emulator and verify GCP/Firestore
 * backend behavior matches the expected repository contracts.
 */

import { describe, beforeAll, afterAll } from 'bun:test';
import {
  createTestContext,
  isBackendAvailable,
  type TestContext,
} from '../../../setup/test-container.factory.js';
import {
  createUserRepositoryTests,
  createCardRepositoryTests,
  createCardRequestRepositoryTests,
  createTransactionRepositoryTests,
} from '../../shared/index.js';
import { resetFirestore } from '../../../../src/infrastructure/persistence/firestore/client.js';

// Skip tests if Firestore emulator is not available
const describeFirestore = isBackendAvailable('firestore') ? describe : describe.skip;

describeFirestore('Firestore Backend Integration Tests', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    // Reset Firestore state before tests
    await resetFirestore();
    ctx = await createTestContext('firestore');
  });

  afterAll(async () => {
    // Clean up Firestore connection
    await resetFirestore();
  });

  describe('User Repository (Firestore)', () => {
    createUserRepositoryTests(() => ctx.repositories.userRepository, 'firestore');
  });

  describe('Card Repository (Firestore)', () => {
    createCardRepositoryTests(
      () => ctx.repositories.cardRepository,
      () => ctx.repositories.userRepository,
      'firestore'
    );
  });

  describe('Card Request Repository (Firestore)', () => {
    createCardRequestRepositoryTests(
      () => ctx.repositories.cardRequestRepository,
      () => ctx.repositories.userRepository,
      'firestore'
    );
  });

  describe('Transaction Repository (Firestore)', () => {
    createTransactionRepositoryTests(
      () => ctx.repositories.transactionRepository,
      () => ctx.repositories.cardRepository,
      () => ctx.repositories.userRepository,
      'firestore'
    );
  });
});
