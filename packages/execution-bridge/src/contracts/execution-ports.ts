// ──────────────────────────────────────────────────────────────────
// VedMoulya — Execution Bridge: Ports
// EPIC-014 — narrow seams ONLY. The provider execution is delegated to
// the gateway's SpecialistExecutionPort adapter (frozen AI runtime);
// the budget is a thin wrapper over the frozen LoopBudget. No new
// provider SDKs, no duplicate routing, no fake adapters.
// ──────────────────────────────────────────────────────────────────

import type { ExecutionPreferenceEvent } from '../types/execution-types.js';
import type { ExecutionRun } from '../types/execution-types.js';

// ── Clock (same shape as @vedmoulya/loop-engine ClockPort so the
//    frozen SystemClock can be injected directly) ───────────────────
export interface ClockPort {
  now(): string;
  timestampMs(): number;
  sleep(ms: number): Promise<void>;
}

// ── Step execution (Phase 1/2) ─────────────────────────────────────
export interface StepExecutionInput {
  stepId: string;
  /** EPIC-013 capability id (e.g. TEXT_GENERATION). */
  capability: string;
  /** Mapped runtime capability (@vedmoulya/ai CapabilityType). */
  runtimeCapability: string;
  /** The step instruction composed from title + purpose. */
  instruction: string;
  userId: string;
  expectedOutputTokens?: number;
  expectedCostUsd?: number;
}

export interface StepExecutionResult {
  ok: boolean;
  content?: string;
  provider?: string;
  model?: string;
  tokens?: { input: number; output: number; total: number };
  costUsd?: number;
  latencyMs?: number;
  /** True when the runtime abstained (evidence-first — not a success). */
  abstained?: boolean;
  /** Runtime structured-output validation decision when reported. */
  validationDecision?: string;
  error?: string;
}

/**
 * The ONLY way an executable step talks to a provider/tool. Implemented
 * by the gateway over the frozen AIOrchestratorSpecialistPort. A port
 * reports honest availability: an unmapped capability or an unconfigured
 * provider returns available:false with a reason (never a fake call).
 */
export interface StepExecutionPort {
  execute(input: StepExecutionInput): Promise<StepExecutionResult>;
  /** Honest pre-flight: can this port execute the capability right now? */
  availability(
    capability: string,
    runtimeCapability: string,
  ): {
    available: boolean;
    reason?: string;
  };
}

// ── Preference ledger (Phase 5) ────────────────────────────────────
export interface PreferenceLedgerPort {
  record(event: Omit<ExecutionPreferenceEvent, 'eventId' | 'timestamp'>): ExecutionPreferenceEvent;
  list(executionId?: string): ExecutionPreferenceEvent[];
}

// ── Run store (owner-scoped) ───────────────────────────────────────
export interface ExecutionRunStore {
  save(run: ExecutionRun): void;
  get(executionId: string): ExecutionRun | undefined;
  list(ownerId: string): ExecutionRun[];
}

// ── Execution budget (fail-closed over the frozen LoopBudget) ──────
export interface ExecutionBudgetConfig {
  maxIterations: number;
  maxTokens: number;
  maxCostUsd: number;
  maxLatencyMs: number;
}
