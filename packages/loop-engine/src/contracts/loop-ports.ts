// ──────────────────────────────────────────────────────────────────
// VedMoulya — Orchestrated AI Loop Engine: Ports
// EPIC-006 — Orchestrated AI / Loop Engine
// The loop engine executes NO AI directly. Every specialist call goes
// through the SpecialistExecutionPort — implemented in the gateway by
// an adapter over the frozen AIOrchestrationService (AI-SELECT / EI-002 /
// EI-004 / EI-003 / Evidence-First). Tools go through ToolExecutionPort
// (adapter over the frozen ToolRuntime). This preserves the invariant:
// business orchestration never calls provider SDKs.
// ──────────────────────────────────────────────────────────────────

import type { CapabilityType, QualityTier } from '@vedmoulya/ai';
import type { EvidenceState } from '@vedmoulya/services';

// ── Specialist Execution (Phase 3) ──────────────────────────────────────────

export interface SpecialistExecutionInput {
  taskId: string;
  capability: CapabilityType;
  qualityTier: QualityTier;
  /** The composed task prompt. */
  userInput: string;
  systemPrompt?: string;
  context?: {
    knowledgeContext?: string;
    executionContext?: string;
  };
  constraints?: {
    maxInputTokens?: number;
    maxOutputTokens?: number;
    maxCost?: number;
    maxLatencyMs?: number;
  };
  /** Evidence-First: forwarded to the runtime's RAG + grounding contract. */
  ragQuery?: { collection: string; query: string; topK?: number };
  groundingRequired?: boolean;
  /** EI-003 input optimization (always on for loop tasks). */
  enableOptimization?: boolean;
  structuredSchema?: Record<string, unknown>;
  userId?: string;
}

export interface SpecialistExecutionResult {
  content: string;
  provider: string;
  model: string;
  tokens: { input: number; output: number; total: number };
  costUsd: number;
  latencyMs: number;
  /** True when the runtime abstained (Evidence-First, no fabrication). */
  abstained: boolean;
  evidenceState?: EvidenceState;
  /** Human-readable AI-SELECT explanation. */
  selectionExplanation?: string;
  validationDecision?: string;
  error?: string;
}

/**
 * The ONLY way the loop engine talks to an AI provider. Implemented by the
 * gateway as an adapter over AIOrchestrationService — the loop never calls
 * provider SDKs and never re-implements routing.
 */
export interface SpecialistExecutionPort {
  execute(input: SpecialistExecutionInput): Promise<SpecialistExecutionResult>;
  /**
   * Phase 3: pure decision query — WHO should perform this task? Consumed by
   * the trace so every specialist choice is explainable before execution.
   * Implementations delegate to the runtime's explainSelection.
   */
  explain?(input: {
    capability: CapabilityType;
    estimatedInputTokens?: number;
  }): Promise<{ providerId: string; modelId: string; reasons: string[]; strategy: string }>;
}

// ── RAG (Phase 6) — reuse the frozen RagRetrievalPort shape ─────────────────

export interface RagSearchResult {
  title: string;
  content: string;
  score: number;
  source?: string;
}

export interface RagSearchPort {
  search(input: {
    userId: string;
    query: string;
    collection: string;
    topK?: number;
  }): Promise<{ results: RagSearchResult[] }>;
}

// ── Tools (Phase 10) — reuse the frozen ToolRuntime security chain ──────────

export interface ToolExecutionPort {
  execute(input: {
    toolName: string;
    arguments: Record<string, unknown>;
    userId: string;
  }): Promise<{
    ok: boolean;
    denied: boolean;
    outcome: string;
    error?: string;
    latencyMs: number;
  }>;
  /** Tools allowed on this platform (from the registry). */
  listAllowed(): string[];
}

// ── Clock — deterministic time for tests ────────────────────────────────────

export interface ClockPort {
  now(): string;
  timestampMs(): number;
  /** Await a delay (system clock sleeps for real; fake clocks resolve instantly). */
  sleep(ms: number): Promise<void>;
}

// ── Loop engine ports bundle ────────────────────────────────────────────────

export interface LoopEnginePorts {
  specialist: SpecialistExecutionPort;
  rag?: RagSearchPort;
  tools?: ToolExecutionPort;
  clock: ClockPort;
  /** Optional hooks for live progress checkpoints (async runs). */
  onStep?: (step: {
    runId: string;
    userId: string;
    step: import('../types/loop-types.js').LoopTraceStep;
  }) => void;
  onRunUpdated?: (run: import('../types/loop-types.js').LoopRun) => void;
}
