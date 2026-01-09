# Deployment Guide

This document provides comprehensive deployment instructions for the Tazco Financial Ecosystem.

## 📋 Table of Contents

- [Deployment Options](#deployment-options)
- [Prerequisites](#prerequisites)
- [Firebase Deployment](#firebase-deployment)
- [AWS Deployment](#aws-deployment)
- [Docker Deployment](#docker-deployment)
- [Environment Configuration](#environment-configuration)
- [CI/CD Pipeline](#cicd-pipeline)
- [Monitoring & Logging](#monitoring--logging)
- [Troubleshooting](#troubleshooting)

## 🎯 Deployment Options

### 1. Firebase (Recommended for Quick Start)
- **Backend**: Firebase Functions
- **Database**: Firestore
- **Auth**: Firebase Authentication
- **Hosting**: Firebase Hosting (for frontend)

**Pros**: Easy setup, managed infrastructure, auto-scaling  
**Cons**: Vendor lock-in, cold starts

### 2. AWS
- **Backend**: Lambda + API Gateway
- **Database**: DynamoDB
- **Auth**: Cognito
- **Hosting**: S3 + CloudFront (for frontend)

**Pros**: Full control, extensive AWS ecosystem  
**Cons**: More complex setup, requires AWS knowledge

### 3. Docker + VPS
- **Backend**: Docker container on VPS
- **Database**: PostgreSQL/MySQL
- **Frontend**: Nginx + Static files
- **Hosting**: DigitalOcean, Linode, etc.

**Pros**: Cost-effective, portable  
**Cons**: Manual scaling, infrastructure management

### 4. Vercel (Frontend Only)
- **Frontend**: Vercel deployment
- **Backend**: Deployed separately (Firebase/AWS)

**Pros**: Excellent DX, automatic deployments, CDN  
**Cons**: Backend needs separate deployment

## 📦 Prerequisites

### General Requirements
- Node.js >= 20.0.0
- Bun >= 1.0.0
- Git
- Domain name (optional but recommended)

### Firebase Deployment
- Firebase CLI: `npm install -g firebase-tools`
- Firebase project
- Google Cloud project (same as Firebase)

### AWS Deployment
- AWS CLI: [Installation Guide](https://aws.amazon.com/cli/)
- AWS account with appropriate permissions
- AWS CDK (optional): `npm install -g aws-cdk`

### Docker Deployment
- Docker >= 20.0.0
- Docker Compose >= 2.0.0
- VPS with SSH access

## 🔥 Firebase Deployment

### Initial Setup

1. **Install Firebase CLI**

```bash
npm install -g firebase-tools
firebase login
```

2. **Create Firebase Project**

```bash
# Via CLI
firebase projects:create tazco-financial-prod

# Or via Console: https://console.firebase.google.com
```

3. **Initialize Firebase in Project**

```bash
cd backend
firebase init

# Select:
# - Functions (backend)
# - Firestore (database)
# - Hosting (optional, for frontend)
```

4. **Configure Firebase**

Update `firebase.json`:

```json
{
  "functions": {
    "source": ".",
    "runtime": "nodejs20",
    "predeploy": ["bun run build"]
  },
  "firestore": {
    "rules": "firestore.rules",
    "indexes": "firestore.indexes.json"
  }
}
```

### Deploy Backend

```bash
cd backend

# Build
bun run build

# Deploy functions and Firestore
firebase deploy --project tazco-financial-prod

# Or deploy separately
firebase deploy --only functions --project tazco-financial-prod
firebase deploy --only firestore --project tazco-financial-prod
```

### Deploy Frontend to Firebase Hosting

```bash
cd frontend

# Build
bun run build

# Deploy
firebase deploy --only hosting --project tazco-financial-prod
```

### Environment Variables

Set Firebase Functions environment variables:

```bash
firebase functions:config:set \
  app.env=production \
  app.rate_limit_api=100 \
  whatsapp.enabled=true \
  --project tazco-financial-prod

# Deploy to apply changes
firebase deploy --only functions --project tazco-financial-prod
```

### Custom Domain

1. Go to Firebase Console > Hosting
2. Add custom domain
3. Follow DNS configuration instructions
4. SSL certificate auto-provisioned

## ☁️ AWS Deployment

### Backend Deployment (Lambda + API Gateway)

1. **Build Backend**

```bash
cd backend
bun run build
```

2. **Package for Lambda**

```bash
# Create deployment package
cd dist
zip -r function.zip .
```

3. **Deploy via AWS CLI**

```bash
# Create Lambda function
aws lambda create-function \
  --function-name tazco-financial-api \
  --runtime nodejs20.x \
  --handler functions/http.handler \
  --zip-file fileb://function.zip \
  --role arn:aws:iam::ACCOUNT_ID:role/lambda-execution-role

# Create API Gateway
aws apigatewayv2 create-api \
  --name tazco-financial-api \
  --protocol-type HTTP \
  --target arn:aws:lambda:REGION:ACCOUNT_ID:function:tazco-financial-api
```

4. **Configure DynamoDB Tables**

```bash
# Users table
aws dynamodb create-table \
  --table-name tazco-users \
  --attribute-definitions AttributeName=ecosystemId,AttributeType=S \
  --key-schema AttributeName=ecosystemId,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST

# Cards table
aws dynamodb create-table \
  --table-name tazco-cards \
  --attribute-definitions \
    AttributeName=cardId,AttributeType=S \
    AttributeName=userId,AttributeType=S \
  --key-schema AttributeName=cardId,KeyType=HASH \
  --global-secondary-indexes \
    "IndexName=userId-index,KeySchema=[{AttributeName=userId,KeyType=HASH}],Projection={ProjectionType=ALL}" \
  --billing-mode PAY_PER_REQUEST

# Similar for transactions and card-requests tables
```

5. **Set Environment Variables**

```bash
aws lambda update-function-configuration \
  --function-name tazco-financial-api \
  --environment "Variables={USE_AWS=true,AWS_REGION=us-east-1,NODE_ENV=production}"
```

### Frontend Deployment (S3 + CloudFront)

1. **Build Frontend**

```bash
cd frontend
bun run build
```

2. **Create S3 Bucket**

```bash
aws s3 mb s3://tazco-financial-frontend
aws s3 website s3://tazco-financial-frontend --index-document index.html
```

3. **Upload Files**

```bash
aws s3 sync out/ s3://tazco-financial-frontend --acl public-read
```

4. **Create CloudFront Distribution**

```bash
aws cloudfront create-distribution \
  --origin-domain-name tazco-financial-frontend.s3.amazonaws.com \
  --default-root-object index.html
```

### Using AWS CDK (Recommended)

Create `cdk/lib/tazco-stack.ts`:

```typescript
import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigatewayv2';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';

export class TazcoStack extends cdk.Stack {
  constructor(scope: cdk.App, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // DynamoDB Tables
    const usersTable = new dynamodb.Table(this, 'Users', {
      partitionKey: { name: 'ecosystemId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST
    });

    // Lambda Function
    const apiFunction = new lambda.Function(this, 'ApiFunction', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'functions/http.handler',
      code: lambda.Code.fromAsset('backend/dist'),
      environment: {
        USE_AWS: 'true',
        USERS_TABLE: usersTable.tableName
      }
    });

    usersTable.grantReadWriteData(apiFunction);

    // API Gateway
    const api = new apigateway.HttpApi(this, 'HttpApi', {
      defaultIntegration: new apigateway.HttpLambdaIntegration('ApiIntegration', apiFunction)
    });
  }
}
```

Deploy:

```bash
cd cdk
cdk deploy
```

## 🐳 Docker Deployment

### Dockerfile for Backend

```dockerfile
# backend/Dockerfile
FROM oven/bun:1 AS base
WORKDIR /app

# Dependencies
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

# Build
COPY . .
RUN bun run build

# Production
FROM oven/bun:1-slim
WORKDIR /app
COPY --from=base /app/dist ./dist
COPY --from=base /app/node_modules ./node_modules
COPY --from=base /app/package.json ./

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000
CMD ["bun", "run", "dist/functions/http.js"]
```

### Dockerfile for Frontend

```dockerfile
# frontend/Dockerfile
FROM oven/bun:1 AS base
WORKDIR /app

# Dependencies
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# Build
COPY . .
RUN bun run build

# Production
FROM oven/bun:1-slim
WORKDIR /app
COPY --from=base /app/.next/standalone ./
COPY --from=base /app/.next/static ./.next/static
COPY --from=base /app/public ./public

ENV NODE_ENV=production
ENV PORT=3001

EXPOSE 3001
CMD ["bun", "server.js"]
```

### Docker Compose for Production

```yaml
# docker-compose.prod.yml
version: '3.8'

services:
  backend:
    build: ./backend
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - USE_INMEMORY=false
      - DATABASE_URL=postgresql://user:pass@db:5432/tazco
    depends_on:
      - db

  frontend:
    build: ./frontend
    ports:
      - "3001:3001"
    environment:
      - NODE_ENV=production
      - NEXT_PUBLIC_API_URL=http://backend:3000

  db:
    image: postgres:16
    volumes:
      - postgres_data:/var/lib/postgresql/data
    environment:
      - POSTGRES_USER=user
      - POSTGRES_PASSWORD=pass
      - POSTGRES_DB=tazco

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/nginx/ssl
    depends_on:
      - backend
      - frontend

volumes:
  postgres_data:
```

### Deploy to VPS

```bash
# SSH into VPS
ssh user@your-server.com

# Clone repository
git clone https://github.com/tazabreu/swx-ai-sdlc-training-playground.git
cd swx-ai-sdlc-training-playground

# Build and start
docker compose -f docker-compose.prod.yml up -d

# View logs
docker compose -f docker-compose.prod.yml logs -f
```

## ⚙️ Environment Configuration

### Production Environment Variables

Create `.env.production`:

```bash
# Environment
NODE_ENV=production

# Backend URL
NEXT_PUBLIC_API_URL=https://api.yourdomain.com

# Provider Selection
USE_INMEMORY=false
USE_AWS=true  # or false for Firebase

# Firebase (if using Firebase)
FIREBASE_PROJECT_ID=tazco-financial-prod
GCLOUD_PROJECT=tazco-financial-prod

# AWS (if using AWS)
AWS_REGION=us-east-1
# AWS credentials via IAM role (don't hardcode)

# Security
RATE_LIMIT_API_PER_MINUTE=100
RATE_LIMIT_AUTH_PER_MINUTE=10

# WhatsApp
WHATSAPP_NOTIFICATIONS_ENABLED=true
WPP_BASE_URL=https://your-wpp-server.com
WPP_SECRET_KEY=your-production-secret

# Admin phones
ADMIN_PHONE_1=+1234567890
ADMIN_PHONE_2=+0987654321
```

### Secrets Management

**Firebase:**
```bash
firebase functions:config:set \
  secret.api_key="your-secret" \
  --project tazco-financial-prod
```

**AWS:**
```bash
aws ssm put-parameter \
  --name /tazco/production/api-key \
  --value "your-secret" \
  --type SecureString
```

**Docker:**
Use Docker secrets or environment files not committed to Git.

## 🔄 CI/CD Pipeline

### GitHub Actions Workflow

`.github/workflows/deploy-production.yml`:

```yaml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  deploy-backend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - uses: oven-sh/setup-bun@v1
      
      - name: Install dependencies
        run: bun install
      
      - name: Run tests
        run: bun test
      
      - name: Build
        run: bun run build
      
      - name: Deploy to Firebase
        uses: FirebaseExtended/action-hosting-deploy@v0
        with:
          repoToken: '${{ secrets.GITHUB_TOKEN }}'
          firebaseServiceAccount: '${{ secrets.FIREBASE_SERVICE_ACCOUNT }}'
          projectId: tazco-financial-prod

  deploy-frontend:
    runs-on: ubuntu-latest
    needs: deploy-backend
    steps:
      - uses: actions/checkout@v4
      
      - uses: oven-sh/setup-bun@v1
      
      - name: Install dependencies
        working-directory: frontend
        run: bun install
      
      - name: Build
        working-directory: frontend
        run: bun run build
      
      - name: Deploy to Vercel
        uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
          working-directory: frontend
```

## 📊 Monitoring & Logging

### Firebase

- **Logs**: Firebase Console > Functions > Logs
- **Metrics**: Built-in function metrics
- **Alerts**: Cloud Monitoring alerts

### AWS

- **Logs**: CloudWatch Logs
- **Metrics**: CloudWatch Metrics
- **Tracing**: X-Ray (optional)
- **Alerts**: CloudWatch Alarms

### Application Monitoring

```typescript
// Add to backend
import * as Sentry from '@sentry/node';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV
});
```

## 🐛 Troubleshooting

### Deployment Fails

```bash
# Check build locally
bun run build

# Verify environment variables
firebase functions:config:get

# Check logs
firebase functions:log
aws logs tail /aws/lambda/tazco-financial-api
```

### Cold Start Issues (Firebase)

- Use Cloud Scheduler to keep functions warm
- Increase memory allocation
- Consider switching to Cloud Run

### CORS Errors

- Verify CORS configuration in backend
- Check allowed origins
- Ensure frontend URL matches

### Database Connection Errors

- Verify credentials
- Check firewall rules
- Ensure region matches

---

## 📝 Deployment Checklist

- [ ] Build passes locally
- [ ] All tests pass
- [ ] Environment variables configured
- [ ] Database migrations run
- [ ] Secrets stored securely
- [ ] Domain/DNS configured
- [ ] SSL/HTTPS enabled
- [ ] Monitoring set up
- [ ] Backup strategy in place
- [ ] Rollback plan ready

---

**Need Help?** Check [ARCHITECTURE.md](./ARCHITECTURE.md) for system design or [CONTRIBUTING.md](./CONTRIBUTING.md) for development guidelines.
