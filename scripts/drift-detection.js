#!/usr/bin/env bun

/**
 * Drift Detection Tool
 *
 * Detects drifts between specifications in specs/ folder and actual code implementation.
 * Analyzes:
 * - Backend implementation (domain entities, APIs, services)
 * - Frontend implementation (pages, components, features)
 * - Infrastructure (persistence, auth, events)
 */

import { readdirSync, statSync, readFileSync } from 'fs';
import { join } from 'path';

// ANSI Colors for terminal output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
};

{
  category;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  title;
  description;
  specReference;
  fileReferences;
  recommendation?;
}

{
  spec;
  title;
  status;
  entities;
  userStories;
  apiEndpoints;
  requirements;
}

const findings: DriftFinding = ;
const repoRoot = process.cwd();

// ============================================================================
// SPEC PARSING
// ============================================================================

function parseSpecFile(specPath): {
  const content = readFileSync(specPath, 'utf-8');
  const lines = content.split('\n');

  let title = '';
  let status = '';
  const entities = ;
  const userStories = ;
  const apiEndpoints = ;
  const requirements = ;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Extract title
    if (line.startsWith('# ') && !title) {
      title = line.substring(2).trim();
    }

    // Extract status
    if (line.includes('**Status**:')) {
      status = line.split('**Status**:')[1].trim();
    }

    // Extract user stories
    if (line.includes('### User Story')) {
      userStories.push(line.trim());
    }

    // Extract functional requirements
    if (line.match(/- \*\*FR-\d+\*\*/)) {
      requirements.push(line.trim());
    }

    // Extract API endpoints (common patterns)
    if (line.match(/GET|POST|PUT|PATCH|DELETE/) && line.includes('/v1/')) {
      apiEndpoints.push(line.trim());
    }
  }

  return {
    spec: specPath,
    title,
    status,
    entities,
    userStories,
    apiEndpoints,
    requirements,
  };
}

// ============================================================================
// CODE ANALYSIS
// ============================================================================

function findFilesRecursive(dir, pattern) {
  const files = ;

  try {
    const entries = readdirSync(dir);

    for (const entry of entries) {
      const fullPath = join(dir, entry);
      const stat = statSync(fullPath);

      if (stat.isDirectory() && !entry.startsWith('.') && entry !== 'node_modules') {
        files.push(...findFilesRecursive(fullPath, pattern));
      } else if (stat.isFile() && pattern.test(entry)) {
        files.push(fullPath);
      }
    }
  } catch (err) {
    // Skip inaccessible directories
  }

  return files;
}

function checkFileContains(filePath, pattern | RegExp) {
  try {
    const content = readFileSync(filePath, 'utf-8');
    if (typeof pattern === 'string') {
      return content.includes(pattern);
    }
    return pattern.test(content);
  } catch {
    return false;
  }
}

// ============================================================================
// SPEC 001: HEADLESS FINANCIAL API
// ============================================================================

