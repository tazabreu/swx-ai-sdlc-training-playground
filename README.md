# acme-sample-financial-ecosystem-product

Full-stack Financial API (Cards-domain) for testing and verification: credit scoring, card requests/approvals, and purchase/payment simulation.

## Overview

**acme-sample-financial-ecosystem-product** is a comprehensive financial services platform consisting of:

- **Backend**: Headless API service providing credit card management, scoring, and transaction processing
- **Frontend**: React (Next.js) application with Shadcn UI for user and admin interfaces

## Technology Stack

### Backend
- **Runtime**: Node.js 20+ with TypeScript 5.x
- **Framework**: Express.js
- **Persistence**: Firebase/Firestore, DynamoDB (LocalStack)
- **Auth**: Firebase Auth, AWS Cognito
- **Testing**: Bun test runner
- **Architecture**: CQRS pattern with DDD principles

### Frontend
- **Framework**: Next.js 16 (App Router)
- **UI Library**: React 19
- **Styling**: Tailwind CSS 4
- **Components**: Shadcn UI
- **State Management**: React Context API

## Project Structure

```
.
├── backend/                      # Backend API service
│   ├── src/
│   │   ├── api/                  # Express routes, middleware, DTOs
│   │   ├── application/          # CQRS commands and queries
│   │   ├── domain/               # Entities, services, value objects
│   │   ├── functions/            # Firebase Functions entry points
│   │   └── infrastructure/       # Repositories, auth providers, DI
│   ├── tests/
│   │   ├── unit/                 # Unit tests
│   │   ├── integration/          # Integration tests (with emulators)
│   │   └── contract/             # API contract tests
│   ├── scripts/                  # Dev scripts, LocalStack init
│   ├── docker-compose.yml        # Firebase emulators
│   └── docker-compose.aws.yml    # LocalStack (AWS emulators)
├── frontend/                     # Next.js frontend
│   ├── src/
│   │   ├── app/                  # App Router pages
│   │   │   ├── (auth)/           # Login page
│   │   │   ├── (user)/           # User dashboard, cards, transactions
│   │   │   └── (admin)/          # Admin requests, score management
│   │   ├── components/           # UI components (Shadcn)
│   │   ├── contexts/             # React contexts (auth)
│   │   └── lib/api/              # API client
│   └── tests/                    # Frontend tests
├── specs/                        # Feature specifications
│   ├── 001-headless-financial-api/
│   └── 002-aws-localstack-infrastructure/
├── .github/workflows/            # CI/CD workflows
├── AGENTS.md                     # Agent development guide
├── LOCAL_TESTING_GUIDE.md        # Detailed testing instructions
└── README.md                     # This file
```

## Quick Start

### Prerequisites

- Node.js 20 or higher
- npm (preferred package manager)
- Docker (for emulators)

### Installation

```bash
# Install all dependencies
npm install
```

### Development

#### Full Stack Development

```bash
# Terminal 1: Start LocalStack (AWS emulators)
cd backend && docker compose -f docker-compose.aws.yml up -d

# Terminal 2: Start backend (http://localhost:3000)
npm run dev:backend

# Terminal 3: Start frontend (http://localhost:3001)
npm run dev:frontend
```

#### Backend Only

```bash
# Quick start with in-memory providers (no Docker required)
npm run dev:backend

# Or navigate to backend directory
cd backend
npm run dev                  # Uses in-memory providers
npm run dev:in-memory        # Quick testing without Docker
npm run dev:emulator         # Firebase emulators
npm run dev:aws              # LocalStack (AWS services)
npm run dev:cloud            # Real Firebase (production)
```

#### Frontend Only

```bash
npm run dev:frontend

# Or navigate to frontend directory
cd frontend
npm run dev
```

### Environment Variables

#### Frontend

Create a `frontend/.env.local` file:

```env
NEXT_PUBLIC_API_URL=http://localhost:3000
```

## Testing

### Backend Tests

```bash
# Run all tests
npm test

# Run specific test suites
npm run test:unit            # Unit tests only
npm run test:contract        # API contract tests
npm run test:ci              # All tests with coverage

# Test against different backends
cd backend
npm run test:integration:inmemory      # In-memory
npm run test:integration:firestore     # Firestore emulator
npm run test:integration:dynamodb      # DynamoDB (LocalStack)
```

**Note**: This project uses Bun's test runner (`bun:test`) for backend tests, not Jest.

### Validation

```bash
# Full validation (typecheck + lint + tests)
npm run typecheck        # Type checking across all packages
npm run lint             # Linting across all packages
npm run build            # Build all packages
```

## Emulators (Optional)

### Firebase Emulators

```bash
cd backend

# Start Firestore/Auth emulators via Docker
npm run emulator:start

# Run API against emulators
npm run dev:emulator

# Run tests against Firestore emulator
npm run test:integration:firestore

# Stop emulators
npm run emulator:stop

# Reset emulators (clears all data)
npm run emulator:reset
```

### AWS LocalStack

LocalStack provides local AWS services (DynamoDB, Cognito, EventBridge, SQS, SSM).

```bash
cd backend

# Start LocalStack
npm run emulator:start:aws

# Run API against LocalStack
npm run dev:aws

# Run tests against LocalStack
npm run test:integration:dynamodb

# Stop LocalStack
npm run emulator:stop:aws

# Reset LocalStack (clears all data)
npm run emulator:reset:aws
```

## API Documentation

### Specifications

- [Feature Specification](specs/001-headless-financial-api/spec.md)
- [OpenAPI Contract](specs/001-headless-financial-api/contracts/openapi.yaml)
- [Implementation Tasks](specs/001-headless-financial-api/tasks.md)

### Testing the API

For detailed API testing instructions, see [LOCAL_TESTING_GUIDE.md](LOCAL_TESTING_GUIDE.md).

Quick test script:
```bash
cd backend
./test-local-api.sh
```

## CI/CD

### Workflows

- **00-ci.yml**: Runs typecheck, lint, and tests on PRs and pushes to `main`
- **10-on-pr-validate.yml**: Path-based validation for `backend/` and `frontend/` changes
- **10-firestore-emulator-tests.yml**: Integration tests with Firebase emulators
- **20-deploy.yml**: Deployment workflow
- **30-destroy.yml**: Infrastructure cleanup

### Running CI Checks Locally

```bash
# Type checking
npm run typecheck

# Linting
npm run lint

# Tests
npm test

# Full validation
npm run typecheck && npm run lint && npm test
```

## Development Guides

- **[AGENTS.md](AGENTS.md)**: Comprehensive development guide for AI coding agents
- **[LOCAL_TESTING_GUIDE.md](LOCAL_TESTING_GUIDE.md)**: Step-by-step API testing guide with examples

## Features

### User Features
- User registration and authentication
- View available credit card offers
- Request new credit cards
- View card details and balances
- Make purchases with credit cards
- Make payments on credit cards
- View transaction history

### Admin Features
- Review pending card requests
- Approve or reject card applications
- View and adjust user credit scores
- Manage system data (cleanup operations)

## Architecture

The backend follows **Clean Architecture** principles with **CQRS** pattern:

- **Domain Layer**: Core business entities and logic (cards, users, transactions, scoring)
- **Application Layer**: Use cases implemented as commands and queries
- **Infrastructure Layer**: Concrete implementations of repositories and external services
- **API Layer**: HTTP endpoints, middleware, and request/response handling

## Contributing

This is a training and testing playground. For contribution guidelines, refer to the project's internal documentation.

## License

UNLICENSED - Private project for ACME Platform Team
