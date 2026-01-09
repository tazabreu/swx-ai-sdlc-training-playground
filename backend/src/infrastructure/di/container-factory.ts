/**
 * Container Factory
 *
 * Factory functions to create pre-configured containers for different environments.
 */

import { Container, ServiceNames } from './container.js';

// Repository interfaces
import type { IUserRepository } from '../persistence/interfaces/user.repository.js';
import type { ICardRepository } from '../persistence/interfaces/card.repository.js';
import type { IPendingApprovalRepository } from '../persistence/interfaces/pending-approval.repository.js';

// InMemory repositories
import {
  InMemoryUserRepository,
  InMemoryCardRepository,
  InMemoryCardRequestRepository,
  InMemoryTransactionRepository,
  InMemoryIdempotencyRepository,
  InMemoryOutboxRepository,
  InMemoryAuditLogRepository,
  InMemoryWhatsAppNotificationRepository,
  InMemoryWhatsAppInboundRepository,
  InMemoryPendingApprovalRepository,
} from '../persistence/inmemory/index.js';

// Firestore repositories
import {
  initializeFirestore,
  getFirestoreDb,
  FirestoreUserRepository,
  FirestoreCardRepository,
  FirestoreCardRequestRepository,
  FirestoreTransactionRepository,
  FirestoreIdempotencyRepository,
  FirestoreOutboxRepository,
  FirestoreAuditLogRepository,
  WhatsAppNotificationFirestoreRepository,
  WhatsAppInboundFirestoreRepository,
  PendingApprovalFirestoreRepository,
} from '../persistence/firestore/index.js';

// AWS DynamoDB repositories
import {
  getDocumentClient,
  DynamoDBUserRepository,
  DynamoDBCardRepository,
  DynamoDBCardRequestRepository,
  DynamoDBTransactionRepository,
  DynamoDBIdempotencyRepository,
  DynamoDBOutboxRepository,
  DynamoDBAuditLogRepository,
  DynamoDBWhatsAppNotificationRepository,
  DynamoDBWhatsAppInboundRepository,
  DynamoDBPendingApprovalRepository,
} from '../persistence/aws/index.js';

// WhatsApp infrastructure
import { WppConnectClient } from '../whatsapp/client.js';
import { loadWhatsAppConfig } from '../whatsapp/config.js';

// WhatsApp services
import { WhatsAppNotificationService } from '../../domain/services/whatsapp-notification.service.js';
import { MessageParserService } from '../../domain/services/message-parser.service.js';

// Auth and Events
import { MockAuthProvider, FirebaseAuthProvider, CognitoAuthProvider } from '../auth/index.js';
import type { CognitoAuthConfig } from '../auth/index.js';
import { InMemoryEventPublisher, EventBridgeSQSPublisher } from '../events/index.js';
import type { IEventPublisher } from '../events/event-publisher.interface.js';

// Event handlers
import { handleCardRequestNotification } from '../../application/handlers/card-request-notification.handler.js';
import { handlePaymentNotification } from '../../application/handlers/payment-notification.handler.js';

/**
 * Container configuration options
 */
export interface ContainerConfig {
  useInMemory?: boolean;
  firestoreEmulatorHost?: string;
  projectId?: string;
}

/**
 * AWS container configuration options
 */
export interface AWSContainerConfig {
  region?: string;
  endpoint?: string; // LocalStack endpoint override
  cognito: CognitoAuthConfig;
}

/**
 * Wire event handlers to the event publisher
 *
 * This subscribes notification handlers to domain events so they execute
 * when events are published.
 */
function wireEventHandlers(container: Container): void {
  const eventPublisher = container.resolve<IEventPublisher>(ServiceNames.EventPublisher);

  // Subscribe card request notification handler to 'card.requested' events
  eventPublisher.subscribe('card.requested', async (event) => {
    const notificationService = container.resolve<WhatsAppNotificationService>(
      ServiceNames.WhatsAppNotificationService
    );
    const pendingApprovalRepo = container.resolve<IPendingApprovalRepository>(
      ServiceNames.PendingApprovalRepository
    );
    const userRepo = container.resolve<IUserRepository>(ServiceNames.UserRepository);

    await handleCardRequestNotification(event, {
      notificationService,
      pendingApprovalRepo,
      userRepo,
    });
  });

  // Subscribe payment notification handler to 'transaction.payment' events
  eventPublisher.subscribe('transaction.payment', async (event) => {
    const notificationService = container.resolve<WhatsAppNotificationService>(
      ServiceNames.WhatsAppNotificationService
    );
    const cardRepo = container.resolve<ICardRepository>(ServiceNames.CardRepository);

    await handlePaymentNotification(event, {
      notificationService,
      cardRepo,
    });
  });
}