function checkSpec001() {
  console.log(`\n${colors.cyan}${colors.bold}Checking Spec 001: Headless Financial API${colors.reset}\n`);

  const backendDir = join(repoRoot, 'backend/src');
  const entitiesDir = join(backendDir, 'domain/entities');
  const apiRoutesDir = join(backendDir, 'api/routes');

  // Check entities exist
  const requiredEntities = [
    'user.entity.ts',
    'card.entity.ts',
    'score.entity.ts',
    'card-request.entity.ts',
    'transaction.entity.ts',
    'event.entity.ts',
    'audit-log.entity.ts',
    'idempotency-record.entity.ts',
  ];

  for (const entity of requiredEntities) {
    const entityPath = join(entitiesDir, entity);
    try {
      statSync(entityPath);
    } catch {
      findings.push({
        category: 'Spec 001 - Entities',
        severity: 'critical',
        title: `Missing entity: ${entity}`,
        description: `Entity ${entity} is specified in data model but not found in code`,
        specReference: 'specs/001-headless-financial-api/data-model.md',
        fileReferences: [`backend/src/domain/entities/${entity} (missing)`],
        recommendation: `Create the entity file following the spec's data model`,
      });
    }
  }

  // Check API routes exist
  const requiredRoutes = [
    { file: 'health.ts', endpoints: ['/health/liveness', '/health/readiness'] },
    { file: 'dashboard.ts', endpoints: ['/v1/dashboard'] },
    { file: 'offers.ts', endpoints: ['/v1/offers'] },
    { file: 'cards.ts', endpoints: ['/v1/cards', '/v1/cards/requests'] },
    { file: 'transactions.ts', endpoints: ['/v1/transactions'] },
    { file: 'admin.ts', endpoints: ['/v1/admin/scores', '/v1/admin/requests'] },
  ];

  for (const route of requiredRoutes) {
    const routePath = join(apiRoutesDir, route.file);
    try {
      statSync(routePath);
      // Check if endpoints are actually implemented
      const content = readFileSync(routePath, 'utf-8');
      for (const endpoint of route.endpoints) {
        const endpointPattern = endpoint.split('/').pop() || endpoint;
        if (!content.includes(`'/${endpointPattern}'`) && !content.includes(`"/${endpointPattern}"`)) {
          findings.push({
            category: 'Spec 001 - API Endpoints',
            severity: 'high',
            title: `Endpoint ${endpoint} may not be implemented`,
            description: `Route file ${route.file} exists but endpoint ${endpoint} pattern not found`,
            specReference: 'specs/001-headless-financial-api/spec.md - User Stories',
            fileReferences: [routePath],
            recommendation: 'Verify endpoint implementation matches spec',
          });
        }
      }
    } catch {
      findings.push({
        category: 'Spec 001 - API Routes',
        severity: 'critical',
        title: `Missing route file: ${route.file}`,
        description: `Route ${route.file} is required by spec but not found`,
        specReference: 'specs/001-headless-financial-api/spec.md',
        fileReferences: [`backend/src/api/routes/${route.file} (missing)`],
        recommendation: 'Create the route file with required endpoints',
      });
    }
  }

  // Check User Story implementations
  const userStoryChecks = [
    {
      story: 'User Story 1 - User Authentication',
      checks: [
        { file: 'backend/src/infrastructure/auth', required: true },
        { file: 'backend/src/api/middleware/auth.ts', required: true },
      ],
    },
    {
      story: 'User Story 2 - Dashboard Summary',
      checks: [{ file: 'backend/src/api/routes/dashboard.ts', required: true }],
    },
    {
      story: 'User Story 3 - Product Offers',
      checks: [{ file: 'backend/src/api/routes/offers.ts', required: true }],
    },
    {
      story: 'User Story 4 - Card Request and Approval',
      checks: [
        { file: 'backend/src/application/handlers/request-card.handler.ts', required: true },
        { file: 'backend/src/application/handlers/admin-approve-card.handler.ts', required: true },
      ],
    },
    {
      story: 'User Story 6 - Purchase and Payment Simulation',
      checks: [
        { file: 'backend/src/application/handlers/make-purchase.handler.ts', required: true },
        { file: 'backend/src/application/handlers/make-payment.handler.ts', required: true },
      ],
    },
    {
      story: 'User Story 10 - Event Publishing',
      checks: [
        { file: 'backend/src/infrastructure/persistence/interfaces/outbox.repository.ts', required: true },
        { file: 'backend/src/domain/entities/event.entity.ts', required: true },
      ],
    },
  ];

  for (const check of userStoryChecks) {
    for (const fileCheck of check.checks) {
      const filePath = join(repoRoot, fileCheck.file);
      try {
        statSync(filePath);
      } catch {
        findings.push({
          category: 'Spec 001 - User Stories',
          severity: fileCheck.required ? 'high' : 'medium',
          title: `${check.story} - Missing file`,
          description: `File ${fileCheck.file} not found for ${check.story}`,
          specReference: 'specs/001-headless-financial-api/spec.md',
          fileReferences: [fileCheck.file + ' (missing)'],
          recommendation: 'Implement the required handler/service for this user story',
        });
      }
    }
  }

  // Check infrastructure modes
  const infrastructureModes = ['inmemory', 'firestore', 'aws'];
  const persistenceDir = join(backendDir, 'infrastructure/persistence');

  for (const mode of infrastructureModes) {
    const modeDir = join(persistenceDir, mode);
    try {
      statSync(modeDir);
    } catch {
      if (mode === 'inmemory' || mode === 'firestore') {
        findings.push({
          category: 'Spec 001 - Infrastructure',
          severity: 'high',
          title: `Missing persistence mode: ${mode}`,
          description: `Persistence implementation for ${mode} not found`,
          specReference: 'specs/001-headless-financial-api/plan.md - Provider-agnostic design',
          fileReferences: [`backend/src/infrastructure/persistence/${mode}/ (missing)`],
          recommendation: `Implement ${mode} persistence layer`,
        });
      }
    }
  }
}

