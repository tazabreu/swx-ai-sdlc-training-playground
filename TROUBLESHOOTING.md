# Troubleshooting Guide

Common issues and solutions for the Tazco Financial Ecosystem.

## 📋 Table of Contents

- [Installation Issues](#installation-issues)
- [Development Issues](#development-issues)
- [Backend Issues](#backend-issues)
- [Frontend Issues](#frontend-issues)
- [Database Issues](#database-issues)
- [Authentication Issues](#authentication-issues)
- [Docker/Emulator Issues](#dockeremulator-issues)
- [Testing Issues](#testing-issues)
- [Deployment Issues](#deployment-issues)
- [Performance Issues](#performance-issues)

## 🔧 Installation Issues

### Bun Installation Fails

**Problem:** Can't install Bun on your system.

**Solutions:**

```bash
# macOS/Linux
curl -fsSL https://bun.sh/install | bash

# Windows (WSL recommended)
wsl --install
# Then install Bun in WSL

# Verify installation
bun --version
```

**Alternative:** Use npm/yarn instead (not recommended):
```bash
npm install
npm run dev
```

### Dependencies Won't Install

**Problem:** `bun install` fails with errors.

**Solutions:**

```bash
# Clear cache
rm -rf node_modules bun.lock
bun install

# Use clean install
bun install --frozen-lockfile

# Check Bun version (should be >= 1.0.0)
bun --version

# Update Bun
bun upgrade
```

### Node Version Issues

**Problem:** "Node version not supported" errors.

**Solutions:**

```bash
# Check version (need >= 20.0.0)
node --version

# Install/update Node
# Using nvm:
nvm install 20
nvm use 20

# Using Volta:
volta install node@20
```

## 💻 Development Issues

### Port Already in Use

**Problem:** "Port 3000 already in use" or "Port 3001 already in use".

**Solutions:**

```bash
# Find process using port
lsof -i :3000
lsof -i :3001

# Kill process
kill -9 <PID>

# Or use different port
PORT=3002 bun run dev:backend
PORT=3003 bun run dev:frontend
```

### Changes Not Reflecting

**Problem:** Code changes don't appear in running app.

**Solutions:**

```bash
# Restart dev server
# Ctrl+C then
bun run dev

# Clear Next.js cache (frontend)
cd frontend
rm -rf .next
bun run dev

# Clear build cache (backend)
cd backend
rm -rf dist
bun run dev
```

### Hot Reload Not Working

**Problem:** Hot module replacement not working.

**Solutions:**

```bash
# Frontend: Check Next.js config
# Ensure reactStrictMode is enabled in next.config.ts

# Backend: Restart server manually
# Bun watch mode should work, but may need restart

# Check file watcher limits (Linux)
echo fs.inotify.max_user_watches=524288 | sudo tee -a /etc/sysctl.conf
sudo sysctl -p
```

## 🔙 Backend Issues

### API Returns 500 Errors

**Problem:** Internal server errors.

**Solutions:**

```bash
# Check backend logs
cd backend
bun run dev  # Look for error messages

# Check environment variables
cat .env
# Ensure all required vars are set

# Verify database connection
# For LocalStack:
docker ps | grep localstack
# For Firebase:
docker ps | grep firebase
```

### "User not found" Errors

**Problem:** API returns "User not found" even with valid token.

**Solution:**

```bash
# Create user first
curl -X POST http://localhost:3000/v1/users \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}'

# Verify user was created
curl http://localhost:3000/v1/dashboard \
  -H "Authorization: Bearer $USER_TOKEN"
```

### Idempotency Key Required

**Problem:** "Idempotency-Key header is required" error.

**Solution:**

```bash
# Add header to POST requests
curl -X POST http://localhost:3000/v1/cards/requests \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H "Idempotency-Key: req-$(date +%s)" \
  -H "Content-Type: application/json" \
  -d '{"productId": "default-credit-card"}'
```

### Provider Configuration Issues

**Problem:** Wrong provider being used.

**Solutions:**

```bash
# Check environment variables
echo $USE_INMEMORY
echo $USE_AWS

# For in-memory mode
bun run dev:in-memory

# For LocalStack
bun run dev:aws

# For Firebase
bun run dev:emulator
```

## 🎨 Frontend Issues

### "Cannot connect to API" Error

**Problem:** Frontend can't reach backend.

**Solutions:**

```bash
# Verify backend is running
curl http://localhost:3000/health/liveness

# Check environment variable
cd frontend
cat .env.local
# Should have: NEXT_PUBLIC_API_URL=http://localhost:3000

# Create .env.local if missing
echo "NEXT_PUBLIC_API_URL=http://localhost:3000" > .env.local

# Restart frontend
bun run dev
```

### Build Fails with Type Errors

**Problem:** TypeScript compilation errors during build.

**Solutions:**

```bash
# Run type check to see all errors
cd frontend
bun run typecheck

# Common fixes:
# 1. Install missing types
bun add -D @types/node @types/react @types/react-dom

# 2. Check tsconfig.json is correct
cat tsconfig.json

# 3. Clear cache and rebuild
rm -rf .next node_modules
bun install
bun run build
```

### Styles Not Loading

**Problem:** Tailwind styles not applied.

**Solutions:**

```bash
# Check globals.css is imported
# Should be in app/layout.tsx

# Verify Tailwind config
cat app/globals.css
# Should have @tailwind directives

# Clear cache
rm -rf .next
bun run dev
```

### Component Not Found

**Problem:** "Module not found" for component imports.

**Solutions:**

```bash
# Check import path uses @ alias
# ✅ import { Button } from '@/components/ui/button'
# ❌ import { Button } from '../../../components/ui/button'

# Verify tsconfig.json has paths config
cat tsconfig.json
# Should have:
# "paths": {
#   "@/*": ["./src/*"]
# }

# Install component if missing
bunx shadcn@latest add button
```

## 💾 Database Issues

### LocalStack Not Responding

**Problem:** LocalStack container not healthy.

**Solutions:**

```bash
# Check container status
docker ps | grep localstack

# View logs
cd backend
bun run emulator:logs:aws

# Restart LocalStack
bun run emulator:stop:aws
bun run emulator:start:aws

# Wait ~30 seconds for initialization
sleep 30

# Test connection
curl http://localhost:4566/_localstack/health
```

### DynamoDB Table Not Found

**Problem:** "Table does not exist" errors.

**Solutions:**

```bash
# Check if LocalStack initialized tables
AWS_ACCESS_KEY_ID=test AWS_SECRET_ACCESS_KEY=test \
  aws dynamodb list-tables \
  --endpoint-url http://localhost:4566 \
  --region us-east-1

# If tables missing, reset LocalStack
cd backend
bun run emulator:reset:aws
# Wait for initialization

# Verify tables created
AWS_ACCESS_KEY_ID=test AWS_SECRET_ACCESS_KEY=test \
  aws dynamodb list-tables \
  --endpoint-url http://localhost:4566 \
  --region us-east-1
```

### Firebase Emulator Connection Failed

**Problem:** Can't connect to Firestore emulator.

**Solutions:**

```bash
# Check emulator is running
docker ps | grep firebase

# Check environment variable
echo $FIRESTORE_EMULATOR_HOST
# Should be: localhost:8080

# Start emulator if not running
cd backend
bun run emulator:start

# View logs
bun run emulator:logs

# Check port not in use
lsof -i :8080
```

### Data Persistence Issues

**Problem:** Data lost when restarting emulators.

**Solutions:**

```bash
# LocalStack uses Docker volumes
# Check volumes exist
docker volume ls | grep tazco

# Firebase emulator data
# Check docker-compose.yml has volumes configured

# To preserve data:
# Stop (don't remove volumes)
docker compose stop

# To reset data:
cd backend
bun run emulator:reset:aws  # LocalStack
bun run emulator:reset      # Firebase
```

## 🔐 Authentication Issues

### "Unauthorized" Errors

**Problem:** 401 Unauthorized despite having token.

**Solutions:**

```bash
# Verify token is set
echo $USER_TOKEN

# Check token format
# Mock: mock.{base64}.sig
# Real: Valid JWT

# Ensure Authorization header is correct
curl http://localhost:3000/v1/dashboard \
  -H "Authorization: Bearer $USER_TOKEN" \
  -v  # Verbose to see headers

# Try generating new token
export USER_TOKEN="mock.$(echo -n '{"ecosystemId":"user-123","role":"user"}' | base64).sig"
```

### "Forbidden" Errors

**Problem:** 403 Forbidden - insufficient permissions.

**Solutions:**

```bash
# Verify role in token
# For admin endpoints, need admin role
export ADMIN_TOKEN="mock.$(echo -n '{"ecosystemId":"admin-001","role":"admin"}' | base64).sig"

# Use admin token for admin endpoints
curl http://localhost:3000/v1/admin/card-requests \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

### Token Decoding Issues

**Problem:** "Invalid token format" errors.

**Solutions:**

```bash
# Verify token structure
# Should have 3 parts: header.payload.signature

# For mock tokens:
# Format: mock.{base64_json}.sig

# Decode base64 to verify
echo "eyJlY29zeXN0ZW1JZCI6InVzZXItMTIzIiwicm9sZSI6InVzZXIifQ" | base64 -d
# Should output: {"ecosystemId":"user-123","role":"user"}

# Generate fresh token
export USER_TOKEN="mock.$(echo -n '{"ecosystemId":"user-123","role":"user"}' | base64).sig"
```

## 🐳 Docker/Emulator Issues

### Docker Daemon Not Running

**Problem:** "Cannot connect to Docker daemon".

**Solutions:**

```bash
# macOS
# Start Docker Desktop

# Linux
sudo systemctl start docker

# Check status
docker ps

# If still issues, reinstall Docker Desktop
```

### Container Won't Start

**Problem:** Emulator container fails to start.

**Solutions:**

```bash
# Check logs
docker logs <container-id>

# Common issues:

# 1. Port conflict
lsof -i :4566  # LocalStack
lsof -i :8080  # Firestore
# Kill conflicting processes

# 2. Permission issues
sudo chown -R $USER:$USER .

# 3. Remove and recreate
docker compose down -v
docker compose up -d
```

### "Network not found" Errors

**Problem:** Docker network errors.

**Solutions:**

```bash
# Remove containers and networks
docker compose down

# Recreate
docker compose up -d

# List networks
docker network ls

# Prune unused networks
docker network prune
```

## 🧪 Testing Issues

### Tests Failing Locally

**Problem:** Tests pass in CI but fail locally.

**Solutions:**

```bash
# Ensure clean state
cd backend
bun run test:unit  # Unit tests shouldn't need emulators

# For integration tests, start emulators first
bun run emulator:start:aws
sleep 30  # Wait for initialization
bun run test:integration:dynamodb

# Clear test databases
bun run emulator:reset:aws
bun run test:integration:dynamodb
```

### "Cannot find module" in Tests

**Problem:** Import errors during test execution.

**Solutions:**

```bash
# Check tsconfig.json paths
cat tsconfig.json

# Ensure test files in correct location
# tests/unit/
# tests/integration/
# tests/contract/

# Run typecheck
bun run typecheck
```

### Timeout Errors

**Problem:** Tests timing out.

**Solutions:**

```bash
# Increase timeout in test file
test('slow operation', async () => {
  // ...
}, { timeout: 30000 });  # 30 seconds

# Or in package.json
# "test": "bun test --timeout 30000"

# Check if emulators are responsive
curl http://localhost:4566/_localstack/health
```

## 🚀 Deployment Issues

### Firebase Deploy Fails

**Problem:** `firebase deploy` fails with errors.

**Solutions:**

```bash
# Login again
firebase login --reauth

# Check project
firebase projects:list
firebase use <project-id>

# Build first
cd backend
bun run build

# Deploy specific target
firebase deploy --only functions
firebase deploy --only firestore

# Check logs
firebase functions:log
```

### Build Errors in Production

**Problem:** Production build fails but dev works.

**Solutions:**

```bash
# Test production build locally
cd backend
bun run build

cd frontend
bun run build

# Check for environment-specific code
# Ensure no dev-only imports in production code

# Verify environment variables
cat .env.production
```

### CORS Errors in Production

**Problem:** CORS errors when deployed.

**Solutions:**

```bash
# Check backend CORS config
# In backend/src/api/middleware/cors.ts

# Ensure frontend URL in allowed origins
const corsOptions = {
  origin: [
    'https://yourdomain.com',
    'https://www.yourdomain.com'
  ]
};

# Verify environment variable
echo $NEXT_PUBLIC_API_URL
```

## ⚡ Performance Issues

### Slow API Responses

**Problem:** API taking too long to respond.

**Solutions:**

```bash
# Check database queries
# Add indexes for frequent queries

# Enable request logging
# Check for N+1 query problems

# Use pagination
curl 'http://localhost:3000/v1/cards/:id/transactions?limit=20&page=1'

# Check emulator performance
# LocalStack can be slow - consider using real services for testing
```

### High Memory Usage

**Problem:** Application using too much memory.

**Solutions:**

```bash
# Check for memory leaks
# Use Node.js --inspect flag

# Limit Next.js memory (frontend)
NODE_OPTIONS="--max-old-space-size=4096" bun run build

# Check Docker resources
docker stats

# Increase Docker memory limit
# Docker Desktop > Settings > Resources
```

### Frontend Slow to Load

**Problem:** Frontend takes long time to load.

**Solutions:**

```bash
# Optimize images
# Use Next.js Image component

# Enable compression in production
# Check next.config.ts

# Analyze bundle size
cd frontend
bun run build
# Review output bundle sizes

# Use dynamic imports for large components
const HeavyComponent = dynamic(() => import('./Heavy'))
```

## 🔍 Debugging Tips

### Enable Verbose Logging

```bash
# Backend
DEBUG=* bun run dev

# Frontend
NEXT_PUBLIC_DEBUG=true bun run dev
```

### Check All Services

```bash
# Backend
curl http://localhost:3000/health/liveness

# LocalStack
curl http://localhost:4566/_localstack/health

# Firebase Emulator
curl http://localhost:8080

# Frontend
curl http://localhost:3001
```

### Reset Everything

```bash
# Nuclear option - reset everything
cd backend
bun run emulator:stop:aws
bun run emulator:stop
docker system prune -a --volumes  # Warning: removes all Docker data
rm -rf node_modules dist .next
cd ../frontend
rm -rf node_modules .next

# Reinstall
cd ..
bun install
bun run dev:backend
bun run dev:frontend
```

## 📞 Getting Help

If you're still stuck:

1. **Check Documentation**
   - [README.md](./README.md)
   - [ARCHITECTURE.md](./ARCHITECTURE.md)
   - [LOCAL_TESTING_GUIDE.md](./LOCAL_TESTING_GUIDE.md)

2. **Search Issues**
   - [GitHub Issues](https://github.com/tazabreu/swx-ai-sdlc-training-playground/issues)

3. **Create New Issue**
   - Include error messages
   - Describe steps to reproduce
   - Share environment details (OS, Bun version, etc.)

4. **Check Logs**
   ```bash
   # Backend logs
   bun run dev  # Look for errors
   
   # Docker logs
   docker compose logs -f
   
   # System logs (macOS)
   tail -f /var/log/system.log
   ```

---

**Still having issues?** Open an issue with:
- Error message (full stack trace)
- Steps to reproduce
- Environment (OS, Bun version, Node version)
- What you've tried already