/**
 * Create a container with InMemory implementations for testing
 */
export function createTestContainer(): Container {
  const container = new Container();

  // Register InMemory repositories
  container.registerSingleton(ServiceNames.UserRepository, () => new InMemoryUserRepository());
  container.registerSingleton(ServiceNames.CardRepository, () => new InMemoryCardRepository());
  container.registerSingleton(
    ServiceNames.CardRequestRepository,
    () => new InMemoryCardRequestRepository()
  );
  container.registerSingleton(
    ServiceNames.TransactionRepository,
    () => new InMemoryTransactionRepository()
  );
  container.registerSingleton(
    ServiceNames.IdempotencyRepository,
    () => new InMemoryIdempotencyRepository()
  );
  container.registerSingleton(ServiceNames.OutboxRepository, () => new InMemoryOutboxRepository());
  container.registerSingleton(
    ServiceNames.AuditLogRepository,
    () => new InMemoryAuditLogRepository()
  );

  // Register providers
  container.registerSingleton(ServiceNames.AuthProvider, () => new MockAuthProvider());
  container.registerSingleton(ServiceNames.EventPublisher, () => new InMemoryEventPublisher());

  // WhatsApp repositories (InMemory)
  container.registerSingleton(
    ServiceNames.WhatsAppNotificationRepository,
    () => new InMemoryWhatsAppNotificationRepository()
  );
  container.registerSingleton(
    ServiceNames.WhatsAppInboundRepository,
    () => new InMemoryWhatsAppInboundRepository()
  );
  container.registerSingleton(
    ServiceNames.PendingApprovalRepository,
    () => new InMemoryPendingApprovalRepository()
  );

  // WhatsApp config (test defaults)
  const testConfig = {
    wppBaseUrl: 'http://localhost:21465',
    wppSecretKey: 'test-secret',
    wppSessionName: 'test-session',
    adminPhone1: '5511999999999',
    adminPhone2: '5511888888888',
    webhookSecret: 'test-webhook-secret',
    notificationsEnabled: false, // Disabled by default in tests
  };
  container.registerInstance(ServiceNames.WhatsAppConfig, testConfig);

  // WhatsApp client (stub for tests - won't be used due to notificationsEnabled: false)
  const stubClient = new WppConnectClient({
    baseUrl: 'http://localhost:21465',
    secretKey: 'stub',
    sessionName: 'stub',
  });
  container.registerInstance(ServiceNames.WppClient, stubClient);

  // WhatsApp services
  container.registerSingleton(ServiceNames.MessageParserService, () => new MessageParserService());
  container.registerSingleton(ServiceNames.WhatsAppNotificationService, (c) => {
    return new WhatsAppNotificationService(
      c.resolve(ServiceNames.WppClient),
      c.resolve(ServiceNames.WhatsAppNotificationRepository),
      c.resolve(ServiceNames.WhatsAppConfig)
    );
  });

  // Wire event handlers
  wireEventHandlers(container);

  return container;
}

/**
 * Create a container with Firestore implementations for production
 */
