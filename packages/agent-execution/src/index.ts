// ──────────────────────────────────────────────────────────────────
// VedMoulya — @vedmoulya/agent-execution
// Agent Execution Intelligence (PLANNING + TOOL SELECTION + VERIFICATION
// + RECOVERY) — the controlled execution foundation between "choose an AI"
// and "accomplish a goal".
//
// The agent executes NO AI directly: AI actions flow through the AI
// execution port (routing-backed), tools through the tool port security
// chain, verification is deterministic-first, recovery is bounded and
// human approval gates are authoritative. No registries/routers/tool
// systems are re-implemented — every capability reuses the frozen estate.
// ──────────────────────────────────────────────────────────────────

// ── Types ────────────────────────────────────────────────────────
export type {
  AgentAutonomyLevel,
  ToolPermissionClass,
  AgentRunState,
  GoalOutcome,
  AgentActionSpec,
  AgentActionKind,
  AgentPlanStep,
  AgentPlan,
  VerificationVerdict,
  AgentRuleCheck,
  VerificationPolicy,
  VerificationCheckStatus,
  AgentVerificationCheck,
  AgentVerificationResult,
  AgentObservationStatus,
  AgentObservation,
  AgentArtifactRef,
  AgentActionRecord,
  FailureClass,
  RecoveryStrategyType,
  AgentRecoveryRecord,
  StepRecoveryPolicy,
  AgentRunBudgetConfig,
  AgentRunUsage,
  AgentApprovalReasonClass,
  AgentApprovalRequest,
  AgentApprovalDecision,
  AgentStepStatus,
  AgentStepResult,
  PlanValidationIssue,
  AgentExecutionRun,
  AgentTracePhase,
  AgentExecutionTraceRecord,
} from './types/agent-execution-types.js';
export {
  AGENT_AUTONOMY_LEVELS,
  TOOL_PERMISSION_CLASSES,
  TOOL_PERMISSION_RISK,
  HIGH_RISK_PERMISSION_CLASSES,
  AGENT_RUN_STATES,
  AGENT_TERMINAL_STATES,
  GOAL_OUTCOMES,
  VERIFICATION_VERDICTS,
  AGENT_STEP_STATUSES,
  DEFAULT_AGENT_RUN_BUDGET,
  EMPTY_AGENT_RUN_USAGE,
} from './types/agent-execution-types.js';

// ── Ports ────────────────────────────────────────────────────────
export type {
  AgentAiActionInput,
  AgentAiActionResult,
  AgentAiExecutionPort,
  AgentToolActionResult,
  AgentToolExecutionPort,
  AgentToolInfo,
  AgentToolRegistryPort,
  AgentModelVerifierPort,
  AgentClockPort,
  AgentExecutionRunStorePort,
} from './contracts/agent-execution-ports.js';

// ── Domain ───────────────────────────────────────────────────────
export { AgentExecutionEngine } from './domain/AgentExecutionEngine.js';
export type { AgentEnginePorts } from './domain/AgentExecutionEngine.js';
export { validatePlanStructure, validatePlanReadiness } from './domain/PlanValidator.js';
export type { ReadinessPorts } from './domain/PlanValidator.js';
export {
  approvalGateForStep,
  isHighRisk,
  awaitingDecisionForStep,
  ownsRun,
} from './domain/approval-policy.js';
export type { ApprovalGate } from './domain/approval-policy.js';
export { classifyFailure, decideRecovery } from './domain/recovery.js';
export type { StepAttemptFailure, RecoveryDecision } from './domain/recovery.js';
export { verifyAgainstPolicy, aggregateVerdict } from './domain/verification.js';
export type { VerificationContext, VerificationDeps } from './domain/verification.js';
export { buildExecutionTrace } from './domain/trace.js';
export { sanitizeTraceText, safeSlice } from './domain/sanitize.js';
export type { SanitizeOptions } from './domain/sanitize.js';

// ── Application + Infrastructure ─────────────────────────────────
export { AgentExecutionService } from './application/AgentExecutionService.js';
export type {
  AgentExecutionServiceOptions,
  StartAgentExecutionInput,
  AgentRunStatusDTO,
} from './application/AgentExecutionService.js';
export { InMemoryAgentExecutionStore } from './infrastructure/InMemoryAgentExecutionStore.js';
export { SystemClock } from './infrastructure/SystemClock.js';
export { AIOrchestrationAgentPort } from './infrastructure/AIOrchestrationAgentPort.js';
export { ToolRegistryAgentPort } from './infrastructure/ToolRegistryAgentPort.js';
