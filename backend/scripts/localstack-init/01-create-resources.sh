#!/bin/bash
# LocalStack Initialization Script
# Creates all DynamoDB tables, Cognito user pool, EventBridge bus, SQS queues, and SSM parameters

set -e

# Disable AWS CLI pager (compatible with both AWS CLI v1 and v2)
export AWS_PAGER=""

ENDPOINT="http://localhost:4566"
REGION="us-east-1"

echo "=== Creating DynamoDB Tables ==="

# 1. acme-users
aws dynamodb create-table \
  --endpoint-url $ENDPOINT \
  --region $REGION \
  --table-name acme-users \
  --attribute-definitions \
    AttributeName=ecosystemId,AttributeType=S \
    AttributeName=firebaseUid,AttributeType=S \
  --key-schema AttributeName=ecosystemId,KeyType=HASH \
  --global-secondary-indexes '[{
    "IndexName": "UserByFirebaseUid",
    "KeySchema": [{"AttributeName": "firebaseUid", "KeyType": "HASH"}],
    "Projection": {"ProjectionType": "ALL"}
  }]' \
  --billing-mode PAY_PER_REQUEST \
 || echo "Table acme-users may already exist"

# 2. acme-scores
aws dynamodb create-table \
  --endpoint-url $ENDPOINT \
  --region $REGION \
  --table-name acme-scores \
  --attribute-definitions \
    AttributeName=ecosystemId,AttributeType=S \
    AttributeName=timestampScoreId,AttributeType=S \
  --key-schema \
    AttributeName=ecosystemId,KeyType=HASH \
    AttributeName=timestampScoreId,KeyType=RANGE \
  --billing-mode PAY_PER_REQUEST \
 || echo "Table acme-scores may already exist"

# 3. acme-cards
aws dynamodb create-table \
  --endpoint-url $ENDPOINT \
  --region $REGION \
  --table-name acme-cards \
  --attribute-definitions \
    AttributeName=ecosystemId,AttributeType=S \
    AttributeName=cardId,AttributeType=S \
    AttributeName=status,AttributeType=S \
  --key-schema \
    AttributeName=ecosystemId,KeyType=HASH \
    AttributeName=cardId,KeyType=RANGE \
  --global-secondary-indexes '[{
    "IndexName": "CardsByStatus",
    "KeySchema": [
      {"AttributeName": "ecosystemId", "KeyType": "HASH"},
      {"AttributeName": "status", "KeyType": "RANGE"}
    ],
    "Projection": {"ProjectionType": "ALL"}
  }]' \
  --billing-mode PAY_PER_REQUEST \
 || echo "Table acme-cards may already exist"

# 4. acme-card-requests
aws dynamodb create-table \
  --endpoint-url $ENDPOINT \
  --region $REGION \
  --table-name acme-card-requests \
  --attribute-definitions \
    AttributeName=ecosystemId,AttributeType=S \
    AttributeName=requestId,AttributeType=S \
    AttributeName=status,AttributeType=S \
    AttributeName=createdAt,AttributeType=S \
  --key-schema \
    AttributeName=ecosystemId,KeyType=HASH \
    AttributeName=requestId,KeyType=RANGE \
  --global-secondary-indexes '[
    {
      "IndexName": "PendingRequests",
      "KeySchema": [
        {"AttributeName": "status", "KeyType": "HASH"},
        {"AttributeName": "createdAt", "KeyType": "RANGE"}
      ],
      "Projection": {"ProjectionType": "ALL"}
    }
  ]' \
  --billing-mode PAY_PER_REQUEST \
 || echo "Table acme-card-requests may already exist"