export function createProductionContainer(config?: ContainerConfig): Container {
  const container = new Container();

  // Initialize Firestore
  initializeFirestore({
    projectId: config?.projectId,
    emulatorHost: config?.firestoreEmulatorHost,
  });

  const db = getFirestoreDb();

  // Register Firestore repositories
  container.registerSingleton(ServiceNames.UserRepository, () => new FirestoreUserRepository(db));
  container.registerSingleton(ServiceNames.CardRepository, () => new FirestoreCardRepository(db));
  container.registerSingleton(
    ServiceNames.CardRequestRepository,
    () => new FirestoreCardRequestRepository(db)
  );
  container.registerSingleton(
    ServiceNames.TransactionRepository,
    () => new FirestoreTransactionRepository(db)
  );
  container.registerSingleton(
    ServiceNames.IdempotencyRepository,
    () => new FirestoreIdempotencyRepository(db)
  );
  container.registerSingleton(
    ServiceNames.OutboxRepository,
    () => new FirestoreOutboxRepository(db)
  );
  container.registerSingleton(
    ServiceNames.AuditLogRepository,
    () => new FirestoreAuditLogRepository(db)
  );

  // Register providers
  container.registerSingleton(ServiceNames.AuthProvider, () => new FirebaseAuthProvider());
  container.registerSingleton(ServiceNames.EventPublisher, () => new InMemoryEventPublisher());

  // WhatsApp repositories (Firestore)
  container.registerSingleton(
    ServiceNames.WhatsAppNotificationRepository,
    () => new WhatsAppNotificationFirestoreRepository(db)
  );
  container.registerSingleton(
    ServiceNames.WhatsAppInboundRepository,
    () => new WhatsAppInboundFirestoreRepository(db)
  );
  container.registerSingleton(
    ServiceNames.PendingApprovalRepository,
    () => new PendingApprovalFirestoreRepository(db)
  );

  // WhatsApp config
  container.registerSingleton(ServiceNames.WhatsAppConfig, () => loadWhatsAppConfig());

  // WhatsApp client
  container.registerSingleton(ServiceNames.WppClient, (c) => {
    const cfg = c.resolve<ReturnType<typeof loadWhatsAppConfig>>(ServiceNames.WhatsAppConfig);
    return new WppConnectClient({
      baseUrl: cfg.wppBaseUrl,
      secretKey: cfg.wppSecretKey,
      sessionName: cfg.wppSessionName,
    });
  });

  // WhatsApp services
  container.registerSingleton(ServiceNames.MessageParserService, () => new MessageParserService());
  container.registerSingleton(ServiceNames.WhatsAppNotificationService, (c) => {
    return new WhatsAppNotificationService(
      c.resolve(ServiceNames.WppClient),
      c.resolve(ServiceNames.WhatsAppNotificationRepository),
      c.resolve(ServiceNames.WhatsAppConfig)
    );
  });

  // Wire event handlers
  wireEventHandlers(container);

  return container;
}

/**
 * Create a container for Firestore emulator testing
 */
export function createEmulatorContainer(): Container {
  const host = process.env.FIRESTORE_EMULATOR_HOST ?? 'localhost:8080';
  const projectId = process.env.GCLOUD_PROJECT ?? 'demo-tazco';

  return createProductionContainer({
    firestoreEmulatorHost: host,
    projectId,
  });
}

/**
 * Create a container with AWS DynamoDB implementations
 */
export function createAWSContainer(config: AWSContainerConfig): Container {
  const container = new Container();

  // Get DynamoDB DocumentClient with optional endpoint override
  const dynamoConfig: Parameters<typeof getDocumentClient>[0] = {};
  if (config.region !== undefined && config.region !== '') {
    dynamoConfig.region = config.region;
  }
  if (config.endpoint !== undefined && config.endpoint !== '') {
    dynamoConfig.endpoint = config.endpoint;
  }
  const docClient = getDocumentClient(dynamoConfig);

  // Register DynamoDB repositories
  container.registerSingleton(
    ServiceNames.UserRepository,
    () => new DynamoDBUserRepository(docClient)
  );
  container.registerSingleton(
    ServiceNames.CardRepository,
    () => new DynamoDBCardRepository(docClient)
  );
  container.registerSingleton(
    ServiceNames.CardRequestRepository,
    () => new DynamoDBCardRequestRepository(docClient)
  );
  container.registerSingleton(
    ServiceNames.TransactionRepository,
    () => new DynamoDBTransactionRepository(docClient)
  );
  container.registerSingleton(
    ServiceNames.IdempotencyRepository,
    () => new DynamoDBIdempotencyRepository(docClient)
  );
  container.registerSingleton(
    ServiceNames.OutboxRepository,
    () => new DynamoDBOutboxRepository(docClient)
  );
  container.registerSingleton(
    ServiceNames.AuditLogRepository,
    () => new DynamoDBAuditLogRepository(docClient)
  );

  // Register Cognito auth provider
  container.registerSingleton(
    ServiceNames.AuthProvider,
    () => new CognitoAuthProvider(config.cognito)
  );
  container.registerSingleton(ServiceNames.EventPublisher, () => {
    return new EventBridgeSQSPublisher({
      region: config.region,
      endpoint: config.endpoint,
      // Publish to EventBridge by default; SQS is optional (EventBridge rule may fan-out to SQS)
      publishToEventBridge: true,
      publishToSqs: process.env.SQS_QUEUE_URL !== undefined && process.env.SQS_QUEUE_URL !== '',
      sqsQueueUrl: process.env.SQS_QUEUE_URL,
    });
  });

  // WhatsApp repositories (DynamoDB)
  container.registerSingleton(
    ServiceNames.WhatsAppNotificationRepository,
    () => new DynamoDBWhatsAppNotificationRepository(docClient)
  );
  container.registerSingleton(
    ServiceNames.WhatsAppInboundRepository,
    () => new DynamoDBWhatsAppInboundRepository(docClient)
  );
  container.registerSingleton(
    ServiceNames.PendingApprovalRepository,
    () => new DynamoDBPendingApprovalRepository(docClient)
  );

  // WhatsApp config
  container.registerSingleton(ServiceNames.WhatsAppConfig, () => loadWhatsAppConfig());

  // WhatsApp client
  container.registerSingleton(ServiceNames.WppClient, (c) => {
    const cfg = c.resolve<ReturnType<typeof loadWhatsAppConfig>>(ServiceNames.WhatsAppConfig);
    return new WppConnectClient({
      baseUrl: cfg.wppBaseUrl,
      secretKey: cfg.wppSecretKey,
      sessionName: cfg.wppSessionName,
    });
  });

  // WhatsApp services
  container.registerSingleton(ServiceNames.MessageParserService, () => new MessageParserService());
  container.registerSingleton(ServiceNames.WhatsAppNotificationService, (c) => {
    return new WhatsAppNotificationService(
      c.resolve(ServiceNames.WppClient),
      c.resolve(ServiceNames.WhatsAppNotificationRepository),
      c.resolve(ServiceNames.WhatsAppConfig)
    );
  });

  // Wire event handlers
  wireEventHandlers(container);

  return container;
}

