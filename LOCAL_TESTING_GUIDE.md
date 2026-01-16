# Local Testing Guide

Run and validate the Financial API locally with minimal setup.

## Quick Start (In-Memory)

```bash
bun install
bun run dev
```

In another terminal:
```bash
./test-local-api.sh
```

Server runs at `http://localhost:3000`.

## Auth Tokens (Mock)

Mock tokens follow: `mock.<base64_json>.signature`

```bash
# Create a user token (ecosystemId: user-123)
export USER_TOKEN="mock.$(echo -n '{"ecosystemId":"user-123","role":"user"}' | base64).sig"

# Create an admin token (ecosystemId: admin-001)
export ADMIN_TOKEN="mock.$(echo -n '{"ecosystemId":"admin-001","role":"admin"}' | base64).sig"
```

Pre-made tokens:
```bash
export USER_TOKEN="mock.eyJlY29zeXN0ZW1JZCI6InVzZXItMTIzIiwicm9sZSI6InVzZXIifQ.sig"
export ADMIN_TOKEN="mock.eyJlY29zeXN0ZW1JZCI6ImFkbWluLTAwMSIsInJvbGUiOiJhZG1pbiJ9.sig"
```

## Create Users (Required)

You must create the user record explicitly before using other endpoints.

```bash
USER_CREATE=$(curl -X POST http://localhost:3000/v1/users \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}' | jq .)
echo "$USER_CREATE" | jq '.user | {ecosystemId, role, email, createdAt}'
export USER_ID=$(echo "$USER_CREATE" | jq -r '.user.ecosystemId')

ADMIN_CREATE=$(curl -X POST http://localhost:3000/v1/users \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}' | jq .)
echo "$ADMIN_CREATE" | jq '.user | {ecosystemId, role, email, createdAt}'
export ADMIN_ID=$(echo "$ADMIN_CREATE" | jq -r '.user.ecosystemId')
```

Notes:
- Idempotent: response includes `created: true|false`.
- Server uses token claims for `ecosystemId`, `role`, `email`. If the token has no email, pass one in the JSON body.

## Core Flow (User)

```bash
# Health check
curl http://localhost:3000/health/liveness | jq .

# Dashboard (after user creation)
curl http://localhost:3000/v1/dashboard \
  -H "Authorization: Bearer $USER_TOKEN" | jq .

# Offers
curl http://localhost:3000/v1/offers \
  -H "Authorization: Bearer $USER_TOKEN" | jq .

# Request a card (Idempotency-Key header required)
CARD_REQUEST=$(curl -X POST http://localhost:3000/v1/cards/requests \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H "Idempotency-Key: req-001" \
  -H "Content-Type: application/json" \
  -d '{"productId": "default-credit-card"}' | jq .)
echo "$CARD_REQUEST" | jq '.request | {requestId, status, cardId: (.card.cardId // null)}'
export REQUEST_ID=$(echo "$CARD_REQUEST" | jq -r '.request.requestId')
export CARD_ID=$(echo "$CARD_REQUEST" | jq -r '.request.card.cardId // empty')

# If CARD_ID is empty, request is pending; use Admin Flow to approve/reject.

# List cards
curl http://localhost:3000/v1/cards \
  -H "Authorization: Bearer $USER_TOKEN" | jq .

# Purchase
curl -X POST http://localhost:3000/v1/cards/$CARD_ID/transactions/purchases \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H "Idempotency-Key: purchase-001" \
  -H "Content-Type: application/json" \
  -d '{"amount": 150, "merchant": "Amazon", "category": "shopping"}' | jq .

# Payment
curl -X POST http://localhost:3000/v1/cards/$CARD_ID/transactions/payments \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H "Idempotency-Key: payment-001" \
  -H "Content-Type: application/json" \
  -d '{"amount": 100, "source": "bank"}' | jq .

# Transaction history
curl http://localhost:3000/v1/cards/$CARD_ID/transactions \
  -H "Authorization: Bearer $USER_TOKEN" | jq .
```

## Admin Flow

