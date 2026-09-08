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
  /**
   * Model-level capabilities from the SINGLE provider registry (authoritative
   * catalog, same CapabilityType taxonomy as provider capabilities). A model
   * may support FEWER capabilities than its provider — routing must evaluate
   * provider + actual model, never provider alone. Absent when the registry
   * declared none: treated as UNKNOWN (conservative — never excluded on an
   * absent list, only on an explicit lack).
   */
  capabilities?: string[];
}

/**
 * Runtime execution health (Capability Intelligence — real-time feedback).
 * Separate from MEASURED EVIDENCE by design:
 *   HEALTH  = "what is happening recently?" (short recency window, bounded)
 *   EVIDENCE = "how has this historically performed?" (RoutingEvidenceService)
 * Both reach the advisor, but never as one opaque number.
 */
export type RuntimeHealthVerdict = 'HEALTHY' | 'DEGRADED' | 'UNAVAILABLE' | 'UNKNOWN';

export interface RuntimeExecutionHealth {
  /** Narrowest measured scope: 'provider' or 'provider_model'. */
  scope: 'provider' | 'provider_model';
  verdict: RuntimeHealthVerdict;
  /** Raw outcome count retained in the bounded window. */
  sampleCount: number;
  /** Recency-weighted success rate 0..1 over the window. */
  weightedSuccessRate?: number;
  /** Consecutive failures at the end of the window (0 = last event ok). */
  consecutiveFailures: number;
  /** Window failure reason tallies — never merged into one number. */
  timeoutCount: number;
  rateLimitCount: number;
  authFailureCount: number;
  unsupportedCount: number;
  /** ISO timestamps of the last outcome in the window. */
  lastSuccessAt?: string;
  lastFailureAt?: string;
  /** Reason for the current verdict (human-readable, e.g. auth failure). */
  detail?: string;
}

/**
 * Measured execution evidence (routing feedback). Consumed by the advisor
 * ONLY with progressive influence — see MEASURED_* weights. Everything here
 * is MEASURED from real executions; static/estimated signals are separate
 * fields (benchmarkScore, averageLatencyMs, costPer1K*) and are never
 * silently replaced — measured data augments them when confidence exists.
 */