/**
 * Create a container for LocalStack testing
 *
 * Uses environment variables for configuration:
 * - AWS_ENDPOINT_URL: LocalStack endpoint (default: http://localhost:4566)
 * - AWS_REGION: AWS region (default: us-east-1)
 * - COGNITO_USER_POOL_ID: Cognito user pool ID
 * - COGNITO_CLIENT_ID: Cognito client ID
 */
export function createLocalStackContainer(): Container {
  const endpoint = process.env.AWS_ENDPOINT_URL ?? 'http://localhost:4566';
  const region = process.env.AWS_REGION ?? 'us-east-1';
  const userPoolId = process.env.COGNITO_USER_POOL_ID ?? 'us-east-1_localstack';
  const clientId = process.env.COGNITO_CLIENT_ID ?? 'localstack-client-id';

  return createAWSContainer({
    region,
    endpoint,
    cognito: {
      region,
      userPoolId,
      clientId,
      endpoint,
    },
  });
}

/**
 * Create a container based on environment
 *
 * Environment selection priority:
 * 1. USE_INMEMORY=true -> InMemory test container
 * 2. USE_AWS=true -> AWS/LocalStack container
 * 3. FIRESTORE_EMULATOR_HOST set -> Firestore emulator container
 * 4. Default -> Firestore production container
 */
export function createContainer(): Container {
  const useInMemory = process.env.USE_INMEMORY === 'true';
  const useAWS = process.env.USE_AWS === 'true';

  if (useInMemory) {
    return createTestContainer();
  }

  if (useAWS) {
    // Check if pointing to LocalStack or real AWS
    if (process.env.AWS_ENDPOINT_URL !== undefined) {
      return createLocalStackContainer();
    }

    // Real AWS - requires Cognito configuration
    const region = process.env.AWS_REGION ?? 'us-east-1';
    const userPoolId = process.env.COGNITO_USER_POOL_ID;
    const clientId = process.env.COGNITO_CLIENT_ID;

    if (
      userPoolId === undefined ||
      userPoolId === '' ||
      clientId === undefined ||
      clientId === ''
    ) {
      throw new Error(
        'AWS mode requires COGNITO_USER_POOL_ID and COGNITO_CLIENT_ID environment variables'
      );
    }

    return createAWSContainer({
      region,
      cognito: {
        region,
        userPoolId,
        clientId,
      },
    });
  }

  if (process.env.FIRESTORE_EMULATOR_HOST !== undefined) {
    return createEmulatorContainer();
  }

  return createProductionContainer();
}
