// ──────────────────────────────────────────────────────────────────
// VedMoulya — Enterprise Operating System: Types
// EPIC-005 / OS-001 — Enterprise Operating System Integration
// The integration layer turns the eleven Enterprise Intelligence
// Engines (EI-001…EI-010 + INT-001) into one Enterprise Operating
// System. These types model the engine registry, the dependency
// matrix (package build graph + consultation graph), the system
// health pass, the 15-stage pipeline validation, cross-engine
// validation, diagnostics, platform validation, performance metrics
// and the persisted health snapshots consumed by the OS dashboard.
//
// The OS layer owns NO engine — every engine is consumed through the
// narrow `OSEngines` port contracts (contracts/os-engines.ts).
// ──────────────────────────────────────────────────────────────────

// ── Engine registry ───────────────────────────────────────────────

/** The eleven Enterprise Intelligence Engines (EI-001…EI-010 + INT-001). */
export type OSEngineId =
  | 'goals'
  | 'capabilities'
  | 'providers'
  | 'context'
  | 'strategy'
  | 'orchestrator'
  | 'intelligence'
  | 'learning'
  | 'brain'
  | 'knowledge'
  | 'memory';

export const OS_ENGINE_IDS: readonly OSEngineId[] = [
  'goals',
  'capabilities',
  'providers',
  'context',
  'strategy',
  'orchestrator',
  'intelligence',
  'learning',
  'brain',
  'knowledge',
  'memory',
] as const;

/** Runtime health of one engine port consultation. */
export type OSEngineHealthStatus = 'healthy' | 'degraded' | 'unhealthy' | 'unknown';

export interface OSEngineStatus {
  /** Canonical engine id (the same id the OS dashboard groups by). */
  engine: OSEngineId;
  /** Display name, e.g. "Enterprise Goal & Task Intelligence Engine". */
  name: string;
  /** Owning workspace package, e.g. "@vedmoulya/goals". */
  packageName: string;
  /** Delivering sprint, e.g. "EI-006". */
  sprint: string;
  status: OSEngineHealthStatus;
  /** Measured latency of the port consultation in ms. */
  latencyMs: number;
  /** Whether the engine's port answered (consulted) at all. */
  consulted: boolean;
  /** Human-readable summary, e.g. "5 goals · 3 tasks". */
  dataSummary: string;
  /** Extracted totals keyed by metric (JSON-safe numbers for the UI). */
  totals: Record<string, number>;
  /** Port error when the consultation failed. */
  error?: string;
  lastCheckedAt: string;
}

// ── Dependency matrix ─────────────────────────────────────────────

export type OSDependencyKind = 'package' | 'consultation';

export interface OSDependencyEdge {
  /** Consuming engine (the edge starts here). */
  from: OSEngineId;
  /** Consumed engine (the port provider). */
  to: OSEngineId;
  /** Why the edge exists (integration note). */
  reason: string;
  kind: OSDependencyKind;
  /** Always true at build time — the edge is expressed in the catalog. */
  valid: boolean;
  verifiedAt: string;
}

export interface OSDependencyGraph {
  nodes: OSEngineId[];
  /** Package build-graph edges (the acyclicity gate). */
  packageEdges: OSDependencyEdge[];
  /** Runtime consultation edges (the integration matrix). */
  consultationEdges: OSDependencyEdge[];
  /** Cycles detected in the package graph — the "no circular dependencies" gate. */
  packageCycles: OSEngineId[][];
  /** Cycles in the consultation graph — expected in an integrated OS (informational). */
  consultationCycles: OSEngineId[][];
  /** True when the package graph has no cycles. */
  acyclic: boolean;
  /** Who-consults-whom matrix (consumes map). */
  matrix: Record<OSEngineId, OSEngineId[]>;
}

// ── Pipeline validation ───────────────────────────────────────────

/** The 15 stages of the Enterprise Operating System pipeline. */
export type OSPipelineStageId =
  | 'goal'
  | 'project'
  | 'task_planning'
  | 'capability_selection'
  | 'knowledge_retrieval'
  | 'memory_retrieval'
  | 'provider_selection'
  | 'context_assembly'
  | 'decision'
  | 'execution_strategy'
  | 'execution_graph'
  | 'execution_session'
  | 'learning'
  | 'knowledge_update'
  | 'memory_update';

export type OSPipelineStageStatus = 'passed' | 'not_started' | 'failed' | 'skipped';

export interface OSPipelineStage {
  stage: OSPipelineStageId;
  engine: OSEngineId;
  label: string;
  status: OSPipelineStageStatus;
  /** Measured latency of this stage's engine consultation in ms. */
  latencyMs: number;
  /** Evidence of the validated stage output. */
  detail: string;
  error?: string;
}