```bash
# List pending requests
PENDING=$(curl http://localhost:3000/v1/admin/card-requests \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq .)
echo "$PENDING" | jq '.requests | map({requestId, userId: .user.ecosystemId, status})'
export REQ_ID=$(echo "$PENDING" | jq -r '.requests[0].requestId // empty')
# If you just created a request above, you can use REQUEST_ID instead of REQ_ID.

# Approve request (Idempotency-Key header required)
curl -X POST http://localhost:3000/v1/admin/card-requests/$REQ_ID/approve \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Idempotency-Key: approve-$REQ_ID" \
  -H "Content-Type: application/json" \
  -d '{"creditLimit": 2000}' | jq .

# Reject request (Idempotency-Key header required)
curl -X POST http://localhost:3000/v1/admin/card-requests/$REQ_ID/reject \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Idempotency-Key: reject-$REQ_ID" \
  -H "Content-Type: application/json" \
  -d '{"reason": "Insufficient documentation"}' | jq .

# View user score
curl http://localhost:3000/v1/admin/users/$USER_ID/score \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq .

# Adjust score (Idempotency-Key header required)
curl -X PATCH http://localhost:3000/v1/admin/users/$USER_ID/score \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Idempotency-Key: score-001" \
  -H "Content-Type: application/json" \
  -d '{"score": 750, "reason": "Manual adjustment"}' | jq .

# Cleanup (two-step confirmation)
CONFIRM=$(curl -X POST http://localhost:3000/v1/admin/cleanup \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}' | jq .)
echo "$CONFIRM" | jq '{message, confirmationToken, expiresAt}'
export CLEANUP_TOKEN=$(echo "$CONFIRM" | jq -r '.confirmationToken')

curl -X POST http://localhost:3000/v1/admin/cleanup \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"confirmationToken\":\"$CLEANUP_TOKEN\"}" | jq .
```

## Emulator Mode (Optional)

```bash
bun run emulator:start
bun run dev:emulator
```

Generate tokens:
```bash
bun run scripts/get-emulator-token.ts user@example.com user-123
bun run scripts/get-emulator-token.ts admin@example.com admin-001 admin
```

Copy the tokens from the output and export them:
```bash
export USER_TOKEN="<token-from-script>"
export ADMIN_TOKEN="<token-from-script>"
```

Auth tokens do not create Firestore users. Create them once per token:

```bash
USER_CREATE=$(curl -X POST http://localhost:3000/v1/users \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}' | jq .)
echo "$USER_CREATE" | jq '.user | {ecosystemId, email}'
export USER_ID=$(echo "$USER_CREATE" | jq -r '.user.ecosystemId')

ADMIN_CREATE=$(curl -X POST http://localhost:3000/v1/users \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}' | jq .)
echo "$ADMIN_CREATE" | jq '.user | {ecosystemId, email}'
export ADMIN_ID=$(echo "$ADMIN_CREATE" | jq -r '.user.ecosystemId')
```

Then follow the same Core Flow and Admin Flow sections above.

## AWS LocalStack Mode

LocalStack provides local AWS services (DynamoDB, Cognito, EventBridge, SQS, SSM) for development.

### Start LocalStack

```bash
bun run emulator:start:aws
# Wait ~30 seconds for initialization
docker ps  # Should show acme-localstack as healthy
```

### Start Server in AWS Mode

```bash
bun run dev:aws
```

### Auth Tokens (AWS/LocalStack)

When running with `AWS_ENDPOINT_URL` set (LocalStack), the auth provider runs in a dev-only fallback mode (no JWT verification). You can use the same mock token format as in-memory mode:

```bash
export USER_TOKEN="mock.$(echo -n '{\"ecosystemId\":\"user-001\",\"role\":\"user\"}' | base64).sig"
export ADMIN_TOKEN="mock.$(echo -n '{\"ecosystemId\":\"admin-001\",\"role\":\"admin\"}' | base64).sig"
export USER_ID="user-001"
export ADMIN_ID="admin-001"
```

LocalStack also creates Cognito test users during initialization (not required for the fallback token flow):
- `admin@test.com` (password: `Password123!`, role: admin, ecosystemId: admin-001)
- `user@test.com` (password: `Password123!`, role: user, ecosystemId: user-001)

### Create Users (Required)

Same as other modes - create user records before using other endpoints:

```bash
USER_CREATE=$(curl -X POST http://localhost:3000/v1/users \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}' | jq .)
echo "$USER_CREATE" | jq '.user | {ecosystemId, role, email, createdAt}'

ADMIN_CREATE=$(curl -X POST http://localhost:3000/v1/users \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}' | jq .)
echo "$ADMIN_CREATE" | jq '.user | {ecosystemId, role, email, createdAt}'
```

