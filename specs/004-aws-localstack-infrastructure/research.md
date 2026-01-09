# Research: AWS LocalStack Infrastructure

**Feature**: 004-aws-localstack-infrastructure
**Date**: 2026-01-07
**Purpose**: Document technology decisions, patterns, and alternatives for AWS infrastructure implementation

## 1. DynamoDB Client Configuration

### Decision
Use AWS SDK v3 with `@aws-sdk/lib-dynamodb` DocumentClient for simplified attribute marshalling.

### Rationale
- SDK v3 is modular (smaller bundle size) and supports tree-shaking
- DocumentClient handles JavaScript/DynamoDB type conversion automatically
- Native support for endpoint override via `AWS_ENDPOINT_URL` environment variable
- Consistent with AWS best practices for new projects

### Alternatives Considered
| Alternative | Why Rejected |
|-------------|--------------|
| AWS SDK v2 | Deprecated, larger bundle, monolithic imports |
| Raw DynamoDB client | Requires manual attribute marshalling with AttributeValue types |
| Third-party ORMs (dynamoose) | Adds unnecessary abstraction, harder to debug LocalStack issues |

### Implementation Pattern
```typescript
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBClient({
  region: process.env.AWS_REGION || 'us-east-1',
  endpoint: process.env.AWS_ENDPOINT_URL, // LocalStack: http://localhost:4566
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || 'test',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || 'test',
  },
});

const docClient = DynamoDBDocumentClient.from(client, {
  marshallOptions: { removeUndefinedValues: true },
  unmarshallOptions: { wrapNumbers: false },
});
```

## 2. DynamoDB Table Design Strategy

### Decision
Use single-table design per entity type with composite keys and Global Secondary Indexes (GSIs) for access patterns.

### Rationale
- Mirrors Firestore collection structure for easier migration path
- Each repository operates on a single table (simpler mental model)
- GSIs provide efficient secondary access patterns without scan operations
- LocalStack supports GSIs in Community Edition

### Table Structure Pattern

| Table | Partition Key (PK) | Sort Key (SK) | GSIs |
|-------|-------------------|---------------|------|
| tazco-users | ecosystemId | - | UserByFirebaseUid (firebaseUid) |
| tazco-cards | ecosystemId | cardId | CardsByStatus (ecosystemId, status) |
| tazco-card-requests | ecosystemId | requestId | PendingRequests (status, createdAt) |
| tazco-transactions | ecosystemId#cardId | transactionId | - |
| tazco-scores | ecosystemId | timestamp#scoreId | - |
| tazco-idempotency | ecosystemId | keyHash | TTL on expiresAt |
| tazco-outbox | eventId | - | PendingEvents (status, createdAt) |
| tazco-outbox-sequences | entityKey | - | - |
| tazco-audit-logs | targetType#targetId | timestamp#logId | LogsByActor (actorId, timestamp) |
| tazco-whatsapp-notifications | notificationId | - | PendingNotifications, ByRelatedEntity |
| tazco-whatsapp-inbound | messageId | - | ByWppMessageId, BySenderPhone |
| tazco-pending-approvals | requestId | - | ExpiredApprovals (status, expiresAt) |

### Alternatives Considered
| Alternative | Why Rejected |
|-------------|--------------|
| Single mega-table design | Over-complex for this use case, harder to reason about |
| Aurora PostgreSQL | Requires different LocalStack tier, more operational overhead |
| Multiple PKs per table | DynamoDB single-table patterns work well for our access patterns |

## 3. Optimistic Locking Pattern

### Decision
Use DynamoDB conditional writes with `ConditionExpression` for version-based optimistic locking.

### Rationale
- Matches existing Firestore transaction pattern semantically
- No additional infrastructure required (no distributed locks)
- `ConditionalCheckFailedException` maps directly to existing `ConcurrencyError`
- Well-supported in LocalStack

### Implementation Pattern
```typescript
async updateBalance(ecosystemId: string, cardId: string, update: CardBalanceUpdate): Promise<void> {
  const command = new UpdateCommand({
    TableName: TableNames.CARDS,
    Key: { ecosystemId, cardId },
    UpdateExpression: 'SET balance = :bal, availableCredit = :credit, version = :newVer, updatedAt = :now',
    ConditionExpression: 'version = :expectedVer',
    ExpressionAttributeValues: {
      ':bal': update.balance,
      ':credit': update.availableCredit,
      ':newVer': update.version,
      ':expectedVer': update.version - 1,
      ':now': new Date().toISOString(),
    },
  });

  try {
    await docClient.send(command);
  } catch (error) {
    if (error.name === 'ConditionalCheckFailedException') {
      throw new ConcurrencyError(cardId, update.version - 1, /* actual from re-fetch */);
    }
    throw error;
  }
}
```

