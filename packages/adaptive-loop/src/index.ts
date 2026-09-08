// ──────────────────────────────────────────────────────────────────
// VedMoulya — @vedmoulya/adaptive-loop
// Adaptive Agent Loop (MODEL-DRIVEN OBSERVE → DECIDE → ACT COORDINATION)
//
//   OBSERVATION → DECISION → ACTION PROPOSAL → VALIDATION → GOVERNANCE →
//   EXECUTION → OBSERVATION → ... → VERIFIED / COMPLETED / FAILED_FINAL /
//   BLOCKED / WAITING_FOR_APPROVAL
//
// The model may propose the next action. VedMoulya remains authoritative
// over capabilities, tools, permissions, approvals, budgets, routing,
// verification, recovery and termination. The model NEVER becomes the
// security boundary.
//
// Nothing here re-implements the frozen estate: AI actions flow through
// the frozen AgentAiExecutionPort (production: AIOrchestrationService →
// routing/health/evidence/cost), tool calls through AgentToolExecutionPort
// (production: ToolRuntime security chain), capabilities reuse the frozen
// CapabilityType taxonomy, verification reuses verifyAgainstPolicy and
// recovery reuses decideRecovery. No provider SDK is ever called here.
// ──────────────────────────────────────────────────────────────────

// ── Types ────────────────────────────────────────────────────────
export type {
  AdaptiveDecisionKind,
  AdaptiveDecision,
  ActionProposal,
  AdaptiveRunState,
  AdaptiveOutcome,
  AdaptiveTerminationReason,
  AdaptiveLoopBudgets,
  AdaptiveRunUsage,
  AdaptiveDecisionRecord,
  AdaptiveRun,
  AdaptiveRunBudgetConfig,
  AdaptiveLoopInput,
  AdaptiveApprovalInput,
  VerificationSummary,
} from './types/adaptive-loop-types.js';
export {
  ADAPTIVE_DECISION_KINDS,
  ADAPTIVE_RUN_STATES,
  ADAPTIVE_TERMINAL_STATES,
  DEFAULT_ADAPTIVE_LOOP_BUDGETS,
} from './types/adaptive-loop-types.js';

// ── Contracts (narrow ports — no duplicate routers/registries) ────
export type {
  DecisionContext,
  DecisionProposalResult,
  AgentDecisionModelPort,
  AdaptiveReplanInput,
  AdaptiveReplanResult,
  AdaptivePlannerPort,
  AdaptiveApprovalStore,
  AdaptiveRunStore,
  AdaptiveRunObserver,
} from './contracts/adaptive-loop-ports.js';

// ── Domain ───────────────────────────────────────────────────────
export { normalizeObservation, buildBoundedObservationContext } from './domain/observation.js';
export type { NormalizeObservationInput } from './domain/observation.js';
export {
  OBSERVATION_MAX_LENGTH,
  MAX_ARTIFACTS,
  MAX_CONTEXT_OBSERVATIONS,
} from './domain/observation.js';
export { parseDecisionProposal } from './domain/decision.js';
export type {
  ParseDecisionResult,
  ParsedDecision,
  ParsedDecisionFailure,
} from './domain/decision.js';
export { validateDecision, allowedCapabilitiesForStep } from './domain/decision-validation.js';
export type {
  DecisionValidationContext,
  DecisionValidationResult,
} from './domain/decision-validation.js';
export {
  checkLoopBudgets,
  detectLoop,
  fingerprintDecision,
  fingerprintAction,
  hashArguments,
} from './domain/loop-guard.js';
export type { LoopGuardState, GuardVerdict } from './domain/loop-guard.js';
export { buildDecisionContext, pickNextPendingStep } from './domain/adaptive-context.js';
export { AdaptiveEngine } from './domain/adaptive-engine.js';
export type { AdaptiveEngineDeps } from './domain/adaptive-engine.js';

// ── Application ──────────────────────────────────────────────────
export {
  AdaptiveLoopService,
  InMemoryAdaptiveRunStore,
} from './application/AdaptiveLoopService.js';
export type {
  AdaptiveLoopServiceOptions,
  AdaptiveRunInput,
  AdaptiveRunStatusDTO,
} from './application/AdaptiveLoopService.js';

// ── Infrastructure (adapters over the frozen estate) ─────────────
export { AIOrchestrationDecisionPort } from './infrastructure/AIOrchestrationDecisionPort.js';
export { InMemoryAdaptiveApprovalStore } from './infrastructure/InMemoryAdaptiveApprovalStore.js';
