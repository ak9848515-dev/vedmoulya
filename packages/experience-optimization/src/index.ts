// ──────────────────────────────────────────────────────────────────
// VedMoulya — @vedmoulya/experience-optimization
// Experience Optimization + Self-Improvement
//
//   VERIFIED EXECUTION → LEARNING → MEMORY → EXPERIENCE OPTIMIZATION →
//   STRATEGY RECOMMENDATION → PLANNING / ADAPTIVE DECISION → NORMAL
//   VALIDATION → GOVERNANCE → EXECUTION → VERIFICATION → MEASURED OUTCOME
//
// Everything here is ADVISORY. Memory/optimization can never authorize,
// cannot bypass ToolRuntime/AIOrchestrationService/governance/
// verification/budgets, cannot widen capabilities/permissions/autonomy,
// and never self-modifies code or configuration. Current runtime truth
// always wins (Phase 18 hierarchy). Persistence is never duplicated:
// evidence flows through @vedmoulya/execution-memory → the enterprise
// memory platform.
// ──────────────────────────────────────────────────────────────────

// ── Types ────────────────────────────────────────────────────────
export type {
  OptimizationTarget,
  EvidenceLevel,
  StrategyEvidence,
  ScoreFactor,
  StrategyCandidate,
  OptimizationConstraint,
  OptimizationContext,
  StrategyRecommendation,
  RecommendationDecision,
  RecommendationOutcomeKind,
  RecommendationOutcomeInput,
  RecommendationOutcomeRecord,
  ComparisonVerdict,
  StrategyComparison,
  OptimizationDecisionKind,
  OptimizationDecision,
  RecommendationEffectiveness,
  OptimizationAuditRecord,
} from './types/experience-optimization-types.js';
export { OPTIMIZATION_TARGETS, EVIDENCE_LEVELS } from './types/experience-optimization-types.js';

// ── Ports ────────────────────────────────────────────────────────
export type {
  ExperienceMemoryPort,
  MemoryEntryQuery,
  RecommendationOutcomeStore,
  ExperienceOptimizationObserver,
} from './contracts/experience-optimization-ports.js';

// ── Domain ───────────────────────────────────────────────────────
export {
  extractStrategyEvidence,
  extractEvidenceForTarget,
  evidenceLevelFor,
  recentConsistencyFor,
  targetForCategory,
  isCapabilityMatch,
  MIN_SAMPLES_INSUFFICIENT,
  MIN_SAMPLES_EMERGING,
  MIN_SAMPLES_RELIABLE,
  MIN_VERIFIED_RATIO_RELIABLE,
  HIGH_RECENCY_FLOOR,
  HIGH_CONSISTENCY_FLOOR,
} from './domain/strategy-evidence.js';
export type {
  MeasuredPerformance,
  MeasuredPerformanceMap,
  EvidenceOptions,
} from './domain/strategy-evidence.js';
export {
  SCORE_WEIGHTS,
  efficiencyEligible,
  scoreCandidate,
  buildCandidates,
  buildExplanation,
  buildRecommendation,
  applyRuntimeTruth,
  boundCandidates,
  satisfiesConstraint,
} from './domain/strategy-scoring.js';
export {
  compareStrategies,
  waldInterval,
  COMPARISON_MIN_SAMPLES,
} from './domain/strategy-comparison.js';
export {
  decideExploration,
  isHighRiskSubject,
  HIGH_RISK_SUBJECTS,
  DEFAULT_EXPLORATION_SHARE,
  MAX_EXPLORATION_SHARE,
} from './domain/strategy-exploration.js';
export type { ExplorationDecision } from './domain/strategy-exploration.js';

// ── Application ──────────────────────────────────────────────────
export {
  ExperienceOptimizationService,
  categoryForTarget,
  MAX_CANDIDATES_CONSIDERED,
  MAX_ALTERNATIVES,
  RECOMMENDABLE_RECOVERY_STRATEGIES,
} from './application/ExperienceOptimizationService.js';
export type {
  ExperienceOptimizationServiceOptions,
  RoutingExperienceSignal,
} from './application/ExperienceOptimizationService.js';

// ── Infrastructure ───────────────────────────────────────────────
export { InMemoryRecommendationOutcomeStore } from './infrastructure/InMemoryRecommendationOutcomeStore.js';
export { ExperienceMemoryPortAdapter } from './infrastructure/ExperienceMemoryPortAdapter.js';
export {
  PlanningExperienceAdapter,
  AdaptiveExperienceAdapter,
  RoutingExperienceAdapter,
} from './infrastructure/integration-adapters.js';
export type {
  PlanStrategyAdvisory,
  FailureAdvisory,
} from './infrastructure/integration-adapters.js';
