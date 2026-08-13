// ──────────────────────────────────────────────────────────────────
// VedMoulya — Scheduler: RunBudgetGuard
// EPIC-018 — Phase 3 bounded execution.
//
// NOT a second budget engine: every hard limit maps 1:1 onto the
// frozen @vedmoulya/loop-engine LoopBudget, checked BEFORE the next
// discovery/source call (fail-closed — a scheduled run can never
// become an infinite crawler):
//
//   maxRuntimeMs      → LoopBudget maxLatencyMs  (wall clock)
//   maxDiscoveryCalls → LoopBudget maxIterations
//   maxSourceCalls    → LoopBudget maxProviderCalls
//   maxTokens         → LoopBudget maxTokens
//   maxCostUsd        → LoopBudget maxCostUsd
// ──────────────────────────────────────────────────────────────────

import { LoopBudget } from '@vedmoulya/loop-engine';
import type { SchedulerBudgetSnapshot, SchedulerRunLimits } from '../types/scheduler-types.js';

export class RunBudgetGuard {
  private readonly budget: LoopBudget;
  private readonly nowMs: () => number;
  private readonly startMs: number;
  private exceeded = false;
  private failureReason?: string;

  constructor(limits: SchedulerRunLimits, nowMs: () => number) {
    this.nowMs = nowMs;
    this.startMs = nowMs();
    this.budget = new LoopBudget({
      maxIterations: limits.maxDiscoveryCalls,
      maxTokens: limits.maxTokens,
      maxCostUsd: limits.maxCostUsd,
      maxLatencyMs: limits.maxRuntimeMs,
      maxProviderCalls: limits.maxSourceCalls,
      maxToolCalls: 0,
    });
  }

  /** Pre-call guard: may we run another discovery pass? Fail-closed. */
  canDiscover(): { ok: boolean; reason?: string } {
    const wallMs = this.nowMs() - this.startMs;
    if (wallMs > this.budget.config.maxLatencyMs) {
      this.fail(
        'TIMEOUT',
        `wall-clock budget exceeded (${String(wallMs)}ms > ${String(this.budget.config.maxLatencyMs)}ms)`,
      );
      return { ok: false, reason: this.failureReason };
    }
    const iteration = this.budget.canStartIteration(wallMs);
    if (!iteration.ok) {
      this.fail(
        iteration.reason ?? 'ITERATION_LIMIT',
        iteration.detail ?? 'discovery-call limit reached',
      );
      return { ok: false, reason: this.failureReason };
    }
    return { ok: true };
  }

  /** Pre-call guard: may we make another source call? Fail-closed. */
  canCallSource(): { ok: boolean; reason?: string } {
    const check = this.budget.canCallProvider(0, 0);
    if (!check.ok) {
      this.fail('BUDGET_EXCEEDED', check.detail ?? 'source-call limit reached');
      return { ok: false, reason: this.failureReason };
    }
    return { ok: true };
  }

  /** Record one discovery pass started. */
  recordDiscoveryCall(): void {
    this.budget.recordIteration();
  }

  /** Record one completed source call (latency accounting). */
  recordSourceCall(latencyMs: number): void {
    this.budget.recordSpecialist({
      tokens: { input: 0, output: 0, total: 0 },
      costUsd: 0,
      latencyMs,
    });
    const post = this.budget.exceededAfter();
    if (!post.ok) {
      this.fail('BUDGET_EXCEEDED', post.detail ?? 'cumulative budget exceeded');
    }
  }

  /** Elapsed wall-clock time since the guard was constructed. */
  elapsedMs(): number {
    return this.nowMs() - this.startMs;
  }

  snapshot(): SchedulerBudgetSnapshot {
    const usage = this.budget.snapshot();
    return {
      spentTokens: usage.tokensTotal,
      spentCostUsd: Number(usage.costUsd.toFixed(6)),
      spentLatencyMs: usage.latencyMs,
      discoveryCalls: usage.iterations,
      sourceCalls: usage.providerCalls,
      exceeded: this.exceeded,
      failureReason: this.failureReason,
    };
  }

  private fail(reason: string, detail: string): void {
    if (this.exceeded) return;
    this.exceeded = true;
    this.failureReason = `${reason}: ${detail}`;
  }
}
