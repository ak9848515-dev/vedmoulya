// ──────────────────────────────────────────────────────────────────
// VedMoulya — Execution Strategy Domain Service: Risk Engine
// Assesses provider, execution, budget, and latency risk for a
// strategy, then combines them into a single overall risk score
// and level. No execution — risk is part of the strategy plan only.
// EI-004 — Enterprise Execution Strategy Engine
// ──────────────────────────────────────────────────────────────────

import type {
  CostBudget,
  LatencyBudget,
  ProviderCandidate,
  RiskAssessment,
  RiskLevel,
  TokenBudget,
} from '../../types/strategy-types.js';

// ── Service ─────────────────────────────────────────────────────────────────

export class RiskEngineService {
  /**
   * Assess risk across all four dimensions and combine into an overall score.
   */
  assess(
    candidates: ProviderCandidate[],
    tokenBudget: TokenBudget,
    costBudget: CostBudget,
    latencyBudget: LatencyBudget,
  ): RiskAssessment {
    const providerRisk = this.assessProvider(candidates);
    const executionRisk = this.assessExecution(candidates, tokenBudget);
    const budgetRisk = this.assessBudget(tokenBudget, costBudget);
    const latencyRisk = this.assessLatency(latencyBudget);

    const overallRisk = Math.max(
      0,
      Math.min(
        1,
        0.35 * providerRisk + 0.25 * executionRisk + 0.2 * budgetRisk + 0.2 * latencyRisk,
      ),
    );

    return {
      providerRisk,
      executionRisk,
      budgetRisk,
      latencyRisk,
      confidence: 0.85,
      overallRisk,
      level: this.toRiskLevel(overallRisk),
      factors: this.collectFactors(providerRisk, executionRisk, budgetRisk, latencyRisk),
    };
  }

  // ── Dimension assessments ─────────────────────────────────────────────────

  private assessProvider(candidates: ProviderCandidate[]): number {
    if (candidates.length === 0) return 1;
    const avgHealth = candidates.reduce((s, c) => s + c.healthScore, 0) / candidates.length;
    const anyUnhealthy = candidates.some((c) => c.availability !== 'healthy');
    return Math.max(0, Math.min(1, 1 - avgHealth + (anyUnhealthy ? 0.15 : 0)));
  }

  private assessExecution(candidates: ProviderCandidate[], tokenBudget: TokenBudget): number {
    const maxContext = candidates.reduce((m, c) => Math.max(m, c.contextWindow), 0);
    if (maxContext === 0) return tokenBudget.maximumTokens > 0 ? 0.7 : 0.3;
    const fit = tokenBudget.maximumTokens / maxContext;
    return Math.max(0, Math.min(1, 0.2 + Math.max(0, fit - 1)));
  }

  private assessBudget(tokenBudget: TokenBudget, costBudget: CostBudget): number {
    let risk = 0;
    if (costBudget.maximumCostUsd > 0) {
      const over = costBudget.expectedCostUsd / costBudget.maximumCostUsd;
      risk = Math.max(risk, over > 1 ? 1 : over);
    } else if (costBudget.expectedCostUsd > 0) {
      risk = 0.6;
    }
    if (tokenBudget.maximumTokens > 0) {
      const over = tokenBudget.expectedTokens / tokenBudget.maximumTokens;
      risk = Math.max(risk, over > 1 ? 1 : over);
    }
    return Math.max(0, Math.min(1, risk));
  }

  private assessLatency(latencyBudget: LatencyBudget): number {
    if (latencyBudget.maximumTimeMs <= 0) {
      return latencyBudget.expectedTimeMs > 0 ? 0.5 : 0;
    }
    const over = latencyBudget.expectedTimeMs / latencyBudget.maximumTimeMs;
    return Math.max(0, Math.min(1, over > 1 ? 1 : over));
  }

  // ── Aggregation helpers ───────────────────────────────────────────────────

  private toRiskLevel(risk: number): RiskLevel {
    if (risk >= 0.8) return 'critical';
    if (risk >= 0.6) return 'high';
    if (risk >= 0.4) return 'medium';
    if (risk >= 0.2) return 'low';
    return 'very_low';
  }

  private collectFactors(
    providerRisk: number,
    executionRisk: number,
    budgetRisk: number,
    latencyRisk: number,
  ): string[] {
    const factors: string[] = [];
    if (providerRisk >= 0.5) factors.push('Provider fleet health or availability is low');
    if (executionRisk >= 0.5) factors.push('Token budget may exceed the largest context window');
    if (budgetRisk >= 0.5) factors.push('Cost or token estimate is close to or above the budget');
    if (latencyRisk >= 0.5) factors.push('Expected latency approaches the latency budget');
    if (factors.length === 0) factors.push('All risk dimensions are within budget');
    return factors;
  }
}
