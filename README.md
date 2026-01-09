# tazco-sample-financial-ecosystem-product

Headless Financial API (Cards-domain) for testing and verification: credit scoring, card requests/approvals, and purchase/payment simulation.

## Specs

- `specs/001-headless-financial-api/spec.md`
- `specs/001-headless-financial-api/contracts/openapi.yaml`
- `specs/001-headless-financial-api/tasks.md`

## Local Development

```bash
# Install
bun install

# Run API locally (in-memory providers)
bun run dev

# Full local validation (typecheck + lint + tests)
make validate
```

## Emulators (optional)

```bash
# Start Firestore/Auth emulators via Docker
bun run emulator:start

# Run tests against Firestore emulator
bun run test:firestore

# Stop emulators
bun run emulator:stop
```

## AWS LocalStack (optional)

```bash
# Start LocalStack (DynamoDB/Cognito/EventBridge/SQS/SSM)
bun run emulator:start:aws

# Run API against LocalStack
bun run dev:aws

# Run tests against LocalStack
bun run test:aws

# Stop LocalStack
bun run emulator:stop:aws
```

## Testing

This repo uses Bun’s test runner (`bun:test`) via `bun test` (not Jest).