// ============================================================================
// SPEC 002: WHATSAPP ADMIN NOTIFICATIONS
// ============================================================================

function checkSpec002() {
  console.log(`\n${colors.cyan}${colors.bold}Checking Spec 002: WhatsApp Admin Notifications${colors.reset}\n`);

  const backendDir = join(repoRoot, 'backend/src');

  // Check WhatsApp entities
  const whatsappEntities = [
    'whatsapp-notification.entity.ts',
    'whatsapp-inbound.entity.ts',
    'pending-approval.entity.ts',
  ];

  for (const entity of whatsappEntities) {
    const entityPath = join(backendDir, 'domain/entities', entity);
    try {
      statSync(entityPath);
    } catch {
      findings.push({
        category: 'Spec 002 - WhatsApp Entities',
        severity: 'critical',
        title: `Missing WhatsApp entity: ${entity}`,
        description: `Entity ${entity} is required by WhatsApp feature spec`,
        specReference: 'specs/002-whatsapp-admin-notifications/data-model.md',
        fileReferences: [`backend/src/domain/entities/${entity} (missing)`],
        recommendation: 'Create the entity as per data model',
      });
    }
  }

  // Check WhatsApp infrastructure
  const whatsappInfraChecks = [
    { file: 'infrastructure/whatsapp/client.ts', description: 'WPP-Connect client' },
    { file: 'infrastructure/whatsapp/config.ts', description: 'WhatsApp configuration' },
    { file: 'api/routes/webhooks.ts', description: 'Webhook endpoint' },
    { file: 'api/middleware/webhook-auth.ts', description: 'Webhook authentication' },
    {
      file: 'application/handlers/whatsapp-approval.handler.ts',
      description: 'WhatsApp approval handler',
    },
  ];

  for (const check of whatsappInfraChecks) {
    const filePath = join(backendDir, check.file);
    try {
      statSync(filePath);
    } catch {
      findings.push({
        category: 'Spec 002 - WhatsApp Infrastructure',
        severity: 'critical',
        title: `Missing WhatsApp component: ${check.description}`,
        description: `File ${check.file} not found`,
        specReference: 'specs/002-whatsapp-admin-notifications/plan.md',
        fileReferences: [`backend/src/${check.file} (missing)`],
        recommendation: `Implement ${check.description}`,
      });
    }
  }

  // Check if WhatsApp is wired into card request flow
  const requestHandlerPath = join(backendDir, 'application/handlers/request-card.handler.ts');
  const hasWhatsAppNotification = checkFileContains(
    requestHandlerPath,
    /whatsapp|WhatsApp|notification/i
  );

  if (!hasWhatsAppNotification) {
    findings.push({
      category: 'Spec 002 - Integration',
      severity: 'high',
      title: 'WhatsApp notifications not integrated with card requests',
      description:
        'Card request handler does not appear to trigger WhatsApp notifications for low-score users',
      specReference: 'specs/002-whatsapp-admin-notifications/spec.md - User Story 1',
      fileReferences: [requestHandlerPath],
      recommendation:
        'Integrate WhatsApp notification service into card request handler for pending approvals',
    });
  }
}

// ============================================================================
// SPEC 004: AWS LOCALSTACK INFRASTRUCTURE
// ============================================================================

