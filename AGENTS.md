# CLAUDE.md

This file provides guidance to Claude Code and other coding agents when working with this repository.

## Package Manager

**Prefer the usage of `npm` over other package managers (e.g. `bun` or `yarn`**

```bash
# Install dependencies (from root)
npm install

# Run scripts for all packages
npm run build
npm run typecheck
npm run lint

# Run backend-specific commands
npm run dev:backend     # Start backend dev server (LocalStack by default)
npm run test            # Run backend tests

# Run frontend-specific commands
npm run dev:frontend    # Start frontend dev server (port 3001)
```

## Repository Overview

**acme-sample-financial-ecosystem-product** is a full-stack Financial API (Cards-domain) for testing and verification. It consists of:

- **Backend**: Headless API service providing credit card management, scoring, and transactions
- **Frontend**: React (Next.js) application with Shadcn UI for user and admin interfaces

## Monorepo Structure

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
│   ├── docker-compose.aws.yml    # LocalStack (AWS emulators)
│   └── package.json              # Backend dependencies
├── frontend/                     # Next.js frontend
│   ├── src/
│   │   ├── app/                  # App Router pages
│   │   │   ├── (auth)/           # Login page
│   │   │   ├── (user)/           # User dashboard, cards, transactions
│   │   │   └── (admin)/          # Admin requests, score management
│   │   ├── components/           # UI components (Shadcn)
│   │   ├── contexts/             # React contexts (auth)
│   │   └── lib/api/              # API client
│   └── package.json              # Frontend dependencies
├── specs/                        # Feature specifications
├── package.json                  # Root workspace config
├── tsconfig.base.json            # Shared TypeScript config
└── .github/workflows/            # CI workflows
```

## Commit Message Pattern

Use Gitmoji + Conventional Commits in a single, action-oriented subject line.

Example:

```
✨ feat(deploy): add health-check manifest

.- nginx deployment for cluster verification
.- ClusterIP service on port 80
```

## Development Commands

### Backend Development

```bash
cd backend

# Start dev server with LocalStack (default)
npm run dev

# Alternative backend modes
npm run dev:in-memory    # Quick testing without Docker
npm run dev:emulator     # Firebase emulators
npm run dev:cloud        # Real Firebase (production)

# Start LocalStack first
docker compose -f docker-compose.aws.yml up -d

# Run tests
npm run test             # All tests
npm test tests/unit      # Unit tests only
npm test tests/integration  # Integration tests

# Type checking and linting
npm run typecheck
npm run lint
npm run lint:fix

# Build
npm run build
```

### Frontend Development

```bash
cd frontend

# Start dev server (port 3001)
npm run dev

# Type checking and linting
npm run typecheck
npm run lint

# Build for production
npm run build
```

### Full Stack Development

```bash
# Terminal 1: Start LocalStack
cd backend && docker compose -f docker-compose.aws.yml up -d

# Terminal 2: Start backend (localhost:3000)
cd backend && npm run dev

# Terminal 3: Start frontend (localhost:3001)
cd frontend && npm run dev
```

### Root-Level Commands

```bash
# Run commands across all packages
npm run typecheck        # Typecheck backend + frontend
npm run lint             # Lint backend + frontend
npm run build            # Build backend + frontend

# Run specific package
npm run dev:backend      # Backend only
npm run dev:frontend     # Frontend only
```

## Key Workflows

### 00-ci.yml

Runs `npm run typecheck`, `npm run lint`, and `npm test` on PRs and on pushes to `main`.

### 10-on-pr-validate.yml

Path-based validation that detects changes in `backend/` or `frontend/` and runs appropriate checks.

## Environment Variables

### Frontend

| Variable | Default | Description |
|----------|---------|-------------|
| `NEXT_PUBLIC_API_URL` | `http://localhost:3000` | Backend API URL |

Set in `frontend/.env.local` for local development.

## Active Technologies

- **Backend**: TypeScript 5.x, Express, Firebase/DynamoDB, LocalStack
- **Frontend**: Next.js 16, React 19, Tailwind CSS 4, Shadcn UI