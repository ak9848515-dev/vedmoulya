// ──────────────────────────────────────────────────────────────────
// VedMoulya — @vedmoulya/brain
// EPIC-016 — The VedMoulya Brain
//
// The central intelligence & orchestration layer. Coordinates the
// frozen estate (capability marketplace EPIC-013, execution bridge
// EPIC-014, provider intelligence EPIC-012A/B, AI World EPIC-012C,
// LoopEngine EPIC-006) through narrow ports. Never executes AI itself.
// ──────────────────────────────────────────────────────────────────

// ── Types ─────────────────────────────────────────────────────────
export type {
  BrainMode,
  BrainStage,
  BrainStageStatus,
  ProviderRole,
  QualityTarget,
  PrivacyRequirement,
  Urgency,
  BoundedAssumption,
  IntentProfile,
  ProviderRoleAssignment,
  BrainNodeKind,
  BrainGraphNode,
  BrainEdgeType,
  BrainGraphEdge,
  BrainExecutionGraph,
  ConflictClassification,
  ConflictReport,
  SynthesizedClaim,
  BrainSynthesis,
  BrainDecisionRecord,
  BrainVerification,
  OutcomeEvaluation,
  BrainBudget,
  BrainTaskStatus,
  BrainTask,
} from './types/brain-types.js';
export { BRAIN_MODES, BRAIN_STAGES, PROVIDER_ROLES } from './types/brain-types.js';

// ── EPIC-020 continuous-intelligence types ────────────────────────
export type {
  EvidenceStatus,
  UsageDatum,
  ProviderUsageFact,
  UsageEvidenceSummary,
  FailureClass,
  FailoverEvent,
  ProviderPerformanceScore,
  OpportunityCategory,
  Opportunity,
  IntelligenceEventKind,
  SecurityClassification,
  IntelligenceEvent,
  BrainOutcomeMemory,
} from './types/continuous-types.js';

// ── EPIC-020 (Outcome & Revenue layer) types ──────────────────────
export type {
  OutcomeType,
  OutcomePriority,
  OutcomeStatus,
  OutcomeConstraint,
  OutcomeValue,
  OutcomeEvidence,
  OutcomeEffort,
  Outcome,
  OutcomeSatisfaction,
  OutcomeVerdict,
  DailyActionCategory,
  DailyAction,
  DailyPriorityPlan,
} from './types/outcome-types.js';
export { OUTCOME_TYPES, OUTCOME_SATISFACTIONS, OUTCOME_VERDICTS } from './types/outcome-types.js';

// ── Contracts ─────────────────────────────────────────────────────
export type {
  ClockPort,
  BrainPlanPort,
  BrainCandidatePort,
  BrainExecutionPort,
  BrainContextPort,
  BrainPreferencePort,
  BrainTaskStore,
  BrainDecisionStore,
  BrainUsagePort,
  BrainExperiencePort,
  BrainMemoryPort,
  BrainDiscoveryBridgePort,
  OpportunityStore,
  IntelligenceEventStore,
} from './contracts/brain-ports.js';

// ── Domain ────────────────────────────────────────────────────────
export { IntentInterpreter } from './domain/IntentInterpreter.js';
export { BrainModeSelector } from './domain/BrainModeSelector.js';
export {
  ProviderRoleAssigner,
  BrainNoCandidatesError,
  CAPABILITY_DEFAULT_ROLE,
} from './domain/ProviderRoleAssigner.js';
export { ParallelPlanner } from './domain/ParallelPlanner.js';
export { ConflictDetector } from './domain/ConflictDetector.js';
export { OutputAssembler } from './domain/OutputAssembler.js';
export { CriticStrategy } from './domain/CriticStrategy.js';
export { BrainBudgetGuard } from './domain/BrainBudgetGuard.js';
export { UsageIntelligence } from './domain/UsageIntelligence.js';
export { AdaptiveScoreLedger } from './domain/AdaptiveScoreLedger.js';
export { FallbackSelector } from './domain/ExecutionFailover.js';
export { OpportunityIntelligence } from './domain/OpportunityIntelligence.js';
export { OutcomePriorityEngine } from './domain/OutcomePriorityEngine.js';
export type {
  RankableAction,
  RankedAction,
  PriorityFactorBreakdown,
} from './domain/OutcomePriorityEngine.js';
export { DailyOutcomeEngine } from './domain/DailyOutcomeEngine.js';
export type { DailyOutcomeInput } from './domain/DailyOutcomeEngine.js';
export { BrainPolicyEngine, SENSITIVE_ACTIONS } from './domain/BrainPolicyEngine.js';
export type { PolicyVerdict, PolicyContext, SensitiveAction } from './domain/BrainPolicyEngine.js';
export { BrainDecisionRecorder } from './domain/BrainDecisionRecorder.js';
export type { DecisionInput } from './domain/BrainDecisionRecorder.js';
export { OutcomeEvaluator } from './domain/OutcomeEvaluator.js';
export { deriveOutcomeVerdict } from './domain/OutcomeVerdict.js';
export type { OutcomeVerdictInput } from './domain/OutcomeVerdict.js';
export { OUTCOME_VERDICT_LABELS } from './domain/OutcomeVerdict.js';

// ── Application ───────────────────────────────────────────────────
export { BrainApplicationService } from './application/BrainApplicationService.js';
export type { BrainServiceOptions, ServiceResult } from './application/BrainApplicationService.js';

// ── Infrastructure ────────────────────────────────────────────────
export {
  InMemoryBrainTaskStore,
  InMemoryBrainDecisionStore,
} from './infrastructure/InMemoryBrainStores.js';
export {
  InMemoryOpportunityStore,
  InMemoryIntelligenceEventStore,
  InMemoryOutcomeMemory,
} from './infrastructure/InMemoryContinuousStores.js';

// ── Infrastructure (SPRINT-022 — production Postgres persistence) ─
// Same synchronous store ports, write-through to Postgres (mirror +
// async idempotent upserts + boot hydration + shutdown flush).
export {
  PostgresBrainTaskStore,
  PostgresBrainDecisionStore,
  PostgresOpportunityStore,
  PostgresIntelligenceEventStore,
  PostgresOutcomeMemory,
  PostgresAdaptiveScoreLedger,
} from './infrastructure/PostgresBrainStores.js';
export type { PostgresAdaptiveScoreLedgerOptions } from './infrastructure/PostgresBrainStores.js';
