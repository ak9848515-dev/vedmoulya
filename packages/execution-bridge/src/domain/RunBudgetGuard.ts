// ──────────────────────────────────────────────────────────────────
// VedMoulya — Execution Bridge: Run Budget Guard (PHASE 4)
// EPIC-014 — reuses the frozen @vedmoulya/loop-engine LoopBudget for
// the hard limits (maxIterations / maxTokens / maxCostUsd /
// maxLatencyMs). Checks are made BEFORE every provider call; a budget
// failure is fail-closed (BLOCKED, never silently exceeded, never an
// endless retry).
// ──────────────────────────────────────────────────────────────────

import { LoopBudget } from '@vedmoulya/loop-engine';
import type { ExecutionBudget } from '../types/execution-types.js';
import type { ExecutionBudgetConfig } from '../contracts/execution-ports.js';

/** Partial usage carried across resume passes (seeded into the LoopBudget). */
export interface RunBudgetSeed {
  iterations?: number;
  providerCalls?: number;
  tokensTotal?: number;
  costUsd?: number;
  latencyMs?: number;
}

export class RunBudgetGuard {
  private readonly budget: LoopBudget;
  private readonly config: ExecutionBudgetConfig;
  private readonly nowMs: () => number;
  private exceeded = false;
  private failureReason?: string;
  private readonly startMs: number;

  constructor(config: ExecutionBudgetConfig, nowMs: () => number, seed: RunBudgetSeed = {}) {
    this.config = config;
    this.nowMs = nowMs;
    this.budget = new LoopBudget(
      {
        maxIterations: config.maxIterations,
        maxTokens: config.maxTokens,
        maxCostUsd: config.maxCostUsd,
        maxLatencyMs: config.maxLatencyMs,
        maxProviderCalls: config.maxIterations * 4,
        maxToolCalls: 0,
      },
      {
        iterations: seed.iterations ?? 0,
        providerCalls: seed.providerCalls ?? 0,
        tokensInput: 0,
        tokensOutput: 0,
        tokensTotal: seed.tokensTotal ?? 0,
        costUsd: seed.costUsd ?? 0,
        latencyMs: seed.latencyMs ?? 0,
        toolCalls: 0,
      },
    );
    this.startMs = nowMs();
  }

  /** Count one provider-call attempt (bounded by maxIterations — fail-closed). */
  beginIteration(): void {
    this.budget.recordIteration();
  }

  /** Pre-call guard: may we make another provider call? Fail-closed. */
  canExecute(expectedTokens?: number, expectedCostUsd?: number): { ok: boolean; reason?: string } {
    const wallMs = this.nowMs() - this.startMs;
    if (wallMs > this.config.maxLatencyMs) {
      this.fail(
        'TIMEOUT',
        `wall-clock budget exceeded (${String(wallMs)}ms > ${String(this.config.maxLatencyMs)}ms)`,
      );
      return { ok: false, reason: this.failureReason };
    }
    const iteration = this.budget.canStartIteration(wallMs);
    if (!iteration.ok) {
      this.fail(
        iteration.reason ?? 'ITERATION_LIMIT',
        iteration.detail ?? 'iteration limit reached',
      );
      return { ok: false, reason: this.failureReason };
    }
    const check = this.budget.canCallProvider(expectedTokens, expectedCostUsd);
    if (!check.ok) {
      this.fail('BUDGET_EXCEEDED', check.detail ?? 'budget limit would be exceeded');
      return { ok: false, reason: this.failureReason };
    }
    return { ok: true };
  }

  /** Record one completed provider execution. */
  record(accounting: { tokens: number; costUsd: number; latencyMs: number }): void {
    this.budget.recordSpecialist({
      tokens: { input: 0, output: 0, total: accounting.tokens },
      costUsd: accounting.costUsd,
      latencyMs: accounting.latencyMs,
    });
    const post = this.budget.exceededAfter();
    if (!post.ok) {
      this.fail('BUDGET_EXCEEDED', post.detail ?? 'cumulative budget exceeded');
    }
  }

  snapshot(): ExecutionBudget {
    const usage = this.budget.snapshot();
    return {
      maxIterations: this.config.maxIterations,
      maxTokens: this.config.maxTokens,
      maxCostUsd: this.config.maxCostUsd,
      maxLatencyMs: this.config.maxLatencyMs,
      spentTokens: usage.tokensTotal,
      spentCostUsd: Number(usage.costUsd.toFixed(6)),
      spentLatencyMs: usage.latencyMs,
      iterations: usage.iterations,
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