# 5. acme-transactions
aws dynamodb create-table \
  --endpoint-url $ENDPOINT \
  --region $REGION \
  --table-name acme-transactions \
  --attribute-definitions \
    AttributeName=ecosystemIdCardId,AttributeType=S \
    AttributeName=transactionId,AttributeType=S \
  --key-schema \
    AttributeName=ecosystemIdCardId,KeyType=HASH \
    AttributeName=transactionId,KeyType=RANGE \
  --billing-mode PAY_PER_REQUEST \
 || echo "Table acme-transactions may already exist"

# 6. acme-idempotency (with TTL)
aws dynamodb create-table \
  --endpoint-url $ENDPOINT \
  --region $REGION \
  --table-name acme-idempotency \
  --attribute-definitions \
    AttributeName=ecosystemId,AttributeType=S \
    AttributeName=keyHash,AttributeType=S \
  --key-schema \
    AttributeName=ecosystemId,KeyType=HASH \
    AttributeName=keyHash,KeyType=RANGE \
  --billing-mode PAY_PER_REQUEST \
 || echo "Table acme-idempotency may already exist"

# Enable TTL on idempotency table
aws dynamodb update-time-to-live \
  --endpoint-url $ENDPOINT \
  --region $REGION \
  --table-name acme-idempotency \
  --time-to-live-specification Enabled=true,AttributeName=expiresAt \
 || echo "TTL may already be configured"

# 7. acme-outbox
aws dynamodb create-table \
  --endpoint-url $ENDPOINT \
  --region $REGION \
  --table-name acme-outbox \
  --attribute-definitions \
    AttributeName=eventId,AttributeType=S \
    AttributeName=status,AttributeType=S \
    AttributeName=createdAt,AttributeType=S \
    AttributeName=updatedAt,AttributeType=S \
  --key-schema AttributeName=eventId,KeyType=HASH \
  --global-secondary-indexes '[
    {
      "IndexName": "PendingEvents",
      "KeySchema": [
        {"AttributeName": "status", "KeyType": "HASH"},
        {"AttributeName": "createdAt", "KeyType": "RANGE"}
      ],
      "Projection": {"ProjectionType": "ALL"}
    },
    {
      "IndexName": "RetryEvents",
      "KeySchema": [
        {"AttributeName": "status", "KeyType": "HASH"},
        {"AttributeName": "updatedAt", "KeyType": "RANGE"}
      ],
      "Projection": {"ProjectionType": "ALL"}
    }
  ]' \
  --billing-mode PAY_PER_REQUEST \
 || echo "Table acme-outbox may already exist"

# 8. acme-outbox-sequences
aws dynamodb create-table \
  --endpoint-url $ENDPOINT \
  --region $REGION \
  --table-name acme-outbox-sequences \
  --attribute-definitions \
    AttributeName=entityKey,AttributeType=S \
  --key-schema AttributeName=entityKey,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
 || echo "Table acme-outbox-sequences may already exist"

# 9. acme-audit-logs
aws dynamodb create-table \
  --endpoint-url $ENDPOINT \
  --region $REGION \
  --table-name acme-audit-logs \
  --attribute-definitions \
    AttributeName=targetTypeTargetId,AttributeType=S \
    AttributeName=timestampLogId,AttributeType=S \
    AttributeName=actorId,AttributeType=S \
    AttributeName=createdAt,AttributeType=S \
  --key-schema \
    AttributeName=targetTypeTargetId,KeyType=HASH \
    AttributeName=timestampLogId,KeyType=RANGE \
  --global-secondary-indexes '[{
    "IndexName": "LogsByActor",
    "KeySchema": [
      {"AttributeName": "actorId", "KeyType": "HASH"},
      {"AttributeName": "createdAt", "KeyType": "RANGE"}
    ],
    "Projection": {"ProjectionType": "ALL"}
  }]' \
  --billing-mode PAY_PER_REQUEST \
 || echo "Table acme-audit-logs may already exist"

