// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — @vedmoulya/api
// API Gateway & Platform Services
// BLD-016A — API Gateway & Platform Services
// ─────────────────────────────────────────────────────────────────────────────

// ── Main Router ─────────────────────────────────────────────────────────────
// The router is built lazily on first use (getAppRouter) so importing
// @vedmoulya/api never evaluates configuration at module scope — `next
// build` (NODE_ENV=production without env vars) bundles the route handlers
// safely. Request-time fail-fast semantics are unchanged.

export { getAppRouter, getServices } from './router.js';
export type { AppRouter } from './router.js';
export type { TRPCContext } from './router.js';

// ── Application Service ─────────────────────────────────────────────────────

export { ApiApplicationService } from './services/ApiApplicationService.js';

// ── Infrastructure Health ────────────────────────────────────────────────────

export { InfrastructureHealthProbe } from './services/InfrastructureHealthProbe.js';

// ── Production Persistence (SPRINT PR-002A / PR-002B) ────────────────────────

export {
  createProductionIdentityRepository,
  createProductionMemoryRepository,
  createProductionDecisionRepository,
  createProductionExecutionRepository,
  createProductionKnowledgeRepository,
} from './infrastructure/ProductionRepositories.js';
export type {
  DependencyHealthResult,
  DependencyName,
  DependencyStatus,
  InfrastructureHealthProbeOptions,
} from './services/InfrastructureHealthProbe.js';

// ── Observability Startup (PH-002/T1) ────────────────────────────────────────

export {
  initGatewayObservability,
  flushGatewayObservability,
  shutdownGatewayObservability,
} from './observability/startup.js';
export type { GatewayObservability, GatewayObservabilityOptions } from './observability/startup.js';

// ── EPIC-012 — Observability & Control Plane ────────────────────────────────

export { OpsApplicationService } from './services/OpsApplicationService.js';
export { TraceProviderOtelBridge } from './observability/TraceProviderOtelBridge.js';
export { CostLedger } from './observability/CostLedger.js';
export type {
  CostLedgerSnapshot,
  CostAnomaly,
  EconomicsTotals,
  ProviderEconomics,
} from './observability/CostLedger.js';
export { assessApplicationHealth } from './observability/ApplicationHealthService.js';
export type {
  ApplicationHealth,
  AppHealthStatus,
  AssessableApplication,
} from './observability/ApplicationHealthService.js';
export { buildIncidentDiagnostics } from './observability/IncidentDiagnostics.js';
export type { IncidentDiagnostics } from './observability/IncidentDiagnostics.js';
export { AlertEngine, DEFAULT_ALERT_THRESHOLDS } from './observability/AlertEngine.js';
export type { Alert, AlertThresholds, AlertMetricsSnapshot } from './observability/AlertEngine.js';
export { OperatorGate, AuditTrail } from './observability/OpsAudit.js';
export type { AuditRecord } from './observability/OpsAudit.js';
export { createOpsRouter } from './routers/OpsRouter.js';
export type { OpsHandlers } from './routers/OpsRouter.js';

// ── OS Health Pass Scheduler (OS-003 operational cadence) ────────────────────

export {
  startOSHealthScheduler,
  stopOSHealthScheduler,
  getOSHealthScheduler,
} from './observability/os-health-scheduler.js';
export type {
  OSHealthScheduler,
  OSHealthSchedulerOptions,
  OSHealthPassResult,
} from './observability/os-health-scheduler.js';

// ── AI World Scheduler Cadence Driver (EPIC-018 runtime closure) ─────────────

export {
  startSchedulerCadenceDriver,
  stopSchedulerCadenceDriver,
  getSchedulerCadenceDriver,
} from './observability/scheduler-cadence.js';
export type {
  SchedulerCadenceDriver,
  SchedulerCadenceDriverOptions,
  SchedulerCadenceTickResult,
  SchedulerCadenceUserSource,
  SchedulerRuntimeStatus,
} from './observability/scheduler-cadence.js';

