// ──────────────────────────────────────────────────────────────────
// VedMoulya — Adaptive Agent Loop: Ports
//
// The adaptive loop executes NO AI directly and re-implements NO
// routing, tool registry, permission chain, verification, recovery or
// budget system. Every capability flows through narrow ports:
//
//   AgentDecisionModelPort — the model's ONLY way to propose a decision.
//     Implemented over the frozen AIOrchestrationService, so decisions
//     inherit ProviderRoutingAdvisor → RoutingEvidenceService →
//     ExecutionHealthService → capability gates → retry/fallback →
//     CostLedger. The model never hard-codes a provider/model and never
//     calls a provider SDK.
//   AgentAiExecutionPort  — AI_ACTION execution (frozen port; production
//     implementation is AIOrchestrationAgentPort → AIOrchestrationService).
//   AgentToolExecutionPort + AgentToolRegistryPort — TOOL_CALL execution
//     (frozen ports; production implementation is ToolRegistryAgentPort →
//     ToolRuntime security chain). Permission is enforced THERE.
//   AdaptivePlannerPort   — bounded REPLAN through the frozen planning
//     boundary (PlannerService). A replan is a NEW PROPOSAL, never a new
//     authority level.
//   AdaptiveApprovalStore — explicit, recorded human approval. The model
//     can never approve itself.
//   AgentClockPort        — deterministic time (frozen).
//
// The model's decision output is UNTRUSTED INPUT: it is parsed with a
// whitelist (domain/decision.ts) and validated (domain/decision-validation.ts)
// before any action proposal can exist.
// ──────────────────────────────────────────────────────────────────

import type { CapabilityType } from '@vedmoulya/ai';
import type {
  AgentAiActionInput,
  AgentAiActionResult,
  AgentAiExecutionPort,
  AgentClockPort,
  AgentPlan,
  AgentToolExecutionPort,
  AgentToolRegistryPort,
  PlanValidationIssue,
  VerificationVerdict,
} from '@vedmoulya/agent-execution';
import type { PlanReadiness } from '@vedmoulya/planning';
import type { AdaptiveDecisionKind, AdaptiveRunUsage } from '../types/adaptive-loop-types.js';

// ── Decision model port (PHASE 5) ─────────────────────────────────

export interface DecisionContext {
  userId?: string;
  goal: string;
  goalId: string;
  planId: string;
  /** Current step (sanitized view — objective + capability only). */
  currentStep?: {
    stepId: string;
    objective: string;
    capability?: string;
    requiredCapabilities?: string[];
  };
  /** Bounded, sanitized recent observations (structured summaries). */
  recentObservations: Array<{
    observationId: string;
    actionId: string;
    stepId: string;
    status: string;
    resultSummary: string;
  }>;
  /** Tools the principal is authorized to use (registry + constraints). */
  availableTools: string[];
  /** Capabilities already allowed by the goal/plan/step. */
  allowedCapabilities: CapabilityType[];
  /** Remaining budget (bounded view). */
  remainingBudget: {
    actions: number;
    toolCalls: number;
    tokens: number;
    costUsd: number;
    decisionIterations: number;
  };
  /** Verification state of the current step. */
  verificationState: VerificationVerdict | 'PENDING';
  /** Bounded recovery state. */
  recoveryState: {
    attempts: number;
    revisions: number;
    replans: number;
    abstains: number;
  };
  /** Allowed decision kinds (already narrowed by the loop). */
  allowedDecisionKinds: AdaptiveDecisionKind[];
}

export interface DecisionProposalResult {
  /** Raw decision text (expected JSON — treated as UNTRUSTED). */
  content?: string;
  provider?: string;
  model?: string;
  tokens?: { input: number; output: number; total: number };
  costUsd?: number;
  latencyMs?: number;
  /** Evidence-first abstention from the runtime. */
  abstained?: boolean;
  /** Runtime-level error. */
  error?: string;
}

export interface AgentDecisionModelPort {
  decide(input: DecisionContext): Promise<DecisionProposalResult>;
}

// ── Replan port (PHASE 13) ────────────────────────────────────────

export interface AdaptiveReplanInput {
  userId?: string;
  goal: string;
  /** Preserved authority: capabilities + constraints from the ORIGINAL run. */
  allowedCapabilities: CapabilityType[];
  allowedTools: string[];
  grantedPermissionClasses: string[];
  autonomyLevel: string;
  budget: Record<string, unknown>;
  /** The bounded reason the decision model gave. */
  replanReason?: string;
}

export interface AdaptiveReplanResult {
  plan?: AgentPlan;
  readiness: PlanReadiness;
  issues: PlanValidationIssue[];
}

export interface AdaptivePlannerPort {
  replan(input: AdaptiveReplanInput): Promise<AdaptiveReplanResult>;
}

// ── Approval (PHASE 15) ───────────────────────────────────────────

export interface AdaptiveApprovalStore {
  request(input: {
    runId: string;
    proposalId: string;
    decisionId: string;
    stepId: string;
    reason: string;
    requestedAt: string;
  }): void;
  approve(runId: string, proposalId: string, actor: string): boolean;
  reject(runId: string, proposalId: string, actor: string): boolean;
  /** Requests still awaiting an explicit human decision. */
  pending(runId: string): Array<{
    proposalId: string;
    decisionId: string;
    stepId: string;
    reason: string;
    requestedAt: string;
  }>;
  /** The recorded decision for a proposal, if a human has decided it. */
  decision(
    runId: string,
    proposalId: string,
  ): { decision: 'approved' | 'rejected'; actor: string } | undefined;
}

// ── Reused frozen ports (no duplicate abstractions) ───────────────
export type { AgentAiExecutionPort, AgentToolExecutionPort, AgentToolRegistryPort, AgentClockPort };
export type { AgentAiActionInput, AgentAiActionResult };

// ── Run persistence (resume-after-approval) ───────────────────────

export interface AdaptiveRunStore {
  save(run: import('../types/adaptive-loop-types.js').AdaptiveRun): void;
  get(runId: string): import('../types/adaptive-loop-types.js').AdaptiveRun | undefined;
  list(ownerId?: string): import('../types/adaptive-loop-types.js').AdaptiveRun[];
}

// ── Run usage callback (observability seam) ───────────────────────

export interface AdaptiveRunObserver {
  onDecision?(record: unknown, usage: AdaptiveRunUsage): void;
}