# 10. acme-whatsapp-notifications
aws dynamodb create-table \
  --endpoint-url $ENDPOINT \
  --region $REGION \
  --table-name acme-whatsapp-notifications \
  --attribute-definitions \
    AttributeName=notificationId,AttributeType=S \
    AttributeName=status,AttributeType=S \
    AttributeName=createdAt,AttributeType=S \
    AttributeName=relatedEntityType,AttributeType=S \
    AttributeName=relatedEntityId,AttributeType=S \
  --key-schema AttributeName=notificationId,KeyType=HASH \
  --global-secondary-indexes '[
    {
      "IndexName": "PendingNotifications",
      "KeySchema": [
        {"AttributeName": "status", "KeyType": "HASH"},
        {"AttributeName": "createdAt", "KeyType": "RANGE"}
      ],
      "Projection": {"ProjectionType": "ALL"}
    },
    {
      "IndexName": "ByRelatedEntity",
      "KeySchema": [
        {"AttributeName": "relatedEntityType", "KeyType": "HASH"},
        {"AttributeName": "relatedEntityId", "KeyType": "RANGE"}
      ],
      "Projection": {"ProjectionType": "ALL"}
    }
  ]' \
  --billing-mode PAY_PER_REQUEST \
 || echo "Table acme-whatsapp-notifications may already exist"

# 11. acme-whatsapp-inbound
aws dynamodb create-table \
  --endpoint-url $ENDPOINT \
  --region $REGION \
  --table-name acme-whatsapp-inbound \
  --attribute-definitions \
    AttributeName=messageId,AttributeType=S \
    AttributeName=wppMessageId,AttributeType=S \
    AttributeName=senderPhone,AttributeType=S \
    AttributeName=receivedAt,AttributeType=S \
  --key-schema AttributeName=messageId,KeyType=HASH \
  --global-secondary-indexes '[
    {
      "IndexName": "ByWppMessageId",
      "KeySchema": [
        {"AttributeName": "wppMessageId", "KeyType": "HASH"}
      ],
      "Projection": {"ProjectionType": "ALL"}
    },
    {
      "IndexName": "BySenderPhone",
      "KeySchema": [
        {"AttributeName": "senderPhone", "KeyType": "HASH"},
        {"AttributeName": "receivedAt", "KeyType": "RANGE"}
      ],
      "Projection": {"ProjectionType": "ALL"}
    }
  ]' \
  --billing-mode PAY_PER_REQUEST \
 || echo "Table acme-whatsapp-inbound may already exist"

# 12. acme-pending-approvals
aws dynamodb create-table \
  --endpoint-url $ENDPOINT \
  --region $REGION \
  --table-name acme-pending-approvals \
  --attribute-definitions \
    AttributeName=requestId,AttributeType=S \
    AttributeName=status,AttributeType=S \
    AttributeName=expiresAt,AttributeType=S \
  --key-schema AttributeName=requestId,KeyType=HASH \
  --global-secondary-indexes '[{
    "IndexName": "ExpiredApprovals",
    "KeySchema": [
      {"AttributeName": "status", "KeyType": "HASH"},
      {"AttributeName": "expiresAt", "KeyType": "RANGE"}
    ],
    "Projection": {"ProjectionType": "ALL"}
  }]' \
  --billing-mode PAY_PER_REQUEST \
 || echo "Table acme-pending-approvals may already exist"

echo "=== DynamoDB Tables Created ==="

echo "=== Creating Cognito User Pool ==="

# Create Cognito User Pool
POOL_RESULT=$(aws cognito-idp create-user-pool \
  --endpoint-url $ENDPOINT \
  --region $REGION \
  --pool-name acme-financial-pool \
  --schema '[
    {"Name": "email", "Required": true, "Mutable": true},
    {"Name": "custom:role", "AttributeDataType": "String", "Mutable": true},
    {"Name": "custom:ecosystemId", "AttributeDataType": "String", "Mutable": true}
  ]' \
  --auto-verified-attributes email \
  --username-attributes email \
 2>&1) || echo "User pool may already exist"

