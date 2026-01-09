# Contributing to Tazco Financial Ecosystem

Thank you for your interest in contributing to the Tazco Financial Ecosystem! This document provides guidelines and instructions for contributing to this project.

## 📋 Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Code Style Guidelines](#code-style-guidelines)
- [Commit Message Convention](#commit-message-convention)
- [Pull Request Process](#pull-request-process)
- [Testing Requirements](#testing-requirements)
- [Documentation](#documentation)

## 📜 Code of Conduct

We are committed to providing a welcoming and inclusive environment for all contributors. Please be respectful and professional in all interactions.

## 🚀 Getting Started

### Prerequisites

Before you start contributing, ensure you have:

- **Bun** >= 1.0.0 installed ([Installation Guide](https://bun.sh))
- **Node.js** >= 20.0.0
- **Git** for version control
- **Docker** (optional, for running emulators)
- A code editor (we recommend VS Code with TypeScript extensions)

### Fork and Clone

1. Fork the repository on GitHub
2. Clone your fork locally:

```bash
git clone https://github.com/YOUR_USERNAME/swx-ai-sdlc-training-playground.git
cd swx-ai-sdlc-training-playground
```

3. Add the upstream repository:

```bash
git remote add upstream https://github.com/tazabreu/swx-ai-sdlc-training-playground.git
```

### Install Dependencies

```bash
bun install
```

### Verify Your Setup

```bash
# Type check all packages
bun run typecheck

# Run linter
bun run lint

# Run tests
bun test
```

If all commands succeed, you're ready to contribute!

## 🔄 Development Workflow

### 1. Create a Feature Branch

Always create a new branch for your work:

```bash
git checkout -b feature/your-feature-name
# or
git checkout -b fix/your-bug-fix
```

Branch naming conventions:
- `feature/` - New features
- `fix/` - Bug fixes
- `docs/` - Documentation updates
- `refactor/` - Code refactoring
- `test/` - Test additions or fixes
- `chore/` - Maintenance tasks

### 2. Make Your Changes

- Write clean, readable, and maintainable code
- Follow the [Code Style Guidelines](#code-style-guidelines)
- Add or update tests as needed
- Update documentation if you're changing functionality

### 3. Test Your Changes

Before committing, ensure all tests pass:

```bash
# Run all tests
bun test

# Run specific test suites
cd backend
bun run test:unit          # Unit tests
bun run test:integration   # Integration tests
bun run test:contract      # Contract tests

cd frontend
bun run test               # Frontend tests
```

### 4. Commit Your Changes

Follow our [Commit Message Convention](#commit-message-convention):

```bash
git add .
git commit -m "✨ feat(cards): add credit limit adjustment feature"
```

### 5. Keep Your Branch Updated

Regularly sync with the upstream repository:

```bash
git fetch upstream
git rebase upstream/main
```

### 6. Push Your Changes

```bash
git push origin feature/your-feature-name
```

### 7. Create a Pull Request

1. Go to your fork on GitHub
2. Click "New Pull Request"
3. Select your feature branch
4. Fill in the PR template with:
   - Clear description of changes
   - Related issue numbers
   - Screenshots (for UI changes)
   - Testing steps
5. Submit the PR

## 🎨 Code Style Guidelines

### TypeScript

- Use TypeScript for all new code
- Enable strict mode
- Avoid `any` types - use proper typing
- Use interfaces for object shapes
- Use type aliases for unions and complex types

```typescript
// Good
interface User {
  ecosystemId: string;
  email: string;
  role: 'user' | 'admin';
}

// Avoid
const user: any = { ... };
```

### Naming Conventions

- **Variables and Functions**: camelCase
  ```typescript
  const userCard = getCardById(cardId);
  ```

- **Classes and Interfaces**: PascalCase
  ```typescript
  class CardService implements ICardService { }
  ```

- **Constants**: UPPER_SNAKE_CASE
  ```typescript
  const MAX_CREDIT_LIMIT = 10000;
  ```

- **Private members**: prefix with underscore
  ```typescript
  private _internalState: State;
  ```

### Code Organization

- Keep files focused and single-purpose
- Limit file length to ~300 lines
- Group related functionality together
- Use barrel exports (index.ts) for clean imports

```typescript
// domain/index.ts
export * from './entities';
export * from './services';
export * from './value-objects';
```

### Comments

- Write self-documenting code with clear names
- Add comments for complex business logic
- Use JSDoc for public APIs

```typescript
/**
 * Approves a card request and creates a new card
 * @param requestId - The unique identifier of the request
 * @param creditLimit - The approved credit limit
 * @returns The approved card request with card details
 */
async approveCardRequest(requestId: string, creditLimit: number): Promise<CardRequest>
```

### Formatting

We use **Prettier** for consistent code formatting:

```bash
# Format all code
bun run format

# Check formatting
bun run format:check
```

### Linting

We use **ESLint** to enforce code quality:

```bash
# Lint all code
bun run lint

# Auto-fix linting issues
cd backend && bun run lint:fix
```

## 📝 Commit Message Convention

We follow **Gitmoji + Conventional Commits** format:

### Format

```
<gitmoji> <type>(<scope>): <subject>

<body>
```

### Types

- `feat` - New feature
- `fix` - Bug fix
- `docs` - Documentation changes
- `style` - Code style changes (formatting, semicolons, etc.)
- `refactor` - Code refactoring
- `test` - Adding or updating tests
- `chore` - Maintenance tasks
- `perf` - Performance improvements

### Gitmojis

Common gitmojis we use:

- ✨ `:sparkles:` - New feature
- 🐛 `:bug:` - Bug fix
- 📝 `:memo:` - Documentation
- 🎨 `:art:` - Code structure/format
- ♻️ `:recycle:` - Refactoring
- ✅ `:white_check_mark:` - Tests
- 🔧 `:wrench:` - Configuration
- 🚀 `:rocket:` - Performance
- 🔒 `:lock:` - Security

### Examples

```bash
# New feature
✨ feat(cards): add credit limit adjustment endpoint

# Bug fix
🐛 fix(auth): resolve token expiration issue

# Documentation
📝 docs(readme): update installation instructions

# Refactoring
♻️ refactor(domain): simplify card approval logic

# Tests
✅ test(cards): add integration tests for card creation

# Multiple lines
✨ feat(admin): add bulk card approval

.- Add endpoint for approving multiple requests
.- Add transaction batching for better performance
.- Update admin UI with bulk actions
```

## 🔀 Pull Request Process

### Before Submitting

1. ✅ All tests pass
2. ✅ Code is formatted (`bun run format`)
3. ✅ No linting errors (`bun run lint`)
4. ✅ Types are valid (`bun run typecheck`)
5. ✅ Documentation is updated
6. ✅ Commits follow convention

### PR Title

Use the same format as commit messages:

```
✨ feat(cards): add credit limit adjustment
```

### PR Description Template

```markdown
## Description
Brief description of the changes

## Related Issues
Fixes #123

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
- [ ] Unit tests added/updated
- [ ] Integration tests added/updated
- [ ] Manually tested

## Screenshots (if applicable)
Add screenshots for UI changes

## Checklist
- [ ] Code follows style guidelines
- [ ] Self-review completed
- [ ] Documentation updated
- [ ] Tests pass locally
- [ ] No new warnings
```

### Review Process

1. Automated checks must pass (CI/CD)
2. At least one maintainer approval required
3. Address review feedback promptly
4. Keep discussions constructive and professional

### After Approval

1. Squash commits if requested
2. Ensure branch is up to date with main
3. Maintainer will merge the PR

## 🧪 Testing Requirements

### Test Coverage

- Aim for **80%+ code coverage**
- All new features must include tests
- Bug fixes must include regression tests

### Test Types

#### Unit Tests
- Test individual functions and classes
- Mock external dependencies
- Fast and isolated

```typescript
describe('CardService', () => {
  it('should create a card with valid parameters', async () => {
    const card = await cardService.createCard({ ... });
    expect(card.cardId).toBeDefined();
  });
});
```

#### Integration Tests
- Test component interactions
- Use test databases (in-memory or emulators)
- Test real workflows

```typescript
describe('Card Request Workflow', () => {
  it('should complete full approval workflow', async () => {
    // Create request
    const request = await createCardRequest();
    
    // Approve request
    const approved = await approveCardRequest(request.id);
    
    // Verify card created
    expect(approved.card).toBeDefined();
  });
});
```

#### Contract Tests
- Verify API contracts
- Test request/response formats
- Ensure backward compatibility

### Running Tests Locally

```bash
# All tests
bun test

# Watch mode (development)
cd backend && bun run test:watch

# With coverage
cd backend && bun run test:ci

# Specific test file
bun test tests/unit/domain/card.test.ts
```

### Testing Different Backends

```bash
# In-memory (fast)
bun run test:integration:inmemory

# Firebase emulator
bun run emulator:start
bun run test:integration:firestore

# AWS LocalStack
bun run emulator:start:aws
bun run test:integration:dynamodb
```

## 📚 Documentation

### When to Update Documentation

Update documentation when you:

- Add new features
- Change existing functionality
- Fix bugs that affect usage
- Add new configuration options
- Update dependencies

### Documentation Files to Update

- **README.md** - Project overview and quick start
- **ARCHITECTURE.md** - Architecture and design decisions
- **LOCAL_TESTING_GUIDE.md** - API testing examples
- **Backend README** - Backend-specific documentation
- **Frontend README** - Frontend-specific documentation
- **Code comments** - Complex logic and public APIs

### Documentation Style

- Use clear, concise language
- Include code examples
- Add diagrams for complex concepts
- Keep formatting consistent
- Test all code examples

## 🐛 Reporting Bugs

### Before Reporting

1. Check existing issues
2. Verify you're using the latest version
3. Test with minimal reproduction

### Bug Report Template

```markdown
**Describe the bug**
Clear description of the bug

**To Reproduce**
Steps to reproduce:
1. Start backend with '...'
2. Call endpoint '...'
3. See error

**Expected behavior**
What you expected to happen

**Actual behavior**
What actually happened

**Environment:**
- OS: [e.g., macOS 14.0]
- Bun version: [e.g., 1.0.0]
- Node version: [e.g., 20.0.0]

**Additional context**
Any other relevant information
```

## 💡 Suggesting Features

We welcome feature suggestions! Please:

1. Check existing feature requests
2. Clearly describe the feature
3. Explain the use case
4. Consider implementation complexity

### Feature Request Template

```markdown
**Is your feature request related to a problem?**
Clear description of the problem

**Describe the solution you'd like**
What you want to happen

**Describe alternatives you've considered**
Other solutions you've thought about

**Additional context**
Any other relevant information
```

## 🔍 Code Review Guidelines

### For Contributors

- Be open to feedback
- Respond to comments promptly
- Make requested changes
- Ask questions if unclear

### For Reviewers

- Be respectful and constructive
- Explain reasoning for changes
- Approve when satisfied
- Use GitHub's suggestion feature

## 📞 Getting Help

If you need help:

1. Check the documentation
2. Search existing issues
3. Ask in discussions
4. Reach out to maintainers

## 🙏 Thank You!

Your contributions make this project better. We appreciate your time and effort!

---

**Happy Coding! 🚀**
