// ──────────────────────────────────────────────────────────────────
// VedMoulya — Orchestration Fabric: Concurrency Controller
// SPRINT-093 — Intelligent Request Queuing + Concurrency Control
//
// Controls WORK concurrency, NOT database connections.
//
// The critical principle:
//   "pool size = task concurrency" is WRONG.
//   100 logical work items → Orchestrator → parallel engine execution
//   → ProviderRouter → provider-specific limits → DatabaseManager →
//   database-specific limits
//
//   Logical concurrency can be much greater than physical DB connections.
//
// Three concurrency domains:
//   1. HTTP concurrency  — API/Gateway (fast reads stay fast)
//   2. WORK concurrency  — THIS controller (meaningful work units)
//   3. RESOURCE concurrency — DatabaseManager, ProviderRouter, Redis
// ──────────────────────────────────────────────────────────────────

import type { WorkItem, WorkType } from '../types/work-item.js';
import type {
  ConcurrencyPolicy,
  ConcurrencySnapshot,
  ConcurrencyGateResult,
  ProviderConcurrencyLimits,
} from '../types/concurrency.js';
import { CONCURRENCY_POLICIES } from '../types/concurrency.js';

export class ConcurrencyController {
  /** Active work items per policy. */
  private readonly activeByPolicy = new Map<string, number>();

  /** Active work items per user. */
  private readonly activeByUser = new Map<string, number>();

  /** Active work items per work type. */
  private readonly activeByType = new Map<string, number>();

  /** Active AI provider calls. */
  private activeAiCalls = 0;

  /** Peak concurrency observed. */
  private peakConcurrency = 0;

  /** Total dispatched. */
  private totalDispatched = 0;

  /** Total waited. */
  private totalWaited = 0;

  /** Wait time accumulator. */
  private totalWaitTimeMs = 0;

  /** Provider concurrency limits. */
  private readonly providerLimits = new Map<string, ProviderConcurrencyLimits>();

  /** Active work item IDs (for tracking). */
  private readonly activeWorkItems = new Set<string>();

  constructor() {
    // Initialize policy counters
    for (const policy of Object.values(CONCURRENCY_POLICIES)) {
      this.activeByPolicy.set(policy.name, 0);
    }
  }

  /**
   * Check if a work item can be dispatched now.
   * Returns a gate result indicating whether dispatch is allowed and why.
   */
  gate(workItem: WorkItem): ConcurrencyGateResult {
    const policy = this.findPolicy(workItem.workType);

    if (!policy) {
      // No specific policy — allow dispatch
      return { canDispatch: true };
    }

    // Check policy-level concurrency
    const policyActive = this.activeByPolicy.get(policy.name) ?? 0;
    if (policyActive >= policy.maxConcurrency) {
      return {
        canDispatch: false,
        reason: `Policy '${policy.name}' at max concurrency (${policyActive}/${policy.maxConcurrency})`,
        limitingPolicy: policy.name,
        currentLoad: policyActive,
        maxCapacity: policy.maxConcurrency,
        waitMs: 1000,
      };
    }

    // Check per-user concurrency
    const userActive = this.activeByUser.get(workItem.ownerUserId) ?? 0;
    if (userActive >= policy.maxConcurrencyPerUser) {
      return {
        canDispatch: false,
        reason: `User '${workItem.ownerUserId}' at max concurrency (${userActive}/${policy.maxConcurrencyPerUser})`,
        limitingPolicy: policy.name,
        currentLoad: userActive,
        maxCapacity: policy.maxConcurrencyPerUser,
        waitMs: 1000,
      };
    }

    // Check AI concurrency (for AI work types)
    if (this.isAiWork(workItem.workType)) {
      if (this.activeAiCalls >= policy.maxAiConcurrency) {
        return {
          canDispatch: false,
          reason: `AI concurrency at limit (${this.activeAiCalls}/${policy.maxAiConcurrency})`,
          limitingPolicy: policy.name,
          currentLoad: this.activeAiCalls,
          maxCapacity: policy.maxAiConcurrency,
          waitMs: 1000,
        };
      }
    }

    // Check provider saturation
    if (workItem.resources.aiCapability) {
      for (const pref of workItem.resources.preferredProviders ?? []) {
        const limits = this.providerLimits.get(pref);
        if (limits && limits.isSaturated) {
          return {
            canDispatch: false,
            reason: `Provider '${pref}' is saturated (${limits.currentActive}/${limits.maxConcurrent})`,
            limitingPolicy: policy.name,
            currentLoad: limits.currentActive,
            maxCapacity: limits.maxConcurrent,
            waitMs: 2000,
          };
        }
      }
    }

    return { canDispatch: true, limitingPolicy: policy.name };
  }