# Extract pool ID
POOL_ID=$(echo $POOL_RESULT | grep -o '"UserPoolId": "[^"]*"' | cut -d'"' -f4 || echo "")

if [ -n "$POOL_ID" ]; then
  echo "Created User Pool: $POOL_ID"

  # Create User Pool Client
  CLIENT_RESULT=$(aws cognito-idp create-user-pool-client \
    --endpoint-url $ENDPOINT \
    --region $REGION \
    --user-pool-id $POOL_ID \
    --client-name acme-api-client \
    --explicit-auth-flows ADMIN_NO_SRP_AUTH ALLOW_USER_PASSWORD_AUTH ALLOW_REFRESH_TOKEN_AUTH \
   2>&1)

  CLIENT_ID=$(echo $CLIENT_RESULT | grep -o '"ClientId": "[^"]*"' | cut -d'"' -f4 || echo "")

  if [ -n "$CLIENT_ID" ]; then
    echo "Created Client: $CLIENT_ID"

    # Store pool and client IDs in SSM
    aws ssm put-parameter \
      --endpoint-url $ENDPOINT \
      --region $REGION \
      --name /acme/financial-api/cognito/userPoolId \
      --value "$POOL_ID" \
      --type String \
      --overwrite \
     || echo "Failed to store pool ID"

    aws ssm put-parameter \
      --endpoint-url $ENDPOINT \
      --region $REGION \
      --name /acme/financial-api/cognito/clientId \
      --value "$CLIENT_ID" \
      --type String \
      --overwrite \
     || echo "Failed to store client ID"

    # Create test users
    echo "Creating test users..."

    # Create admin user
    aws cognito-idp admin-create-user \
      --endpoint-url $ENDPOINT \
      --region $REGION \
      --user-pool-id $POOL_ID \
      --username admin@test.com \
      --user-attributes \
        Name=email,Value=admin@test.com \
        Name=email_verified,Value=true \
        Name=custom:role,Value=admin \
        Name=custom:ecosystemId,Value=admin-001 \
      --message-action SUPPRESS \
     || echo "Admin user may already exist"

    # Set admin password
    aws cognito-idp admin-set-user-password \
      --endpoint-url $ENDPOINT \
      --region $REGION \
      --user-pool-id $POOL_ID \
      --username admin@test.com \
      --password Password123! \
      --permanent \
     || echo "Failed to set admin password"

    # Create regular user
    aws cognito-idp admin-create-user \
      --endpoint-url $ENDPOINT \
      --region $REGION \
      --user-pool-id $POOL_ID \
      --username user@test.com \
      --user-attributes \
        Name=email,Value=user@test.com \
        Name=email_verified,Value=true \
        Name=custom:role,Value=user \
        Name=custom:ecosystemId,Value=user-001 \
      --message-action SUPPRESS \
     || echo "Regular user may already exist"

    # Set user password
    aws cognito-idp admin-set-user-password \
      --endpoint-url $ENDPOINT \
      --region $REGION \
      --user-pool-id $POOL_ID \
      --username user@test.com \
      --password Password123! \
      --permanent \
     || echo "Failed to set user password"
  fi
fi

echo "=== Cognito Setup Complete ==="

echo "=== Creating EventBridge Event Bus ==="

aws events create-event-bus \
  --endpoint-url $ENDPOINT \
  --region $REGION \
  --name acme-financial-events \
 || echo "Event bus may already exist"

echo "=== Creating SQS Queue ==="

aws sqs create-queue \
  --endpoint-url $ENDPOINT \
  --region $REGION \
  --queue-name acme-events-queue \
 || echo "Queue may already exist"

# Create EventBridge rule to send to SQS
QUEUE_ARN="arn:aws:sqs:${REGION}:000000000000:acme-events-queue"

