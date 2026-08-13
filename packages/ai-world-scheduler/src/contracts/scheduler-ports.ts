// ──────────────────────────────────────────────────────────────────
// VedMoulya — @vedmoulya/ai-world-scheduler — Scheduler Ports
// EPIC-018
//
// The ONLY seams the scheduler uses to reach the frozen estate:
//   • SchedulerDiscoveryPort — EPIC-012C AI World (the EXISTING
//     DiscoveryOrchestrator + DiscoveryStore — one discovery database).
//   • SchedulerBrainPort      — the intelligence/relevance seam. The
//     scheduler never makes user decisions; it asks and records the
//     verdict. The gateway adapter reuses the EXISTING relevance
//     engine (the same deterministic RelevanceScorer the discovery
//     pipeline and the Brain's candidate seam consume) — no second
//     intelligence engine.
//   • SchedulerNotifyPort     — the EXISTING relevance-gated
//     notification surface (EPIC-015 notify — the same adapter
//     EPIC-017's BridgeAiWorldPort uses). No second notification
//     system.
//
// Adapters live at the gateway (deterministic in CI); the scheduler
// package itself stays pure.
// ──────────────────────────────────────────────────────────────────

import type { DiscoveryBudget, DiscoveryItem } from '@vedmoulya/ai-world';
import type {
  DiscoveryCooldown,
  DiscoveryJob,
  DiscoveryResult,
  DiscoveryRun,
  DiscoveryRunLedger,
  DiscoverySchedule,
  DiscoverySourcePolicy,
  SchedulerRelevanceVerdict,
} from '../types/scheduler-types.js';

// ── Clock (same shape as the platform ClockPort) ──────────────────
export interface SchedulerClockPort {
  now(): string;
  timestampMs(): number;
}

// ── AI World discovery (EPIC-012C REUSE — never a second engine) ───
export interface SchedulerDiscoveryPort {
  /**
   * Run ONE bounded discovery pass through the EXISTING AI World
   * pipeline (orchestrator budgets, SecurityScanner, normalizer,
   * deduplicator, existing store), restricted to the given eligible
   * sources. Returns the raw result; items are already stored by the
   * orchestrator. Sources may return items of any category — the
   * scheduler's ChangeDetector filters by the job's itemCategories.
   */
  discover(request: { budget: DiscoveryBudget; sourceIds: string[] }): Promise<DiscoveryResult>;
  /** Known source ids (so the scheduler can apply per-source policy gates). */
  listSourceIds(): string[];
  /** Current items in the EXISTING AI World store (change baseline). */
  listStoredItems(): Promise<DiscoveryItem[]>;
}

// ── Intelligence / relevance (Phase 7 — Brain seam) ────────────────
export interface SchedulerBrainPort {
  /**
   * Evaluate whether a discovered change is relevant to this user.
   * The scheduler SURFACES only what the verdict says is relevant —
   * it never decides alone, and it never acts (approval stays in the
   * existing EPIC-014/017 surfaces).
   */
  evaluateRelevance(userId: string, item: DiscoveryItem): SchedulerRelevanceVerdict;
}

// ── Notifications (Phase 8 — EXISTING surface reuse) ───────────────
export interface SchedulerNotifyPort {
  /**
   * Emit one relevance-gated notification through the EXISTING
   * notification surface. Honest result — dropped (with reason) or
   * emitted. The scheduler additionally enforces its own
   * item-level cooldowns/deduplication.
   */
  notify(
    userId: string,
    event: {
      item: DiscoveryItem;
      change: 'NEW' | 'UPDATED' | 'REMOVED' | 'CRITICAL_CHANGE';
    },
  ): { emitted: boolean; reason?: string } | Promise<{ emitted: boolean; reason?: string }>;
}

// ── Stores (owner-scoped convention; synchronous in-memory) ────────

export interface ScheduleStore {
  save(schedule: DiscoverySchedule): void;
  get(userId: string, jobCategory: string): DiscoverySchedule | undefined;
  list(userId: string): DiscoverySchedule[];
}

export interface JobStore {
  save(job: DiscoveryJob): void;
  get(userId: string, jobCategory: string): DiscoveryJob | undefined;
  list(userId: string): DiscoveryJob[];
}

export interface RunStore {
  save(run: DiscoveryRun): void;
  get(userId: string, runId: string): DiscoveryRun | undefined;
  list(userId: string): DiscoveryRun[];
  /** Append-only, bounded ledger (FIFO retention). */
  ledger(userId: string): DiscoveryRunLedger;
}

export interface SourcePolicyStore {
  get(sourceId: string): DiscoverySourcePolicy | undefined;
  save(policy: DiscoverySourcePolicy): void;
  list(): DiscoverySourcePolicy[];
}

export interface CooldownStore {
  get(userId: string, key: string): DiscoveryCooldown | undefined;
  save(cooldown: DiscoveryCooldown): void;
}
