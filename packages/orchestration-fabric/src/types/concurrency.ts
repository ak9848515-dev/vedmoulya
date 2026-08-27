// ──────────────────────────────────────────────────────────────────
// VedMoulya — Orchestration Fabric: Concurrency Controller
// SPRINT-093 — Intelligent Request Queuing + Concurrency Control
//
// The ConcurrencyController controls WORK concurrency, NOT database
// connections. It ensures:
// - Interactive work has bounded high concurrency
// - Autonomous work has bounded concurrency
// - Background intelligence has lower bounded concurrency
// - Provider-specific work respects ProviderRouter limits
// - Database work stays within DatabaseManager limits
//
// The critical principle:
//   "pool size = task concurrency" is WRONG.
//   Logical concurrency can be much greater than physical DB connections.
// ──────────────────────────────────────────────────────────────────

import type { WorkType } from './work-item.js';

// ── Concurrency Policy ────────────────────────────────────────────────────

export interface ConcurrencyPolicy {
  /** Name of this policy. */
  name: string;

  /** Which work types this policy applies to. */
  appliesTo: WorkType[];

  /** Maximum concurrent work items for this policy. */
  maxConcurrency: number;

  /** Maximum concurrent work items per user. */
  maxConcurrencyPerUser: number;

  /** Maximum concurrent AI provider calls. */
  maxAiConcurrency: number;

  /** Maximum concurrent database queries. */
  maxDbConcurrency: number;

  /** Whether to allow work stealing (take from lower priority when idle). */
  allowWorkStealing: boolean;

  /** Minimum guaranteed concurrency (prevents starvation). */
  minGuaranteedConcurrency: number;
}

// ── Predefined Concurrency Policies ───────────────────────────────────────

export const CONCURRENCY_POLICIES: Record<string, ConcurrencyPolicy> = {
  interactive: {
    name: 'interactive',
    appliesTo: ['ai_inference', 'ai_generation', 'multi_step_task', 'content_generation'],
    maxConcurrency: 20,
    maxConcurrencyPerUser: 5,
    maxAiConcurrency: 10,
    maxDbConcurrency: 8,
    allowWorkStealing: false,
    minGuaranteedConcurrency: 5,
  },
  autonomous: {
    name: 'autonomous',
    appliesTo: ['discovery', 'intelligence', 'engine_workflow'],
    maxConcurrency: 10,
    maxConcurrencyPerUser: 3,
    maxAiConcurrency: 5,
    maxDbConcurrency: 4,
    allowWorkStealing: true,
    minGuaranteedConcurrency: 2,
  },
  background: {
    name: 'background',
    appliesTo: ['maintenance', 'knowledge_retrieval', 'memory_operation'],
    maxConcurrency: 5,
    maxConcurrencyPerUser: 2,
    maxAiConcurrency: 2,
    maxDbConcurrency: 3,
    allowWorkStealing: true,
    minGuaranteedConcurrency: 1,
  },
  ai_intensive: {
    name: 'ai_intensive',
    appliesTo: ['ai_embedding', 'ai_evaluation', 'factory_execution'],
    maxConcurrency: 8,
    maxConcurrencyPerUser: 2,
    maxAiConcurrency: 8,
    maxDbConcurrency: 4,
    allowWorkStealing: false,
    minGuaranteedConcurrency: 2,
  },
};

// ── Concurrency Snapshot ──────────────────────────────────────────────────

export interface ConcurrencySnapshot {
  /** Total active work items. */
  activeCount: number;

  /** Active work items per policy. */
  activeByPolicy: Record<string, number>;

  /** Active work items per user. */
  activeByUser: Record<string, number>;

  /** Active AI provider calls. */
  activeAiCalls: number;

  /** Active database queries (from DatabaseManager). */
  activeDbQueries: number;

  /** Peak concurrency observed since startup. */
  peakConcurrency: number;

  /** Total work items dispatched since startup. */
  totalDispatched: number;

  /** Total work items that waited for concurrency. */
  totalWaited: number;

  /** Average wait time in ms. */
  averageWaitTimeMs: number;

  /** Timestamp of this snapshot. */
  snapshotAt: string;
}

// ── Concurrency Gate Result ───────────────────────────────────────────────

export interface ConcurrencyGateResult {
  /** Whether the work item can be dispatched now. */
  canDispatch: boolean;

  /** Reason if cannot dispatch. */
  reason?: string;

  /** How long to wait before retrying (ms). */
  waitMs?: number;

  /** Which policy is limiting. */
  limitingPolicy?: string;

  /** Current load on the limiting resource. */
  currentLoad?: number;

  /** Max capacity of the limiting resource. */
  maxCapacity?: number;
}

// ── Provider Concurrency ──────────────────────────────────────────────────

/**
 * Per-provider concurrency limits. The ConcurrencyController tracks
 * these and routes around saturated providers.
 */
export interface ProviderConcurrencyLimits {
  /** Provider name. */
  providerName: string;

  /** Maximum concurrent requests to this provider. */
  maxConcurrent: number;

  /** Current active requests. */
  currentActive: number;

  /** Maximum requests per minute. */
  maxPerMinute: number;

  /** Requests in the last minute. */
  currentPerMinute: number;

  /** Whether the provider is considered saturated. */
  isSaturated: boolean;

  /** Saturation threshold (0-1). When currentActive/maxConcurrent >= threshold. */
  saturationThreshold: number;
}
