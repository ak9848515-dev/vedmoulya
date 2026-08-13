// ──────────────────────────────────────────────────────────────────
// VedMoulya — Enterprise Intelligence Pipeline: Engine Ports
// EI-006 / INT-001
// The pipeline composes the six existing Enterprise Intelligence
// engines through narrow ports. Each port is structurally satisfied
// by the owning engine's application service, so the pipeline REUSES
// every registry and engine — it never duplicates their logic.
//
//   Goal (EI-006/goals) → Capabilities (EI-001) → Providers (EI-002)
//   → Context (EI-003) → Strategy (EI-004) → Graph + Session (EI-005)
//
// Contracts are typed against the engines' public DTOs so the gateway
// and the web dashboard share exactly the same shapes.
// ──────────────────────────────────────────────────────────────────

import type { CapabilityType } from '@vedmoulya/ai';
import type { GoalDTO, GoalResult, GoalSummaryDTO } from '@vedmoulya/goals';
import type {
  CapabilityDTO,
  CapabilityMarketplaceDTO,
  CapabilityResult,
} from '@vedmoulya/capabilities';
import type {
  ProviderCapabilityMatrixDTO,
  ProviderMarketplaceDTO,
  ProviderResult,
} from '@vedmoulya/providers';
import type {
  ContextItemDTO,
  ContextQueryDTO,
  ContextRegistrySummaryDTO,
  ContextResult,
} from '@vedmoulya/context';
import type {
  CreateStrategyDTO,
  ExecutionStrategyDTO,
  StrategyResult,
  StrategySummaryDTO,
} from '@vedmoulya/execution-strategy';
import type {
  BuildGraphInputDTO,
  CreateSessionDTO,
  ExecutionGraphDTO,
  ExecutionSessionDTO,
  OrchestratorResult,
  OrchestratorSummaryDTO,
} from '@vedmoulya/execution-orchestrator';

// ── Goal & Task Intelligence Engine (EI-006 / goals) ───────────────────────

export interface GoalEnginePort {
  getGoal(goalId: string): Promise<GoalResult<GoalDTO>>;
  /** Re-runs understanding + classification and persists them. */
  analyzeGoal(goalId: string): Promise<GoalResult<GoalDTO>>;
  getSummary(): Promise<GoalResult<GoalSummaryDTO>>;
}

// ── Enterprise Capability Registry (EI-001) ────────────────────────────────

export interface CapabilityEnginePort {
  getCapability(id: string): Promise<CapabilityResult<CapabilityDTO>>;
  /**
   * Resolve registry capabilities by required AI feature (CapabilityType).
   * A goal's required capabilities are AI-feature names (e.g. 'reasoning');
   * the registry keys capabilities by business ids (e.g. research/writing),
   * so the pipeline resolves features → registry ids through this port.
   */
  findByAIFeatures(features: CapabilityType[]): Promise<CapabilityResult<CapabilityDTO[]>>;
  getMarketplace(): Promise<CapabilityResult<CapabilityMarketplaceDTO>>;
}

// ── Enterprise Provider Registry (EI-002) ─────────────────────────────────

export interface ProviderEnginePort {
  getProvidersForCapability(
    capability: CapabilityType,
  ): Promise<ProviderResult<ProviderCapabilityMatrixDTO['rows'][number]['rankings']>>;
  getMarketplace(): Promise<ProviderResult<ProviderMarketplaceDTO>>;
}

// ── Enterprise Context Intelligence Engine (EI-003) ────────────────────────

export interface ContextEnginePort {
  searchContext(
    query: ContextQueryDTO,
  ): Promise<ContextResult<{ items: ContextItemDTO[]; total: number }>>;
  getContextSummary(): Promise<ContextResult<ContextRegistrySummaryDTO>>;
}

// ── Enterprise Execution Strategy Engine (EI-004) ──────────────────────────

export interface StrategyEnginePort {
  listByGoal(goalId: string): Promise<StrategyResult<ExecutionStrategyDTO[]>>;
  createStrategy(dto: CreateStrategyDTO): Promise<StrategyResult<ExecutionStrategyDTO>>;
  getSummary(): Promise<StrategyResult<StrategySummaryDTO>>;
}

// ── Enterprise Execution Orchestrator (EI-005) ─────────────────────────────

export interface OrchestratorEnginePort {
  buildExecutionGraph(input: BuildGraphInputDTO): Promise<OrchestratorResult<ExecutionGraphDTO>>;
  createExecutionSession(dto: CreateSessionDTO): Promise<OrchestratorResult<ExecutionSessionDTO>>;
  getSummary(): Promise<OrchestratorResult<OrchestratorSummaryDTO>>;
}

// ── Combined engine bundle passed to the pipeline builder ──────────────────

export interface IntelligenceEngines {
  goals: GoalEnginePort;
  capabilities: CapabilityEnginePort;
  providers: ProviderEnginePort;
  context: ContextEnginePort;
  strategies: StrategyEnginePort;
  orchestrator: OrchestratorEnginePort;
}
