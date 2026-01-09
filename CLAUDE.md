# CLAUDE.md

This file provides guidance to Claude Code and other coding agents when working with this repository.

## Package Manager

**Always use `bun` instead of `npm` or `yarn`.**

```bash
# Install dependencies (from root)
bun install

# Run scripts for all packages
bun run build
bun run typecheck
bun run lint

# Run backend-specific commands
bun run dev:backend     # Start backend dev server (LocalStack by default)
bun run test            # Run backend tests

# Run frontend-specific commands
bun run dev:frontend    # Start frontend dev server (port 3001)
```

Do NOT use `npm run`, `npm install`, `yarn`, or other package managers.

## Repository Overview

**tazco-sample-financial-ecosystem-product** is a full-stack Financial API (Cards-domain) for testing and verification. It consists of:

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
bun run dev

# Alternative backend modes
bun run dev:in-memory    # Quick testing without Docker
bun run dev:emulator     # Firebase emulators
bun run dev:cloud        # Real Firebase (production)

# Start LocalStack first
docker compose -f docker-compose.aws.yml up -d

# Run tests
bun run test             # All tests
bun test tests/unit      # Unit tests only
bun test tests/integration  # Integration tests

# Type checking and linting
bun run typecheck
bun run lint
bun run lint:fix

# Build
bun run build
```

### Frontend Development

```bash
cd frontend

# Start dev server (port 3001)
bun run dev

# Type checking and linting
bun run typecheck
bun run lint

# Build for production
bun run build
```

### Full Stack Development

```bash
# Terminal 1: Start LocalStack
cd backend && docker compose -f docker-compose.aws.yml up -d

# Terminal 2: Start backend (localhost:3000)
cd backend && bun run dev

# Terminal 3: Start frontend (localhost:3001)
cd frontend && bun run dev
```

### Root-Level Commands

```bash
# Run commands across all packages
bun run typecheck        # Typecheck backend + frontend
bun run lint             # Lint backend + frontend
bun run build            # Build backend + frontend

# Run specific package
bun run dev:backend      # Backend only
bun run dev:frontend     # Frontend only
```

## Key Workflows

### 00-ci.yml

Runs `bun run typecheck`, `bun run lint`, and `bun test` on PRs and on pushes to `main`.

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

## Recent Changes

- 005-frontend-monorepo: Restructured as Bun workspace monorepo with frontend
- 004-aws-localstack-infrastructure: Added DynamoDB backend via LocalStack
