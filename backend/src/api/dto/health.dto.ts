/**
 * Health DTOs
 *
 * Health check response shapes per OpenAPI spec.
 */

/**
 * Liveness response
 */
export interface HealthResponse {
  status: 'ok';
  timestamp: string;
}

/**
 * Dependency health status
 */
export type DependencyStatus = 'healthy' | 'unhealthy';

/**
 * Dependencies health
 */
export interface DependenciesHealth {
  database: DependencyStatus;
  message_stream: DependencyStatus;
  auth_provider: DependencyStatus;
}

/**
 * Readiness response
 */
export interface ReadinessResponse {
  status: 'healthy' | 'unhealthy';
  dependencies: DependenciesHealth;
  warnings?: string[];
}
