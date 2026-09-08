// ──────────────────────────────────────────────────────────────────
// VedMoulya — @vedmoulya/planning
// Autonomous Planning Intelligence (SPRINT 1)
//
// USER GOAL → GOAL UNDERSTANDING → PLAN GENERATION → VALIDATION →
// READINESS → EXISTING AGENT EXECUTION ENGINE
//
// The planner PROPOSES. The execution engine executes. Governance
// authorizes. Verification determines evidence of success.
//
// Nothing here re-implements the frozen estate: capabilities reuse the
// CapabilityType taxonomy, plan/step/action/verification/recovery reuse
// the frozen AgentPlan/VerificationPolicy/StepRecoveryPolicy types,
// tool availability flows through the authoritative tool registry port,
// and every AI call (including AI-assisted planning) goes through the
// frozen AIOrchestrationService — inheriting ProviderRoutingAdvisor,
// RoutingEvidenceService, ExecutionHealthService, capability gates,
// retry/fallback and CostLedger. The planner never calls a provider SDK
// and never bypasses the tool security chain.
// ──────────────────────────────────────────────────────────────────

// ── Types ────────────────────────────────────────────────────────
export type {
  GoalInput,
  PlanConstraint,
  GoalUnderstanding,
  PlanReadinessStatus,
  PlanReadinessIssue,
  PlanReadiness,
  PlanGenerationSource,
  PlannerAiUsage,
  SelectedVerificationKind,
  PlanGenerationResult,
  PlanAndExecuteInput,
  PlanAndExecuteResult,
} from './types/planning-types.js';
export type { PlanningBudget } from './types/planning-types.js';

// ── Contracts (narrow ports — no duplicate routers/registries) ────
export type {
  PlannerAiProposalInput,
  PlannerAiProposalResult,
  PlannerAiPort,
} from './contracts/planning-ports.js';
export type { AgentToolRegistryPort, AgentClockPort } from './contracts/planning-ports.js';

// ── Domain ───────────────────────────────────────────────────────
export { GoalUnderstandingService } from './domain/goal-understanding.js';
export { PlannerService } from './domain/planner-service.js';
export type {
  PlannerServiceOptions,
  GeneratePlanInput,
  GeneratePlanOutput,
} from './domain/planner-service.js';
export { validateGeneratedPlan } from './domain/plan-validation.js';
export type { PlanValidationContext } from './domain/plan-validation.js';
export {
  ESTIMATED_TOKENS_PER_AI_ACTION,
  ESTIMATED_COST_PER_TOKEN,
} from './domain/plan-validation.js';
export { computePlanReadiness } from './domain/plan-readiness.js';
export type { ReadinessPorts } from './domain/plan-readiness.js';
export { READINESS_BLOCK_CODES } from './domain/plan-readiness.js';
export { PLAN_TEMPLATES, selectTemplate } from './domain/planner-templates.js';
export type { PlanTemplate } from './domain/planner-templates.js';
export {
  parsePlanProposal,
  planFromProposal,
  MAX_PLAN_STEPS,
  MAX_ACTIONS_PER_STEP,
  MAX_RECOVERY_ATTEMPTS,
  MAX_RECOVERY_REVISIONS,
} from './domain/plan-proposal.js';
export type {
  PlannerPlanProposal,
  ParsedPlan,
  ParsedPlanStep,
  ParsedPlanAction,
  ProposalParseResult,
} from './domain/plan-proposal.js';

// ── Application ──────────────────────────────────────────────────
export { PlanningApplicationService } from './application/PlanningApplicationService.js';
export type { PlanningApplicationServiceOptions } from './application/PlanningApplicationService.js';

// ── Infrastructure (adapters over the frozen estate) ─────────────
export { AIOrchestrationPlannerPort } from './infrastructure/AIOrchestrationPlannerPort.js';
