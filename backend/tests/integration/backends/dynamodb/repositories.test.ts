/**
 * DynamoDB Backend Integration Tests
 *
 * Tests all repository implementations using LocalStack DynamoDB.
 * Requires: AWS_ENDPOINT_URL=http://localhost:4566 AWS_REGION=us-east-1
 *
 * These tests run against LocalStack and verify AWS DynamoDB
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

// Skip tests if LocalStack is not available
const describeDynamoDB = isBackendAvailable('dynamodb') ? describe : describe.skip;

describeDynamoDB('DynamoDB Backend Integration Tests', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestContext('dynamodb');
  });

  afterAll(async () => {
    // DynamoDB cleanup happens via test isolation (unique IDs)
    // or LocalStack reset when needed
  });

  describe('User Repository (DynamoDB)', () => {
    createUserRepositoryTests(() => ctx.repositories.userRepository, 'dynamodb');
  });

  describe('Card Repository (DynamoDB)', () => {
    createCardRepositoryTests(
      () => ctx.repositories.cardRepository,
      () => ctx.repositories.userRepository,
      'dynamodb'
    );
  });

  describe('Card Request Repository (DynamoDB)', () => {
    createCardRequestRepositoryTests(
      () => ctx.repositories.cardRequestRepository,
      () => ctx.repositories.userRepository,
      'dynamodb'
    );
  });

  describe('Transaction Repository (DynamoDB)', () => {
    createTransactionRepositoryTests(
      () => ctx.repositories.transactionRepository,
      () => ctx.repositories.cardRepository,
      () => ctx.repositories.userRepository,
      'dynamodb'
    );
  });
});