Then follow the same **Core Flow** and **Admin Flow** sections above.

### View Data in LocalStack

#### Option 1: AWS CLI (requires aws-cli installed)

```bash
# List all DynamoDB tables
AWS_ACCESS_KEY_ID=test AWS_SECRET_ACCESS_KEY=test \
  aws dynamodb list-tables --endpoint-url http://localhost:4566 --region us-east-1

# Scan a table (e.g., users)
AWS_ACCESS_KEY_ID=test AWS_SECRET_ACCESS_KEY=test \
  aws dynamodb scan --table-name acme-users \
  --endpoint-url http://localhost:4566 --region us-east-1

# Query specific user
AWS_ACCESS_KEY_ID=test AWS_SECRET_ACCESS_KEY=test \
  aws dynamodb get-item --table-name acme-users \
  --key '{"ecosystemId": {"S": "user-001"}}' \
  --endpoint-url http://localhost:4566 --region us-east-1

# View cards
AWS_ACCESS_KEY_ID=test AWS_SECRET_ACCESS_KEY=test \
  aws dynamodb scan --table-name acme-cards \
  --endpoint-url http://localhost:4566 --region us-east-1

# View transactions
AWS_ACCESS_KEY_ID=test AWS_SECRET_ACCESS_KEY=test \
  aws dynamodb scan --table-name acme-transactions \
  --endpoint-url http://localhost:4566 --region us-east-1

# Check SQS queue for events
AWS_ACCESS_KEY_ID=test AWS_SECRET_ACCESS_KEY=test \
  aws sqs receive-message --queue-url http://localhost:4566/000000000000/acme-events-queue \
  --endpoint-url http://localhost:4566 --region us-east-1
```

#### Option 2: DynamoDB Admin UI (Docker)

```bash
# Start DynamoDB Admin UI on port 8001
docker run -p 8001:8001 -e DYNAMO_ENDPOINT=http://host.docker.internal:4566 \
  aaronshaf/dynamodb-admin

# Open http://localhost:8001 in your browser
```

#### Option 3: NoSQL Workbench

1. Download [NoSQL Workbench](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/workbench.html)
2. Add connection:
   - Name: LocalStack
   - Endpoint: http://localhost:4566
   - Region: us-east-1
   - Access Key: test
   - Secret Key: test

#### Option 4: LocalStack Health & Resource List

```bash
# Health check
curl http://localhost:4566/_localstack/health | jq .

# List resources (LocalStack Pro feature, but basic info works in Community)
curl http://localhost:4566/_localstack/diagnose | jq .
```

### Stop LocalStack

```bash
bun run emulator:stop:aws

# Or reset (clears all data)
bun run emulator:reset:aws
```

### Run Tests Against LocalStack

```bash
bun run test:aws
```

## Troubleshooting

- `User not found`: call `POST /v1/users` for that token.
- `Idempotency-Key header is required`: add the header for write endpoints.
- `productId is required`: include `productId` in card requests.
- `Admin access required`: use an admin token.
- Port in use: `PORT=3001 bun run dev`.
- LocalStack not ready: wait 30 seconds after `emulator:start:aws`, check `docker ps` for healthy status.
- DynamoDB errors: run `bun run emulator:reset:aws` to recreate tables.

## Quick Reference

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health/liveness` | GET | Health check |
| `/v1/users` | POST | Create user (explicit registration) |
| `/v1/dashboard` | GET | User dashboard |
| `/v1/offers` | GET | Product offers |
| `/v1/cards/requests` | POST | Request new card |
| `/v1/cards` | GET | List cards |
| `/v1/cards/:id` | GET | Card details |
| `/v1/cards/:id/transactions/purchases` | POST | Purchase |
| `/v1/cards/:id/transactions/payments` | POST | Payment |
| `/v1/cards/:id/transactions` | GET | Transactions |
| `/v1/admin/card-requests` | GET | Pending requests |
| `/v1/admin/card-requests/:id/approve` | POST | Approve request |
| `/v1/admin/card-requests/:id/reject` | POST | Reject request |
| `/v1/admin/users/:slug/score` | GET | User score |
| `/v1/admin/users/:slug/score` | PATCH | Adjust score |
| `/v1/admin/cleanup` | POST | Reset data |
