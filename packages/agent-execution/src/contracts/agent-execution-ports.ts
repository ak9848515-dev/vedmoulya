// ──────────────────────────────────────────────────────────────────
// VedMoulya — Agent Execution Intelligence: Ports
//
// The agent layer executes NO AI directly and re-implements NO routing,
// tool registry, permission chain, approval engine or budget ledger.
// Every capability flows through these narrow ports:
//
//   AiExecutionPort    — implemented over the frozen AI runtime
//                        (AIOrchestratorSpecialistPort → AIOrchestrationService
//                        → ProviderRoutingAdvisor / RoutingEvidenceService /
//                          ExecutionHealthService / capability gates / CostLedger).
//                        The agent asks "give me the best available model for
//                        this step"; the routing layer decides.
//   ToolExecutionPort  — implemented over the frozen ToolRuntime security chain
//                        (ToolRegistryToolPort / ToolRuntime). Permission is
//                        enforced there — this engine never bypasses a denial.
//   ToolRegistryPort   — authoritative tool metadata (availability + risk class)
//                        so the agent can gate/plan before executing.
//   ModelVerifierPort  — OPTIONAL model-based verification used ONLY when a
//                        deterministic policy is impossible.
//   ClockPort          — deterministic time for tests.
//   StorePort          — owner-scoped run persistence.
// ──────────────────────────────────────────────────────────────────

import type { CapabilityType, QualityTier } from '@vedmoulya/ai';
import type { ToolPermissionClass } from '../types/agent-execution-types.js';
import type { AgentExecutionRun } from '../types/agent-execution-types.js';

// ── AI execution (routing-backed) ─────────────────────────────────

export interface AgentAiActionInput {
  actionId: string;
  stepId: string;
  goalId: string;
  planId: string;
  userId?: string;
  /** Primary/routing capability (frozen taxonomy). */
  capability: CapabilityType;
  /**
   * ALL hard capability requirements. Forwarded in FULL so the routing layer
   * gates on every requirement — never collapsed to [capability].
   */
  requiredCapabilities?: CapabilityType[];
  qualityTier: QualityTier;
  /** The composed instruction (already substituted by the engine). */
  instruction: string;
  attempt: number;
  revision: number;
  fallbackExpected: boolean;
  expectedOutcome?: string;
  /** Summaries of earlier observations in this step (sliced, sanitized). */
  previousObservations?: string[];
}

export interface AgentAiActionResult {
  content?: string;
  provider?: string;
  model?: string;
  tokens?: { input: number; output: number; total: number };
  costUsd?: number;
  latencyMs?: number;
  /** Evidence-First abstention (runtime refused to fabricate). */
  abstained?: boolean;
  /** Runtime-level error (the port may also throw provider errors). */
  error?: string;
  selectionExplanation?: string;
}

export interface AgentAiExecutionPort {
  execute(input: AgentAiActionInput): Promise<AgentAiActionResult>;
  /**
   * Pure feasibility query used during plan validation: "can this step's
   * capability set be routed today?" Implementations delegate to the runtime
   * selection intelligence. Absent ⇒ feasibility is not checked up front
   * (execution-time failures still surface through bounded recovery).
   */
  canRoute?(input: {
    capability: CapabilityType;
    requiredCapabilities?: CapabilityType[];
  }): Promise<{ ok: boolean; reason?: string }>;
}

// ── Tool execution (permission enforced by the security chain) ─────

export interface AgentToolActionResult {
  ok: boolean;
  /** True when the tool security chain denied the call — never bypassed. */
  denied: boolean;
  outcome: string;
  artifacts?: Array<{ name: string; type: string }>;
  error?: string;
  latencyMs?: number;
}

export interface AgentToolExecutionPort {
  execute(input: {
    toolName: string;
    arguments: Record<string, unknown>;
    userId?: string;
  }): Promise<AgentToolActionResult>;
  /** Tools allowed on this platform (authoritative registry view). */
  listAllowed(): string[];
}

export interface AgentToolInfo {
  toolName: string;
  permissionClass: ToolPermissionClass;
  description?: string;
  requiresApproval?: boolean;
}

export interface AgentToolRegistryPort {
  listAllowed(): string[];
  describe(toolName: string): AgentToolInfo | undefined;
}

// ── Model-based verification (only when deterministic is impossible) ─

export interface AgentModelVerifierPort {
  verify(input: {
    stepId: string;
    output: string;
    criteria: string[];
    expectedOutcome?: string;
  }): Promise<{
    passed: boolean;
    checks: Array<{ name: string; passed: boolean; detail: string }>;
  }>;
}

// ── Clock + store ──────────────────────────────────────────────────

export interface AgentClockPort {
  now(): string;
  timestampMs(): number;
}

export interface AgentExecutionRunStorePort {
  save(run: AgentExecutionRun): void;
  get(runId: string): AgentExecutionRun | undefined;
  list(ownerId?: string): AgentExecutionRun[];
}
