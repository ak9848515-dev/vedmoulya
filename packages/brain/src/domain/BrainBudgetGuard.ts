// ──────────────────────────────────────────────────────────────────
// VedMoulya — Brain · BrainBudgetGuard
// EPIC-016 §22 — Budget intelligence.
//
// Reuses LoopBudget semantics (iterations/tokens/cost/wall-clock,
// fail-closed). Before execution: ESTIMATE (where evidence exists;
// UNKNOWN stays UNKNOWN). During: TRACK. Before exceeding: STOP /
// FALLBACK / ASK. Never silently truncate a task.
// ──────────────────────────────────────────────────────────────────

import type { BrainBudget } from '../types/brain-types.js';

export interface CostFact {
  /** Provider-level cost estimate (USD per request) when known. */
  estimatedCostUsd?: number;
  /** Token estimate when known. */
  estimatedTokens?: number;
}

export type BudgetVerdict =
  | { allowed: true; reason: string }
  | { allowed: false; reason: string; guard: 'TOKEN' | 'COST' | 'ITERATION' | 'LATENCY' };

export class BrainBudgetGuard {
  constructor(private readonly budget: BrainBudget) {}

  estimate(steps: Array<{ cost?: CostFact }>): {
    estimatedCostUsd?: number;
    estimatedTokens?: number;
  } {
    const knownCosts = steps
      .map((s) => s.cost?.estimatedCostUsd)
      .filter((c): c is number => c !== undefined);
    const knownTokens = steps
      .map((s) => s.cost?.estimatedTokens)
      .filter((t): t is number => t !== undefined);

    // Estimates only when evidence exists — never fabricated.
    return {
      estimatedCostUsd: knownCosts.length ? knownCosts.reduce((a, b) => a + b, 0) : undefined,
      estimatedTokens: knownTokens.length ? knownTokens.reduce((a, b) => a + b, 0) : undefined,
    };
  }

  /**
   * Pre-execution gate. Fail-closed: if the estimate would exceed a hard
   * limit, block BEFORE any call. No silent truncation.
   */
  checkBefore(steps: Array<{ cost?: CostFact }>): BudgetVerdict {
    const est = this.estimate(steps);

    if (est.estimatedTokens !== undefined && est.estimatedTokens > this.budget.maxTokens) {
      return {
        allowed: false,
        reason: `Token budget would be exceeded (${est.estimatedTokens} > ${this.budget.maxTokens})`,
        guard: 'TOKEN',
      };
    }
    if (est.estimatedCostUsd !== undefined && est.estimatedCostUsd > this.budget.maxCostUsd) {
      return {
        allowed: false,
        reason: `Cost budget would be exceeded ($${est.estimatedCostUsd.toFixed(4)} > $${this.budget.maxCostUsd.toFixed(4)})`,
        guard: 'COST',
      };
    }
    return { allowed: true, reason: 'Within budget.' };
  }

  /** Track a single consumed unit; fail-closed after budget exhaustion. */
  checkDuring(consumed: { tokens: number; costUsd: number; iterations: number }): BudgetVerdict {
    if (consumed.tokens > this.budget.maxTokens) {
      return {
        allowed: false,
        reason: `Token budget exceeded (${consumed.tokens} > ${this.budget.maxTokens})`,
        guard: 'TOKEN',
      };
    }
    if (consumed.costUsd > this.budget.maxCostUsd) {
      return {
        allowed: false,
        reason: `Cost budget exceeded ($${consumed.costUsd.toFixed(4)} > $${this.budget.maxCostUsd.toFixed(4)})`,
        guard: 'COST',
      };
    }
    if (consumed.iterations > this.budget.maxIterations) {
      return {
        allowed: false,
        reason: `Iteration budget exceeded (${consumed.iterations} > ${this.budget.maxIterations})`,
        guard: 'ITERATION',
      };
    }
    return { allowed: true, reason: 'Within budget.' };
  }
}
