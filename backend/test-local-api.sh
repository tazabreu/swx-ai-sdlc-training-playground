#!/bin/bash
# Quick Local API Test Script
# Make sure the server is running first: bun run dev

set -euo pipefail  # Exit on error and failed pipelines

echo "🧪 Testing Local Financial API"
echo "================================"
echo ""

# Setup tokens
export USER_TOKEN="mock.eyJlY29zeXN0ZW1JZCI6InVzZXItMTIzIiwicm9sZSI6InVzZXIifQ.sig"
export ADMIN_TOKEN="mock.eyJlY29zeXN0ZW1JZCI6ImFkbWluLTAwMSIsInJvbGUiOiJhZG1pbiJ9.sig"

BASE_URL="http://localhost:3000"
CURL_FLAGS="-fsS"

echo "1️⃣  Testing health check..."
curl $CURL_FLAGS "$BASE_URL/health/liveness" | jq .
echo "✅ Health check passed"
echo ""

echo "2️⃣  Creating user..."
USER_CREATE=$(curl $CURL_FLAGS -X POST $BASE_URL/v1/users \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}' | jq .)
echo "$USER_CREATE" | jq .
USER_ID=$(echo "$USER_CREATE" | jq -r '.user.ecosystemId')
USER_CREATED=$(echo "$USER_CREATE" | jq -r '.created')
echo "✅ User ready (created: $USER_CREATED, id: $USER_ID)"
echo ""

echo "3️⃣  Creating admin user..."
ADMIN_CREATE=$(curl $CURL_FLAGS -X POST $BASE_URL/v1/users \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}' | jq .)
echo "$ADMIN_CREATE" | jq .
ADMIN_ID=$(echo "$ADMIN_CREATE" | jq -r '.user.ecosystemId')
ADMIN_CREATED=$(echo "$ADMIN_CREATE" | jq -r '.created')
echo "✅ Admin ready (created: $ADMIN_CREATED, id: $ADMIN_ID)"
echo ""

echo "4️⃣  Testing dashboard..."
DASHBOARD=$(curl $CURL_FLAGS $BASE_URL/v1/dashboard -H "Authorization: Bearer $USER_TOKEN" | jq .)
echo "$DASHBOARD" | jq .
SCORE=$(echo "$DASHBOARD" | jq -r '.user.score')
echo "✅ Dashboard loaded - Current score: $SCORE"
echo ""

echo "5️⃣  Testing offers..."
curl $CURL_FLAGS $BASE_URL/v1/offers -H "Authorization: Bearer $USER_TOKEN" | jq .
echo "✅ Offers retrieved"
echo ""

echo "6️⃣  Requesting credit card..."
CARD_REQUEST=$(curl $CURL_FLAGS -X POST $BASE_URL/v1/cards/requests \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H "Idempotency-Key: test-request-001" \
  -H "Content-Type: application/json" \
  -d '{"productId": "default-credit-card"}' | jq .)
echo "$CARD_REQUEST" | jq .
STATUS=$(echo "$CARD_REQUEST" | jq -r '.request.status')
echo "✅ Card request status: $STATUS"
echo ""

if [ "$STATUS" = "approved" ]; then
  CARD_ID=$(echo "$CARD_REQUEST" | jq -r '.request.card.cardId // empty')
  if [ -z "$CARD_ID" ]; then
    echo "WARN: Card request approved but no cardId found; skipping transactions"
  else
    echo "7️⃣  Making a purchase on card: $CARD_ID..."
    curl $CURL_FLAGS -X POST "$BASE_URL/v1/cards/$CARD_ID/transactions/purchases" \
      -H "Authorization: Bearer $USER_TOKEN" \
      -H "Idempotency-Key: purchase-001" \
      -H "Content-Type: application/json" \
      -d '{"amount": 50.00, "merchant": "Test Store", "category": "shopping"}' | jq .
    echo "✅ Purchase completed"
    echo ""

    echo "8️⃣  Making a payment..."
    curl $CURL_FLAGS -X POST "$BASE_URL/v1/cards/$CARD_ID/transactions/payments" \
      -H "Authorization: Bearer $USER_TOKEN" \
      -H "Idempotency-Key: payment-001" \
      -H "Content-Type: application/json" \
      -d '{"amount": 25.00, "source": "bank"}' | jq .
    echo "✅ Payment completed"
    echo ""
  fi
fi

echo "9️⃣  Testing admin: view user score..."
curl $CURL_FLAGS "$BASE_URL/v1/admin/users/$USER_ID/score" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq .
echo "✅ Admin access verified"
echo ""

echo "🎉 All tests passed!"
echo ""
echo "📖 For more examples, see LOCAL_TESTING_GUIDE.md"
