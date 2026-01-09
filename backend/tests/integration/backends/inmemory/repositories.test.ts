/**
 * InMemory Backend Integration Tests
 *
 * Tests all repository implementations using the InMemory backend.
 * These tests run fast without external dependencies.
 */

import { describe, beforeAll, afterAll } from 'bun:test';
import { createTestContext, type TestContext } from '../../../setup/test-container.factory.js';
import {
  createUserRepositoryTests,
  createCardRepositoryTests,
  createCardRequestRepositoryTests,
  createTransactionRepositoryTests,
} from '../../shared/index.js';

describe('InMemory Backend Integration Tests', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestContext('inmemory');
  });

  afterAll(async () => {
    await ctx.cleanup();
  });

  describe('User Repository', () => {
    createUserRepositoryTests(() => ctx.repositories.userRepository, 'inmemory');
  });

  describe('Card Repository', () => {
    createCardRepositoryTests(
      () => ctx.repositories.cardRepository,
      () => ctx.repositories.userRepository,
      'inmemory'
    );
  });

  describe('Card Request Repository', () => {
    createCardRequestRepositoryTests(
      () => ctx.repositories.cardRequestRepository,
      () => ctx.repositories.userRepository,
      'inmemory'
    );
  });

  describe('Transaction Repository', () => {
    createTransactionRepositoryTests(
      () => ctx.repositories.transactionRepository,
      () => ctx.repositories.cardRepository,
      () => ctx.repositories.userRepository,
      'inmemory'
    );
  });
});