export type OSPipelineOverallStatus = 'ready' | 'degraded' | 'blocked';

export interface OSPipelineHealth {
  stages: OSPipelineStage[];
  overallStatus: OSPipelineOverallStatus;
  totalLatencyMs: number;
  /** True when no stage failed (not-started stages are tolerated). */
  valid: boolean;
  passedStages: number;
  notStartedStages: number;
  failedStages: number;
}

// ── Cross-engine validation ───────────────────────────────────────

export interface OSCrossEngineCheck {
  description: string;
  passed: boolean;
  /** True for the cross-reference evidence check (drives validated/not_checked). */
  linkage?: boolean;
}

export type OSCrossEnginePairStatus = 'validated' | 'not_checked' | 'failed';

export interface OSCrossEnginePair {
  /** Pair label, e.g. "Capability ↔ Provider". */
  pair: string;
  from: OSEngineId;
  to: OSEngineId;
  status: OSCrossEnginePairStatus;
  checks: OSCrossEngineCheck[];
}

// ── Diagnostics ───────────────────────────────────────────────────

export type OSDiagnosticSeverity = 'info' | 'warning' | 'critical';

export type OSDiagnosticCategory =
  | 'engine'
  | 'dependency'
  | 'contract'
  | 'repository'
  | 'pipeline'
  | 'lifecycle'
  | 'event_flow'
  | 'ownership'
  | 'database';

export interface OSDiagnosticFinding {
  id: string;
  severity: OSDiagnosticSeverity;
  category: OSDiagnosticCategory;
  engine?: OSEngineId;
  message: string;
}

export interface OSDiagnosticsReport {
  findings: OSDiagnosticFinding[];
  passed: number;
  failed: number;
  warnings: number;
  critical: number;
  total: number;
  /** 0-100 — share of passed checks (critical findings heavily weighted). */
  healthScore: number;
}

// ── Repository readiness ──────────────────────────────────────────

export interface OSRepositoryStatus {
  engine: OSEngineId;
  /** Production repository class, e.g. "PostgresMemoryRepository". */
  repository: string;
  /** Database table, e.g. "memory_registry". */
  table: string;
  /** True when the engine resolves a persisted (Postgres) repository. */
  persisted: boolean;
  status: 'ready' | 'missing';
}

// ── Performance ───────────────────────────────────────────────────

export interface OSPerformanceMetric {
  engine: OSEngineId;
  calls: number;
  totalLatencyMs: number;
  avgLatencyMs: number;
}

export interface OSPerformanceMetrics {
  endToEndLatencyMs: number;
  perEngine: OSPerformanceMetric[];
  totalCalls: number;
  checkedAt: string;
}

// ── System health ─────────────────────────────────────────────────

export type OSSystemHealthStatus = 'healthy' | 'degraded' | 'unhealthy';

export interface OSSystemHealth {
  engines: OSEngineStatus[];
  /** Overall OS health score 0-100 (engines, dependencies, pipeline, diagnostics). */
  overallScore: number;
  status: OSSystemHealthStatus;
  dependencies: OSDependencyGraph;
  pipeline: OSPipelineHealth;
  repositories: OSRepositoryStatus[];
  crossEngine: OSCrossEnginePair[];
  diagnostics: OSDiagnosticsReport;
  performance: OSPerformanceMetrics;
  checkedAt: string;
}

// ── Persisted snapshot ────────────────────────────────────────────

export interface OSHealthSnapshot {
  snapshotId: string;
  checkedAt: string;
  overallScore: number;
  status: OSSystemHealthStatus;
  engineCount: number;
  healthyCount: number;
  degradedCount: number;
  unhealthyCount: number;
  unknownCount: number;
  pipelineStatus: OSPipelineOverallStatus;
  pipelineValid: boolean;
  dependencyAcyclic: boolean;
  criticalFindings: number;
  warningFindings: number;
  passedChecks: number;
}

// ── Platform validation ───────────────────────────────────────────

export interface OSValidationCheck {
  id: string;
  label: string;
  category: OSDiagnosticCategory;
  passed: boolean;
  detail: string;
}

export interface OSPlatformValidation {
  valid: boolean;
  checks: OSValidationCheck[];
  summary: { passed: number; failed: number; total: number; score: number };
}

// ── Dashboard ─────────────────────────────────────────────────────

export interface OSDashboardData {
  health: OSSystemHealth;
  latestSnapshot?: OSHealthSnapshot;
  snapshotHistory: OSHealthSnapshot[];
}
