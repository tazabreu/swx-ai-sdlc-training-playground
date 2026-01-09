# API Contracts: AWS LocalStack Infrastructure

**Feature**: 004-aws-localstack-infrastructure
**Date**: 2026-01-07

## Contract Status: No Changes

This feature adds AWS infrastructure as an alternative to Firebase/GCP. Per the specification (FR-010), the API request/response contracts remain **identical** regardless of infrastructure mode.

### Preserved Contracts

All existing API contracts are preserved without modification:

| Endpoint | Method | Contract Status |
|----------|--------|-----------------|
| `/health` | GET | Unchanged |
| `/api/users/me` | GET | Unchanged |
| `/api/users/:id` | GET, PUT, DELETE | Unchanged |
| `/api/cards` | GET, POST | Unchanged |
| `/api/cards/:id` | GET, PUT, DELETE | Unchanged |
| `/api/cards/:id/transactions` | GET, POST | Unchanged |
| `/api/card-requests` | GET, POST | Unchanged |
| `/api/card-requests/:id` | GET, PUT | Unchanged |
| `/api/admin/*` | Various | Unchanged |

### Verification

Contract tests (`tests/contract/`) verify API behavior remains identical across infrastructure modes:

```bash
# Run contract tests against Firebase mode
bun run dev:emulator
bun test tests/contract

# Run contract tests against AWS mode
bun run dev:aws
bun test tests/contract
```

Both executions must produce identical results.

### Infrastructure-Specific Headers

The only observable difference may be internal response headers for debugging:

| Header | Firebase Mode | AWS Mode |
|--------|---------------|----------|
| `X-Infrastructure-Mode` | `firebase` | `aws` |

This header is optional and for debugging purposes only. Client applications should not depend on it.

## Reference

For existing API contract definitions, see:
- `specs/001-headless-financial-api/` - OpenAPI specifications
- `tests/contract/` - Contract test implementations
