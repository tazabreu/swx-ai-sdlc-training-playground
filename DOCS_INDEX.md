# Documentation Index

Complete guide to all documentation in the Tazco Financial Ecosystem.

## 📚 Getting Started

Start here if you're new to the project:

1. **[README.md](./README.md)** - Project overview, features, and quick start guide
2. **[LOCAL_TESTING_GUIDE.md](./LOCAL_TESTING_GUIDE.md)** - Step-by-step guide to testing the API locally
3. **[CONTRIBUTING.md](./CONTRIBUTING.md)** - How to contribute to the project

## 🏗 Architecture & Design

Deep dive into the system architecture:

- **[ARCHITECTURE.md](./ARCHITECTURE.md)** - Complete system architecture documentation
  - Layered architecture (API, Application, Domain, Infrastructure)
  - CQRS pattern implementation
  - Provider pattern for multi-backend support
  - Domain-driven design
  - Data models and schemas
  - Security architecture

## 🔧 Development

Documentation for developers:

### Setup & Configuration
- **[README.md](./README.md#quick-start)** - Initial setup and installation
- **[backend/README.md](./backend/README.md)** - Backend-specific setup and commands
- **[frontend/README.md](./frontend/README.md)** - Frontend-specific setup and commands

### Development Workflow
- **[CONTRIBUTING.md](./CONTRIBUTING.md)** - Complete contribution guide
  - Git workflow
  - Code style guidelines
  - Commit message conventions
  - Pull request process
  - Testing requirements

### AI Agent Guidelines
- **[CLAUDE.md](./CLAUDE.md)** - Guidelines for AI coding agents
  - Package manager usage (Bun)
  - Repository structure
  - Development commands
  - Commit message patterns

## 📡 API Reference

Everything about the API:

- **[API.md](./API.md)** - Complete REST API documentation
  - Authentication
  - All endpoints with request/response examples
  - Error codes
  - Rate limiting
  - Common patterns (idempotency, pagination)

- **[OpenAPI Specification](./specs/001-headless-financial-api/contracts/openapi.yaml)** - Machine-readable API spec

## 🧪 Testing

Testing guides and best practices:

- **[LOCAL_TESTING_GUIDE.md](./LOCAL_TESTING_GUIDE.md)** - Manual API testing guide
  - Authentication setup
  - User workflow examples
  - Admin workflow examples
  - curl command examples

- **[backend/README.md#testing](./backend/README.md#testing)** - Backend testing
  - Unit tests
  - Integration tests
  - Contract tests
  - Testing different backends (in-memory, Firebase, AWS)

- **[frontend/README.md#testing](./frontend/README.md#testing)** - Frontend testing

## 🚀 Deployment

Deploy the application to various platforms:

- **[DEPLOYMENT.md](./DEPLOYMENT.md)** - Complete deployment guide
  - Firebase deployment
  - AWS deployment (Lambda, DynamoDB, Cognito)
  - Docker deployment
  - Environment configuration
  - CI/CD setup
  - Monitoring and logging

## 🐛 Troubleshooting

Solutions to common problems:

- **[TROUBLESHOOTING.md](./TROUBLESHOOTING.md)** - Comprehensive troubleshooting guide
  - Installation issues
  - Development issues
  - Backend/Frontend issues
  - Database connection problems
  - Authentication errors
  - Docker/Emulator issues
  - Testing problems
  - Deployment issues
  - Performance optimization

## 📋 Specifications

Detailed feature specifications:

- **[specs/001-headless-financial-api/](./specs/001-headless-financial-api/)** - Core API specification
  - Feature spec
  - Data model
  - Implementation plan
  - OpenAPI contract
  
- **[specs/002-whatsapp-admin-notifications/](./specs/002-whatsapp-admin-notifications/)** - WhatsApp integration
  
- **[specs/003-streaming-and-observability/](./specs/003-streaming-and-observability/)** - Future observability features
  
- **[specs/004-aws-localstack-infrastructure/](./specs/004-aws-localstack-infrastructure/)** - AWS LocalStack setup

## 📦 Component Documentation

### Backend

**[backend/README.md](./backend/README.md)** - Complete backend documentation

Topics covered:
- Architecture overview
- Development modes (in-memory, emulators, cloud)
- Testing strategies
- Configuration
- API endpoints
- Docker commands
- Build and deployment

### Frontend

**[frontend/README.md](./frontend/README.md)** - Complete frontend documentation

Topics covered:
- Architecture overview (Next.js App Router)
- UI components (Shadcn UI)
- Features (user & admin dashboards)
- Authentication flow
- API integration
- Styling (Tailwind CSS)
- Forms (React Hook Form + Zod)
- Deployment

## 🔍 Quick Reference

### Common Tasks

| Task | Documentation |
|------|---------------|
| First-time setup | [README.md](./README.md#quick-start) |
| Run locally | [README.md](./README.md#running-locally) |
| Test API manually | [LOCAL_TESTING_GUIDE.md](./LOCAL_TESTING_GUIDE.md) |
| Add new feature | [CONTRIBUTING.md](./CONTRIBUTING.md) |
| Fix a bug | [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) |
| Deploy to production | [DEPLOYMENT.md](./DEPLOYMENT.md) |
| Understand architecture | [ARCHITECTURE.md](./ARCHITECTURE.md) |
| API reference | [API.md](./API.md) |

### Technology-Specific Docs

| Technology | Documentation |
|------------|---------------|
| Bun | [CLAUDE.md](./CLAUDE.md#package-manager) |
| TypeScript | [CONTRIBUTING.md](./CONTRIBUTING.md#typescript) |
| Express | [backend/README.md](./backend/README.md) |
| Next.js | [frontend/README.md](./frontend/README.md) |
| Firebase | [DEPLOYMENT.md](./DEPLOYMENT.md#firebase-deployment) |
| AWS | [DEPLOYMENT.md](./DEPLOYMENT.md#aws-deployment) |
| Docker | [DEPLOYMENT.md](./DEPLOYMENT.md#docker-deployment) |
| Testing | [backend/README.md](./backend/README.md#testing) |

### By Role

**Developers:**
1. [README.md](./README.md) - Overview
2. [CONTRIBUTING.md](./CONTRIBUTING.md) - Development workflow
3. [ARCHITECTURE.md](./ARCHITECTURE.md) - System design
4. [backend/README.md](./backend/README.md) - Backend development
5. [frontend/README.md](./frontend/README.md) - Frontend development

**Testers:**
1. [LOCAL_TESTING_GUIDE.md](./LOCAL_TESTING_GUIDE.md) - Manual testing
2. [API.md](./API.md) - API reference
3. [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) - Issue resolution

**DevOps/SRE:**
1. [DEPLOYMENT.md](./DEPLOYMENT.md) - Deployment guide
2. [ARCHITECTURE.md](./ARCHITECTURE.md#deployment-architecture) - Infrastructure
3. [TROUBLESHOOTING.md](./TROUBLESHOOTING.md#deployment-issues) - Deployment troubleshooting

**Product Managers:**
1. [README.md](./README.md#features) - Feature overview
2. [specs/](./specs/) - Detailed specifications
3. [API.md](./API.md) - API capabilities

## 🆘 Need Help?

**Can't find what you're looking for?**

1. Use the search function in your editor/browser
2. Check the [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) guide
3. Look in the [specs/](./specs/) directory for feature-specific docs
4. Open an [issue](https://github.com/tazabreu/swx-ai-sdlc-training-playground/issues)

## 📝 Documentation Standards

All documentation follows these standards:

- **Markdown format** - Easy to read and version control
- **Table of contents** - For documents > 200 lines
- **Code examples** - Practical, tested examples
- **Cross-references** - Links between related docs
- **Emojis** - For better visual navigation
- **Clear structure** - Hierarchical headings
- **Up-to-date** - Maintained with code changes

## 🔄 Contributing to Documentation

Found a typo or want to improve documentation?

1. See [CONTRIBUTING.md](./CONTRIBUTING.md)
2. Documentation changes follow same process as code
3. Update this index if adding new documentation files
4. Keep all docs in sync when making changes

---

**Last Updated:** January 2025

**Total Documentation:** 51 files, ~5000 lines