aws events put-rule \
  --endpoint-url $ENDPOINT \
  --region $REGION \
  --name acme-events-to-sqs \
  --event-bus-name acme-financial-events \
  --event-pattern '{"source": ["acme.financial-api"]}' \
 || echo "Rule may already exist"

aws events put-targets \
  --endpoint-url $ENDPOINT \
  --region $REGION \
  --rule acme-events-to-sqs \
  --event-bus-name acme-financial-events \
  --targets "Id=sqs-target,Arn=${QUEUE_ARN}" \
 || echo "Target may already exist"

echo "=== Creating SSM Parameters ==="

# Limits configuration
aws ssm put-parameter --endpoint-url "$ENDPOINT" --region "$REGION" \
  --name /acme/financial-api/limits/lowTier --value "500" --type String --overwrite \
 || echo "Failed to write /acme/financial-api/limits/lowTier"
aws ssm put-parameter --endpoint-url "$ENDPOINT" --region "$REGION" \
  --name /acme/financial-api/limits/mediumTier --value "1500" --type String --overwrite \
 || echo "Failed to write /acme/financial-api/limits/mediumTier"
aws ssm put-parameter --endpoint-url "$ENDPOINT" --region "$REGION" \
  --name /acme/financial-api/limits/highTier --value "3000" --type String --overwrite \
 || echo "Failed to write /acme/financial-api/limits/highTier"

# Approval configuration
aws ssm put-parameter --endpoint-url "$ENDPOINT" --region "$REGION" \
  --name /acme/financial-api/approval/autoApproveThreshold --value "700" --type String --overwrite \
 || echo "Failed to write /acme/financial-api/approval/autoApproveThreshold"

# WhatsApp configuration
aws ssm put-parameter --endpoint-url "$ENDPOINT" --region "$REGION" \
  --name /acme/financial-api/whatsapp/notificationsEnabled --value "true" --type String --overwrite \
 || echo "Failed to write /acme/financial-api/whatsapp/notificationsEnabled"
aws ssm put-parameter --endpoint-url "$ENDPOINT" --region "$REGION" \
  --name /acme/financial-api/whatsapp/approvalExpiryHours --value "24" --type String --overwrite \
 || echo "Failed to write /acme/financial-api/whatsapp/approvalExpiryHours"

# Scoring configuration
aws ssm put-parameter --endpoint-url "$ENDPOINT" --region "$REGION" \
  --name /acme/financial-api/scoring/paymentBonusMax --value "50" --type String --overwrite \
 || echo "Failed to write /acme/financial-api/scoring/paymentBonusMax"
aws ssm put-parameter --endpoint-url "$ENDPOINT" --region "$REGION" \
  --name /acme/financial-api/scoring/paymentBonusMin --value "10" --type String --overwrite \
 || echo "Failed to write /acme/financial-api/scoring/paymentBonusMin"
aws ssm put-parameter --endpoint-url "$ENDPOINT" --region "$REGION" \
  --name /acme/financial-api/scoring/latePenaltyMild --value "20" --type String --overwrite \
 || echo "Failed to write /acme/financial-api/scoring/latePenaltyMild"
aws ssm put-parameter --endpoint-url "$ENDPOINT" --region "$REGION" \
  --name /acme/financial-api/scoring/latePenaltyModerate --value "50" --type String --overwrite \
 || echo "Failed to write /acme/financial-api/scoring/latePenaltyModerate"
aws ssm put-parameter --endpoint-url "$ENDPOINT" --region "$REGION" \
  --name /acme/financial-api/scoring/latePenaltySevere --value "100" --type String --overwrite \
 || echo "Failed to write /acme/financial-api/scoring/latePenaltySevere"

echo "=== LocalStack Initialization Complete ==="
echo "Tables: 12 DynamoDB tables created"
echo "Auth: Cognito user pool with 2 test users (admin@test.com, user@test.com)"
echo "Events: EventBridge bus + SQS queue"
echo "Config: SSM parameters under /acme/financial-api/"
