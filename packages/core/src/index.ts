// ──────────────────────────────────────────────────────────────────
// VedMoulya — @vedmoulya/core
// Core shared types, errors, configuration, and infrastructure
// BLD-002 — Core Platform Foundation
// ──────────────────────────────────────────────────────────────────

// Types
export type {
  BrandedId,
  Result,
  PaginationParams,
  PaginatedResult,
  ApiResponse,
  ApiError,
  EntityStatus,
  TimeRange,
} from './types/index.js';

// Constants
export {
  APP,
  HTTP_METHODS,
  HTTP_STATUS,
  LOG_LEVELS,
  CONTENT_TYPES,
  PAGINATION,
  TIME,
} from './constants/index.js';

// Errors
export {
  AppError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ConflictError,
  RateLimitError,
  DomainError,
  InternalError,
} from './errors/index.js';

// Configuration
export { config, loadConfiguration } from './config/index.js';
export type {
  Configuration,
  AppConfig,
  DatabaseConfig,
  RedisConfig,
  AuthConfig,
  AiConfig,
  FeatureFlags,
  ObservabilityConfig,
} from './config/index.js';

// Environment Management
export { Environment, EnvironmentError, env, defineStandardEnvVars } from './env/index.js';
export type { EnvVarDefinition } from './env/index.js';

// Logging
export { logger } from './logger/index.js';
export type { Logger, LogLevel, LogEntry } from './logger/index.js';

// Validation
export { ValidationSchema, Rules } from './validation/index.js';
export type { ValidationResult, ValidationIssue, ValidationRule } from './validation/index.js';

// Dependency Injection
export { Container, container } from './di/index.js';
export type { ServiceFactory, ServiceDefinitionMeta } from './di/index.js';

// Feature Flags
export { featureFlags } from './feature-flags/index.js';
export type { FeatureFlagRegistry } from './feature-flags/index.js';

// Module Registration
export { moduleRegistry } from './modules/index.js';
export type { ModuleDefinition } from './modules/index.js';

// Health Checks
export {
  HealthChecker,
  healthChecker,
  databaseHealthCheck,
  redisHealthCheck,
  memoryHealthCheck,
} from './health/index.js';
export type {
  HealthStatus,
  HealthCheckResult,
  HealthCheck,
  HealthCheckFn,
} from './health/index.js';

// Metrics
export { MetricsRegistry, metrics, Timer } from './metrics/index.js';
export type { Metric, MetricType, MetricListener } from './metrics/index.js';

// Tracing
export { TraceProvider, traceProvider } from './tracing/index.js';
export type { Span, Tracer } from './tracing/index.js';

// Event Bus
export { InMemoryEventBus, createEvent, createEventId } from './event-bus/index.js';
export type { DomainEvent, EventHandler, EventBus } from './event-bus/index.js';

// Lifecycle
export { ApplicationLifecycle, appLifecycle } from './lifecycle/index.js';
export type { LifecyclePhase, LifecycleHook } from './lifecycle/index.js';

// Bootstrap
export { bootstrap } from './bootstrap/index.js';
export type { BootstrapOptions, BootstrapResult } from './bootstrap/index.js';

// Utilities
export {
  sleep,
  now,
  clamp,
  generateId,
  pick,
  omit,
  deepFreeze,
  debounce,
  throttle,
  retry,
  isUuid,
  isEmail,
} from './utilities/index.js';

// Base Abstractions
export {
  BaseService,
  BaseRepository,
  BaseUseCase,
  BaseController,
  processInBatches,
} from './base/index.js';
export type { BatchResult } from './base/index.js';
