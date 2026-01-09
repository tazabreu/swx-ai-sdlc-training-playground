/**
 * HTTP Firebase Function
 *
 * HTTP trigger wrapping Express app for Firebase Functions.
 */

import { createApp } from '../api/app.js';
import { createContainer } from '../infrastructure/di/container-factory.js';
import { ServiceNames } from '../infrastructure/di/container.js';
import type { IUserRepository } from '../infrastructure/persistence/interfaces/user.repository.js';
import { createUser } from '../domain/entities/user.entity.js';

// Create container based on environment
const container = createContainer();

// Create Express app
const app = createApp(container);

// Export for Firebase Functions (in production would use onRequest)
export { app };

/**
 * Seed default users for in-memory mode.
 * Creates user-123 (user) and admin-001 (admin) if they don't exist.
 */
async function seedDefaultUsers(): Promise<void> {
  const userRepo = container.resolve<IUserRepository>(ServiceNames.UserRepository);

  const defaultUsers = [
    {
      ecosystemId: 'user-123',
      firebaseUid: 'user-123',
      email: 'user-123@test.local',
      role: 'user' as const,
      initialScore: 700, // High tier for demo: $10,000 max credit limit
    },
    {
      ecosystemId: 'admin-001',
      firebaseUid: 'admin-001',
      email: 'admin-001@test.local',
      role: 'admin' as const,
      initialScore: 700,
    },
  ];

  for (const userData of defaultUsers) {
    const existing = await userRepo.findById(userData.ecosystemId);
    if (existing === null) {
      const user = createUser(userData);
      // Override score if specified
      if ('initialScore' in userData && userData.initialScore !== undefined) {
        user.currentScore = userData.initialScore;
        user.tier =
          userData.initialScore >= 700 ? 'high' : userData.initialScore >= 500 ? 'medium' : 'low';
      }
      await userRepo.save(user);
      console.log(
        `  ✓ Seeded ${userData.role}: ${userData.ecosystemId} (score: ${user.currentScore}, tier: ${user.tier})`
      );
    } else {
      console.log(
        `  ○ ${userData.role} exists: ${userData.ecosystemId} (score: ${existing.currentScore}, tier: ${existing.tier})`
      );
    }
  }
}

// For local development with Bun
if (import.meta.main) {
  const port = parseInt(process.env.PORT ?? '3000', 10);
  const useInMemory = process.env.USE_INMEMORY === 'true';

  // Start server after seeding (if needed)
  const startServer = async () => {
    // Seed default users in in-memory mode BEFORE starting server
    if (useInMemory) {
      console.log('Seeding default users (in-memory mode)...');
      await seedDefaultUsers();
      console.log('Default users ready.');
    }

    app.listen(port, () => {
      console.log(`Server running on http://localhost:${port}`);
      console.log('Available endpoints:');
      console.log('  GET  /health/liveness');
      console.log('  GET  /health/readiness');
      console.log('  GET  /v1/dashboard');
      console.log('  GET  /v1/offers');
      console.log('  GET  /v1/cards');
      console.log('  POST /v1/cards/requests');
      console.log('  GET  /v1/cards/requests/:requestId');
      console.log('  GET  /v1/cards/:cardId');
      console.log('  POST /v1/cards/:cardId/transactions/purchases');
      console.log('  POST /v1/cards/:cardId/transactions/payments');
      console.log('  GET  /v1/cards/:cardId/transactions');
      console.log('  GET  /v1/admin/users/:userSlug/score');
      console.log('  PATCH /v1/admin/users/:userSlug/score');
      console.log('  GET  /v1/admin/card-requests');
      console.log('  POST /v1/admin/card-requests/:requestId/approve');
      console.log('  POST /v1/admin/card-requests/:requestId/reject');
      console.log('  POST /v1/admin/cleanup');
    });
  };

  // Start the server
  startServer().catch((err) => {
    console.error('Failed to start server:', err);
    process.exit(1);
  });
}
