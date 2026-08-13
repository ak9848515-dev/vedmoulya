// ──────────────────────────────────────────────────────────────────
// VedMoulya — Provider Routing Advisor
// Deterministic, explainable provider/model selection that consumes
// EI-002 (Provider Intelligence) and EI-004 (Execution Strategy)
// through narrow port contracts. No randomness, no direct provider
// SDK access: business engines remain decoupled while the runtime
// genuinely routes on live intelligence.
// AI-RUNTIME-002 — Intelligent Provider Routing.
// ──────────────────────────────────────────────────────────────────

export interface ProviderModelIntelligence {
  id: string;
  contextWindow: number;
  maxOutputTokens: number;
  streaming: boolean;
}

export interface ProviderCandidateIntelligence {
  providerId: string;
  family: string;
  capabilities: string[];
  healthy: boolean;
  models: ProviderModelIntelligence[];
  /** 0..100 composite benchmark/quality score. */
  benchmarkScore: number;
  averageLatencyMs: number;
  costPer1KInput: number;
  costPer1KOutput: number;
  // ── EPIC-012B — intelligence-layer facts (optional; the advisor falls
  //    back to deterministic derivation when absent). Free/local availability
  //    and model lifecycle come from the provider intelligence profile —
  //    never re-invented from cost heuristics alone. ──────────────────────
  /** Resource classification (LOCAL / FREE_HOSTED / FREE_API_QUOTA / …). */
  resourceType?: string;
  /** Whether the provider is free to use (from the intelligence layer). */
  freeToUse?: boolean;
  /** Model ids known unavailable/deprecated — excluded from selection. */
  unavailableModelIds?: string[];
}

export interface ProviderIntelligencePort {
  getCandidates(capability: string): Promise<ProviderCandidateIntelligence[]>;
}

export interface ExecutionStrategyPort {
  getRoutingContext(): Promise<{
    maxCost?: number;
    preferredProviders?: string[];
    strategy: 'quality-first' | 'cost-first' | 'latency-first' | 'balanced';
  }>;
}

export interface ProviderSelectionExplanation {
  capability: string;
  selected: {
    providerId: string;
    modelId: string;
    reasons: string[];
    score: number;
  };
  fallback: Array<{
    providerId: string;
    modelId: string;
    reasons: string[];
    score: number;
  }>;
  candidatesConsidered: Array<{ providerId: string; score: number; excluded: boolean }>;
  strategy: 'quality-first' | 'cost-first' | 'latency-first' | 'balanced';
  estimatedInputTokens: number;
  estimatedCost: number;
  evaluatedAt: string;
}

/** Deterministic routing weights (normalised later). */
const WEIGHTS = {
  benchmark: 0.5,
  cost: 0.2,
  latency: 0.15,
  health: 0.15,
} as const;

export class ProviderRoutingAdvisor {
  constructor(
    private readonly providerIntelligence: ProviderIntelligencePort,
    private readonly executionStrategy: ExecutionStrategyPort,
  ) {}

