# Quickstart: AWS Mode Development

**Feature**: 002-aws-localstack-infrastructure
**Date**: 2026-01-07

## Prerequisites

- Docker and Docker Compose v2+
- Bun runtime installed
- Project dependencies installed (`bun install`)

## Quick Start (2 minutes)

### 1. Start LocalStack

```bash
bun run emulator:start:aws
```

This starts a LocalStack container with:
- DynamoDB on port 4566
- Cognito on port 4566
- EventBridge on port 4566
- SQS on port 4566
- SSM Parameter Store on port 4566

Wait for initialization (tables, user pools, queues created automatically).

### 2. Start the API

```bash
bun run dev:aws
```

The API starts on `http://localhost:3000` connected to LocalStack.

### 3. Verify

```bash
curl http://localhost:3000/health/liveness
```

Expected response:
```json
{
  "status": "ok",
  "timestamp": "2026-01-07T..."
}
```

## Available Commands

| Command | Description |
|---------|-------------|
| `bun run emulator:start:aws` | Start LocalStack container |
| `bun run emulator:stop:aws` | Stop LocalStack container |
| `bun run emulator:logs:aws` | View LocalStack logs |
| `bun run emulator:reset:aws` | Reset LocalStack (clear all data) |
| `bun run dev:aws` | Start API in AWS mode |
| `bun run test:aws` | Run tests against LocalStack |

## Environment Variables

When running in AWS mode, these environment variables are set automatically:

| Variable | Value | Description |
|----------|-------|-------------|
| `USE_AWS` | `true` | Enable AWS infrastructure |
| `AWS_ENDPOINT_URL` | `http://localhost:4566` | LocalStack endpoint |
| `AWS_REGION` | `us-east-1` | AWS region |
| `AWS_ACCESS_KEY_ID` | `test` | LocalStack credentials |
| `AWS_SECRET_ACCESS_KEY` | `test` | LocalStack credentials |
| `COGNITO_USER_POOL_ID` | `us-east-1_localstack` | Cognito user pool (if Cognito auth is enabled) |
| `COGNITO_CLIENT_ID` | `localstack-client-id` | Cognito client ID (if Cognito auth is enabled) |

## Test Users

AWS mode must not depend on Firebase emulators. For local development (LocalStack endpoint), the Cognito auth provider runs in a dev-only fallback mode (no JWT verification) and accepts the same mock token format used elsewhere in this repo (see `LOCAL_TESTING_GUIDE.md`).

## Switching Between Modes

### Firebase Emulator Mode
```bash
bun run emulator:start     # Start Firebase emulator
bun run dev:emulator       # Start API with Firebase
```

### AWS Mode
```bash
bun run emulator:start:aws # Start LocalStack
bun run dev:aws            # Start API with AWS
```

### In-Memory Mode (fastest for unit tests)
```bash
bun run dev                # Default, no external dependencies
```

## Troubleshooting

### LocalStack not starting

Check if port 4566 is available:
```bash
lsof -i :4566
```

Check Docker is running:
```bash
docker ps
```

### Connection refused errors

Ensure LocalStack is fully initialized:
```bash
bun run emulator:logs:aws
```

Look for "Ready." message before starting the API.

### DynamoDB table not found

Reset LocalStack to recreate all resources:
```bash
bun run emulator:reset:aws
```

### Cognito token verification failing

For local development, token verification uses a simplified flow. Ensure `AWS_ENDPOINT_URL` is set correctly.

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                    Express API                       │
│                  (localhost:3000)                    │
└─────────────────────┬───────────────────────────────┘
                      │
         ┌────────────┴────────────┐
         ▼                         ▼
┌─────────────────┐       ┌─────────────────┐
│  Firebase Mode  │       │    AWS Mode     │
│  (Emulator)     │       │  (LocalStack)   │
├─────────────────┤       ├─────────────────┤
│ Firestore:8080  │       │ DynamoDB        │
│ Auth:9099       │       │ Cognito         │
│ UI:4000         │       │ EventBridge     │
└─────────────────┘       │ SQS             │
                          │ SSM             │
                          │ (all on :4566)  │
                          └─────────────────┘
```

## Verification Checklist

After setup, verify these work:

- [ ] `curl http://localhost:3000/health/liveness` returns `{ "status": "ok" }`
- [ ] `curl http://localhost:3000/health/readiness` returns `{ "status": "healthy", ... }`
- [ ] Can create a user record: `POST /v1/users` (required before other endpoints)
- [ ] Can load dashboard: `GET /v1/dashboard`
- [ ] Tests pass: `bun run test:aws`

## Next Steps

1. Run the full test suite: `bun run test:aws`
2. Explore the API with the test tokens
3. Review DynamoDB tables in LocalStack: `aws --endpoint-url=http://localhost:4566 dynamodb list-tables`
