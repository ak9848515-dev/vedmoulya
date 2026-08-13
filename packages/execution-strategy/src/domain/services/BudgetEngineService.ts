// ──────────────────────────────────────────────────────────────────
// VedMoulya — Execution Strategy Domain Service: Budget Engine
// Estimates token, cost, and latency budgets for a strategy, plus the
// quality target. No execution — budgets are predictions with confidence.
// EI-004 — Enterprise Execution Strategy Engine
// ──────────────────────────────────────────────────────────────────

import type { QualityTier } from '@vedmoulya/ai';
import type {
  CapabilityPlan,
  CostBudget,
  LatencyBudget,
  ProviderCandidate,
  QualityTarget,
  TokenBudget,
} from '../../types/strategy-types.js';

// ── Tier multipliers ────────────────────────────────────────────────────────

const TIER_OUTPUT_MULTIPLIER: Record<QualityTier, number> = {
  premium: 1.4,
  standard: 1.0,
  economy: 0.7,
  free: 0.5,
};

const TIER_QUALITY: Record<QualityTier, { target: number; minimum: number; retry: number }> = {
  premium: { target: 0.9, minimum: 0.8, retry: 0.85 },
  standard: { target: 0.8, minimum: 0.7, retry: 0.75 },
  economy: { target: 0.7, minimum: 0.6, retry: 0.65 },
  free: { target: 0.6, minimum: 0.5, retry: 0.55 },
};

// ── Service ─────────────────────────────────────────────────────────────────

export class BudgetEngineService {
  /**
   * Estimate the token budget for a strategy.
   * Base input/output derived from the capability plan weight and tier.
   */
  estimateTokens(plan: CapabilityPlan, tier: QualityTier, maxTokens?: number): TokenBudget {
    const stepCount = Math.max(1, plan.steps.length);
    const baseInput = 2000 + stepCount * 500;
    const baseOutput = 1500 * TIER_OUTPUT_MULTIPLIER[tier];
    const contextTokens = 4000;
    const reservedTokens = 1000;
    const inputTokens = baseInput;
    const outputTokens = Math.round(baseOutput);
    const expectedTokens = inputTokens + outputTokens + contextTokens + reservedTokens;
    const maximumTokens = maxTokens ?? Math.round(expectedTokens * 1.5);

    return {
      inputTokens,
      outputTokens,
      contextTokens,
      reservedTokens,
      maximumTokens,
      expectedTokens,
      confidence: 0.85,
    };
  }

  /**
   * Estimate the cost budget for a strategy using the top provider candidate.
   */
  estimateCost(
    tokenBudget: TokenBudget,
    candidates: ProviderCandidate[],
    maxCostUsd?: number,
  ): CostBudget {
    const top = candidates[0];
    if (!top) {
      return {
        expectedCostUsd: 0,
        maximumCostUsd: maxCostUsd ?? 0,
        category: 'minimum',
        confidence: 0.5,
      };
    }
    // Approximate per-token cost from the candidate's cost estimate (filled later).
    const expectedCostUsd = Math.max(
      0.01,
      Math.round((tokenBudget.expectedTokens / 1_000_000) * 10 * 100) / 100,
    );
    const maximumCostUsd = maxCostUsd ?? Math.round(expectedCostUsd * 2 * 100) / 100;
    const category =
      expectedCostUsd < 0.1
        ? 'minimum'
        : expectedCostUsd < 1
          ? 'standard'
          : expectedCostUsd < 5
            ? 'premium'
            : 'maximum';
    return { expectedCostUsd, maximumCostUsd, category, confidence: 0.8 };
  }

  /**
   * Estimate the latency budget for a strategy.
   */
  estimateLatency(
    plan: CapabilityPlan,
    candidates: ProviderCandidate[],
    maxLatencyMs?: number,
  ): LatencyBudget {
    const top = candidates[0];
    const perStep = top?.latencyEstimateMs ?? 1000;
    const expectedTimeMs = Math.round(perStep * plan.steps.length * 1.2);
    const maximumTimeMs = maxLatencyMs ?? Math.round(expectedTimeMs * 2);
    return { expectedTimeMs, maximumTimeMs, confidence: 0.8 };
  }

  /**
   * Build the quality target for a strategy from the quality tier.
   */
  buildQualityTarget(
    tier: QualityTier,
    approvalRequired = false,
    humanReview = false,
  ): QualityTarget {
    const q = TIER_QUALITY[tier];
    return {
      targetScore: q.target,
      minimumScore: q.minimum,
      retryThreshold: q.retry,
      approvalRequired,
      humanReview,
      tier,
    };
  }
}
