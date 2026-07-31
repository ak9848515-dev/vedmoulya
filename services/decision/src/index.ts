// ──────────────────────────────────────────────────────────────────
// VedMoulya — @vedmoulya/decision
// Decision Intelligence Engine Service
// ARC-003/ARC-004 — Decision Intelligence Engine Bounded Context
// Implements BLD-008 Decision Intelligence Engine
// ──────────────────────────────────────────────────────────────────

export const serviceName = 'decision' as const;

// ── Schema ─────────────────────────────────────────────────────────────────
export { decisions, decisionTimeline } from './schema/decision.js';
export type {
  DecisionRow,
  NewDecisionRow,
  DecisionTimelineRow,
  NewDecisionTimelineRow,
} from './schema/decision.js';

// ── Infrastructure — Persistence ───────────────────────────────────────────
export { PostgresDecisionRepository } from './infrastructure/persistence/PostgresDecisionRepository.js';
export {
  initializeDatabase,
  closeDatabase,
  getDatabase,
} from './infrastructure/persistence/DatabaseConnection.js';

// ── Infrastructure — Cache ─────────────────────────────────────────────────
export { DecisionCache } from './infrastructure/cache/DecisionCache.js';

// ── Infrastructure — Events ────────────────────────────────────────────────
export { DecisionEventPublisher } from './infrastructure/events/DecisionEventPublisher.js';

// ── Infrastructure — DI ────────────────────────────────────────────────────
export { registerDecisionServices, decisionModule } from './infrastructure/di/DecisionModule.js';

// ── Observability — Metrics ────────────────────────────────────────────────
export { DecisionMetrics, MetricNames } from './observability/DecisionMetrics.js';

// ── Observability — Audit ──────────────────────────────────────────────────
export { DecisionAuditor } from './observability/DecisionAudit.js';
export type { DecisionAuditAction, AuditEntry } from './observability/DecisionAudit.js';

// ── Observability — Tracing ────────────────────────────────────────────────
export { DecisionTracer } from './observability/DecisionTracing.js';

// ── Presentation — Routes ──────────────────────────────────────────────────
export { createDecisionRouter, decisionRouteConfig } from './presentation/routes/DecisionRoutes.js';
export { DecisionController } from './presentation/controllers/DecisionController.js';

// ── Presentation — tRPC ────────────────────────────────────────────────────
export { createDecisionTrpcRouter } from './presentation/trpc/DecisionRouter.js';

// ── Config ─────────────────────────────────────────────────────────────────
export {
  getDecisionConfig,
  updateDecisionConfig,
  resetDecisionConfig,
} from './config/DecisionConfig.js';
export type {
  DecisionConfig,
  DatabaseConfig,
  CacheConfig,
  ScoringConfig,
  ExplainabilityConfig,
} from './config/DecisionConfig.js';

// ── Constants ──────────────────────────────────────────────────────────────
export {
  DECISION_CATEGORIES,
  DECISION_STATUS_VALUES,
  DECISION_INITIATORS,
  PRIORITY_LEVELS,
  CONFIDENCE_LEVELS,
  RISK_LEVELS,
  OPPORTUNITY_LEVELS,
  REASONING_METHODS,
  OUTCOME_RESULTS,
  CONSTRAINT_TYPES,
  CONSTRAINT_CATEGORIES,
  EVIDENCE_TYPES,
  DEFAULT_SCORING_WEIGHTS,
} from './constants/DecisionConstants.js';

// ── Errors ─────────────────────────────────────────────────────────────────
export {
  DecisionError,
  DecisionNotFoundError,
  DecisionValidationError,
  DecisionStateTransitionError,
  DecisionOptionNotFoundError,
  DecisionDuplicateOptionError,
  DecisionNoOptionsError,
  DecisionNoScoreError,
} from './errors/DecisionErrors.js';

// ── Types ──────────────────────────────────────────────────────────────────
export type {
  ServiceResult,
  DecisionExplanation,
  ExplanationFormat,
  ExplainabilityRequest,
  ExplainabilityResponse,
  HealthStatus,
} from './types/DecisionTypes.js';

// ── Utils ──────────────────────────────────────────────────────────────────
export {
  generateDecisionId,
  generateOptionId,
  generateEvidenceId,
  clamp,
  calculateOffset,
  calculateTotalPages,
  withRetry,
} from './utils/DecisionUtils.js';

// ── Integration Clients ────────────────────────────────────────────────────
export { KnowledgeGraphClient } from './integration/KnowledgeGraphClient.js';
export { MemoryEngineClient } from './integration/MemoryEngineClient.js';
export { AIOrchestratorClient } from './integration/AIOrchestratorClient.js';

// ── Services ───────────────────────────────────────────────────────────────
export { DecisionExplainabilityService } from './services/DecisionExplainabilityService.js';

// ── Presentation — OpenAPI ─────────────────────────────────────────────────
export { decisionOpenApiSchema } from './presentation/openapi/DecisionOpenAPI.js';
