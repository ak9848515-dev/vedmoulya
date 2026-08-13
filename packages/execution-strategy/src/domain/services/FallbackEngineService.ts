// ──────────────────────────────────────────────────────────────────
// VedMoulya — Execution Strategy Domain Service: Fallback & Retry
// Stores the primary/secondary/emergency/local fallback plan and the
// retry policy for a strategy. No execution — fallback is strategy only.
// EI-004 — Enterprise Execution Strategy Engine
// ──────────────────────────────────────────────────────────────────

import type { FallbackPlan, StrategyRetryPolicy } from '../../types/strategy-types.js';

export class FallbackEngineService {
  /**
   * Build the fallback plan for a strategy.
   * Primary = top candidate; secondary = next candidate; emergency =
   * any healthy provider; local = self-hosted/offline execution.
   */
  buildFallback(strategyId: string, candidateFamilies: string[]): FallbackPlan {
    const [primary, secondary] = candidateFamilies;
    return {
      primaryPlanId: `${strategyId}_primary`,
      secondaryPlanId: `${strategyId}_secondary`,
      emergencyPlanId: `${strategyId}_emergency`,
      localExecutionPlanId: `${strategyId}_local`,
      description: this.describe(primary, secondary),
      activeTier: 'primary',
    };
  }

  /**
   * Build the retry policy for a strategy.
   */
  buildRetryPolicy(
    maximumRetries = 2,
    retryDelayMs = 1000,
    escalation: StrategyRetryPolicy['escalation'] = 'double-delay',
  ): StrategyRetryPolicy {
    return {
      maximumRetries,
      retryDelayMs,
      escalation,
      stopConditions: [
        'budget_exceeded',
        'quality_below_threshold',
        'context_window_exceeded',
        'policy_violation',
      ],
    };
  }

  private describe(primary?: string, secondary?: string): string {
    if (!primary) return 'No eligible provider — fallback to local execution';
    if (!secondary) return `Primary: ${primary}. Fallback: local execution.`;
    return `Primary: ${primary}. Secondary: ${secondary}. Emergency: any healthy provider. Local: self-hosted.`;
  }
}
