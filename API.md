# API Documentation

Complete API reference for the Tazco Financial Ecosystem API.

## 📋 Table of Contents

- [Overview](#overview)
- [Base URL](#base-url)
- [Authentication](#authentication)
- [Common Patterns](#common-patterns)
- [Health Endpoints](#health-endpoints)
- [User Endpoints](#user-endpoints)
- [Card Endpoints](#card-endpoints)
- [Transaction Endpoints](#transaction-endpoints)
- [Admin Endpoints](#admin-endpoints)
- [Error Handling](#error-handling)
- [Rate Limiting](#rate-limiting)

## 🔍 Overview

The Tazco Financial API is a RESTful API that provides credit card management, scoring, and transaction simulation capabilities.

**API Version:** v1  
**Protocol:** HTTPS (production), HTTP (development)  
**Format:** JSON

## 🌐 Base URL

**Development:**
```
http://localhost:3000
```

**Production:**
```
https://api.yourdomain.com
```

## 🔐 Authentication

All endpoints (except health checks) require authentication via Bearer token.

### Header Format

```
Authorization: Bearer <token>
```

### Token Types

#### Development (Mock Tokens)

```bash
# User token
mock.eyJlY29zeXN0ZW1JZCI6InVzZXItMTIzIiwicm9sZSI6InVzZXIifQ.sig

# Admin token
mock.eyJlY29zeXN0ZW1JZCI6ImFkbWluLTAwMSIsInJvbGUiOiJhZG1pbiJ9.sig
```

#### Production (Firebase/Cognito)

Tokens obtained from Firebase Authentication or AWS Cognito.

### Token Claims

```json
{
  "ecosystemId": "user-123",
  "role": "user|admin",
  "email": "user@example.com"
}
```

## 🔄 Common Patterns

### Idempotency

Write operations require an `Idempotency-Key` header to prevent duplicate requests.

```
Idempotency-Key: unique-request-id-123
```

### Pagination

List endpoints support pagination via query parameters:

```
?page=1&limit=20
```

Response includes pagination metadata:

```json
{
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "pages": 5
  }
}
```

### Response Format

**Success:**

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

**Error:**

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable message",
    "details": { ... }
  }
}
```

## 🏥 Health Endpoints

### Check API Health

```http
GET /health/liveness
```

**Response:**

```json
{
  "status": "ok",
  "timestamp": "2024-01-09T12:00:00Z",
  "version": "1.0.0"
}
```

## 👤 User Endpoints

### Create User

Create a new user account. Idempotent - safe to call multiple times with same token.

```http
POST /v1/users
Authorization: Bearer <token>
Content-Type: application/json

{}
```

**Request Body (Optional):**

```json
{
  "email": "user@example.com"  // Optional - taken from token if not provided
}
```

**Response:**

```json
{
  "user": {
    "ecosystemId": "user-123",
    "email": "user@example.com",
    "role": "user",
    "creditScore": 650,
    "createdAt": "2024-01-09T12:00:00Z",
    "updatedAt": "2024-01-09T12:00:00Z"
  },
  "created": true
}
```

**Status Codes:**
- `201` - User created
- `200` - User already exists
- `401` - Unauthorized
- `400` - Invalid request

### Get Dashboard

Get user dashboard with overview information.

```http
GET /v1/dashboard
Authorization: Bearer <token>
```

**Response:**

```json
{
  "user": {
    "ecosystemId": "user-123",
    "email": "user@example.com",
    "creditScore": 750
  },
  "cards": [
    {
      "cardId": "card-456",
      "cardNumber": "****1234",
      "status": "ACTIVE",
      "balance": 1500.00,
      "creditLimit": 5000.00,
      "availableCredit": 3500.00
    }
  ],
  "summary": {
    "totalCards": 1,
    "activeCards": 1,
    "totalBalance": 1500.00,
    "totalCreditLimit": 5000.00,
    "totalAvailableCredit": 3500.00
  },
  "recentTransactions": [
    {
      "transactionId": "txn-789",
      "type": "PURCHASE",
      "amount": 150.00,
      "merchant": "Amazon",
      "timestamp": "2024-01-09T10:30:00Z"
    }
  ]
}
```

### Get Product Offers

Get available credit card products based on credit score.

```http
GET /v1/offers
Authorization: Bearer <token>
```

**Response:**

```json
{
  "offers": [
    {
      "productId": "default-credit-card",
      "name": "Standard Credit Card",
      "description": "Basic credit card with standard benefits",
      "maxCreditLimit": 5000,
      "interestRate": 18.99,
      "annualFee": 0,
      "rewards": null,
      "eligible": true
    },
    {
      "productId": "premium-credit-card",
      "name": "Premium Rewards Card",
      "description": "Premium card with cashback rewards",
      "maxCreditLimit": 10000,
      "interestRate": 15.99,
      "annualFee": 95,
      "rewards": "2% cashback on all purchases",
      "eligible": false,
      "reason": "Credit score below 700"
    }
  ]
}
```

## 💳 Card Endpoints

### Request New Card

Submit a new card request.

```http
POST /v1/cards/requests
Authorization: Bearer <token>
Idempotency-Key: <unique-key>
Content-Type: application/json

{
  "productId": "default-credit-card"
}
```

**Request Body:**

```json
{
  "productId": "default-credit-card"  // Required
}
```

**Response (Auto-Approved):**

```json
{
  "request": {
    "requestId": "req-123",
    "userId": "user-123",
    "productId": "default-credit-card",
    "status": "APPROVED",
    "card": {
      "cardId": "card-456",
      "cardNumber": "4532123456781234",
      "cvv": "123",
      "expiryDate": "12/2029",
      "creditLimit": 3250.00,
      "status": "ACTIVE"
    },
    "createdAt": "2024-01-09T12:00:00Z",
    "reviewedAt": "2024-01-09T12:00:00Z"
  }
}
```

**Response (Pending Review):**

```json
{
  "request": {
    "requestId": "req-123",
    "userId": "user-123",
    "productId": "premium-credit-card",
    "status": "PENDING",
    "createdAt": "2024-01-09T12:00:00Z"
  }
}
```

**Status Codes:**
- `201` - Request created
- `200` - Request already exists (idempotent)
- `400` - Invalid product or already has active card
- `401` - Unauthorized

### List User Cards

Get all cards for the authenticated user.

```http
GET /v1/cards
Authorization: Bearer <token>
```

**Query Parameters:**

- `status` (optional) - Filter by status: `ACTIVE`, `BLOCKED`, `CANCELLED`

**Response:**

```json
{
  "cards": [
    {
      "cardId": "card-456",
      "userId": "user-123",
      "cardNumber": "****1234",
      "status": "ACTIVE",
      "balance": 1500.00,
      "creditLimit": 5000.00,
      "availableCredit": 3500.00,
      "createdAt": "2024-01-01T10:00:00Z"
    }
  ],
  "total": 1
}
```

### Get Card Details

Get details for a specific card.

```http
GET /v1/cards/:cardId
Authorization: Bearer <token>
```

**Response:**

```json
{
  "card": {
    "cardId": "card-456",
    "userId": "user-123",
    "cardNumber": "4532123456781234",
    "cvv": "123",
    "expiryDate": "12/2029",
    "status": "ACTIVE",
    "balance": 1500.00,
    "creditLimit": 5000.00,
    "availableCredit": 3500.00,
    "createdAt": "2024-01-01T10:00:00Z",
    "updatedAt": "2024-01-09T12:00:00Z"
  }
}
```

**Status Codes:**
- `200` - Success
- `404` - Card not found
- `403` - Not authorized to view this card

## 💰 Transaction Endpoints

### Make Purchase

Process a purchase transaction.

```http
POST /v1/cards/:cardId/transactions/purchases
Authorization: Bearer <token>
Idempotency-Key: <unique-key>
Content-Type: application/json

{
  "amount": 150.00,
  "merchant": "Amazon",
  "category": "shopping"
}
```

**Request Body:**

```json
{
  "amount": 150.00,           // Required, > 0
  "merchant": "Amazon",       // Required
  "category": "shopping"      // Optional
}
```

**Response:**

```json
{
  "transaction": {
    "transactionId": "txn-789",
    "cardId": "card-456",
    "type": "PURCHASE",
    "amount": 150.00,
    "merchant": "Amazon",
    "category": "shopping",
    "timestamp": "2024-01-09T12:00:00Z",
    "status": "COMPLETED"
  },
  "card": {
    "balance": 1650.00,
    "availableCredit": 3350.00
  }
}
```

**Status Codes:**
- `201` - Transaction created
- `200` - Transaction already exists (idempotent)
- `400` - Invalid amount or insufficient credit
- `403` - Card blocked or inactive
- `404` - Card not found

### Make Payment

Process a payment transaction.

```http
POST /v1/cards/:cardId/transactions/payments
Authorization: Bearer <token>
Idempotency-Key: <unique-key>
Content-Type: application/json

{
  "amount": 500.00,
  "source": "bank"
}
```

**Request Body:**

```json
{
  "amount": 500.00,     // Required, > 0
  "source": "bank"      // Optional
}
```

**Response:**

```json
{
  "transaction": {
    "transactionId": "txn-790",
    "cardId": "card-456",
    "type": "PAYMENT",
    "amount": 500.00,
    "source": "bank",
    "timestamp": "2024-01-09T12:00:00Z",
    "status": "COMPLETED"
  },
  "card": {
    "balance": 1150.00,
    "availableCredit": 3850.00
  }
}
```

### Get Transaction History

Get transaction history for a card.

```http
GET /v1/cards/:cardId/transactions
Authorization: Bearer <token>
```

**Query Parameters:**

- `type` (optional) - Filter by type: `PURCHASE`, `PAYMENT`
- `startDate` (optional) - Filter from date (ISO 8601)
- `endDate` (optional) - Filter to date (ISO 8601)
- `page` (optional) - Page number (default: 1)
- `limit` (optional) - Items per page (default: 20, max: 100)

**Response:**

```json
{
  "transactions": [
    {
      "transactionId": "txn-790",
      "type": "PAYMENT",
      "amount": 500.00,
      "source": "bank",
      "timestamp": "2024-01-09T12:00:00Z"
    },
    {
      "transactionId": "txn-789",
      "type": "PURCHASE",
      "amount": 150.00,
      "merchant": "Amazon",
      "category": "shopping",
      "timestamp": "2024-01-09T10:30:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 2,
    "pages": 1
  }
}
```

## 🔧 Admin Endpoints

All admin endpoints require `admin` role.

### List Pending Card Requests

Get all pending card requests.

```http
GET /v1/admin/card-requests
Authorization: Bearer <admin-token>
```

**Query Parameters:**

- `status` (optional) - Filter by status: `PENDING`, `APPROVED`, `REJECTED`
- `page` (optional) - Page number
- `limit` (optional) - Items per page

**Response:**

```json
{
  "requests": [
    {
      "requestId": "req-123",
      "user": {
        "ecosystemId": "user-123",
        "email": "user@example.com",
        "creditScore": 680
      },
      "productId": "premium-credit-card",
      "status": "PENDING",
      "createdAt": "2024-01-09T11:00:00Z"
    }
  ],
  "total": 1
}
```

### Approve Card Request

Approve a pending card request.

```http
POST /v1/admin/card-requests/:requestId/approve
Authorization: Bearer <admin-token>
Idempotency-Key: <unique-key>
Content-Type: application/json

{
  "creditLimit": 5000.00
}
```

**Request Body:**

```json
{
  "creditLimit": 5000.00  // Required, > 0
}
```

**Response:**

```json
{
  "request": {
    "requestId": "req-123",
    "status": "APPROVED",
    "card": {
      "cardId": "card-789",
      "cardNumber": "4532123456789012",
      "creditLimit": 5000.00
    },
    "reviewedAt": "2024-01-09T12:00:00Z"
  }
}
```

### Reject Card Request

Reject a pending card request.

```http
POST /v1/admin/card-requests/:requestId/reject
Authorization: Bearer <admin-token>
Idempotency-Key: <unique-key>
Content-Type: application/json

{
  "reason": "Insufficient documentation"
}
```

**Request Body:**

```json
{
  "reason": "Insufficient documentation"  // Required
}
```

**Response:**

```json
{
  "request": {
    "requestId": "req-123",
    "status": "REJECTED",
    "rejectionReason": "Insufficient documentation",
    "reviewedAt": "2024-01-09T12:00:00Z"
  }
}
```

### Get User Score

Get credit score for a user.

```http
GET /v1/admin/users/:userSlug/score
Authorization: Bearer <admin-token>
```

**Response:**

```json
{
  "user": {
    "ecosystemId": "user-123",
    "email": "user@example.com"
  },
  "creditScore": 750,
  "scoreHistory": [
    {
      "score": 750,
      "reason": "Manual adjustment",
      "adjustedBy": "admin-001",
      "timestamp": "2024-01-09T12:00:00Z"
    },
    {
      "score": 650,
      "reason": "Initial score",
      "timestamp": "2024-01-01T10:00:00Z"
    }
  ]
}
```

### Update User Score

Manually adjust a user's credit score.

```http
PATCH /v1/admin/users/:userSlug/score
Authorization: Bearer <admin-token>
Idempotency-Key: <unique-key>
Content-Type: application/json

{
  "score": 750,
  "reason": "Payment history improvement"
}
```

**Request Body:**

```json
{
  "score": 750,                              // Required, 300-850
  "reason": "Payment history improvement"    // Required
}
```

**Response:**

```json
{
  "user": {
    "ecosystemId": "user-123",
    "email": "user@example.com"
  },
  "previousScore": 680,
  "newScore": 750,
  "reason": "Payment history improvement",
  "adjustedBy": "admin-001",
  "timestamp": "2024-01-09T12:00:00Z"
}
```

### System Cleanup

Reset system data (development/testing only).

**Step 1: Request Cleanup**

```http
POST /v1/admin/cleanup
Authorization: Bearer <admin-token>
Content-Type: application/json

{}
```

**Response:**

```json
{
  "message": "Cleanup initiated. Confirm with token.",
  "confirmationToken": "cleanup-token-abc123",
  "expiresAt": "2024-01-09T12:05:00Z"
}
```

**Step 2: Confirm Cleanup**

```http
POST /v1/admin/cleanup
Authorization: Bearer <admin-token>
Content-Type: application/json

{
  "confirmationToken": "cleanup-token-abc123"
}
```

**Response:**

```json
{
  "message": "System data cleaned successfully",
  "deletedRecords": {
    "users": 10,
    "cards": 8,
    "transactions": 45,
    "requests": 3
  }
}
```

## ⚠️ Error Handling

### Error Response Format

```json
{
  "error": {
    "code": "INSUFFICIENT_CREDIT",
    "message": "Insufficient credit for this purchase",
    "details": {
      "requestedAmount": 1000,
      "availableCredit": 500
    }
  }
}
```

### Common Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `UNAUTHORIZED` | 401 | Missing or invalid token |
| `FORBIDDEN` | 403 | Insufficient permissions |
| `NOT_FOUND` | 404 | Resource not found |
| `VALIDATION_ERROR` | 400 | Invalid request data |
| `DUPLICATE_REQUEST` | 409 | Resource already exists |
| `INSUFFICIENT_CREDIT` | 400 | Not enough credit available |
| `CARD_INACTIVE` | 400 | Card is not active |
| `INVALID_AMOUNT` | 400 | Invalid transaction amount |
| `INTERNAL_ERROR` | 500 | Server error |

## 🚦 Rate Limiting

API requests are rate-limited to prevent abuse.

### Limits

- **Authentication**: 10 requests/minute
- **API Calls**: 100 requests/minute

### Headers

Rate limit information is included in response headers:

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1704801600
```

### Exceeded Limit

When limit is exceeded, API returns:

```json
{
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Too many requests. Please try again later.",
    "retryAfter": 60
  }
}
```

**HTTP Status:** `429 Too Many Requests`

---

## 📚 Additional Resources

- [OpenAPI Specification](../specs/001-headless-financial-api/contracts/openapi.yaml)
- [LOCAL_TESTING_GUIDE.md](../LOCAL_TESTING_GUIDE.md) - Complete testing guide with curl examples
- [ARCHITECTURE.md](../ARCHITECTURE.md) - System architecture
- [Backend README](../backend/README.md) - Backend documentation

---

**Questions?** Open an issue or check the [main documentation](../README.md).
