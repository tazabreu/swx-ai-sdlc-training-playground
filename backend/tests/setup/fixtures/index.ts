/**
 * Test Fixtures Index
 *
 * Central export for all test fixtures used across integration tests.
 */

// User fixtures
export { createTestUser, userFixtures, type UserFixtureOptions } from './user.fixtures.js';

// Card fixtures
export { createTestCard, cardFixtures, type CardFixtureOptions } from './card.fixtures.js';

// Card request fixtures
export {
  createTestCardRequest,
  cardRequestFixtures,
  type CardRequestFixtureOptions,
} from './card-request.fixtures.js';

// Transaction fixtures
export {
  createTestPurchase,
  createTestPayment,
  createTestFailedTransaction,
  transactionFixtures,
  generateTransactionHistory,
  type PurchaseFixtureOptions,
  type PaymentFixtureOptions,
  type FailedTransactionOptions,
} from './transaction.fixtures.js';
