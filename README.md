# Tazco Financial Ecosystem Product

A full-stack **Financial API (Cards-domain)** platform for testing and verification, featuring credit scoring, card request management, purchase/payment simulation, and administrative tools.

[![CI](https://github.com/tazabreu/swx-ai-sdlc-training-playground/workflows/CI/badge.svg)](https://github.com/tazabreu/swx-ai-sdlc-training-playground/actions)

## 📋 Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Architecture](#architecture)
- [Quick Start](#quick-start)
- [Development](#development)
- [Testing](#testing)
- [Documentation](#documentation)
- [Contributing](#contributing)
- [License](#license)

## 🔍 Overview

This project provides a comprehensive financial ecosystem simulation with:

- **Backend**: Headless API service built with TypeScript, Express, and multiple persistence options (In-Memory, Firebase, AWS DynamoDB)
- **Frontend**: Modern React application using Next.js 16, React 19, Tailwind CSS 4, and Shadcn UI
- **Multi-Provider Architecture**: Supports Firebase (Firestore/Auth), AWS (DynamoDB/Cognito), and in-memory providers
- **CQRS Pattern**: Clean separation of commands and queries
- **Domain-Driven Design**: Well-structured domain entities and services

## ✨ Features

### User Features
- 🎫 Credit card request and management
- 💳 Purchase and payment simulation
- 📊 Personal dashboard with financial overview
- 🔐 Secure authentication and authorization
- 📱 Responsive web interface

### Admin Features
- ✅ Card request approval/rejection workflow
- 📈 Credit score management
- 👥 User management
- 🔧 System cleanup utilities
- 📬 WhatsApp notifications for card approvals

### Technical Features
- 🚀 Multiple deployment modes (in-memory, emulator, cloud, LocalStack)
- 🧪 Comprehensive test coverage (unit, integration, contract tests)
- 🔒 Security-first design with Helmet, CORS, and rate limiting
- 📝 OpenAPI/Swagger documentation
- 🎯 TypeScript end-to-end
- 🐳 Docker support for local development

## 🏗 Architecture

This is a **monorepo** managed with Bun workspaces:

```
tazco-financial-ecosystem/
├── backend/              # Backend API service
│   ├── src/
│   │   ├── api/          # Express routes, middleware, DTOs
│   │   ├── application/  # CQRS commands and queries
│   │   ├── domain/       # Business entities and logic
│   │   └── infrastructure/ # Repositories, auth, DI
│   └── tests/
│       ├── unit/         # Unit tests
│       ├── integration/  # Integration tests
│       └── contract/     # API contract tests
├── frontend/             # Next.js frontend
│   ├── src/
│   │   ├── app/          # App Router pages
│   │   ├── components/   # Reusable UI components
│   │   ├── contexts/     # React contexts
│   │   └── lib/          # Utilities and API client
│   └── tests/
└── specs/                # Feature specifications
    ├── 001-headless-financial-api/
    ├── 002-whatsapp-admin-notifications/
    ├── 003-streaming-and-observability/
    └── 004-aws-localstack-infrastructure/
```

For detailed architecture information, see [ARCHITECTURE.md](./ARCHITECTURE.md).

## 🚀 Quick Start

### Prerequisites

- **Bun** >= 1.0.0 ([Install Bun](https://bun.sh))
- **Node.js** >= 20.0.0
- **Docker** (optional, for emulators)

### Installation

```bash
# Clone the repository
git clone https://github.com/tazabreu/swx-ai-sdlc-training-playground.git
cd swx-ai-sdlc-training-playground

# Install dependencies
bun install
```

### Running Locally

#### Option 1: Quick Start (In-Memory)

Fastest way to get started with no external dependencies:

```bash
# Start backend (port 3000)
bun run dev:backend

# In another terminal, start frontend (port 3001)
bun run dev:frontend
```

Visit http://localhost:3001 for the UI or use the API at http://localhost:3000.

#### Option 2: AWS LocalStack (Recommended for Development)

Most complete local development experience with AWS services:

```bash
# Terminal 1: Start LocalStack
cd backend && bun run emulator:start:aws

# Terminal 2: Start backend with AWS providers
cd backend && bun run dev:aws

# Terminal 3: Start frontend
cd frontend && bun run dev
```

#### Option 3: Firebase Emulators

```bash
# Terminal 1: Start Firebase emulators
cd backend && bun run emulator:start

# Terminal 2: Start backend with Firebase providers
cd backend && bun run dev:emulator

# Terminal 3: Start frontend
cd frontend && bun run dev
```

### Testing the API

See [LOCAL_TESTING_GUIDE.md](./LOCAL_TESTING_GUIDE.md) for detailed API testing instructions including:
- Authentication setup
- Creating users
- Card request workflow
- Admin operations
- Example curl commands

## 💻 Development

### Package Manager

**Always use `bun` instead of `npm` or `yarn`.**

```bash
# Install dependencies
bun install

# Run commands for all packages
bun run build        # Build backend + frontend
bun run typecheck    # Type check all packages
bun run lint         # Lint all packages
bun run format       # Format all packages

# Run package-specific commands
bun run dev:backend   # Backend only
bun run dev:frontend  # Frontend only
```

### Backend Development

```bash
cd backend

# Development modes
bun run dev              # LocalStack (default)
bun run dev:in-memory    # Quick testing without Docker
bun run dev:emulator     # Firebase emulators
bun run dev:cloud        # Real Firebase (production)

# Testing
bun run test             # All tests
bun run test:unit        # Unit tests only
bun run test:contract    # Contract tests
bun run test:integration # Integration tests

# Code quality
bun run typecheck
bun run lint
bun run lint:fix
bun run format
```

### Frontend Development

```bash
cd frontend

# Development
bun run dev              # Start dev server (port 3001)

# Testing
bun run test             # Run tests

# Code quality
bun run typecheck
bun run lint
bun run format

# Build
bun run build
```

### Environment Variables

Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
```

For frontend configuration, create `frontend/.env.local`:

```bash
NEXT_PUBLIC_API_URL=http://localhost:3000
```

See `.env.example` for all available configuration options.

## 🧪 Testing

This repository uses **Bun's test runner** (not Jest).

### Running Tests

```bash
# From root - runs backend tests
bun test

# Backend tests
cd backend
bun run test              # All tests
bun run test:unit         # Unit tests
bun run test:contract     # API contract tests
bun run test:integration  # Integration tests
bun run test:ci           # Tests with coverage

# Test specific backends
bun run test:integration:inmemory   # In-memory provider tests
bun run test:integration:firestore  # Firestore tests (requires emulator)
bun run test:integration:dynamodb   # DynamoDB tests (requires LocalStack)

# Frontend tests
cd frontend
bun run test
```

### Continuous Integration

GitHub Actions workflows automatically run on every pull request:
- **00-ci.yml**: Typecheck, lint, and test
- **10-on-pr-validate.yml**: Path-based validation for backend/frontend changes
- **10-firestore-emulator-tests.yml**: Firestore emulator integration tests

## 📚 Documentation

- **[ARCHITECTURE.md](./ARCHITECTURE.md)**: Detailed system architecture and design patterns
- **[CONTRIBUTING.md](./CONTRIBUTING.md)**: Contribution guidelines and development workflow
- **[LOCAL_TESTING_GUIDE.md](./LOCAL_TESTING_GUIDE.md)**: Complete API testing guide with examples
- **[CLAUDE.md](./CLAUDE.md)**: AI coding agent guidelines
- **[DEPLOYMENT.md](./DEPLOYMENT.md)**: Deployment instructions and configurations
- **[specs/](./specs/)**: Feature specifications and technical designs

### API Documentation

- OpenAPI/Swagger specification: `specs/001-headless-financial-api/contracts/openapi.yaml`
- View interactive API docs: Start the backend and visit `/api-docs` (when available)

## 🤝 Contributing

We welcome contributions! Please see [CONTRIBUTING.md](./CONTRIBUTING.md) for:
- Development setup
- Code style guidelines
- Commit message conventions
- Pull request process
- Testing requirements

### Commit Message Convention

We use Gitmoji + Conventional Commits:

```
✨ feat(cards): add credit limit adjustment
🐛 fix(auth): resolve token expiration issue
📝 docs(readme): update installation steps
```

## 📄 License

This project is **UNLICENSED** and proprietary to Tazco Platform Team.

---

## 📞 Support

For questions or issues:
1. Check existing [Issues](https://github.com/tazabreu/swx-ai-sdlc-training-playground/issues)
2. Review [LOCAL_TESTING_GUIDE.md](./LOCAL_TESTING_GUIDE.md) for common scenarios
3. Create a new issue with detailed information

## 🗺 Roadmap

- [ ] Streaming and observability (Spec 003)
- [ ] Enhanced admin dashboard
- [ ] Mobile application
- [ ] Advanced fraud detection
- [ ] Multi-currency support

---

**Built with ❤️ by the Tazco Platform Team**
