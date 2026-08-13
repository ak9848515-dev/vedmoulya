// ──────────────────────────────────────────────────────────────────
// VedMoulya — @vedmoulya/enterprise-brain
// Enterprise Brain — Central Decision Intelligence (EI-008)
// The highest decision-making layer of VedMoulya. It coordinates
// every Enterprise Intelligence Engine and DECIDES — it never
// executes, never calls an LLM, and owns no engine. Every decision is
// fully explained (why, evidence, confidence, trade-offs,
// alternatives, risks) and grouped into a decision plan that is
// handed to the Execution Orchestrator only after human approval.
// ──────────────────────────────────────────────────────────────────

// ── Types ─────────────────────────────────────────────────────────
export type {
  BrainDecisionType,
  BrainDecisionStatus,
  BrainPlanStatus,
  BrainDecisionAction,
  BrainConfidenceLevel,
  BrainDecisionConfidence,
  BrainRecommendation,
  BrainDecisionReason,
  BrainDecisionContext,
  BrainAuditEntry,
  BrainHistoryEntry,
  BrainDecision,
  BrainPipelineStep,
  BrainDecisionPlan,
  BrainTrendPoint,
  BrainDecisionMetrics,
  BrainDashboardData,
} from './types/brain-types.js';
export {
  BRAIN_DECISION_TYPES,
  BRAIN_DECISION_TYPE_LABELS,
  BRAIN_DECISION_STATUSES,
} from './types/brain-types.js';

// ── Contracts (engine ports) ──────────────────────────────────────
export type {
  BrainGoalEnginePort,
  BrainLearningEnginePort,
  BrainCapabilityEnginePort,
  BrainProviderEnginePort,
  BrainContextEnginePort,
  BrainStrategyEnginePort,
  BrainOrchestratorEnginePort,
  BrainEngines,
} from './contracts/brain-engines.js';

// ── Domain ────────────────────────────────────────────────────────
export {
  createBrainDecisionId,
  createPlanDecisionId,
  generateBrainPlanId,
  generateHistoryId,
  generateAuditId,
} from './domain/value-objects/BrainDecisionId.js';
export type { BrainDecisionId, BrainPlanId } from './domain/value-objects/BrainDecisionId.js';
export type { BrainRepository, BrainDecisionSearch } from './domain/repository/BrainRepository.js';
export {
  decisionTypeRule,
  decisionStatusRule,
  confidenceRule,
  nonNegativeRule,
  entityRule,
  validateDecision,
  validatePlan,
  canTransitionDecision,
  canTransitionPlan,
  validate,
} from './domain/rules/BrainDecisionRules.js';
export type { RuleResult } from './domain/rules/BrainDecisionRules.js';
export { BrainDecisionService } from './domain/services/BrainDecisionService.js';
export type {
  BrainEngineSnapshot,
  DecisionServiceOptions,
} from './domain/services/BrainDecisionService.js';
export { BrainExplainerService } from './domain/services/BrainExplainerService.js';
export { BrainMetricsService } from './domain/services/BrainMetricsService.js';
export { BrainPlanService } from './domain/services/BrainPlanService.js';
export type { BuildPlanOptions, BrainPlanResult } from './domain/services/BrainPlanService.js';

// ── Infrastructure ─────────────────────────────────────────────────
export { InMemoryBrainRepository } from './infrastructure/InMemoryBrainRepository.js';
export type { InMemoryBrainSeed } from './infrastructure/InMemoryBrainRepository.js';
export { PostgresBrainRepository } from './infrastructure/PostgresBrainRepository.js';

// ── Application ───────────────────────────────────────────────────
export { BrainApplicationService } from './application/BrainApplicationService.js';
export type {
  BrainResult,
  BrainApplicationOptions,
} from './application/BrainApplicationService.js';
export { BrainMapper } from './application/BrainMapper.js';
export type {
  DecideGoalDTO,
  BrainListDecisionsQueryDTO,
  BrainTimelineDTO,
  BrainDecisionActionDTO,
  BrainPlanActionDTO,
  BrainDecisionDTO,
  BrainPlanDTO,
  BrainHistoryDTO,
  BrainTrendPointDTO,
  BrainDecisionMetricsDTO,
  BrainDashboardDTO,
} from './application/BrainDTO.js';

// ── Catalog Seed ──────────────────────────────────────────────────
export {
  createCatalogBrainPlan,
  createCatalogBrainDecisions,
  hasAllDecisionTypes,
  SEED_PLAN_ID,
  SEED_GOAL_ID,
  SEED_DECISIONS_SIZE,
  SEED_PLANS_SIZE,
} from './catalog/brain-catalog.js';
