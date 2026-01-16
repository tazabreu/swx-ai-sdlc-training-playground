# tazco-sample-financial-ecosystem-product

Financial ecosystem playground: a Cards-domain backend API (credit scoring, card requests/approvals, purchase/payment simulation) plus a Next.js frontend.

Monorepo layout:
- `backend/` (Express API; local dev on `http://localhost:3000`)
- `frontend/` (Next.js app; local dev on `http://localhost:3001`)

## Specs

- `specs/001-headless-financial-api/spec.md`
- `specs/001-headless-financial-api/contracts/openapi.yaml` (contract source; enforced by `backend/tests/contract`)
- `specs/001-headless-financial-api/tasks.md`
- `specs/002-aws-localstack-infrastructure/spec.md`

## Local Development

```bash
# Install dependencies
bun install

# Full stack (recommended): backend in-memory + frontend
bun run dev:in-memory

# Backend only (defaults to AWS/LocalStack mode)
bun run dev:backend

# Frontend only
bun run dev:frontend
```

## Environment Files

- `.env.example`: complete inventory of env vars used by backend/frontend (placeholders only)

For local dev, scripts set the important env vars inline (e.g. `USE_INMEMORY=true USE_AWS=false PORT=3000`).

## Firebase Emulators (optional)

```bash
cd backend

# Start Firestore/Auth emulators via Docker
bun run emulator:start

# Run tests against the Firestore emulator
bun run test:integration:firestore

# Stop emulators
bun run emulator:stop
```

## AWS LocalStack (optional)

```bash
cd backend

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

