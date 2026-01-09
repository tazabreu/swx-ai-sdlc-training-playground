# Tazco Backend - Financial API

Headless Financial API service for credit card management, scoring, and payment simulation.

## 📋 Overview

The backend is a TypeScript-based API service built with:
- **Express 5.x** for HTTP server
- **CQRS pattern** for clean command/query separation
- **Multi-provider architecture** supporting Firebase, AWS, and in-memory storage
- **Domain-driven design** with rich domain models
- **Comprehensive testing** with Bun's test runner

## 🏗 Architecture

```
backend/
├── src/
│   ├── api/              # HTTP layer
│   │   ├── routes/       # Express routes
│   │   ├── middleware/   # Auth, validation, error handling
│   │   └── dto/          # Data transfer objects
│   ├── application/      # Application layer (CQRS)
│   │   ├── commands/     # Write operations
│   │   ├── queries/      # Read operations
│   │   └── handlers/     # Command/query handlers
│   ├── domain/           # Domain layer
│   │   ├── entities/     # Business entities
│   │   ├── services/     # Domain services
│   │   └── value-objects/ # Value objects
│   ├── infrastructure/   # Infrastructure layer
│   │   ├── persistence/  # Repository implementations
│   │   ├── auth/         # Auth provider implementations
│   │   ├── events/       # Event publishers
│   │   └── di/           # Dependency injection
│   ├── config/           # Configuration
│   └── functions/        # Firebase Functions entry points
├── tests/
│   ├── unit/             # Unit tests
│   ├── integration/      # Integration tests
│   └── contract/         # API contract tests
├── scripts/              # Development scripts
├── docker-compose.yml    # Firebase emulators
└── docker-compose.aws.yml # LocalStack (AWS emulators)
```

See [../ARCHITECTURE.md](../ARCHITECTURE.md) for detailed architecture documentation.

## 🚀 Quick Start

### Prerequisites

- Bun >= 1.0.0
- Node.js >= 20.0.0
- Docker (optional, for emulators)

### Installation

```bash
cd backend
bun install
```

### Development Modes

#### 1. In-Memory (Fastest - No Docker)

```bash
bun run dev:in-memory
```

- No external dependencies
- Data stored in memory
- Perfect for quick testing

#### 2. AWS LocalStack (Recommended)

```bash
# Terminal 1: Start LocalStack
bun run emulator:start:aws

# Terminal 2: Start server
bun run dev:aws
# or simply
bun run dev  # Default mode
```

- DynamoDB for persistence
- Cognito for auth (fallback mode)
- EventBridge for events
- SQS for messaging

#### 3. Firebase Emulators

```bash
# Terminal 1: Start emulators
bun run emulator:start

# Terminal 2: Start server
bun run dev:emulator
```

- Firestore for persistence
- Firebase Auth for authentication

#### 4. Cloud (Production)

```bash
bun run dev:cloud
```

- Real Firebase services
- Requires Firebase project setup

## 🧪 Testing

### Run All Tests

```bash
bun run test
```

### Run Specific Test Suites

```bash
# Unit tests only
bun run test:unit

# Integration tests (in-memory)
bun run test:integration

# Contract tests (API)
bun run test:contract

# Watch mode
bun run test:watch

# With coverage
bun run test:ci
```

### Test Different Backends

```bash
# In-memory providers
bun run test:integration:inmemory

# Firestore (requires emulator)
bun run emulator:start
bun run test:integration:firestore

# DynamoDB (requires LocalStack)
bun run emulator:start:aws
bun run test:integration:dynamodb

# All backends
bun run test:integration:all
```

## 🐳 Docker Commands

### Firebase Emulators

```bash
# Start
bun run emulator:start

# Stop
bun run emulator:stop

# View logs
bun run emulator:logs

# Reset (clear data)
bun run emulator:reset
```

### LocalStack (AWS)

```bash
# Start
bun run emulator:start:aws

# Stop
bun run emulator:stop:aws

# View logs
bun run emulator:logs:aws

# Reset (clear data)
bun run emulator:reset:aws
```

## ⚙️ Configuration

### Environment Variables

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Key variables:

```bash
# Provider Selection
USE_INMEMORY=true          # true = in-memory, false = external providers
USE_AWS=false              # true = AWS (DynamoDB/Cognito), false = Firebase

# LocalStack (AWS Emulator)
AWS_ENDPOINT_URL=http://localhost:4566
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=test
AWS_SECRET_ACCESS_KEY=test

# Firebase
FIREBASE_PROJECT_ID=your-project-id
GCLOUD_PROJECT=your-project-id
FIRESTORE_EMULATOR_HOST=localhost:8080

# Server
PORT=3000
HOST=localhost

# Rate Limiting
RATE_LIMIT_AUTH_PER_MINUTE=10
RATE_LIMIT_API_PER_MINUTE=100

# WhatsApp Notifications (Feature 002)
WHATSAPP_NOTIFICATIONS_ENABLED=true
WPP_BASE_URL=http://your-wpp-server:21465
WPP_SECRET_KEY=your-secret-key
ADMIN_PHONE_1=5573981112636
```