## 4. Atomic Sequence Allocation (Outbox)

### Decision
Use DynamoDB `TransactWriteItems` for atomic sequence counter increment and event insertion.

### Rationale
- Guarantees ordering without race conditions
- Single network round-trip for both operations
- Transaction failure is atomic (all-or-nothing)
- LocalStack supports transactions

### Implementation Pattern
```typescript
async save(event: OutboxEvent): Promise<void> {
  const sequenceKey = `${event.aggregateType}:${event.aggregateId}`;

  const command = new TransactWriteCommand({
    TransactItems: [
      {
        Update: {
          TableName: TableNames.OUTBOX_SEQUENCES,
          Key: { entityKey: sequenceKey },
          UpdateExpression: 'SET #seq = if_not_exists(#seq, :zero) + :one',
          ExpressionAttributeNames: { '#seq': 'sequence' },
          ExpressionAttributeValues: { ':zero': 0, ':one': 1 },
          ReturnValuesOnConditionCheckFailure: 'ALL_OLD',
        },
      },
      {
        Put: {
          TableName: TableNames.OUTBOX,
          Item: {
            eventId: event.id,
            ...mapEventToDoc(event),
            sequence: /* obtained from counter */,
          },
        },
      },
    ],
  });

  await docClient.send(command);
}
```

**Note**: DynamoDB transactions don't return intermediate values. Alternative: Use conditional put with optimistic sequence guessing, retry on conflict.

## 5. Cursor-Based Pagination

### Decision
Encode DynamoDB `LastEvaluatedKey` as base64 JSON string for cursor tokens.

### Rationale
- Maintains API contract compatibility with existing Firebase pagination
- Opaque to clients (they just pass the cursor back)
- Stateless - no server-side cursor storage
- Works with GSI queries

### Implementation Pattern
```typescript
// Encoding
const nextCursor = result.LastEvaluatedKey
  ? Buffer.from(JSON.stringify(result.LastEvaluatedKey)).toString('base64')
  : undefined;

// Decoding
const exclusiveStartKey = cursor
  ? JSON.parse(Buffer.from(cursor, 'base64').toString('utf8'))
  : undefined;

// Query with pagination
const command = new QueryCommand({
  TableName: TableNames.CARD_REQUESTS,
  IndexName: 'PendingRequests',
  Limit: pagination?.limit || 20,
  ExclusiveStartKey: exclusiveStartKey,
  // ... other params
});
```

## 6. Cognito JWT Verification

### Decision
Use `aws-jwt-verify` library for Cognito token validation with LocalStack support.

### Rationale
- Official AWS-maintained library for JWT verification
- Caches JWKS for performance
- Supports custom issuers (for LocalStack)
- Handles Cognito-specific claims parsing

### Implementation Pattern
```typescript
import { CognitoJwtVerifier } from 'aws-jwt-verify';

const verifier = CognitoJwtVerifier.create({
  userPoolId: process.env.AWS_COGNITO_USER_POOL_ID!,
  clientId: process.env.AWS_COGNITO_CLIENT_ID!,
  tokenUse: 'access',
  // For LocalStack, override the issuer URL
});

async verifyToken(token: string): Promise<AuthTokenClaims> {
  const payload = await verifier.verify(token);
  return {
    uid: payload.sub,
    email: payload.email,
    role: payload['custom:role'] as 'user' | 'admin',
    ecosystemId: payload['custom:ecosystemId'],
  };
}
```

### LocalStack Consideration
LocalStack Cognito may require custom JWKS endpoint configuration. Fallback: decode JWT without signature verification in LocalStack mode (acceptable for local development).

## 7. EventBridge/SQS Publisher

### Decision
Implement IEventPublisher using EventBridge for event routing with SQS for reliable delivery.

### Rationale
- EventBridge provides event bus pattern (matches domain event semantics)
- SQS ensures at-least-once delivery
- Decouples publishers from consumers
- LocalStack supports both services