function checkSpec004() {
  console.log(`\n${colors.cyan}${colors.bold}Checking Spec 004: AWS LocalStack Infrastructure${colors.reset}\n`);

  const backendDir = join(repoRoot, 'backend');

  // Check AWS persistence layer
  const awsPersistenceDir = join(backendDir, 'src/infrastructure/persistence/aws');
  try {
    statSync(awsPersistenceDir);

    // Check for DynamoDB repositories
    const requiredRepos = [
      'user.dynamodb.ts',
      'card.dynamodb.ts',
      'card-request.dynamodb.ts',
      'transaction.dynamodb.ts',
      'score.dynamodb.ts',
      'idempotency.dynamodb.ts',
      'outbox.dynamodb.ts',
      'audit-log.dynamodb.ts',
    ];

    for (const repo of requiredRepos) {
      const repoPath = join(awsPersistenceDir, repo);
      try {
        statSync(repoPath);
      } catch {
        findings.push({
          category: 'Spec 004 - DynamoDB Repositories',
          severity: 'high',
          title: `Missing DynamoDB repository: ${repo}`,
          description: `Repository ${repo} not found in AWS persistence layer`,
          specReference: 'specs/004-aws-localstack-infrastructure/data-model.md',
          fileReferences: [`backend/src/infrastructure/persistence/aws/${repo} (missing)`],
          recommendation: 'Implement DynamoDB repository following the interface',
        });
      }
    }
  } catch {
    findings.push({
      category: 'Spec 004 - AWS Infrastructure',
      severity: 'critical',
      title: 'AWS persistence layer not found',
      description: 'AWS/DynamoDB persistence implementation directory not found',
      specReference: 'specs/004-aws-localstack-infrastructure/spec.md',
      fileReferences: ['backend/src/infrastructure/persistence/aws/ (missing)'],
      recommendation: 'Create AWS persistence layer with DynamoDB implementations',
    });
  }

  // Check Docker Compose for LocalStack
  const dockerComposePath = join(backendDir, 'docker-compose.aws.yml');
  try {
    statSync(dockerComposePath);
    const content = readFileSync(dockerComposePath, 'utf-8');
    if (!content.includes('localstack')) {
      findings.push({
        category: 'Spec 004 - LocalStack Config',
        severity: 'high',
        title: 'docker-compose.aws.yml missing LocalStack service',
        description: 'Docker Compose file exists but does not define LocalStack service',
        specReference: 'specs/004-aws-localstack-infrastructure/spec.md - User Story 1',
        fileReferences: [dockerComposePath],
        recommendation: 'Add LocalStack service definition to docker-compose.aws.yml',
      });
    }
  } catch {
    findings.push({
      category: 'Spec 004 - LocalStack Config',
      severity: 'critical',
      title: 'docker-compose.aws.yml not found',
      description: 'LocalStack Docker Compose configuration file not found',
      specReference: 'specs/004-aws-localstack-infrastructure/spec.md',
      fileReferences: ['backend/docker-compose.aws.yml (missing)'],
      recommendation: 'Create docker-compose.aws.yml with LocalStack service',
    });
  }

  // Check init script
  const initScriptPath = join(backendDir, 'scripts/localstack-init');
  try {
    statSync(initScriptPath);
  } catch {
    findings.push({
      category: 'Spec 004 - LocalStack Init',
      severity: 'medium',
      title: 'LocalStack initialization script not found',
      description: 'Script to initialize LocalStack resources (tables, etc.) not found',
      specReference: 'specs/004-aws-localstack-infrastructure/spec.md - User Story 3',
      fileReferences: ['backend/scripts/localstack-init/ (missing)'],
      recommendation: 'Create initialization script to set up DynamoDB tables and other resources',
    });
  }

  // Check AWS auth provider
  const awsAuthPath = join(backendDir, 'src/infrastructure/auth/cognito.auth-provider.ts');
  try {
    statSync(awsAuthPath);
  } catch {
    findings.push({
      category: 'Spec 004 - AWS Auth',
      severity: 'medium',
      title: 'Cognito auth provider not found',
      description: 'AWS Cognito authentication provider implementation not found',
      specReference: 'specs/004-aws-localstack-infrastructure/spec.md - Milestone 2',
      fileReferences: [
        'backend/src/infrastructure/auth/cognito.auth-provider.ts (missing or different name)',
      ],
      recommendation: 'Implement Cognito auth provider or document if using different approach',
    });
  }

  // Check bun scripts for AWS mode
  const packageJsonPath = join(backendDir, 'package.json');
  try {
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
    const scripts = packageJson.scripts || {};

    const requiredScripts = ['dev:aws', 'emulator:start:aws', 'emulator:reset:aws', 'test:aws'];

    for (const script of requiredScripts) {
      if (!scripts[script]) {
        findings.push({
          category: 'Spec 004 - Scripts',
          severity: 'medium',
          title: `Missing npm script: ${script}`,
          description: `Script "${script}" not found in backend package.json`,
          specReference: 'specs/004-aws-localstack-infrastructure/spec.md',
          fileReferences: [packageJsonPath],
          recommendation: `Add "${script}" script to package.json`,
        });
      }
    }
  } catch {
    // package.json should exist, but don't fail entirely
  }
}

