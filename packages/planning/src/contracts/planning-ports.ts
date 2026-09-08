// ──────────────────────────────────────────────────────────────────
// VedMoulya — Autonomous Planning Intelligence: Ports
//
// The planner executes NO AI directly and re-implements NO routing,
// tool registry, permission chain, verification or recovery. Every
// capability flows through narrow ports:
//
//   PlannerAiPort         — the planner's ONLY way to request a plan
//                           PROPOSAL. Implemented over the frozen
//                           AIOrchestrationService, so proposals inherit
//                           ProviderRoutingAdvisor → RoutingEvidenceService
//                           → ExecutionHealthService → capability gates →
//                           retry/fallback → CostLedger. The planner never
//                           hard-codes a provider/model and never calls a
//                           provider SDK.
//   AgentToolRegistryPort — the AUTHORITATIVE tool registry (reused from
//                           @vedmoulya/agent-execution — the same port the
//                           execution engine consumes). The planner may only
//                           select tools this registry exposes.
//   AgentClockPort        — deterministic time for tests (reused).
//
// The AI output is UNTRUSTED INPUT: the proposal returned by PlannerAiPort
// is parsed + validated before it can ever become a plan (see
// domain/plan-proposal.ts). The port never executes anything.
// ──────────────────────────────────────────────────────────────────

import type { CapabilityType } from '@vedmoulya/ai';
import type { AgentToolRegistryPort } from '@vedmoulya/agent-execution';

// ── Planner AI proposal port ─────────────────────────────────────

export interface PlannerAiProposalInput {
  userId?: string;
  goal: string;
  objective: string;
  /** Capabilities the understanding already established (in FULL). */
  requiredCapabilities: CapabilityType[];
  /** Registry-exposed tool names ONLY (whitelisted before prompting). */
  availableTools: string[];
  /** Deterministic constraints the proposal must respect. */
  constraints: {
    maxSteps: number;
    autonomyLevel: string;
    allowToolUse: boolean;
  };
}

export interface PlannerAiProposalResult {
  /** The raw proposal text (expected JSON — treated as UNTRUSTED). */
  content?: string;
  provider?: string;
  model?: string;
  tokens?: { input: number; output: number; total: number };
  costUsd?: number;
  latencyMs?: number;
  /** Evidence-first abstention from the runtime — never fabricated. */
  abstained?: boolean;
  /** Runtime-level error (the port may also throw provider errors). */
  error?: string;
}

/**
 * The single AI boundary for planning. `propose` asks the runtime-backed
 * model for a plan PROPOSAL; the planner validates everything it returns.
 * `canRoute` is a pure feasibility query used by readiness (same shape as
 * the execution engine's AgentAiExecutionPort.canRoute — the planner never
 * executes).
 */
export interface PlannerAiPort {
  propose(input: PlannerAiProposalInput): Promise<PlannerAiProposalResult>;
  canRoute?(input: {
    capability: CapabilityType;
    requiredCapabilities?: CapabilityType[];
  }): Promise<{ ok: boolean; reason?: string }>;
}

// ── Reused ports (no duplicate abstractions) ─────────────────────
export type { AgentToolRegistryPort };
export type { AgentClockPort } from '@vedmoulya/agent-execution';
