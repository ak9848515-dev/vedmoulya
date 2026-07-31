// ──────────────────────────────────────────────────────────────────
// VedMoulya — @vedmoulya/execution
// Execution Intelligence Engine Service
// ARC-004 — Execution Intelligence Engine Bounded Context
// BLD-009 — Execution Intelligence Engine
// ──────────────────────────────────────────────────────────────────

export const serviceName = 'execution' as const;

// ── Schema ─────────────────────────────────────────────────────────────────
export { executionPlans } from './schema/execution.js';
export type { ExecutionPlanRow, NewExecutionPlanRow } from './schema/execution.js';

// ── Infrastructure — Persistence ───────────────────────────────────────────
export { PostgresExecutionRepository } from './infrastructure/persistence/PostgresExecutionRepository.js';
export {
  initializeDatabase,
  closeDatabase,
  getDatabase,
} from './infrastructure/persistence/DatabaseConnection.js';

// ── Infrastructure — Cache ─────────────────────────────────────────────────
export { ExecutionCache } from './infrastructure/cache/ExecutionCache.js';

// ── Infrastructure — Events ────────────────────────────────────────────────
export { ExecutionEventPublisher } from './infrastructure/events/ExecutionEventPublisher.js';

// ── Infrastructure — DI ────────────────────────────────────────────────────
export { registerExecutionServices, executionModule } from './infrastructure/di/ExecutionModule.js';

// ── Observability — Metrics ────────────────────────────────────────────────
export { ExecutionMetrics, MetricNames } from './observability/ExecutionMetrics.js';

// ── Observability — Audit ──────────────────────────────────────────────────
export { ExecutionAuditor } from './observability/ExecutionAudit.js';
export type { ExecutionAuditAction, AuditEntry } from './observability/ExecutionAudit.js';

// ── Observability — Tracing ────────────────────────────────────────────────
export { ExecutionTracer } from './observability/ExecutionTracing.js';

// ── Presentation — Routes ──────────────────────────────────────────────────
export {
  createExecutionRouter,
  executionRouteConfig,
} from './presentation/routes/ExecutionRoutes.js';
export { ExecutionController } from './presentation/controllers/ExecutionController.js';

// ── Presentation — tRPC ────────────────────────────────────────────────────
export { createExecutionTrpcRouter } from './presentation/trpc/ExecutionRouter.js';

// ── Config ─────────────────────────────────────────────────────────────────
export {
  getExecutionConfig,
  updateExecutionConfig,
  resetExecutionConfig,
} from './config/ExecutionConfig.js';
export type {
  ExecutionConfig,
  DatabaseConfig,
  SchedulingConfig,
  PlanningConfig,
  RecoveryConfig,
} from './config/ExecutionConfig.js';

// ── Constants ──────────────────────────────────────────────────────────────
export {
  PLANNING_LEVELS,
  EXECUTION_STATUS_VALUES,
  PRIORITY_LEVELS,
  RESULT_VALUES,
  DEPENDENCY_TYPES,
  STRATEGY_TYPES,
  POLICY_DOMAINS,
  POLICY_SEVERITIES,
  EXECUTION_EVENT_TYPES,
  PAGINATION,
  ID_PREFIX,
  CACHE_PREFIX,
  API_PATHS,
  EXTERNAL_API_PATHS,
} from './constants/ExecutionConstants.js';

// ── Errors ─────────────────────────────────────────────────────────────────
export {
  ExecutionError,
  ExecutionPlanNotFoundError,
  ExecutionValidationError,
  ExecutionStateTransitionError,
  ExecutionTaskNotFoundError,
  ExecutionMissionNotFoundError,
  ExecutionDependencyError,
  ExecutionScheduleConflictError,
  ExecutionRecoveryFailedError,
  DecisionEngineUnavailableError,
  KnowledgeGraphUnavailableError,
  MemoryEngineUnavailableError,
  AIOrchestratorUnavailableError,
} from './errors/ExecutionErrors.js';

// ── Types ──────────────────────────────────────────────────────────────────
export type {
  ServiceResult,
  ExecutionExplanation,
  DailyBrief,
  HealthStatus,
  KnowledgeQuery,
  KnowledgeResult,
  MemoryQuery,
  AIRequest,
} from './types/ExecutionTypes.js';

// ── Utils ──────────────────────────────────────────────────────────────────
export {
  generatePlanId,
  generateMissionId,
  generateTaskId,
  generateStepId,
  clamp,
  calculateOffset,
  calculateTotalPages,
  safeDateToString,
  parseDate,
  sleep,
  withRetry,
  truncate,
  isBlank,
  deepMerge,
} from './utils/ExecutionUtils.js';

// ── Integration Clients ────────────────────────────────────────────────────
export { DecisionEngineClient } from './integration/DecisionEngineClient.js';
export { KnowledgeGraphClient } from './integration/KnowledgeGraphClient.js';
export { MemoryEngineClient } from './integration/MemoryEngineClient.js';
export { AIOrchestratorClient } from './integration/AIOrchestratorClient.js';

// ── Services ──────────────────────────────────────────────────────────────
export { ExecutionExplainabilityService } from './services/ExecutionExplainabilityService.js';

// ── Presentation — OpenAPI ─────────────────────────────────────────────────
export { executionOpenApiSchema } from './presentation/openapi/ExecutionOpenAPI.js';
