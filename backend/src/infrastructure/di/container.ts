/**
 * Dependency Injection Container
 *
 * Simple DI container for managing dependencies.
 * Supports singleton and transient lifetimes.
 */

/**
 * Service lifetime
 */
export type ServiceLifetime = 'singleton' | 'transient';

/**
 * Service factory function
 */
export type ServiceFactory<T> = (container: Container) => T;

/**
 * Service registration
 */
interface ServiceRegistration<T> {
  factory: ServiceFactory<T>;
  lifetime: ServiceLifetime;
  instance?: T;
}

/**
 * DI Container
 */
export class Container {
  private services: Map<string, ServiceRegistration<unknown>> = new Map();

  /**
   * Register a service with singleton lifetime (one instance for all requests)
   */
  registerSingleton<T>(name: string, factory: ServiceFactory<T>): void {
    this.services.set(name, { factory, lifetime: 'singleton' });
  }

  /**
   * Register a service with transient lifetime (new instance per request)
   */
  registerTransient<T>(name: string, factory: ServiceFactory<T>): void {
    this.services.set(name, { factory, lifetime: 'transient' });
  }

  /**
   * Register a pre-created instance
   */
  registerInstance<T>(name: string, instance: T): void {
    this.services.set(name, {
      factory: () => instance,
      lifetime: 'singleton',
      instance,
    });
  }

  /**
   * Resolve a service by name
   */
  resolve<T>(name: string): T {
    const registration = this.services.get(name);
    if (registration === undefined) {
      throw new Error(`Service not registered: ${name}`);
    }

    if (registration.lifetime === 'singleton') {
      if (registration.instance === undefined) {
        registration.instance = registration.factory(this);
      }
      return registration.instance as T;
    }

    // Transient - create new instance
    return registration.factory(this) as T;
  }

  /**
   * Check if a service is registered
   */
  has(name: string): boolean {
    return this.services.has(name);
  }

  /**
   * Clear all registrations (for testing)
   */
  clear(): void {
    this.services.clear();
  }

  /**
   * Get all registered service names
   */
  getRegisteredServices(): string[] {
    return Array.from(this.services.keys());
  }
}

/**
 * Service names for type-safe resolution
 */
export const ServiceNames = {
  // Repositories
  UserRepository: 'UserRepository',
  CardRepository: 'CardRepository',
  CardRequestRepository: 'CardRequestRepository',
  TransactionRepository: 'TransactionRepository',
  IdempotencyRepository: 'IdempotencyRepository',
  OutboxRepository: 'OutboxRepository',
  AuditLogRepository: 'AuditLogRepository',

  // WhatsApp Repositories
  WhatsAppNotificationRepository: 'WhatsAppNotificationRepository',
  WhatsAppInboundRepository: 'WhatsAppInboundRepository',
  PendingApprovalRepository: 'PendingApprovalRepository',

  // Providers
  AuthProvider: 'AuthProvider',
  EventPublisher: 'EventPublisher',

  // WhatsApp Infrastructure
  WppClient: 'WppClient',
  WhatsAppConfig: 'WhatsAppConfig',

  // WhatsApp Services
  WhatsAppNotificationService: 'WhatsAppNotificationService',
  MessageParserService: 'MessageParserService',

  // Command Handlers
  RegisterUserHandler: 'RegisterUserHandler',
  RequestCardHandler: 'RequestCardHandler',
  ProcessCardDecisionHandler: 'ProcessCardDecisionHandler',
  ProcessPurchaseHandler: 'ProcessPurchaseHandler',
  ProcessPaymentHandler: 'ProcessPaymentHandler',
  UpdateUserScoreHandler: 'UpdateUserScoreHandler',
  DeleteUserDataHandler: 'DeleteUserDataHandler',

  // Query Handlers
  GetUserProfileHandler: 'GetUserProfileHandler',
  GetOffersHandler: 'GetOffersHandler',
  GetUserCardsHandler: 'GetUserCardsHandler',
  GetCardDetailsHandler: 'GetCardDetailsHandler',
  GetTransactionsHandler: 'GetTransactionsHandler',
  GetPendingRequestsHandler: 'GetPendingRequestsHandler',
  GetDashboardStatsHandler: 'GetDashboardStatsHandler',
} as const;

export type ServiceName = (typeof ServiceNames)[keyof typeof ServiceNames];
