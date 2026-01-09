# Quickstart: WhatsApp Admin Notifications

**Feature**: 002-whatsapp-admin-notifications
**Date**: 2026-01-04

## Prerequisites

- Bun installed (v1.0+)
- Access to wpp-connect server (see connection details below)
- WhatsApp session with QR code scanned

## Environment Setup

### 1. Add Environment Variables

Create or update `.env`:

```bash
# WPP-Connect Server Configuration
WPP_BASE_URL="http://35.232.155.23:21465"
WPP_SECRET_KEY="QKio1tFW1ICMhUWdr6tr3O3eHcUs76QQ"
WPP_SESSION_NAME="tazco-financial-api"

# Admin Phone Numbers (Brazilian E.164 format, 13 digits)
ADMIN_PHONE_1="5573981112636"
ADMIN_PHONE_2="5548998589532"

# Webhook Authentication
WEBHOOK_SECRET="your-secure-random-secret-here"

# Feature Flag (optional - defaults to true)
WHATSAPP_NOTIFICATIONS_ENABLED="true"
```

### 2. Install Dependencies

```bash
bun install
```

### 3. Access WPP-Connect Server

**Option A: Direct Access (if port 21465 open)**
```bash
curl http://35.232.155.23:21465/healthz
```

**Option B: SSH Tunnel (recommended)**
```bash
gcloud compute ssh tazco-platform-dev-wppconnect \
  --zone=us-central1-a \
  --project=tazco-platform-gcp-project-dev \
  --tunnel-through-iap -- \
  -L 21465:localhost:21465 \
  -N -f

# Then update .env:
WPP_BASE_URL="http://localhost:21465"
```

## Running Tests

### Unit Tests

```bash
bun test tests/unit/infrastructure/whatsapp
bun test tests/unit/application/handlers/whatsapp
```

### Contract Tests

```bash
bun test tests/contract/webhooks.test.ts
```

### Integration Tests (requires emulator)

```bash
bun run emulator:start
FIRESTORE_EMULATOR_HOST=localhost:8080 bun test tests/integration/whatsapp
```

## Manual Testing

### 1. Generate WPP-Connect Bearer Token

```bash
export WPP_SECRET_KEY="QKio1tFW1ICMhUWdr6tr3O3eHcUs76QQ"
export WPP_SESSION="tazco-financial-api"

export TOKEN=$(curl -s -X POST \
  "http://localhost:21465/api/${WPP_SESSION}/${WPP_SECRET_KEY}/generate-token" \
  | jq -r '.token')

echo "Token: $TOKEN"
```

### 2. Check Session Status

```bash
curl -s "http://localhost:21465/api/${WPP_SESSION}/check-connection-session" \
  -H "Authorization: Bearer $TOKEN" | jq
```

### 3. Send Test Message

```bash
curl -X POST "http://localhost:21465/api/${WPP_SESSION}/send-message" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "5573981112636",
    "message": "Test message from Financial API"
  }' | jq
```

### 4. Test Webhook Endpoint

```bash
# Start the server
bun run dev

# In another terminal, simulate webhook
curl -X POST http://localhost:3000/webhooks/wpp-connect \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Secret: your-secure-random-secret-here" \
  -d '{
    "event": "onMessage",
    "session": "tazco-financial-api",
    "data": {
      "from": "5573981112636@c.us",
      "body": "y 12345678",
      "fromMe": false
    }
  }' | jq
```

## Development Workflow

### 1. Start Dev Server

```bash
bun run dev
```

### 2. Start Firestore Emulator

```bash
bun run emulator:start
```

### 3. Run All Tests

```bash
bun test
```

### 4. Type Check

```bash
bun run typecheck
```

### 5. Lint

```bash
bun run lint
```

## Key Files

| File | Purpose |
|------|---------|
| `src/infrastructure/whatsapp/client.ts` | WPP-Connect API client |
| `src/infrastructure/whatsapp/message-parser.ts` | Parse admin commands |
| `src/api/routes/webhooks.ts` | Webhook endpoint |
| `src/application/handlers/whatsapp-approval.handler.ts` | Process approvals via WhatsApp |
| `src/domain/services/notification.service.ts` | Send notifications |

## Common Issues

### "Session not connected"
- Check if QR code was scanned
- SSH tunnel may have dropped - reconnect

### "Invalid webhook secret"
- Verify `WEBHOOK_SECRET` matches in both places
- Check header is `X-Webhook-Secret` (with dashes)

### "Phone number not on WhatsApp"
- Verify E.164 format (13 digits for Brazil)
- Check number has WhatsApp installed

## Next Steps

1. Run `/speckit.tasks` to generate implementation tasks
2. Follow task order in `tasks.md`
3. Ensure all tests pass before PR
