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
export {
  config,
  getConfig,
  loadConfiguration,
  requireProdSecret,
  requireExternalUrl,
  requireProdExternalUrl,
} from './config/index.js';
export type {
  Configuration,
  AppConfig,
  DatabaseConfig,
  RedisConfig,
  AuthConfig,
  AiConfig,
  SmtpConfig,
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

// Database — Shared Connection Manager (SPRINT-090)
export { databaseManager } from './database/index.js';
export type {
  DatabaseManager,
  DatabaseManagerHealth,
  DatabaseManagerSnapshot,
  DatabasePoolAccessOptions,
  DatabasePoolStats,
} from './database/index.js';

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
  cpuHealthCheck,
  uptimeHealthCheck,
} from './health/index.js';
export type {
  HealthStatus,
  HealthCheckResult,
  HealthCheck,
  HealthCheckFn,
} from './health/index.js';

// Startup Preflight (EPIC-018 — deterministic startup diagnostics)
export { PreflightEngine, loadEnvFileSafe, loadEnvFilesSafe } from './startup/preflight.js';
export type {
  PreflightMode,
  PreflightStatus,
  PreflightCheck,
  PreflightReport,
  PreflightEnvironment,
  PreflightEngineOptions,
} from './startup/preflight.js';

// Provider Runtime Truth (EPIC-019 — configuration agrees with the runtime
// registry: catalog ≠ adapter ≠ execution)
export {
  PROVIDER_RUNTIME_DESCRIPTORS,
  readProviderRuntimeState,
  runtimeExecutionReady,
  validateDefaultProvider,
  isValueSet,
  isStrictRuntimeMode,
  toRuntimeMode,
} from './startup/provider-runtime.js';
export type {
  ProviderRuntimeMode,
  ProviderRuntimeStatus,
  ProviderRuntimeState,
  ProviderRuntimeDescriptor,
  ProviderRuntimeOptions,
  RuntimeExecutionReadyResult,
  DefaultProviderValidation,
} from './startup/provider-runtime.js';

// Deterministic Port Diagnostics (EPIC-019 — no silent port juggling)
export { isPortAvailable, probePort, findPortOwner, formatPortConflict } from './startup/port.js';
export type { PortProbeResult } from './startup/port.js';

// Startup Doctor (EPIC-019 — npm run doctor)
export { buildDoctorReport } from './startup/doctor.js';
export type { DoctorRow, DoctorStatus, DoctorToolInputs } from './startup/doctor.js';

// Metrics
export { MetricsRegistry, metrics, Timer } from './metrics/index.js';
export type { Metric, MetricType, MetricListener } from './metrics/index.js';

// Tracing
export {
  TraceProvider,
  traceProvider,
  ExecutionTraceProvider,
  InMemoryTraceStore,
  NoopTelemetryPort,
  NOOP_TELEMETRY,
  createTraceId,
  createSpanId,
  normalizeTraceStatus,
} from './tracing/index.js';
export type {
  Span,
  Tracer,
  ExecutionTrace,
  TraceSpan,
  TraceEvent,
  TraceSpanError,
  TraceStatus,
  TraceStore,
  TraceQuery,
  TelemetryPort,
  TelemetrySpanHandle,
  TelemetrySpanInput,
  TelemetryAttribute,
} from './tracing/index.js';

// Event Bus
export { InMemoryEventBus, createEvent, createEventId } from './event-bus/index.js';
export type { DomainEvent, EventHandler, EventBus } from './event-bus/index.js';

// Lifecycle
export { ApplicationLifecycle, appLifecycle } from './lifecycle/index.js';
export { GracefulShutdown } from './lifecycle/gracefulShutdown.js';
export type {
  GracefulShutdownOptions,
  GracefulShutdownResult,
  ShutdownResource,
} from './lifecycle/gracefulShutdown.js';
export type { LifecyclePhase, LifecycleHook } from './lifecycle/index.js';

// Bootstrap
export { bootstrap } from './bootstrap/index.js';
export type { BootstrapOptions, BootstrapResult } from './bootstrap/index.js';

// Observability (PH-002 T1/T3)
export {
  metricsToPrometheus,
  prometheusMetrics,
  metricsSnapshotJson,
  OtelExporter,
  createCorrelationId,
  runWithCorrelation,
  withNewCorrelation,
  getCorrelationId,
  ensureCorrelationId,
  ConsoleErrorReporter,
  HttpErrorReporter,
  ErrorReporterHub,
  errorReporter,
  getRuntimeInfo,
  recordRuntimeMetrics,
} from './observability/index.js';
export type {
  OtelExporterOptions,
  ErrorReporter,
  ErrorReportContext,
  RuntimeInfo,
} from './observability/index.js';

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

// Persistence (SPRINT-022 — Persistent Intelligence Foundation)
// Write-through Postgres base for the synchronous owner-scoped store ports
// (in-memory mirror + async idempotent upserts + boot hydration + shutdown
// flush) — the persistence seam for every EPIC-016/017/018/020 store.
export { WriteThroughDocumentStore } from './persistence/WriteThroughDocumentStore.js';