See `.env.example` for all available options.

## 📝 Code Quality

### Type Checking

```bash
bun run typecheck
```

### Linting

```bash
# Check
bun run lint

# Fix
bun run lint:fix
```

### Formatting

```bash
# Format
bun run format

# Check
bun run format:check
```

## 🔌 API Endpoints

### Health

```
GET /health/liveness    # Server health check
```

### User Endpoints

```
POST   /v1/users                 # Create user
GET    /v1/dashboard             # User dashboard
GET    /v1/offers                # Product offers
```

### Card Endpoints

```
GET    /v1/cards                 # List user's cards
GET    /v1/cards/:id             # Card details
POST   /v1/cards/requests        # Request new card
GET    /v1/cards/:id/transactions # Transaction history
POST   /v1/cards/:id/transactions/purchases  # Make purchase
POST   /v1/cards/:id/transactions/payments   # Make payment
```

### Admin Endpoints

```
GET    /v1/admin/card-requests              # Pending requests
POST   /v1/admin/card-requests/:id/approve  # Approve request
POST   /v1/admin/card-requests/:id/reject   # Reject request
GET    /v1/admin/users/:slug/score          # Get user score
PATCH  /v1/admin/users/:slug/score          # Update user score
POST   /v1/admin/cleanup                    # System cleanup
```

See [OpenAPI specification](../specs/001-headless-financial-api/contracts/openapi.yaml) for detailed API documentation.

## 🔐 Authentication

### Mock Tokens (Development)

For in-memory and LocalStack modes:

```bash
# User token
export USER_TOKEN="mock.$(echo -n '{"ecosystemId":"user-123","role":"user"}' | base64).sig"

# Admin token
export ADMIN_TOKEN="mock.$(echo -n '{"ecosystemId":"admin-001","role":"admin"}' | base64).sig"
```

### Firebase Auth (Emulator)

Generate tokens using the script:

```bash
bun run scripts/get-emulator-token.ts user@example.com user-123
bun run scripts/get-emulator-token.ts admin@example.com admin-001 admin
```

### Testing API

See [../LOCAL_TESTING_GUIDE.md](../LOCAL_TESTING_GUIDE.md) for complete API testing guide with curl examples.

## 🏭 Build & Deploy

### Build

```bash
bun run build
```

Output: `dist/` directory with compiled JavaScript

### Deploy to Firebase

```bash
# Deploy functions and Firestore rules
bun run deploy:dev

# Deploy only functions
bun run deploy:functions

# Deploy only Firestore rules
bun run deploy:rules

# Deploy only indexes
bun run deploy:indexes
```

## 🗂 Key Files

- **`src/api/routes/`** - API route definitions
- **`src/application/`** - Business logic (commands/queries)
- **`src/domain/`** - Domain entities and business rules
- **`src/infrastructure/di/container.ts`** - Dependency injection configuration
- **`docker-compose.yml`** - Firebase emulators setup
- **`docker-compose.aws.yml`** - LocalStack setup
- **`firebase.json`** - Firebase configuration
- **`tsconfig.json`** - TypeScript configuration

## 🐛 Troubleshooting

### Port Already in Use

```bash
# Use different port
PORT=3001 bun run dev
```

### LocalStack Not Ready

```bash
# Wait ~30 seconds after starting
docker ps  # Check health status

# View logs
bun run emulator:logs:aws

# Reset if needed
bun run emulator:reset:aws
```

### Firestore Connection Issues

```bash
# Ensure emulator is running
docker ps | grep firebase

# Check environment variable
echo $FIRESTORE_EMULATOR_HOST  # Should be localhost:8080
```

### Tests Failing

```bash
# Run tests in isolation
bun run test:unit              # Unit tests only
bun run test:integration:inmemory  # No emulators needed

# Check for port conflicts
lsof -i :3000  # Backend port
lsof -i :8080  # Firestore emulator
lsof -i :4566  # LocalStack
```

## 📚 Additional Resources

- [Main README](../README.md) - Project overview
- [ARCHITECTURE.md](../ARCHITECTURE.md) - Detailed architecture
- [CONTRIBUTING.md](../CONTRIBUTING.md) - Contribution guidelines
- [LOCAL_TESTING_GUIDE.md](../LOCAL_TESTING_GUIDE.md) - API testing guide
- [Feature Specs](../specs/) - Feature specifications

## 🤝 Contributing

See [../CONTRIBUTING.md](../CONTRIBUTING.md) for development guidelines.

---

**Questions?** Check the [main documentation](../README.md) or open an issue.