### Implementation Pattern
```typescript
import { EventBridgeClient, PutEventsCommand } from '@aws-sdk/client-eventbridge';

async publish(event: OutboxEvent): Promise<void> {
  const command = new PutEventsCommand({
    Entries: [{
      EventBusName: 'tazco-financial-events',
      Source: 'tazco.financial-api',
      DetailType: event.eventType,
      Detail: JSON.stringify({
        eventId: event.id,
        aggregateType: event.aggregateType,
        aggregateId: event.aggregateId,
        payload: event.payload,
        occurredAt: event.occurredAt.toISOString(),
      }),
    }],
  });

  await eventBridgeClient.send(command);

  // Also notify local handlers (for WhatsApp notifications in same process)
  await this.notifyLocalHandlers(event);
}
```

## 8. SSM Parameter Store Configuration

### Decision
Use SSM Parameter Store with `/tazco/financial-api/` path prefix for configuration.

### Rationale
- Free tier (no cost for standard parameters)
- Hierarchical path structure matches existing config shape
- Supports encryption for sensitive values (KMS)
- LocalStack Community Edition includes SSM

### Parameter Structure
```
/tazco/financial-api/limits/lowTier = 500
/tazco/financial-api/limits/mediumTier = 1500
/tazco/financial-api/limits/highTier = 3000
/tazco/financial-api/approval/autoApproveThreshold = 700
/tazco/financial-api/whatsapp/notificationsEnabled = true
/tazco/financial-api/whatsapp/approvalExpiryHours = 24
/tazco/financial-api/scoring/paymentBonusMax = 50
...
```

### Implementation Pattern
```typescript
import { SSMClient, GetParametersByPathCommand } from '@aws-sdk/client-ssm';

async initialize(): Promise<void> {
  const command = new GetParametersByPathCommand({
    Path: '/tazco/financial-api/',
    Recursive: true,
    WithDecryption: true,
  });

  const response = await ssmClient.send(command);
  this.config = this.parseParameters(response.Parameters || []);
}
```

## 9. LocalStack Configuration

### Decision
Use LocalStack Community Edition with Docker Compose and init scripts.

### Rationale
- Free and open source
- Supports all required services (DynamoDB, Cognito, EventBridge, SQS, SSM)
- Init scripts enable reproducible environment setup
- Single container simplifies developer experience

### Services Required
| Service | LocalStack Support | Notes |
|---------|-------------------|-------|
| DynamoDB | Full | Tables, GSIs, Transactions, TTL |
| Cognito | Partial | User pools, custom attributes, basic token generation |
| EventBridge | Full | Event buses, rules |
| SQS | Full | Queues, message handling |
| SSM | Full | Parameter Store, paths |

### Docker Compose Pattern
```yaml
services:
  localstack:
    image: localstack/localstack:latest
    ports:
      - "4566:4566"
    environment:
      - SERVICES=dynamodb,cognito-idp,events,sqs,ssm
      - DEBUG=0
      - PERSISTENCE=1
    volumes:
      - "./scripts/localstack-init:/etc/localstack/init/ready.d"
      - "localstack-data:/var/lib/localstack"
```

## 10. Date/Time Handling

### Decision
Store dates as ISO 8601 strings in DynamoDB.

### Rationale
- DynamoDB has no native Date type
- ISO strings are sortable (lexicographic order matches chronological)
- Human-readable for debugging
- Compatible with JavaScript Date parsing

### Implementation Pattern
```typescript
// Encoding
const doc = {
  createdAt: entity.createdAt.toISOString(),
  updatedAt: entity.updatedAt.toISOString(),
};

// Decoding
const entity = {
  createdAt: new Date(doc.createdAt),
  updatedAt: new Date(doc.updatedAt),
};
```

## Summary of Technology Choices

| Component | Technology | Version |
|-----------|------------|---------|
| DynamoDB Client | @aws-sdk/client-dynamodb + @aws-sdk/lib-dynamodb | ^3.500.0 |
| Cognito Auth | aws-jwt-verify | ^4.0.0 |
| EventBridge | @aws-sdk/client-eventbridge | ^3.500.0 |
| SQS | @aws-sdk/client-sqs | ^3.500.0 |
| SSM | @aws-sdk/client-ssm | ^3.500.0 |
| Local Dev | LocalStack Community | latest |
| Container | Docker Compose | v2 |

All technologies are production-ready and have proven LocalStack compatibility.