// ============================================================================
// FRONTEND COVERAGE CHECK
// ============================================================================

function checkFrontendCoverage() {
  console.log(`\n${colors.cyan}${colors.bold}Checking Frontend Implementation${colors.reset}\n`);

  const frontendDir = join(repoRoot, 'frontend/src/app');

  // Check user pages
  const userPages = [
    { path: '(user)/dashboard/page.tsx', story: 'User Story 2 - Dashboard Summary' },
    { path: '(user)/offers/page.tsx', story: 'User Story 3 - Product Offers' },
    { path: '(user)/cards/page.tsx', story: 'User Story 5 - View Cards' },
    { path: '(user)/transactions/page.tsx', story: 'User Story 6 - Purchase and Payment' },
  ];

  for (const page of userPages) {
    const pagePath = join(frontendDir, page.path);
    try {
      statSync(pagePath);
    } catch {
      findings.push({
        category: 'Frontend - User Pages',
        severity: 'high',
        title: `Missing user page: ${page.path}`,
        description: `Page for ${page.story} not found`,
        specReference: 'specs/001-headless-financial-api/spec.md',
        fileReferences: [`frontend/src/app/${page.path} (missing)`],
        recommendation: 'Create user page for this story',
      });
    }
  }

  // Check admin pages
  const adminPages = [
    { path: '(admin)/requests/page.tsx', story: 'User Story 8 - Admin Card Approval' },
    { path: '(admin)/scores/page.tsx', story: 'User Story 7 - Admin Score Management' },
  ];

  for (const page of adminPages) {
    const pagePath = join(frontendDir, page.path);
    try {
      statSync(pagePath);
    } catch {
      findings.push({
        category: 'Frontend - Admin Pages',
        severity: 'high',
        title: `Missing admin page: ${page.path}`,
        description: `Page for ${page.story} not found`,
        specReference: 'specs/001-headless-financial-api/spec.md',
        fileReferences: [`frontend/src/app/${page.path} (missing)`],
        recommendation: 'Create admin page for this story',
      });
    }
  }

  // Check API client
  const apiClientPath = join(repoRoot, 'frontend/src/lib/api/client.ts');
  try {
    statSync(apiClientPath);
    const content = readFileSync(apiClientPath, 'utf-8');

    // Check for required API methods
    const requiredMethods = [
      'dashboard',
      'offers',
      'cards',
      'transactions',
      'admin.approveRequest',
      'admin.rejectRequest',
      'admin.getScore',
    ];

    for (const method of requiredMethods) {
      if (!content.includes(method)) {
        findings.push({
          category: 'Frontend - API Client',
          severity: 'medium',
          title: `API method possibly missing: ${method}`,
          description: `Method ${method} not found in API client`,
          specReference: 'specs/001-headless-financial-api/spec.md',
          fileReferences: [apiClientPath],
          recommendation: 'Verify API client has all required methods',
        });
      }
    }
  } catch {
    findings.push({
      category: 'Frontend - API Client',
      severity: 'critical',
      title: 'API client not found',
      description: 'Frontend API client implementation not found',
      specReference: 'specs/001-headless-financial-api/spec.md',
      fileReferences: ['frontend/src/lib/api/client.ts (missing)'],
      recommendation: 'Create API client for backend communication',
    });
  }
}