export interface ProviderMeasuredEvidence {
  /** Raw execution sample count. */
  sampleCount: number;
  /** Recency-weighted sample count (drives confidence/influence). */
  effectiveSampleCount: number;
  /** Weighted success rate 0..1. */
  successRate?: number;
  /** Weighted failure rate 0..1. */
  failureRate?: number;
  /** Median latency ms over recorded executions. */
  p50LatencyMs?: number;
  /** p95 latency ms over recorded executions. */
  p95LatencyMs?: number;
  /** Weighted share of executions classified as timeout. */
  timeoutRate?: number;
  /** Weighted share of executions classified as rate-limited. */
  rateLimitRate?: number;
  /** Weighted average tokens per execution. */
  averageTokensPerCall?: number;
  /** Weighted average input tokens per execution. */
  averageInputTokens?: number;
  /** Weighted average output tokens per execution. */
  averageOutputTokens?: number;
  /** Weighted average total tokens per execution. */
  averageTotalTokens?: number;
  /** Weighted average cost USD per execution. */
  averageCostUsd?: number;
  /** Failures within the recent window (raw count). */
  recentFailureCount?: number;
  confidence: 'INSUFFICIENT' | 'LOW_CONFIDENCE' | 'MEASURED';
  /** 0..1 progressive influence ramp (0 when INSUFFICIENT). */
  influence: number;
  /** Dimension this evidence was measured for (provider/model/capability). */
  dimension?: 'provider' | 'provider_model' | 'provider_model_capability';
  /** Always MEASURED — never static/estimated. */
  provenance: 'MEASURED';
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
  // ── Routing evidence (Phases G/H) — real measured history, when it exists.
  //    Absent in cold start → the advisor behaves exactly as before.
  measured?: ProviderMeasuredEvidence;
  // ── Real-time execution health (Capability Intelligence) — bounded, recent,
  //    recoverable feedback from actual outcomes. UNKNOWN when the tracker has
  //    no window data → advisor behaves exactly as before (Gemini cold start).
  runtimeHealth?: RuntimeExecutionHealth;
  /** Models the runtime tracker knows are failing at MODEL scope (e.g.
   *  unsupported or model-level unavailable) — excluded from selection while
   *  the provider itself stays eligible. Never derived from provider health. */
  runtimeUnavailableModelIds?: string[];
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
  /** Authoritative task capability requirements (CapabilityType taxonomy).
   *  Defaults to [capability] when the caller supplied none. */
  requiredCapabilities: string[];
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

// ── Measured-evidence weights (Phase G/H) ────────────────────────────────
// These are ADDITIVE and BOUNDED: measured data augments the existing
// deterministic weights instead of replacing them, and its influence is
// scaled by `evidence.influence` (0..1, progressive — see the evidence
// service). With zero evidence the terms contribute exactly 0, so cold
// start behaves identically to the previous advisor.

/** Max score contribution from measured reliability (success rate). */
const MEASURED_RELIABILITY_WEIGHT = 0.12;
/** Max penalty from measured recent failures. */
const MEASURED_RECENT_FAILURE_WEIGHT = 0.06;
/** Max penalty from measured rate-limit / timeout frequency. */
const MEASURED_DEGRADATION_WEIGHT = 0.06;
/** Minimum success rate below which measured reliability drags the score. */
const MEASURED_SUCCESS_FLOOR = 0.9;

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
    /** Authoritative task capability requirements (existing CapabilityType
     *  taxonomy). When omitted the task requires exactly its routing
     *  capability — cold-start behavior is unchanged. */
    requiredCapabilities?: string[];
    estimatedInputTokens: number;
    requestedOutputTokens?: number;
  }): Promise<ProviderSelectionExplanation> {
    const [candidates, routing] = await Promise.all([
      this.providerIntelligence.getCandidates(input.capability),
      this.executionStrategy.getRoutingContext(),
    ]);

    // The task capability requirements. The routing capability is always
    // required (candidates were fetched against it); caller-supplied extra
    // requirements gate provider AND model eligibility below.
    const requiredCapabilities = [
      input.capability,
      ...(input.requiredCapabilities ?? []).filter((c) => c !== input.capability),
    ];

    const estimatedCost = this.estimateCost(input, candidates, routing.strategy);

    const scored = candidates.map((candidate) => {
      const reasons: string[] = [];
      let score = 0;

      // ── Health gate (registry + real-time execution health) ────────────
      // UNAVAILABLE runtime verdict folds into the existing unhealthy gate
      // (excluded only while a healthy alternative exists — never an
      // auto-disable). DEGRADED applies a bounded soft penalty instead.
      const runtimeHealth = candidate.runtimeHealth;
      if (!candidate.healthy || runtimeHealth?.verdict === 'UNAVAILABLE') {
        reasons.push('provider health check failing');
        if (runtimeHealth?.detail) reasons.push(runtimeHealth.detail);
        score -= 1;
      } else {
        score += WEIGHTS.health * 1;
        reasons.push('provider health acceptable');
        if (runtimeHealth?.verdict === 'DEGRADED') {
          score -= 0.08;
          reasons.push('provider degraded by recent execution failures');
        }
      }

      // ── Capability compatibility (HARD gate on required capabilities) ──
      // Provider level first: every required capability must be declared at
      // the provider level. Model level second: at least one model must
      // support every required capability (provider capability ≠ model
      // capability — an embedding model inside a vision-capable provider is
      // never eligible for a vision task).
      const missingProviderCapabilities = requiredCapabilities.filter(
        (c) => !candidate.capabilities.includes(c),
      );
      // A candidate cannot serve when EVERY model explicitly declares
      // capabilities and NO model supports all of them. Models with no
      // declared capability list are UNKNOWN → conservative, never excluded
      // on an absent list (sparse metadata cannot break cold-start routing).
      const declaresAll = candidate.models.every(
        (m) => m.capabilities !== undefined && m.capabilities.length > 0,
      );
      const noCapableModel =
        declaresAll &&
        candidate.models.length > 0 &&
        !candidate.models.some((m) =>
          requiredCapabilities.every((c) => (m.capabilities ?? []).includes(c)),
        );
      if (missingProviderCapabilities.length > 0 || noCapableModel) {
        reasons.push(
          `required capability${missingProviderCapabilities.length > 0 ? ` ${missingProviderCapabilities.join(', ')}` : ''} not supported${noCapableModel && missingProviderCapabilities.length === 0 ? ' by any model' : ''}`,
        );
        score -= 1;
      } else {
        reasons.push('capability compatible');
        score += WEIGHTS.benchmark * (candidate.benchmarkScore / 100);
        // Models that explicitly lack a required capability are excluded from
        // model selection even though the provider qualifies (informational).
        const excludedByCapability = candidate.models.filter((m) => {
          const caps = m.capabilities;
          return (
            caps !== undefined &&
            caps.length > 0 &&
            !requiredCapabilities.every((c) => caps.includes(c))
          );
        });
        if (excludedByCapability.length > 0) {
          reasons.push(
            `${excludedByCapability.length} model(s) excluded: do not support all required capabilities`,
          );
        }
      }

      // Context window sufficiency (only among models that support the
      // required capabilities and are not runtime-unavailable).
      const model = this.pickModel(candidate, input.estimatedInputTokens, requiredCapabilities);
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
      // Measured latency (Phase G): when real evidence exists, prefer the
      // measured median over the static registry latency signal. Influence is
      // scaled so a single fast run cannot override the catalog.
      const measured = candidate.measured;
      const measuredLatency =
        measured && measured.confidence !== 'INSUFFICIENT' && measured.p50LatencyMs !== undefined
          ? measured.p50LatencyMs
          : undefined;
      const latencyMs = measuredLatency ?? candidate.averageLatencyMs;
      const latencyFactor = Math.max(0, 1 - latencyMs / 10_000);
      score += latencyWeight * latencyFactor;
      reasons.push(
        measuredLatency !== undefined
          ? `measured p50 latency ${Math.round(measuredLatency)}ms`
          : 'expected latency acceptable',
      );

      // Measured reliability (Phase G/H) — bounded + influence-scaled.
      if (measured && measured.confidence !== 'INSUFFICIENT' && measured.influence > 0) {
        const reliability =
          measured.successRate !== undefined
            ? Math.max(0, measured.successRate - MEASURED_SUCCESS_FLOOR) /
              (1 - MEASURED_SUCCESS_FLOOR) // 0 at 90%, 1 at 100%
            : 0;
        score += MEASURED_RELIABILITY_WEIGHT * reliability * measured.influence;
        reasons.push(
          `measured reliability ${measured.successRate !== undefined ? Math.round(measured.successRate * 100) : '?'}% over ${measured.sampleCount} executions`,
        );
        if ((measured.recentFailureCount ?? 0) > 0) {
          const penalty = Math.min(
            MEASURED_RECENT_FAILURE_WEIGHT,
            ((measured.recentFailureCount ?? 0) / 10) * MEASURED_RECENT_FAILURE_WEIGHT,
          );
          score -= penalty * measured.influence;
          reasons.push(
            `${measured.recentFailureCount} recent failure(s) weigh against this provider`,
          );
        }
        const degradation =
          ((measured.timeoutRate ?? 0) + (measured.rateLimitRate ?? 0)) *
          MEASURED_DEGRADATION_WEIGHT;
        if (degradation > 0) {
          score -= Math.min(MEASURED_DEGRADATION_WEIGHT, degradation) * measured.influence;
          reasons.push('measured timeouts/rate-limits weigh against this provider');
        }
      }

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
      requiredCapabilities,
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

  /**
   * Pick the best model for the candidate: it must support EVERY required
   * capability (model-level, explicit only) and fit the token budget, and
   * must not be runtime-unavailable or lifecycle-deprecated.
   */
  private pickModel(
    candidate: ProviderCandidateIntelligence,
    estimatedInputTokens: number,
    requiredCapabilities: string[],
  ): ProviderModelIntelligence | undefined {
    // EPIC-012B — models the intelligence layer knows are unavailable or
    // deprecated are never selected, even when they fit the budget.
    const unavailable = new Set([
      ...(candidate.unavailableModelIds ?? []),
      ...(candidate.runtimeUnavailableModelIds ?? []),
    ]);
    const models = candidate.models
      .filter((m) => !unavailable.has(m.id))
      .filter((m) => this.modelSupportsAll(m, requiredCapabilities))
      .filter((m) => m.contextWindow >= estimatedInputTokens + 512)
      .sort((a, b) => b.contextWindow - a.contextWindow);
    return models[0];
  }

  /**
   * Model-level capability check. A model with NO declared capability list is
   * UNKNOWN — treated as compatible (an absent list never excludes; only an
   * explicit lack does, so sparse registry metadata cannot break routing).
   */
  private modelSupportsAll(model: ProviderModelIntelligence, required: string[]): boolean {
    const caps = model.capabilities;
    if (caps === undefined || caps.length === 0) return true;
    return required.every((c) => caps.includes(c));
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