  /**
   * Dispatch a work item (increment counters).
   */
  dispatch(workItem: WorkItem): void {
    const policy = this.findPolicy(workItem.workType);
    if (policy) {
      this.activeByPolicy.set(policy.name, (this.activeByPolicy.get(policy.name) ?? 0) + 1);
    }

    this.activeByUser.set(
      workItem.ownerUserId,
      (this.activeByUser.get(workItem.ownerUserId) ?? 0) + 1,
    );

    this.activeByType.set(workItem.workType, (this.activeByType.get(workItem.workType) ?? 0) + 1);

    if (this.isAiWork(workItem.workType)) {
      this.activeAiCalls++;
    }

    this.activeWorkItems.add(workItem.id);
    this.totalDispatched++;

    const totalActive = this.activeWorkItems.size;
    if (totalActive > this.peakConcurrency) {
      this.peakConcurrency = totalActive;
    }
  }

  /**
   * Complete a work item (decrement counters).
   */
  complete(workItem: WorkItem): void {
    const policy = this.findPolicy(workItem.workType);
    if (policy) {
      const current = this.activeByPolicy.get(policy.name) ?? 0;
      this.activeByPolicy.set(policy.name, Math.max(0, current - 1));
    }

    const userActive = this.activeByUser.get(workItem.ownerUserId) ?? 0;
    this.activeByUser.set(workItem.ownerUserId, Math.max(0, userActive - 1));

    const typeActive = this.activeByType.get(workItem.workType) ?? 0;
    this.activeByType.set(workItem.workType, Math.max(0, typeActive - 1));

    if (this.isAiWork(workItem.workType)) {
      this.activeAiCalls = Math.max(0, this.activeAiCalls - 1);
    }

    this.activeWorkItems.delete(workItem.id);
  }

  /**
   * Record wait time (for observability).
   */
  recordWait(waitMs: number): void {
    this.totalWaited++;
    this.totalWaitTimeMs += waitMs;
  }

  /**
   * Update provider concurrency limits.
   */
  updateProviderLimits(limits: ProviderConcurrencyLimits): void {
    this.providerLimits.set(limits.providerName, {
      ...limits,
      isSaturated: limits.currentActive / limits.maxConcurrent >= limits.saturationThreshold,
    });
  }

  /**
   * Get the current concurrency snapshot.
   */
  getSnapshot(): ConcurrencySnapshot {
    const activeByPolicy: Record<string, number> = {};
    for (const [policy, count] of this.activeByPolicy) {
      activeByPolicy[policy] = count;
    }

    const activeByUser: Record<string, number> = {};
    for (const [user, count] of this.activeByUser) {
      if (count > 0) activeByUser[user] = count;
    }

    return {
      activeCount: this.activeWorkItems.size,
      activeByPolicy,
      activeByUser,
      activeAiCalls: this.activeAiCalls,
      activeDbQueries: 0, // Comes from DatabaseManager — this controller doesn't track it
      peakConcurrency: this.peakConcurrency,
      totalDispatched: this.totalDispatched,
      totalWaited: this.totalWaited,
      averageWaitTimeMs: this.totalWaited > 0 ? this.totalWaitTimeMs / this.totalWaited : 0,
      snapshotAt: new Date().toISOString(),
    };
  }

  /**
   * Get the number of currently active work items.
   */
  get activeCount(): number {
    return this.activeWorkItems.size;
  }

  /**
   * Check if a work item is currently active.
   */
  isActive(workItemId: string): boolean {
    return this.activeWorkItems.has(workItemId);
  }

  // ── Private Methods ─────────────────────────────────────────────────────

  private findPolicy(workType: WorkType): ConcurrencyPolicy | undefined {
    for (const policy of Object.values(CONCURRENCY_POLICIES)) {
      if (policy.appliesTo.includes(workType)) {
        return policy;
      }
    }
    return undefined;
  }

  private isAiWork(workType: WorkType): boolean {
    return ['ai_inference', 'ai_generation', 'ai_embedding', 'ai_evaluation'].includes(workType);
  }
}