  /**
   * Select the primary provider/model and a deterministic fallback chain for
   * a capability. Every decision carries human-readable reasons so telemetry
   * and the /ai explainSelection procedure can show WHY a provider won.
   */
  async decide(input: {
    capability: string;
    estimatedInputTokens: number;
    requestedOutputTokens?: number;
  }): Promise<ProviderSelectionExplanation> {
    const [candidates, routing] = await Promise.all([
      this.providerIntelligence.getCandidates(input.capability),
      this.executionStrategy.getRoutingContext(),
    ]);

    const estimatedCost = this.estimateCost(input, candidates, routing.strategy);

    const scored = candidates.map((candidate) => {
      const reasons: string[] = [];
      let score = 0;

      // Health gate: unhealthy providers are excluded unless nothing is healthy.
      if (!candidate.healthy) {
        reasons.push('provider health check failing');
        score -= 1;
      } else {
        score += WEIGHTS.health * 1;
        reasons.push('provider health acceptable');
      }

      // Capability compatibility.
      if (!candidate.capabilities.includes(input.capability)) {
        reasons.push('capability not supported');
        score -= 1;
      } else {
        reasons.push('capability compatible');
        score += WEIGHTS.benchmark * (candidate.benchmarkScore / 100);
      }

      // Context window sufficiency.
      const model = this.pickModel(candidate, input.estimatedInputTokens);
      if (!model) {
        reasons.push('no model with sufficient context window');
        score -= 0.5;
      } else {
        reasons.push('context window sufficient');
        score += WEIGHTS.benchmark * (candidate.benchmarkScore / 200);
      }

      const hasFittingModel = model !== undefined;

      // Cost vs budget.
      const providerCost = this.providerCost(candidate, input);
      if (routing.maxCost !== undefined && providerCost > routing.maxCost) {
        reasons.push('estimated cost above budget');
        score -= 0.4;
      } else {
        reasons.push('estimated cost within budget');
        score += WEIGHTS.cost * 1;
      }

      // Latency (latency-first strategy weights it much higher).
      // Calibrated 2026-08-08 (AI-RUNTIME-003 Phase 4): the previous ×2
      // multiplier let a 3200ms provider beat an 180ms one under
      // latency-first because its benchmark edge (+0.1575 combined) exceeded
      // the latency edge (×2 → 0.091). ×4 (0.6) closes that gap so the
      // strategy intent actually holds: the fastest healthy, capable,
      // fitting provider wins latency-first routing.
      const latencyWeight =
        routing.strategy === 'latency-first' ? WEIGHTS.latency * 4 : WEIGHTS.latency;
      const latencyFactor = Math.max(0, 1 - candidate.averageLatencyMs / 10_000);
      score += latencyWeight * latencyFactor;
      reasons.push('expected latency acceptable');

      // Strategy preference.
      if (routing.strategy === 'cost-first') {
        // $0.50 per $1/1K input — a strong enough signal to flip close
        // benchmark gaps but never to pick an unusable provider.
        score -= candidate.costPer1KInput * 0.5;
      }
      if (routing.preferredProviders?.includes(candidate.providerId)) {
        score += 0.15;
        reasons.push('execution strategy preferred provider');
      }

      return {
        candidate,
        model: model ?? candidate.models[0],
        score: Math.max(0, score),
        reasons,
        hasFittingModel,
      };
    });

    // Prefer candidates whose selected model actually fits the token budget;
    // only degrade to no-fitting-model candidates when nothing else is viable
    // (the token budget must not be silently defeated by the routing layer).
    const healthyWithModel = scored.filter(
      (s) => s.hasFittingModel && s.candidate.healthy && s.score > 0,
    );
    const healthyPool = scored.filter((s) => s.candidate.healthy && s.score > 0);
    const positiveWithModel = scored.filter((s) => s.hasFittingModel && s.score > 0);
    const positivePool = scored.filter((s) => s.score > 0);
    const pool =
      healthyWithModel.length > 0
        ? healthyWithModel
        : healthyPool.length > 0
          ? healthyPool
          : positiveWithModel.length > 0
            ? positiveWithModel
            : positivePool;

    pool.sort(
      (a, b) => b.score - a.score || a.candidate.providerId.localeCompare(b.candidate.providerId),
    );

    const selected = pool[0];
    if (!selected) {
      throw new Error(`No eligible provider for capability: ${input.capability}`);
    }

    const fallback = pool.slice(1, 3).map((entry) => ({
      providerId: entry.candidate.providerId,
      modelId: entry.model?.id ?? entry.candidate.models[0]?.id ?? '',
      reasons: entry.reasons,
      score: entry.score,
    }));

    return {
      capability: input.capability,
      selected: {
        providerId: selected.candidate.providerId,
        modelId: selected.model?.id ?? selected.candidate.models[0]?.id ?? '',
        reasons: selected.reasons,
        score: selected.score,
      },
      fallback,
      candidatesConsidered: scored.map((entry) => ({
        providerId: entry.candidate.providerId,
        score: entry.score,
        excluded: !entry.candidate.healthy || entry.score <= 0,
      })),
      strategy: routing.strategy,
      estimatedInputTokens: input.estimatedInputTokens,
      estimatedCost,
      evaluatedAt: new Date().toISOString(),
    };
  }

  /** Pick the best model for the candidate that fits the token budget. */
  private pickModel(
    candidate: ProviderCandidateIntelligence,
    estimatedInputTokens: number,
  ): ProviderModelIntelligence | undefined {
    // EPIC-012B — models the intelligence layer knows are unavailable or
    // deprecated are never selected, even when they fit the budget.
    const unavailable = new Set(candidate.unavailableModelIds ?? []);
    const models = candidate.models
      .filter((m) => !unavailable.has(m.id))
      .filter((m) => m.contextWindow >= estimatedInputTokens + 512)
      .sort((a, b) => b.contextWindow - a.contextWindow);
    return models[0];
  }

  private providerCost(
    candidate: ProviderCandidateIntelligence,
    input: { estimatedInputTokens: number; requestedOutputTokens?: number },
  ): number {
    return (
      (input.estimatedInputTokens / 1000) * candidate.costPer1KInput +
      ((input.requestedOutputTokens ?? 1024) / 1000) * candidate.costPer1KOutput
    );
  }

  private estimateCost(
    input: { estimatedInputTokens: number; requestedOutputTokens?: number },
    candidates: ProviderCandidateIntelligence[],
    _strategy: string,
  ): number {
    if (candidates.length === 0) return 0;
    const median = candidates.map((c) => this.providerCost(c, input)).sort((a, b) => a - b);
    return median[Math.floor(median.length / 2)] ?? 0;
  }
}
