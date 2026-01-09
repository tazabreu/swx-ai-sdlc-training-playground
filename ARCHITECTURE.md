# Architecture Documentation

This document provides a comprehensive overview of the Tazco Financial Ecosystem architecture, design patterns, and technical decisions.

## 📋 Table of Contents

- [System Overview](#system-overview)
- [Architecture Principles](#architecture-principles)
- [Technology Stack](#technology-stack)
- [Backend Architecture](#backend-architecture)
- [Frontend Architecture](#frontend-architecture)
- [Data Architecture](#data-architecture)
- [Security Architecture](#security-architecture)
- [Deployment Architecture](#deployment-architecture)
- [Design Patterns](#design-patterns)
- [API Design](#api-design)
- [Testing Strategy](#testing-strategy)

## 🏗 System Overview

The Tazco Financial Ecosystem is a full-stack financial simulation platform built as a monorepo with clear separation between backend and frontend components.

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         Frontend                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Next.js App (React 19, Tailwind CSS 4, Shadcn UI)  │  │
│  │  - User Dashboard                                     │  │
│  │  - Admin Dashboard                                    │  │
│  │  - Authentication UI                                  │  │
│  └──────────────────────────────────────────────────────┘  │
└──────────────────────┬──────────────────────────────────────┘
                       │ HTTP/REST API
                       │
┌──────────────────────▼──────────────────────────────────────┐
│                      Backend API                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              Express HTTP Server                      │  │
│  │  - Routes & Middleware                                │  │
│  │  - Authentication & Authorization                     │  │
│  │  - Rate Limiting & Security                           │  │
│  └──────────────────┬───────────────────────────────────┘  │
│                     │                                        │
│  ┌──────────────────▼───────────────────────────────────┐  │
│  │          Application Layer (CQRS)                     │  │
│  │  - Commands (writes)                                  │  │
│  │  - Queries (reads)                                    │  │
│  │  - Handlers                                           │  │
│  └──────────────────┬───────────────────────────────────┘  │
│                     │                                        │
│  ┌──────────────────▼───────────────────────────────────┐  │
│  │              Domain Layer                             │  │
│  │  - Entities (Card, User, Transaction)                │  │
│  │  - Domain Services                                    │  │
│  │  - Value Objects                                      │  │
│  │  - Business Rules                                     │  │
│  └──────────────────┬───────────────────────────────────┘  │
│                     │                                        │
│  ┌──────────────────▼───────────────────────────────────┐  │
│  │         Infrastructure Layer                          │  │
│  │  - Repository Implementations                         │  │
│  │  - Auth Providers                                     │  │
│  │  - Event Publishers                                   │  │
│  │  - External Integrations                              │  │
│  └──────────────────┬───────────────────────────────────┘  │
└────────────────────┬┴───────────────────────────────────────┘
                     │
        ┌────────────┼────────────┐
        │            │            │
    ┌───▼───┐   ┌───▼────┐   ┌──▼──────┐
    │Firebase│   │  AWS   │   │In-Memory│
    │Firestore│   │DynamoDB│   │ Storage │
    │  Auth  │   │Cognito │   │         │
    └────────┘   └────────┘   └─────────┘
```

## 🎯 Architecture Principles

### 1. **Separation of Concerns**
- Clear boundaries between layers
- Each layer has specific responsibilities
- Dependencies flow inward (Dependency Inversion)

### 2. **Domain-Driven Design**
- Business logic encapsulated in domain layer
- Rich domain models
- Ubiquitous language across team

### 3. **CQRS (Command Query Responsibility Segregation)**
- Separate read and write operations
- Commands for state changes
- Queries for data retrieval

### 4. **Provider Pattern**
- Multiple backend implementations (Firebase, AWS, In-Memory)
- Abstraction through interfaces
- Runtime provider selection

### 5. **Security First**
- Authentication required for all endpoints
- Role-based authorization
- Input validation and sanitization
- Rate limiting

### 6. **Testability**
- Dependency injection for easy mocking
- Clear test boundaries
- Multiple test levels (unit, integration, contract)

## 🔧 Technology Stack

### Backend

| Component | Technology | Purpose |
|-----------|-----------|---------|
| **Runtime** | Bun | Fast JavaScript runtime |
| **Language** | TypeScript 5.x | Type-safe development |
| **Framework** | Express 5.x | HTTP server |
| **Persistence** | Firebase Firestore<br/>AWS DynamoDB<br/>In-Memory | Multi-provider data storage |
| **Authentication** | Firebase Auth<br/>AWS Cognito | User authentication |
| **Events** | AWS EventBridge | Event publishing |
| **Testing** | Bun Test | Fast native test runner |
| **Security** | Helmet, CORS | Security middleware |

### Frontend

| Component | Technology | Purpose |
|-----------|-----------|---------|
| **Framework** | Next.js 16 | React framework with App Router |
| **UI Library** | React 19 | Component library |
| **Styling** | Tailwind CSS 4 | Utility-first CSS |
| **Components** | Shadcn UI | Pre-built accessible components |
| **Forms** | React Hook Form | Form management |
| **Validation** | Zod | Schema validation |
| **Icons** | Lucide React | Icon library |
| **Theme** | next-themes | Dark/light mode |

### DevOps

| Component | Technology | Purpose |
|-----------|-----------|---------|
| **CI/CD** | GitHub Actions | Continuous integration |
| **Containers** | Docker | Local emulators |
| **Emulators** | Firebase Emulators<br/>LocalStack | Local development |
| **Linting** | ESLint | Code quality |
| **Formatting** | Prettier | Code formatting |

## 🔙 Backend Architecture

### Layered Architecture

The backend follows a clean, layered architecture with strict dependency rules:

```
┌─────────────────────────────────────────┐
│           API Layer                     │
│  - Routes (Express)                     │
│  - Middleware (auth, validation)        │
│  - DTOs (Data Transfer Objects)         │
└──────────────┬──────────────────────────┘
               │ depends on
┌──────────────▼──────────────────────────┐
│       Application Layer                 │
│  - Commands (CreateCardCommand)         │
│  - Queries (GetDashboardQuery)          │
│  - Handlers (business orchestration)    │
└──────────────┬──────────────────────────┘
               │ depends on
┌──────────────▼──────────────────────────┐
│          Domain Layer                   │
│  - Entities (Card, User, Transaction)   │
│  - Value Objects (Money, CardNumber)    │
│  - Domain Services (ScoringService)     │
│  - Business Rules                       │
└──────────────┬──────────────────────────┘
               │ depends on
┌──────────────▼──────────────────────────┐
│      Infrastructure Layer               │
│  - Repositories (CardRepository)        │
│  - Auth Providers (FirebaseAuth)        │
│  - Event Publishers                     │
│  - External Services                    │
└─────────────────────────────────────────┘
```

### Layer Responsibilities

#### 1. API Layer (`src/api/`)

**Responsibilities:**
- HTTP request/response handling
- Input validation
- Route definition
- Middleware execution
- DTO transformations

**Key Components:**
```
api/
├── routes/
│   ├── health.routes.ts      # Health check endpoints
│   ├── user.routes.ts        # User management
│   ├── card.routes.ts        # Card operations
│   └── admin.routes.ts       # Admin operations
├── middleware/
│   ├── auth.middleware.ts    # Authentication
│   ├── validation.ts         # Request validation
│   └── error-handler.ts      # Error handling
└── dto/
    ├── requests/             # Request DTOs
    └── responses/            # Response DTOs
```

#### 2. Application Layer (`src/application/`)

**Responsibilities:**
- Business workflow orchestration
- Transaction coordination
- Command/query processing
- Cross-cutting concerns

**Key Components:**
```
application/
├── commands/
│   ├── create-card-request.command.ts
│   ├── approve-card.command.ts
│   └── process-purchase.command.ts
├── queries/
│   ├── get-dashboard.query.ts
│   ├── list-cards.query.ts
│   └── get-transactions.query.ts
└── handlers/
    ├── command-handlers/
    └── query-handlers/
```

**CQRS Pattern:**

Commands (Write Operations):
```typescript
// Command
interface CreateCardRequestCommand {
  userId: string;
  productId: string;
  idempotencyKey: string;
}

// Handler
class CreateCardRequestHandler {
  async handle(command: CreateCardRequestCommand): Promise<CardRequest> {
    // 1. Validate business rules
    // 2. Create domain entities
    // 3. Persist to repository
    // 4. Publish domain events
    // 5. Return result
  }
}
```

Queries (Read Operations):
```typescript
// Query
interface GetDashboardQuery {
  userId: string;
}

// Handler
class GetDashboardHandler {
  async handle(query: GetDashboardQuery): Promise<Dashboard> {
    // 1. Fetch data from repository
    // 2. Aggregate information
    // 3. Return view model
  }
}
```

#### 3. Domain Layer (`src/domain/`)

**Responsibilities:**
- Core business logic
- Domain entities and value objects
- Business rules enforcement
- Domain services

**Key Components:**
```
domain/
├── entities/
│   ├── card.entity.ts
│   ├── user.entity.ts
│   ├── transaction.entity.ts
│   └── card-request.entity.ts
├── value-objects/
│   ├── money.vo.ts
│   ├── credit-score.vo.ts
│   └── card-number.vo.ts
├── services/
│   ├── scoring.service.ts
│   ├── credit-limit.service.ts
│   └── card-approval.service.ts
└── interfaces/
    └── repositories/        # Repository interfaces
```

**Example Entity:**
```typescript
export class Card {
  constructor(
    public readonly cardId: string,
    public readonly userId: string,
    private _status: CardStatus,
    private _balance: Money,
    private _creditLimit: Money,
  ) {}

  // Business logic
  canMakePurchase(amount: Money): boolean {
    if (this._status !== 'ACTIVE') return false;
    const newBalance = this._balance.add(amount);
    return newBalance.isLessThanOrEqual(this._creditLimit);
  }

  makePurchase(amount: Money): void {
    if (!this.canMakePurchase(amount)) {
      throw new InsufficientCreditError();
    }
    this._balance = this._balance.add(amount);
  }
}
```

#### 4. Infrastructure Layer (`src/infrastructure/`)

**Responsibilities:**
- External service integration
- Database access
- Authentication implementation
- Event publishing

**Key Components:**
```
infrastructure/
├── persistence/
│   ├── inmemory/
│   │   ├── inmemory-card.repository.ts
│   │   └── inmemory-user.repository.ts
│   ├── firestore/
│   │   ├── firestore-card.repository.ts
│   │   └── firestore-user.repository.ts
│   └── aws/
│       ├── dynamodb-card.repository.ts
│       └── dynamodb-user.repository.ts
├── auth/
│   ├── firebase-auth.provider.ts
│   ├── cognito-auth.provider.ts
│   └── mock-auth.provider.ts
├── events/
│   ├── event-publisher.interface.ts
│   ├── eventbridge-publisher.ts
│   └── inmemory-publisher.ts
└── di/
    └── container.ts         # Dependency injection
```

### Provider Pattern

Multiple implementations for flexibility:

```typescript
// Interface (in domain layer)
interface ICardRepository {
  save(card: Card): Promise<void>;
  findById(id: string): Promise<Card | null>;
  findByUserId(userId: string): Promise<Card[]>;
}

// Implementations (in infrastructure layer)
class InMemoryCardRepository implements ICardRepository { ... }
class FirestoreCardRepository implements ICardRepository { ... }
class DynamoDBCardRepository implements ICardRepository { ... }

// Runtime selection (in DI container)
const repository = 
  config.useInMemory ? new InMemoryCardRepository() :
  config.useAWS ? new DynamoDBCardRepository() :
  new FirestoreCardRepository();
```

## 🎨 Frontend Architecture

### Next.js App Router Structure

```
frontend/src/
├── app/
│   ├── (auth)/              # Auth route group
│   │   └── login/           # Login page
│   ├── (user)/              # User route group
│   │   ├── dashboard/       # User dashboard
│   │   ├── cards/           # Card management
│   │   └── transactions/    # Transaction history
│   ├── (admin)/             # Admin route group
│   │   ├── requests/        # Card requests
│   │   └── users/           # User management
│   ├── layout.tsx           # Root layout
│   └── page.tsx             # Home page
├── components/
│   ├── ui/                  # Shadcn UI components
│   ├── cards/               # Card components
│   ├── dashboard/           # Dashboard components
│   └── layout/              # Layout components
├── contexts/
│   └── auth-context.tsx     # Authentication context
├── lib/
│   ├── api/                 # API client
│   └── utils.ts             # Utilities
└── styles/
    └── globals.css          # Global styles
```

### Component Architecture

**Atomic Design Pattern:**

1. **Atoms** - Basic UI elements
2. **Molecules** - Simple component groups
3. **Organisms** - Complex components
4. **Templates** - Page layouts
5. **Pages** - Complete pages

### State Management

- **Server State**: React Server Components (default)
- **Client State**: React Context API
- **Form State**: React Hook Form
- **URL State**: Next.js routing

### API Client

```typescript
// lib/api/client.ts
class ApiClient {
  private baseUrl: string;
  private token?: string;

  async get<T>(path: string): Promise<T> { ... }
  async post<T>(path: string, data: any): Promise<T> { ... }
  
  // Authentication
  setToken(token: string): void { ... }
}
```

## 💾 Data Architecture

### Domain Models

#### User
```typescript
interface User {
  ecosystemId: string;      // Primary key
  email: string;
  role: 'user' | 'admin';
  creditScore: number;
  createdAt: Date;
  updatedAt: Date;
}
```

#### Card
```typescript
interface Card {
  cardId: string;           // Primary key
  userId: string;           // Foreign key
  cardNumber: string;
  status: CardStatus;
  balance: number;
  creditLimit: number;
  createdAt: Date;
  updatedAt: Date;
}
```

#### Transaction
```typescript
interface Transaction {
  transactionId: string;    // Primary key
  cardId: string;           // Foreign key
  type: 'PURCHASE' | 'PAYMENT';
  amount: number;
  merchant?: string;
  category?: string;
  timestamp: Date;
}
```

#### CardRequest
```typescript
interface CardRequest {
  requestId: string;        // Primary key
  userId: string;           // Foreign key
  productId: string;
  status: RequestStatus;
  cardId?: string;          // Set after approval
  rejectionReason?: string;
  createdAt: Date;
  reviewedAt?: Date;
}
```

### Database Schema

#### Firebase Firestore Collections

```
users/
  {ecosystemId}/
    - email
    - role
    - creditScore
    - createdAt

cards/
  {cardId}/
    - userId
    - cardNumber
    - status
    - balance
    - creditLimit

transactions/
  {transactionId}/
    - cardId
    - type
    - amount
    - merchant
    - timestamp

card-requests/
  {requestId}/
    - userId
    - status
    - productId
    - cardId
```

#### AWS DynamoDB Tables

- **tazco-users** (PK: ecosystemId)
- **tazco-cards** (PK: cardId, GSI: userId)
- **tazco-transactions** (PK: transactionId, GSI: cardId)
- **tazco-card-requests** (PK: requestId, GSI: userId-status)

### Event Sourcing (Future)

Domain events captured for audit and replay:

```typescript
interface DomainEvent {
  eventId: string;
  eventType: string;
  aggregateId: string;
  timestamp: Date;
  payload: any;
}

// Examples
- CardRequestCreated
- CardRequestApproved
- PurchaseMade
- PaymentProcessed
```

## 🔒 Security Architecture

### Authentication Flow

```
1. User logs in → Frontend
2. Frontend → Firebase Auth / Cognito
3. Get JWT token
4. Store token (httpOnly cookie or secure storage)
5. Include token in API requests (Authorization: Bearer {token})
6. Backend validates token
7. Extract user claims (ecosystemId, role)
8. Proceed with request
```

### Authorization

**Role-Based Access Control (RBAC):**

- **User Role**: Can manage own cards and transactions
- **Admin Role**: Can approve requests, manage users, adjust scores

**Middleware:**
```typescript
const requireRole = (role: UserRole) => {
  return (req, res, next) => {
    if (req.user.role !== role) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    next();
  };
};

// Usage
router.post('/admin/approve', requireRole('admin'), approveHandler);
```

### Security Measures

1. **Helmet** - HTTP security headers
2. **CORS** - Cross-origin resource sharing
3. **Rate Limiting** - Prevent abuse
4. **Input Validation** - Prevent injection
5. **Idempotency** - Prevent duplicate operations
6. **HTTPS Only** - Encrypted transport (production)

## 🚀 Deployment Architecture

### Deployment Modes

1. **Development (In-Memory)**
   - No external dependencies
   - Fast startup
   - Data lost on restart

2. **Development (Emulators)**
   - Firebase Emulators or LocalStack
   - Persistent data (Docker volumes)
   - Close to production

3. **Production (Cloud)**
   - Firebase (Firestore + Auth)
   - AWS (DynamoDB + Cognito)
   - Scalable and managed

### Infrastructure as Code

```yaml
# Firebase Functions deployment
backend/
  functions:
    - name: api
      runtime: nodejs20
      entryPoint: http
      
# AWS Lambda + API Gateway (future)
```

## 🎯 Design Patterns

### 1. Repository Pattern
Abstracts data access, enables provider switching

### 2. Command Query Responsibility Segregation (CQRS)
Separates read and write operations

### 3. Dependency Injection
Loose coupling, easier testing

### 4. Factory Pattern
Creates provider instances based on configuration

### 5. Strategy Pattern
Different implementations for auth, persistence, events

### 6. Middleware Pattern
Request processing pipeline in Express

### 7. Value Object Pattern
Immutable domain primitives (Money, Email)

## 📡 API Design

### RESTful Principles

- **Resources**: Nouns (cards, transactions, users)
- **HTTP Methods**: GET, POST, PATCH, DELETE
- **Status Codes**: Proper HTTP codes
- **Versioning**: `/v1/` prefix

### Endpoint Structure

```
/v1/users              POST    Create user
/v1/dashboard          GET     User dashboard
/v1/offers             GET     Product offers
/v1/cards              GET     List cards
/v1/cards/requests     POST    Request card
/v1/cards/:id          GET     Card details
/v1/cards/:id/transactions/purchases  POST  Purchase
/v1/cards/:id/transactions/payments   POST  Payment
/v1/admin/card-requests        GET    Pending requests
/v1/admin/card-requests/:id/approve   POST  Approve
```

### Response Format

```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "timestamp": "2024-01-09T12:00:00Z",
    "requestId": "req-123"
  }
}
```

### Error Format

```json
{
  "error": {
    "code": "INSUFFICIENT_CREDIT",
    "message": "Insufficient credit for purchase",
    "details": { ... }
  }
}
```

## 🧪 Testing Strategy

### Test Pyramid

```
         /\
        /E2E\          ← Few, critical paths
       /──────\
      /Contract\       ← API contract tests
     /──────────\
    /Integration \     ← Component interaction
   /──────────────\
  /  Unit Tests    \   ← Most tests, fast
 /──────────────────\
```

### Test Levels

1. **Unit Tests** - 70%
   - Pure functions
   - Domain logic
   - Value objects

2. **Integration Tests** - 20%
   - Repository + Database
   - API + Handlers
   - Auth flow

3. **Contract Tests** - 10%
   - API endpoints
   - Request/response format
   - Backward compatibility

### Testing Backends

```bash
# In-memory (fast, no setup)
bun run test:integration:inmemory

# Firebase (realistic)
bun run test:integration:firestore

# AWS (production-like)
bun run test:integration:dynamodb
```

## 📊 Observability (Future - Spec 003)

### Monitoring
- Health endpoints
- Metrics collection
- Performance tracking

### Logging
- Structured logs
- Request tracing
- Error tracking

### Tracing
- Distributed tracing
- OpenTelemetry integration
- Jaeger/Zipkin

---

## 🔄 Future Enhancements

1. **Event Sourcing** - Full event history
2. **GraphQL API** - Alternative to REST
3. **WebSockets** - Real-time updates
4. **Caching Layer** - Redis for performance
5. **Message Queue** - Async processing
6. **Microservices** - Service decomposition

---

**Last Updated:** January 2025
