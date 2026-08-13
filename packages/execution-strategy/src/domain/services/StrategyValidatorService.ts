// ──────────────────────────────────────────────────────────────────
// VedMoulya — Execution Strategy Domain Service: Strategy Validator
// Validates a strategy: capability exists, context available, provider
// available, budget possible, latency acceptable, quality achievable.
// EI-004 — Enterprise Execution Strategy Engine
// ──────────────────────────────────────────────────────────────────

import type {
  CapabilityPlan,
  CostBudget,
  ExecutionStrategy,
  LatencyBudget,
  ProviderCandidate,
  QualityTarget,
  StrategyValidation,
  StrategyValidationCheck,
  TokenBudget,
} from '../../types/strategy-types.js';

export class StrategyValidatorService {
  /**
   * Validate a strategy across all six dimensions.
   */
  validate(strategy: ExecutionStrategy): StrategyValidation {
    const checks: StrategyValidationCheck[] = [
      this.checkCapability(strategy.capabilityPlan),
      this.checkContext(strategy.capabilityPlan),
      this.checkProvider(strategy.providerCandidates),
      this.checkBudget(strategy.tokenBudget, strategy.costBudget),
      this.checkLatency(strategy.latencyBudget),
      this.checkQuality(strategy.qualityTarget),
    ];

    const passed = checks.every((c) => c.passed);
    const score = checks.reduce((s, c) => s + (c.passed ? 1 : 0), 0) / checks.length;
    const summary = passed
      ? 'Strategy is valid and ready for execution planning.'
      : `Strategy has ${String(checks.filter((c) => !c.passed).length)} validation issue(s).`;

    return { passed, checks, summary, score };
  }

  private checkCapability(plan: CapabilityPlan): StrategyValidationCheck {
    const ok = plan.feasible && plan.requiredCapabilities.length > 0;
    return {
      check: 'Capability exists',
      passed: ok,
      detail: ok
        ? `Plan requires ${plan.requiredCapabilities.join(', ')}`
        : 'No feasible required capability in the plan',
    };
  }

  private checkContext(plan: CapabilityPlan): StrategyValidationCheck {
    const ok = plan.steps.length > 0;
    return {
      check: 'Context available',
      passed: ok,
      detail: ok ? `${String(plan.steps.length)} steps planned` : 'No context steps planned',
    };
  }

  private checkProvider(candidates: ProviderCandidate[]): StrategyValidationCheck {
    const ok = candidates.length > 0;
    return {
      check: 'Provider available',
      passed: ok,
      detail: ok
        ? `${String(candidates.length)} eligible provider(s) ranked`
        : 'No eligible provider for the required capabilities',
    };
  }

  private checkBudget(tokenBudget: TokenBudget, costBudget: CostBudget): StrategyValidationCheck {
    const ok = tokenBudget.maximumTokens > 0 && costBudget.maximumCostUsd > 0;
    return {
      check: 'Budget possible',
      passed: ok,
      detail: ok
        ? `Max ${String(tokenBudget.maximumTokens)} tokens / $${costBudget.maximumCostUsd.toFixed(2)}`
        : 'Budget is zero or unset',
    };
  }

  private checkLatency(latencyBudget: LatencyBudget): StrategyValidationCheck {
    const ok = latencyBudget.maximumTimeMs > 0;
    return {
      check: 'Latency acceptable',
      passed: ok,
      detail: ok ? `Max ${String(latencyBudget.maximumTimeMs)}ms` : 'Latency budget unset',
    };
  }

  private checkQuality(qualityTarget: QualityTarget): StrategyValidationCheck {
    const ok = qualityTarget.minimumScore > 0;
    return {
      check: 'Quality achievable',
      passed: ok,
      detail: ok
        ? `Target ${String(qualityTarget.targetScore)} / min ${String(qualityTarget.minimumScore)}`
        : 'Quality target unset',
    };
  }
}
