// ──────────────────────────────────────────────────────────────────
// VedMoulya — Loop Engine: Budget Guard
// EPIC-006 — Phase 4 / Phase 8 / Phase 12. The loop is ALWAYS bounded:
//   - maximum iterations
//   - maximum token budget
//   - maximum cost
//   - maximum latency
//   - maximum provider calls
//   - maximum tool calls
// Every bound is checked BEFORE the next provider/tool call, so the
// loop terminates before exhaustion — never after. Token/cost/latency
// accounting comes from the frozen runtime's measured DTOs (EI-003
// optimization is active on every task).
// ──────────────────────────────────────────────────────────────────

import type { LoopBudgetConfig, LoopBudgetUsage, TerminationReason } from '../types/loop-types.js';
import { EMPTY_BUDGET_USAGE } from '../types/loop-types.js';

export interface BudgetCheckResult {
  ok: boolean;
  reason?: TerminationReason;
  detail?: string;
}

export interface SpecialistAccounting {
  tokens: { input: number; output: number; total: number };
  costUsd: number;
  latencyMs: number;
}

export class LoopBudget {
  readonly config: LoopBudgetConfig;
  private readonly usage: LoopBudgetUsage;

  constructor(config: LoopBudgetConfig, seed: LoopBudgetUsage = EMPTY_BUDGET_USAGE) {
    this.config = config;
    this.usage = { ...EMPTY_BUDGET_USAGE, ...seed };
  }

  snapshot(): LoopBudgetUsage {
    return { ...this.usage };
  }

  /** Record one completed specialist execution (provider call + tokens/cost/latency). */
  recordSpecialist(accounting: SpecialistAccounting): void {
    this.usage.providerCalls += 1;
    this.usage.tokensInput += Math.max(0, accounting.tokens.input);
    this.usage.tokensOutput += Math.max(0, accounting.tokens.output);
    this.usage.tokensTotal += Math.max(0, accounting.tokens.total);
    this.usage.costUsd += Math.max(0, accounting.costUsd);
    this.usage.latencyMs += Math.max(0, accounting.latencyMs);
  }

  /** Record one tool call (always counted, even when denied). */
  recordToolCall(): void {
    this.usage.toolCalls += 1;
  }

  /** Record the start of one iteration. */
  recordIteration(): void {
    this.usage.iterations += 1;
  }

  /** Record wall-clock latency for the run (overwrite cumulative time). */
  recordWallLatency(ms: number): void {
    this.usage.latencyMs = Math.max(this.usage.latencyMs, ms);
  }

  /**
   * Pre-execution guard: may the loop run another iteration? Checks the
   * iteration + wall-clock bounds only (tokens/cost/provider/tool are
   * checked immediately before each call).
   */
  canStartIteration(nowMs: number): BudgetCheckResult {
    if (this.usage.iterations >= this.config.maxIterations) {
      return {
        ok: false,
        reason: 'ITERATION_LIMIT',
        detail: `iteration limit reached (${String(this.usage.iterations)} >= ${String(this.config.maxIterations)})`,
      };
    }
    if (nowMs > this.config.maxLatencyMs) {
      return {
        ok: false,
        reason: 'TIMEOUT',
        detail: `wall-clock budget exceeded (${String(nowMs)}ms > ${String(this.config.maxLatencyMs)}ms)`,
      };
    }
    return { ok: true };
  }

  /** Pre-execution guard: may we make another provider (specialist) call? */
  canCallProvider(expectedTokens?: number, expectedCostUsd?: number): BudgetCheckResult {
    if (this.usage.providerCalls >= this.config.maxProviderCalls) {
      return {
        ok: false,
        reason: 'BUDGET_EXCEEDED',
        detail: `provider-call limit reached (${String(this.usage.providerCalls)} >= ${String(this.config.maxProviderCalls)})`,
      };
    }
    const projectedTokens = this.usage.tokensTotal + Math.max(0, expectedTokens ?? 0);
    if (projectedTokens > this.config.maxTokens) {
      return {
        ok: false,
        reason: 'BUDGET_EXCEEDED',
        detail: `token budget would be exceeded (${String(projectedTokens)} > ${String(this.config.maxTokens)})`,
      };
    }
    const projectedCost = this.usage.costUsd + Math.max(0, expectedCostUsd ?? 0);
    if (projectedCost > this.config.maxCostUsd) {
      return {
        ok: false,
        reason: 'BUDGET_EXCEEDED',
        detail: `cost budget would be exceeded ($${projectedCost.toFixed(6)} > $${String(this.config.maxCostUsd)})`,
      };
    }
    return { ok: true };
  }

  /** Pre-execution guard: may we make another tool call? */
  canCallTool(): BudgetCheckResult {
    if (this.usage.toolCalls >= this.config.maxToolCalls) {
      return {
        ok: false,
        reason: 'BUDGET_EXCEEDED',
        detail: `tool-call limit reached (${String(this.usage.toolCalls)} >= ${String(this.config.maxToolCalls)})`,
      };
    }
    return { ok: true };
  }

  /** Post-execution check: did any cumulative bound get breached? */
  exceededAfter(): BudgetCheckResult {
    if (this.usage.tokensTotal > this.config.maxTokens) {
      return {
        ok: false,
        reason: 'BUDGET_EXCEEDED',
        detail: `token budget exceeded (${String(this.usage.tokensTotal)} > ${String(this.config.maxTokens)})`,
      };
    }
    if (this.usage.costUsd > this.config.maxCostUsd) {
      return {
        ok: false,
        reason: 'BUDGET_EXCEEDED',
        detail: `cost budget exceeded ($${this.usage.costUsd.toFixed(6)} > $${String(this.config.maxCostUsd)})`,
      };
    }
    return { ok: true };
  }
}
