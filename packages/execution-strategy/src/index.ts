// ──────────────────────────────────────────────────────────────────
// VedMoulya — @vedmoulya/execution-strategy
// Enterprise Execution Strategy Engine (EI-004)
// Given a Goal, the EES determines WHAT to execute, WHICH capabilities
// are required, WHICH providers are eligible, HOW work should be divided,
// HOW MUCH context/tokens/budget to use, whether execution is sequential
// or parallel, WHAT quality must be achieved, and WHAT fallback strategy
// to use. The engine creates the strategy — it does NOT execute work.
// ──────────────────────────────────────────────────────────────────

// ── Types ─────────────────────────────────────────────────────────────────
export type {
  ExecutionMode,
  StrategyPriority,
  RiskLevel,
  CapabilitySupport,
  CapabilityFlowType,
  CapabilityPlanStep,
  CapabilityPlan,
  ProviderCandidate,
  TokenBudget,
  BudgetCategory,
  CostBudget,
  LatencyBudget,
  QualityTarget,
  SequentialPlan,
  ParallelPlan,
  ExecutionModePlan,
  RiskAssessment,
  FallbackPlan,
  StrategyRetryPolicy,
  ContextReference,
  ExecutionStrategy,
  StrategyValidationCheck,
  StrategyValidation,
  StrategyInput,
  TokenEstimate,
  CostEstimate,
  LatencyEstimate,
  StrategySearchCriteria,
} from './types/strategy-types.js';
export {
  EXECUTION_MODES,
  STRATEGY_PRIORITIES,
  RISK_LEVELS,
  CAPABILITY_FLOW_TYPES,
  BUDGET_CATEGORIES,
} from './types/strategy-types.js';

// ── Domain ────────────────────────────────────────────────────────────────
export { createStrategyId, generateStrategyId } from './domain/value-objects/StrategyId.js';
export type { StrategyId } from './domain/value-objects/StrategyId.js';
export type { ExecutionStrategyRepository } from './domain/repository/ExecutionStrategyRepository.js';
export { CapabilityPlannerService } from './domain/services/CapabilityPlannerService.js';
export { ProviderCandidateService } from './domain/services/ProviderCandidateService.js';
export { BudgetEngineService } from './domain/services/BudgetEngineService.js';
export { RiskEngineService } from './domain/services/RiskEngineService.js';
export { FallbackEngineService } from './domain/services/FallbackEngineService.js';
export { StrategyValidatorService } from './domain/services/StrategyValidatorService.js';
export { ExecutionStrategyService } from './domain/services/ExecutionStrategyService.js';

// ── Infrastructure ────────────────────────────────────────────────────────
export { InMemoryExecutionStrategyRepository } from './infrastructure/InMemoryExecutionStrategyRepository.js';
export { PostgresExecutionStrategyRepository } from './infrastructure/PostgresExecutionStrategyRepository.js';

// ── Application ───────────────────────────────────────────────────────────
export { ExecutionStrategyApplicationService } from './application/ExecutionStrategyApplicationService.js';
export type { StrategyResult } from './application/ExecutionStrategyApplicationService.js';
export { StrategyMapper } from './application/StrategyMapper.js';
export type {
  CreateStrategyDTO,
  StrategySearchDTO,
  CapabilityPlanStepDTO,
  CapabilityPlanDTO,
  ProviderCandidateDTO,
  TokenBudgetDTO,
  CostBudgetDTO,
  LatencyBudgetDTO,
  QualityTargetDTO,
  RiskAssessmentDTO,
  FallbackPlanDTO,
  RetryPolicyDTO,
  ContextReferenceDTO,
  ExecutionModePlanDTO,
  StrategyValidationDTO,
  ExecutionStrategyDTO,
  StrategySummaryDTO,
  StrategyExplanationDTO,
  TokenEstimateDTO,
  CostEstimateDTO,
  LatencyEstimateDTO,
} from './application/StrategyDTO.js';

// ── Catalog Seed ──────────────────────────────────────────────────────────
export { createCatalogStrategies, SEED_STRATEGY_SIZE } from './catalog/strategy-catalog.js';