// ── Router Registry ─────────────────────────────────────────────────────────

export { createAppRouter, router, publicProcedure } from './services/RouterRegistry.js';
export type { TRPCContext as RTRPCContext } from './services/RouterRegistry.js';

// ── Module Routers ──────────────────────────────────────────────────────────

export { createLifeOSRouter } from './routers/LifeOSRouter.js';
export { createDashboardRouter } from './routers/DashboardRouter.js';
export { createCareerRouter } from './routers/CareerRouter.js';
export { createLearningRouter } from './routers/LearningRouter.js';
export { createBusinessRouter } from './routers/BusinessRouter.js';
export { createMarketplaceRouter } from './routers/MarketplaceRouter.js';
export { createContentAgencyRouter } from './routers/ContentAgencyRouter.js';
export type { ContentAgencyHandlers } from './routers/ContentAgencyRouter.js';
export { createCapabilitiesRouter } from './routers/CapabilitiesRouter.js';
export type { CapabilitiesHandlers } from './routers/CapabilitiesRouter.js';
export { createProvidersRouter } from './routers/ProvidersRouter.js';
export type { ProvidersHandlers } from './routers/ProvidersRouter.js';
export { createExecutionStrategyRouter } from './routers/ExecutionStrategyRouter.js';
export type { ExecutionStrategyHandlers } from './routers/ExecutionStrategyRouter.js';
export { createGoalsRouter } from './routers/GoalsRouter.js';
export type { GoalsHandlers } from './routers/GoalsRouter.js';
export { createIntelligenceRouter } from './routers/IntelligenceRouter.js';
export type { IntelligenceHandlers } from './routers/IntelligenceRouter.js';
export { createLearningIntelligenceRouter } from './routers/LearningIntelligenceRouter.js';
export type { LearningIntelligenceHandlers } from './routers/LearningIntelligenceRouter.js';
export { createEnterpriseBrainRouter } from './routers/BrainRouter.js';
export type { EnterpriseBrainHandlers } from './routers/BrainRouter.js';
export { createMemoryIntelligenceRouter } from './routers/MemoryIntelligenceRouter.js';
export type { MemoryIntelligenceHandlers } from './routers/MemoryIntelligenceRouter.js';
export { createOSRouter } from './routers/OSRouter.js';
export { createContextFabricRouter } from './routers/ContextFabricRouter.js';
export type { OSHandlers } from './routers/OSRouter.js';
export { createLoopRouter } from './routers/LoopRouter.js';
export type { LoopHandlers } from './routers/LoopRouter.js';
export { createRequirementsRouter } from './routers/RequirementsRouter.js';
export type { RequirementsHandlers } from './routers/RequirementsRouter.js';
export { createHealthRouter, type PlatformHealth } from './routers/HealthRouter.js';

// ── Middleware ───────────────────────────────────────────────────────────────

export {
  authenticateRequest,
  createAuthContext,
  isAuthenticated,
  verifyAccessToken,
} from './middleware/auth.js';
export type { AuthSession } from './middleware/auth.js';
export { checkRateLimit, assertRateLimit, RateLimitTiers } from './middleware/rate-limit.js';
export {
  validateInput,
  validateOrThrow,
  userIdSchema,
  paginationSchema,
  searchQuerySchema,
} from './middleware/validation.js';
export { toGatewayError, notFound } from './middleware/error.js';
export type { ErrorCode, GatewayError } from './middleware/error.js';
export { logAuditEvent, getAuditLog, createRequestAudit } from './middleware/audit.js';
export type { AuditEntry, AuditEventType } from './middleware/audit.js';

// ── Response Mapper ─────────────────────────────────────────────────────────

export {
  successResponse,
  errorResponse,
  fromServiceResult,
  paginatedResponse,
} from './services/ResponseMapper.js';
export type { ApiResponse, ResponseMeta } from './services/ResponseMapper.js';