// ============================================================================
// TESTING COVERAGE CHECK
// ============================================================================

function checkTestingCoverage() {
  console.log(`\n${colors.cyan}${colors.bold}Checking Test Coverage${colors.reset}\n`);

  const testsDir = join(repoRoot, 'backend/tests');

  // Check test directories
  const testTypes = ['unit', 'integration', 'contract', 'functional'];

  for (const testType of testTypes) {
    const testPath = join(testsDir, testType);
    try {
      statSync(testPath);
    } catch {
      findings.push({
        category: 'Testing',
        severity: testType === 'contract' ? 'high' : 'medium',
        title: `Missing ${testType} tests directory`,
        description: `Directory for ${testType} tests not found`,
        specReference: 'specs/001-headless-financial-api/spec.md - FR-047 to FR-050',
        fileReferences: [`backend/tests/${testType}/ (missing)`],
        recommendation: `Create ${testType} tests directory and add tests`,
      });
    }
  }

  // Check for contract tests
  const contractTestPath = join(testsDir, 'contract');
  try {
    const contractTests = findFilesRecursive(contractTestPath, /\.test\.ts$/);
    if (contractTests.length === 0) {
      findings.push({
        category: 'Testing - Contract Tests',
        severity: 'high',
        title: 'No contract tests found',
        description: 'Contract tests directory exists but contains no test files',
        specReference: 'specs/001-headless-financial-api/spec.md - Testing requirements',
        fileReferences: [contractTestPath],
        recommendation: 'Add contract tests to verify API contracts',
      });
    }
  } catch {
    // Already reported as missing directory
  }
}

// ============================================================================
// CROSS-CUTTING CONCERNS
// ============================================================================

function checkCrossCuttingConcerns() {
  console.log(`\n${colors.cyan}${colors.bold}Checking Cross-Cutting Concerns${colors.reset}\n`);

  const backendDir = join(repoRoot, 'backend/src');

  // Check observability
  const observabilityChecks = [
    {
      file: 'api/middleware/request-id.ts',
      description: 'Request ID middleware',
      requirement: 'FR-045',
    },
    { file: 'api/middleware/error-handler.ts', description: 'Error handler', requirement: 'FR-046' },
  ];

  for (const check of observabilityChecks) {
    const filePath = join(backendDir, check.file);
    try {
      statSync(filePath);
    } catch {
      findings.push({
        category: 'Cross-Cutting - Observability',
        severity: 'medium',
        title: `Missing ${check.description}`,
        description: `${check.description} not found (${check.requirement})`,
        specReference: 'specs/001-headless-financial-api/spec.md',
        fileReferences: [`backend/src/${check.file} (missing)`],
        recommendation: `Implement ${check.description}`,
      });
    }
  }

  // Check idempotency support
  const idempotencyRepoPath = join(
    backendDir,
    'infrastructure/persistence/interfaces/idempotency.repository.ts'
  );
  try {
    statSync(idempotencyRepoPath);
  } catch {
    findings.push({
      category: 'Cross-Cutting - Idempotency',
      severity: 'high',
      title: 'Idempotency repository not found',
      description: 'Idempotency support not found',
      specReference: 'specs/001-headless-financial-api/spec.md - FR-020',
      fileReferences: [idempotencyRepoPath + ' (missing)'],
      recommendation: 'Implement idempotency repository interface',
    });
  }

  // Check outbox pattern
  const outboxRepoPath = join(
    backendDir,
    'infrastructure/persistence/interfaces/outbox.repository.ts'
  );
  try {
    statSync(outboxRepoPath);
  } catch {
    findings.push({
      category: 'Cross-Cutting - Event Publishing',
      severity: 'critical',
      title: 'Outbox repository not found',
      description: 'Transactional outbox pattern not found',
      specReference: 'specs/001-headless-financial-api/spec.md - FR-037 to FR-042',
      fileReferences: [outboxRepoPath + ' (missing)'],
      recommendation: 'Implement outbox repository for event publishing',
    });
  }
}

