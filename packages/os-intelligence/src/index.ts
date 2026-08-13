// ──────────────────────────────────────────────────────────────────
// VedMoulya — @vedmoulya/os-intelligence
// Enterprise Operating System Integration Layer (EPIC-005 / OS-001)
// The integration layer that turns the eleven Enterprise Intelligence
// Engines into one Enterprise Operating System. It integrates,
// validates, optimizes and certifies the complete platform — it owns
// no engine, duplicates no logic, and modifies nothing downstream.
// ──────────────────────────────────────────────────────────────────

// ── Types ─────────────────────────────────────────────────────────
export type {
  OSEngineId,
  OSEngineHealthStatus,
  OSEngineStatus,
  OSDependencyKind,
  OSDependencyEdge,
  OSDependencyGraph,
  OSPipelineStageId,
  OSPipelineStageStatus,
  OSPipelineStage,
  OSPipelineOverallStatus,
  OSPipelineHealth,
  OSCrossEngineCheck,
  OSCrossEnginePairStatus,
  OSCrossEnginePair,
  OSDiagnosticSeverity,
  OSDiagnosticCategory,
  OSDiagnosticFinding,
  OSDiagnosticsReport,
  OSRepositoryStatus,
  OSPerformanceMetric,
  OSPerformanceMetrics,
  OSSystemHealthStatus,
  OSSystemHealth,
  OSHealthSnapshot,
  OSValidationCheck,
  OSPlatformValidation,
  OSDashboardData,
} from './types/os-types.js';
export { OS_ENGINE_IDS } from './types/os-types.js';

// ── Contracts (engine ports) ──────────────────────────────────────
export type {
  PortResult,
  OSGoalEnginePort,
  OSCapabilityEnginePort,
  OSProviderEnginePort,
  OSContextEnginePort,
  OSStrategyEnginePort,
  OSOrchestratorEnginePort,
  OSIntelligenceEnginePort,
  OSLearningEnginePort,
  OSBrainEnginePort,
  OSKnowledgeEnginePort,
  OSMemoryEnginePort,
  OSEngines,
} from './contracts/os-engines.js';

// ── Domain ────────────────────────────────────────────────────────
export type { OSRepository } from './domain/repository/OSRepository.js';
export {
  engineSpecsRule,
  matrixRule,
  pipelineRule,
  OS_SCORE_WEIGHTS,
  engineHealthScore,
  pipelineScore,
  diagnosticsScore,
  overallOSScore,
  osHealthStatusFromScore,
  stageStatusRule,
  engineStatusRule,
  isOSEngineId,
} from './domain/rules/OSRules.js';
export type { RuleResult } from './domain/rules/OSRules.js';
export { OSDependencyGraphService } from './domain/services/OSDependencyGraphService.js';
export { OSEngineProbeService } from './domain/services/OSEngineProbeService.js';
export type { OSEngineProbe, OSPortResult } from './domain/services/OSEngineProbeService.js';
export { OSHealthService } from './domain/services/OSHealthService.js';
export { OSPipelineValidationService } from './domain/services/OSPipelineValidationService.js';
export type { StageEvidence } from './domain/services/OSPipelineValidationService.js';
export { OSCrossEngineValidationService } from './domain/services/OSCrossEngineValidationService.js';
export { OSRepositoryStatusService } from './domain/services/OSRepositoryStatusService.js';
export { OSPerformanceService } from './domain/services/OSPerformanceService.js';
export { OSDiagnosticsService } from './domain/services/OSDiagnosticsService.js';
export type { OSDiagnosticsInput } from './domain/services/OSDiagnosticsService.js';
export { OSValidationService } from './domain/services/OSValidationService.js';
export { OSDashboardService } from './domain/services/OSDashboardService.js';
export { asRecord, numOf, strOf, arrOf, objOf } from './domain/services/os-data.js';

// ── Infrastructure ─────────────────────────────────────────────────
export { InMemoryOSRepository } from './infrastructure/InMemoryOSRepository.js';
export { PostgresOSRepository } from './infrastructure/PostgresOSRepository.js';

// ── Application ───────────────────────────────────────────────────
export { OSApplicationService } from './application/OSApplicationService.js';
export type { OSResult } from './application/OSApplicationService.js';
export type {
  OSSystemHealthDTO,
  OSPipelineHealthDTO,
  OSDiagnosticsReportDTO,
  OSDiagnosticFindingDTO,
  OSPlatformValidationDTO,
  OSEngineStatusDTO,
  OSDependencyGraphDTO,
  OSPerformanceMetricsDTO,
  OSHealthSnapshotDTO,
  OSDashboardDataDTO,
  OSSnapshotListDTO,
  OSValidatePlatformDTO,
} from './application/OSDTO.js';

// ── Catalog Seed ──────────────────────────────────────────────────
export {
  OS_ENGINE_SPECS,
  OS_CONSUMPTION_MATRIX,
  OS_PACKAGE_DEPENDENCIES,
  OS_CONSUMPTION_REASONS,
  OS_CROSS_ENGINE_PAIRS,
  SEED_OS_SNAPSHOT_ID,
  createCatalogOSSnapshot,
} from './catalog/os-catalog.js';
export type { OSEngineSpec, OSCrossEnginePairSpec } from './catalog/os-catalog.js';
export { OSPIPELINE_ENGINE, OSPIPELINE_LABELS, OSPIPELINE_STAGES } from './catalog/os-pipeline.js';
