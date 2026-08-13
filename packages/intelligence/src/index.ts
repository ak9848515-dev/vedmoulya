// ──────────────────────────────────────────────────────────────────
// VedMoulya — @vedmoulya/intelligence
// Enterprise Intelligence Integration Platform (EI-006 / INT-001)
// Integrates every Enterprise Intelligence engine into one pipeline:
//   Goal → Capabilities → Providers → Context → Execution Strategy →
//   Execution Graph → Execution Session
// The pipeline plans and validates end-to-end readiness — it never
// executes. No AI calls. Every artifact is produced by the owning
// engine (goals, capabilities, providers, context, execution-strategy,
// execution-orchestrator) and merely composed here.
// ──────────────────────────────────────────────────────────────────

// ── Types ─────────────────────────────────────────────────────────
export type {
  PipelineStage,
  PipelineStepStatus,
  PipelineStatus,
  EnterprisePipelineStep,
  PipelineValidationCheck,
  PipelineValidation,
  EnterprisePipeline,
  EnterprisePipelineArtifacts,
  PipelineBuildInput,
  PipelineStepExplanation,
  PipelineExplanation,
  PipelineSummary,
  IntelligenceEngine,
  EngineStatus,
} from './types/pipeline-types.js';
export { PIPELINE_STAGES, PIPELINE_STAGE_LABELS } from './types/pipeline-types.js';

// ── Contracts (engine ports) ──────────────────────────────────────
export type {
  GoalEnginePort,
  CapabilityEnginePort,
  ProviderEnginePort,
  ContextEnginePort,
  StrategyEnginePort,
  OrchestratorEnginePort,
  IntelligenceEngines,
} from './contracts/pipeline-engines.js';

// ── Domain ────────────────────────────────────────────────────────
export { createPipelineId, generatePipelineId } from './domain/value-objects/PipelineId.js';
export type { PipelineId } from './domain/value-objects/PipelineId.js';
export type { PipelineRepository } from './domain/repository/PipelineRepository.js';
export { PipelineBuilderService } from './domain/services/PipelineBuilderService.js';
export { PipelineValidatorService } from './domain/services/PipelineValidatorService.js';
export { PipelineExplainerService } from './domain/services/PipelineExplainerService.js';
export { PipelineSummaryService } from './domain/services/PipelineSummaryService.js';

// ── Infrastructure ─────────────────────────────────────────────────
export { InMemoryPipelineRepository } from './infrastructure/InMemoryPipelineRepository.js';
export { PostgresPipelineRepository } from './infrastructure/PostgresPipelineRepository.js';

// ── Application ───────────────────────────────────────────────────
export { IntelligenceApplicationService } from './application/IntelligenceApplicationService.js';
export type { IntelligenceResult } from './application/IntelligenceApplicationService.js';
export { PipelineMapper } from './application/PipelineMapper.js';
export type {
  PipelineStepDTO,
  PipelineValidationDTO,
  PipelineArtifactsDTO,
  PipelineDTO,
  PipelineExplanationDTO,
  PipelineSummaryDTO,
  EngineStatusDTO,
  IntelligenceDashboardDTO,
} from './application/PipelineDTO.js';

// ── Catalog Seed ──────────────────────────────────────────────────
export {
  PIPELINE_CATALOG,
  SEED_PIPELINE_CATALOG_SIZE,
  findCatalogEntry,
} from './catalog/pipeline-catalog.js';
export type { PipelineCatalogEntry } from './catalog/pipeline-catalog.js';