// ============================================================================
// REPORT GENERATION
// ============================================================================

function printSummary() {
  console.log(
    `\n${colors.bold}${colors.blue}${'='.repeat(80)}${colors.reset}`
  );
  console.log(`${colors.bold}${colors.blue}DRIFT DETECTION SUMMARY${colors.reset}`);
  console.log(`${colors.bold}${colors.blue}${'='.repeat(80)}${colors.reset}\n`);

  const bySeverity = {
    critical: findings.filter((f) => f.severity === 'critical'),
    high: findings.filter((f) => f.severity === 'high'),
    medium: findings.filter((f) => f.severity === 'medium'),
    low: findings.filter((f) => f.severity === 'low'),
    info: findings.filter((f) => f.severity === 'info'),
  };

  console.log(`${colors.bold}Total Findings: ${findings.length}${colors.reset}`);
  console.log(`  ${colors.red}${colors.bold}Critical: ${bySeverity.critical.length}${colors.reset}`);
  console.log(`  ${colors.yellow}${colors.bold}High:     ${bySeverity.high.length}${colors.reset}`);
  console.log(`  ${colors.yellow}Medium:   ${bySeverity.medium.length}${colors.reset}`);
  console.log(`  ${colors.blue}Low:      ${bySeverity.low.length}${colors.reset}`);
  console.log(`  ${colors.cyan}Info:     ${bySeverity.info.length}${colors.reset}\n`);

  // Group by category
  const byCategory: Record<string, DriftFinding> = {};
  for (const finding of findings) {
    if (!byCategory[finding.category]) {
      byCategory[finding.category] = ;
    }
    byCategory[finding.category].push(finding);
  }

  console.log(`${colors.bold}Findings by Category:${colors.reset}`);
  for (const [category, categoryFindings] of Object.entries(byCategory)) {
    console.log(`  ${category}: ${categoryFindings.length}`);
  }
  console.log();
}

function printDetailedFindings() {
  if (findings.length === 0) {
    console.log(`${colors.green}${colors.bold}✓ No drifts detected! Code is aligned with specifications.${colors.reset}\n`);
    return;
  }

  console.log(
    `${colors.bold}${colors.blue}${'='.repeat(80)}${colors.reset}`
  );
  console.log(`${colors.bold}${colors.blue}DETAILED FINDINGS${colors.reset}`);
  console.log(`${colors.bold}${colors.blue}${'='.repeat(80)}${colors.reset}\n`);

  // Sort by severity
  const severityOrder = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
  findings.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  for (let i = 0; i < findings.length; i++) {
    const finding = findings[i];
    const severityColor =
      finding.severity === 'critical'
        ? colors.red
        : finding.severity === 'high'
          ? colors.yellow
          : finding.severity === 'medium'
            ? colors.yellow
            : finding.severity === 'low'
              ? colors.blue
              : colors.cyan;

    console.log(
      `${colors.bold}[${i + 1}/${findings.length}] ${severityColor}${finding.severity.toUpperCase()}${colors.reset} - ${colors.bold}${finding.title}${colors.reset}`
    );
    console.log(`${colors.cyan}Category:${colors.reset} ${finding.category}`);
    console.log(`${colors.cyan}Description:${colors.reset} ${finding.description}`);
    console.log(`${colors.cyan}Spec Reference:${colors.reset} ${finding.specReference}`);
    console.log(`${colors.cyan}Files:${colors.reset}`);
    for (const file of finding.fileReferences) {
      console.log(`  - ${file}`);
    }
    if (finding.recommendation) {
      console.log(`${colors.green}${colors.bold}Recommendation:${colors.reset} ${finding.recommendation}`);
    }
    console.log();
  }
}

