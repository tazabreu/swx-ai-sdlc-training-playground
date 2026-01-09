/**
 * Dependency Injection Infrastructure
 *
 * Re-exports DI container and factory functions.
 */

export { Container, ServiceNames } from './container.js';
export type { ServiceLifetime, ServiceFactory, ServiceName } from './container.js';
export {
  createTestContainer,
  createProductionContainer,
  createEmulatorContainer,
  createContainer,
} from './container-factory.js';
export type { ContainerConfig } from './container-factory.js';
