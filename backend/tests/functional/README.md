# Functional Tests

This directory contains end-to-end functional tests that exercise complete user journeys through the Financial API. These tests complement the unit and integration tests by validating that the full system works correctly when all components are wired together.

## Test Categories

### Unit Tests (`tests/unit/`)
- Test individual components in isolation
- Mock all external dependencies
- Fast execution (< 1ms per test)
- Focus: correctness of individual functions and classes

### Integration Tests (`tests/integration/`)
- Test component interactions with external systems
- Use Firestore emulator for database operations
- Medium execution time (< 1s per test)
- Focus: data persistence, container wiring

### Contract Tests (`tests/contract/`)
- Test API endpoint contracts
- Validate request/response schemas
- Use mock repositories (InMemory)
- Focus: HTTP layer, DTOs, error responses

### Functional Tests (`tests/functional/`) - THIS DIRECTORY
- Test complete user journeys end-to-end
- Exercise the full flow from HTTP request to database to response
- Use InMemory repositories for isolation and speed
- Focus: business flows work correctly when everything is wired together

## Functional Test Flows

The functional tests cover these complete user journeys:

### 1. Card Request Flow (`card-request-flow.test.ts`)
- User authenticates
- User requests a credit card
- System scores user and determines tier
- Card is auto-approved (high tier) or queued for admin (low/medium tier)
- User can view their card status

### 2. Card Approval Flow (`card-approval-flow.test.ts`)
- Admin views pending card requests
- Admin approves or rejects cards
- User receives notification of decision
- User can view their approved/rejected card

### 3. Transaction Flow (`transaction-flow.test.ts`)
- User with active card makes a purchase
- Purchase reduces available credit
- User makes a payment
- Payment increases available credit and affects score
- Complete purchase-payment cycle

### 4. WhatsApp Approval Flow (`whatsapp-approval-flow.test.ts`)
- Card request triggers WhatsApp notification
- Admin replies with "APROVAR {ID}" or "REJEITAR {ID}"
- System processes webhook and updates card status

## Running Functional Tests

```bash
# Run all functional tests
bun test tests/functional

# Run specific flow
bun test tests/functional/card-request-flow.test.ts

# Run with watch mode
bun test tests/functional --watch
```

## Test Requirements

### Prerequisites
- No external services required (uses InMemory repositories)
- No Firestore emulator needed
- Fast execution (< 100ms per test)

### Test Utilities
- `TestHarness` - Creates isolated test containers
- `cleanup()` - Resets all repositories between tests
- `authenticate()` - Simulates user authentication
- `asAdmin()` - Simulates admin authentication

## Design Principles

1. **Isolation**: Each test starts with a clean slate
2. **Complete Flows**: Tests exercise full user journeys, not partial flows
3. **Realistic Scenarios**: Use realistic data and sequences
4. **Self-Documenting**: Test names describe the business flow being tested
5. **Fast Feedback**: All tests complete in seconds, not minutes

## Adding New Functional Tests

When adding new functional tests:

1. Create a new file: `{flow-name}-flow.test.ts`
2. Import `TestHarness` from `./test-harness`
3. Use `beforeEach` to call `harness.cleanup()`
4. Write tests that exercise complete flows
5. Verify both success and failure paths

Example structure:
```typescript
import { describe, it, expect, beforeEach } from 'bun:test';
import { TestHarness } from './test-harness';

describe('My Flow', () => {
  const harness = new TestHarness();

  beforeEach(() => {
    harness.cleanup();
  });

  it('should complete the happy path', async () => {
    // Arrange: setup initial state
    // Act: execute the flow
    // Assert: verify outcomes
  });
});
```