function saveReport() {
  const reportPath = join(repoRoot, 'DRIFT_REPORT.md');
  const timestamp = new Date().toISOString();

  let markdown = `# Drift Detection Report\n\n`;
  markdown += `**Generated:** ${timestamp}\n`;
  markdown += `**Total Findings:** ${findings.length}\n\n`;

  markdown += `## Summary\n\n`;
  const bySeverity = {
    critical: findings.filter((f) => f.severity === 'critical'),
    high: findings.filter((f) => f.severity === 'high'),
    medium: findings.filter((f) => f.severity === 'medium'),
    low: findings.filter((f) => f.severity === 'low'),
    info: findings.filter((f) => f.severity === 'info'),
  };

  markdown += `| Severity | Count |\n`;
  markdown += `|----------|-------|\n`;
  markdown += `| Critical | ${bySeverity.critical.length} |\n`;
  markdown += `| High     | ${bySeverity.high.length} |\n`;
  markdown += `| Medium   | ${bySeverity.medium.length} |\n`;
  markdown += `| Low      | ${bySeverity.low.length} |\n`;
  markdown += `| Info     | ${bySeverity.info.length} |\n\n`;

  // Group by category
  const byCategory: Record<string, DriftFinding> = {};
  for (const finding of findings) {
    if (!byCategory[finding.category]) {
      byCategory[finding.category] = ;
    }
    byCategory[finding.category].push(finding);
  }

  markdown += `## Findings by Category\n\n`;
  for (const [category, categoryFindings] of Object.entries(byCategory)) {
    markdown += `### ${category} (${categoryFindings.length})\n\n`;

    for (const finding of categoryFindings) {
      markdown += `#### ${finding.severity.toUpperCase()}: ${finding.title}\n\n`;
      markdown += `**Description:** ${finding.description}\n\n`;
      markdown += `**Spec Reference:** ${finding.specReference}\n\n`;
      markdown += `**Files:**\n`;
      for (const file of finding.fileReferences) {
        markdown += `- \`${file}\`\n`;
      }
      if (finding.recommendation) {
        markdown += `\n**Recommendation:** ${finding.recommendation}\n`;
      }
      markdown += `\n---\n\n`;
    }
  }

  // Write to file
  require('fs').writeFileSync(reportPath, markdown);
  console.log(`${colors.green}${colors.bold}Report saved to: ${reportPath}${colors.reset}\n`);
}

// ============================================================================
// MAIN
// ============================================================================

function main() {
  console.log(`${colors.bold}${colors.magenta}╔═══════════════════════════════════════════════════════════════════════════╗${colors.reset}`);
  console.log(`${colors.bold}${colors.magenta}║                     DRIFT DETECTION TOOL                                  ║${colors.reset}`);
  console.log(`${colors.bold}${colors.magenta}║           Analyzing specs/ vs backend/ and frontend/                      ║${colors.reset}`);
  console.log(`${colors.bold}${colors.magenta}╚═══════════════════════════════════════════════════════════════════════════╝${colors.reset}`);

  // Run all checks
  checkSpec001();
  checkSpec002();
  checkSpec004();
  checkFrontendCoverage();
  checkTestingCoverage();
  checkCrossCuttingConcerns();

  // Print results
  printSummary();
  printDetailedFindings();
  saveReport();

  // Exit with appropriate code
  const criticalCount = findings.filter((f) => f.severity === 'critical').length;
  const highCount = findings.filter((f) => f.severity === 'high').length;

  if (criticalCount > 0) {
    console.log(`${colors.red}${colors.bold}⚠ ${criticalCount} CRITICAL issues found!${colors.reset}\n`);
    process.exit(1);
  } else if (highCount > 0) {
    console.log(`${colors.yellow}${colors.bold}⚠ ${highCount} HIGH severity issues found${colors.reset}\n`);
    process.exit(0);
  } else if (findings.length > 0) {
    console.log(`${colors.blue}${colors.bold}ℹ ${findings.length} minor issues found${colors.reset}\n`);
    process.exit(0);
  } else {
    console.log(`${colors.green}${colors.bold}✓ All checks passed!${colors.reset}\n`);
    process.exit(0);
  }
}

main();
