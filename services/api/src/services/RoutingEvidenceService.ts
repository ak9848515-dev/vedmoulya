/* eslint-disable security/detect-object-injection -- Heuristic rule
   false-positive: every dynamic key is a dimension key built from a closed
   set of span attribute names (provider/model/capability from runtime code),
   never attacker-controlled input. */

// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Routing Evidence Service
//
// PURPOSE
//   Turns the EXISTING execution-trace history into measured routing evidence
//   for provider/model selection. It is a PURE QUERY over the SAME TraceStore
//   the CostLedger reads — it never writes, never stores history itself, and
//   never duplicates the ledger. CostLedger remains the authoritative
//   economics/history source; this service derives reliability/latency/token/
//   cost/health evidence from the actual ai.provider_execution spans.
//
// PROVENANCE (Phase F — strict separation)
//   Everything here is MEASURED: it comes from real executions recorded in
//   traces. Static catalog quality/pricing, registry health seeds and quota
//   estimates are NEVER mixed in — the advisor receives them separately as
//   KNOWN/STATIC inputs, and this service only ever returns measured facts.
//
// DIMENSIONS (Phases I/J)
//   provider                     — always computable from span attributes
//   provider + model             — only when the span recorded the real model
//   provider + model + capability— only when both model and capability exist
//   Dimensions with no real samples simply return undefined — never invented.
//
// RECENCY (Phase D — deterministic, explainable, bounded)
//   Each sample is weighted by an exponential half-life decay:
//     weight = 0.5 ^ (ageDays / halfLifeDays)
//   Default half-life 30 days: a 30-day-old sample counts half, a 60-day-old
//   sample a quarter, etc. Weights are clamped to [0.05, 1] so very old
//   samples never fully disappear but never dominate. No ML, no hidden state —
//   the same traces + the same clock always produce the same weights.
//
// CONFIDENCE (Phase E — progressive influence, cold-start safe)
//   The EFFECTIVE sample count is the sum of recency weights. Three states:
//     INSUFFICIENT    effective < minSamples (default 5)
//     LOW_CONFIDENCE  minSamples .. targetSamples (default 25)
//     MEASURED        >= targetSamples
//   A provider with 2/2 successes has effective ≈ 2 → INSUFFICIENT and
//   influence 0, so it can NEVER beat a 520-sample provider. Influence ramps
//   linearly from 0 → 1 as effective samples grow to targetSamples, so
//   measured data gains weight gradually instead of flipping routing on a
//   hard threshold.
// ─────────────────────────────────────────────────────────────────────────────

import type { TraceStore, TraceSpan } from '@vedmoulya/core';
import type { ProviderMeasuredEvidence } from '@vedmoulya/services';

// ── Public types ────────────────────────────────────────────────────────────

export type EvidenceConfidence = 'INSUFFICIENT' | 'LOW_CONFIDENCE' | 'MEASURED';

/** Provenance of an evidence value — always MEASURED in this service. */
export const EVIDENCE_PROVENANCE = 'MEASURED' as const;
export type EvidenceProvenance = typeof EVIDENCE_PROVENANCE;

export type EvidenceDimension = 'provider' | 'provider_model' | 'provider_model_capability';

/**
 * Measured evidence for a dimension. The SHARED advisor contract is
 * ProviderMeasuredEvidence from @vedmoulya/services; this service adds the
 * dimension identity (providerId / modelId / capability) so callers can tell
 * which dimension a value was measured for.
 */
export interface RoutingEvidence extends ProviderMeasuredEvidence {
  dimension: EvidenceDimension;
  providerId: string;
  modelId?: string;
  capability?: string;
}

export interface RoutingEvidenceSnapshot {
  /** All measured evidence, keyed by dimension key. */
  provider: Map<string, RoutingEvidence>;
  providerModel: Map<string, RoutingEvidence>;
  providerModelCapability: Map<string, RoutingEvidence>;
  /** Traces scanned in this snapshot (bounded). */
  scannedTraces: number;
  scannedSpans: number;
  computedAt: number;
}

export interface RoutingEvidenceOptions {
  /** Existing trace spine — the SAME store the CostLedger reads. */
  store: TraceStore;
  /** Deterministic clock for tests. Default Date.now. */
  now?: () => number;
  /** Max traces scanned per snapshot (bounded — never a full unbounded scan). */
  maxTraces?: number;
  /** Recency half-life in days (Phase D). Default 30. */
  halfLifeDays?: number;
  /** Minimum effective samples for LOW_CONFIDENCE. Default 5. */
  minSamples?: number;
  /** Effective samples at which evidence is fully influential. Default 25. */
  targetSamples?: number;
  /** Recent-failure window in ms. Default 24h. */
  recentWindowMs?: number;
  /** How long a computed snapshot is reused. Default 60s. */
  cacheTtlMs?: number;
}

// ── Internal aggregation ────────────────────────────────────────────────────

interface Sample {
  provider: string;
  model?: string;
  capability?: string;
  success: boolean;
  latencyMs?: number;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  costUsd?: number;
  timeout: boolean;
  rateLimited: boolean;
  ageMs: number;
}

const HALF_LIFE_DAYS_DEFAULT = 30;
const MIN_SAMPLES_DEFAULT = 5;
const TARGET_SAMPLES_DEFAULT = 25;
const RECENT_WINDOW_MS_DEFAULT = 24 * 60 * 60 * 1000;
const CACHE_TTL_MS_DEFAULT = 60_000;
const MAX_TRACES_DEFAULT = 2000;

/** Recency weight for a sample: 0.5^(ageDays/halfLifeDays), clamped [0.05, 1]. */
export function recencyWeight(ageMs: number, halfLifeMs: number): number {
  if (ageMs <= 0) return 1;
  const ageDays = ageMs / (24 * 60 * 60 * 1000);
  const halfLifeDays = halfLifeMs / (24 * 60 * 60 * 1000);
  const weight = Math.pow(0.5, ageDays / halfLifeDays);
  return Math.min(1, Math.max(0.05, weight));
}

/** Percentile of a sorted numeric array (0..1); undefined when empty. */
export function percentile(sorted: number[], p: number): number | undefined {
  if (sorted.length === 0) return undefined;
  // Nearest-rank percentile (deterministic): for p=0.5 with 4 elements the
  // 2nd-smallest is returned (lower median) — stable and explainable.
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(p * sorted.length) - 1));
  return sorted[index];
}

function toNum(value: string | number | boolean | undefined): number | undefined {
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function toStr(value: string | number | boolean | undefined): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function isErrorReason(span: TraceSpan, reason: string): boolean {
  return toStr(span.attributes.error_reason) === reason;
}

/** Extract one measured sample from an ai.provider_execution span. */
function sampleFromSpan(span: TraceSpan, now: number): Sample | undefined {
  const provider = toStr(span.attributes.provider);
  if (!provider) return undefined;
  const model = toStr(span.attributes.model);
  const capability = toStr(span.attributes.capability);
  const status = toStr(span.attributes.status);
  // Success = explicit success marker OR a span that ended OK without an
  // error marker. A span that ended with an error reason is a failure even
  // if the status attribute is absent.
  const success = status === 'success' || (status === undefined && span.status === 'OK');
  const latencyMs = toNum(span.attributes.latency_ms) ?? span.durationMs;
  const endedAt = span.endedAt ?? span.startedAt;
  return {
    provider,
    model,
    capability,
    success,
    latencyMs,
    inputTokens: toNum(span.attributes.input_tokens),
    outputTokens: toNum(span.attributes.output_tokens),
    totalTokens: toNum(span.attributes.tokens_total),
    costUsd: toNum(span.attributes.cost),
    timeout: isErrorReason(span, 'timeout'),
    rateLimited: isErrorReason(span, 'rate_limited'),
    ageMs: Math.max(0, now - endedAt),
  };
}

function dimensionKey(provider: string, model?: string, capability?: string): string {
  return [provider, model, capability].filter((part) => part !== undefined).join('|');
}

/** Aggregate a list of samples into measured evidence for one dimension. */
function aggregate(
  samples: Sample[],
  options: Required<
    Pick<RoutingEvidenceOptions, 'halfLifeDays' | 'minSamples' | 'targetSamples' | 'recentWindowMs'>
  >,
  dimension: EvidenceDimension,
  providerId: string,
  modelId?: string,
  capability?: string,
): RoutingEvidence | undefined {
  if (samples.length === 0) return undefined;
  const halfLifeMs = options.halfLifeDays * 24 * 60 * 60 * 1000;
  const weights = samples.map((s) => recencyWeight(s.ageMs, halfLifeMs));
  const effective = weights.reduce((sum, w) => sum + w, 0);
  const weightOf = (pick: (s: Sample) => boolean): number =>
    samples.reduce((sum, s, i) => (pick(s) ? sum + (weights[i] ?? 0) : sum), 0);

  const weightedRate = (pick: (s: Sample) => boolean): number | undefined =>
    effective > 0 ? weightOf(pick) / effective : undefined;

  const successCount = weightOf((s) => s.success);
  const latencies = samples
    .map((s) => s.latencyMs)
    .filter((v): v is number => v !== undefined)
    .sort((a, b) => a - b);

  const weightedAvg = (pick: (s: Sample) => number | undefined): number | undefined => {
    let sum = 0;
    let wsum = 0;
    samples.forEach((s, i) => {
      const v = pick(s);
      if (v !== undefined) {
        sum += v * (weights[i] ?? 0);
        wsum += weights[i] ?? 0;
      }
    });
    return wsum > 0 ? sum / wsum : undefined;
  };

  const recentFailures = samples.filter(
    (s) => !s.success && s.ageMs <= options.recentWindowMs,
  ).length;

  let confidence: EvidenceConfidence;
  if (effective < options.minSamples) confidence = 'INSUFFICIENT';
  else if (effective < options.targetSamples) confidence = 'LOW_CONFIDENCE';
  else confidence = 'MEASURED';
  const influence =
    confidence === 'INSUFFICIENT' ? 0 : Math.min(1, effective / options.targetSamples);

  const failureRate = weightedRate((s) => !s.success);
  return {
    sampleCount: samples.length,
    effectiveSampleCount: Math.round(effective * 100) / 100,
    successRate: effective > 0 ? successCount / effective : undefined,
    failureRate,
    p50LatencyMs: percentile(latencies, 0.5),
    p95LatencyMs: percentile(latencies, 0.95),
    timeoutRate: weightedRate((s) => s.timeout),
    rateLimitRate: weightedRate((s) => s.rateLimited),
    averageInputTokens: weightedAvg((s) => s.inputTokens),
    averageOutputTokens: weightedAvg((s) => s.outputTokens),
    averageTotalTokens: weightedAvg((s) => s.totalTokens),
    averageCostUsd: weightedAvg((s) => s.costUsd),
    recentFailureCount: recentFailures,
    confidence,
    influence: Math.round(influence * 100) / 100,
    dimension,
    providerId,
    modelId,
    capability,
    provenance: EVIDENCE_PROVENANCE,
  };
}

/**
 * Pure query over the existing trace store. Computes measured evidence for
 * provider / provider+model / provider+model+capability dimensions with
 * recency weighting + progressive confidence. Snapshot results are cached
 * for a bounded TTL so a full trace scan never runs on every AI request.
 */
export class RoutingEvidenceService {
  private readonly store: TraceStore;
  private readonly now: () => number;
  private readonly options: Required<
    Pick<
      RoutingEvidenceOptions,
      | 'maxTraces'
      | 'halfLifeDays'
      | 'minSamples'
      | 'targetSamples'
      | 'recentWindowMs'
      | 'cacheTtlMs'
    >
  >;
  private cached: { snapshot: RoutingEvidenceSnapshot; computedAt: number } | null = null;

  constructor(options: RoutingEvidenceOptions) {
    this.store = options.store;
    this.now = options.now ?? ((): number => Date.now());
    this.options = {
      maxTraces: options.maxTraces ?? MAX_TRACES_DEFAULT,
      halfLifeDays: options.halfLifeDays ?? HALF_LIFE_DAYS_DEFAULT,
      minSamples: options.minSamples ?? MIN_SAMPLES_DEFAULT,
      targetSamples: options.targetSamples ?? TARGET_SAMPLES_DEFAULT,
      recentWindowMs: options.recentWindowMs ?? RECENT_WINDOW_MS_DEFAULT,
      cacheTtlMs: options.cacheTtlMs ?? CACHE_TTL_MS_DEFAULT,
    };
  }

  /** Compute (or reuse the bounded TTL cache of) a fresh evidence snapshot. */
  compute(): RoutingEvidenceSnapshot {
    const now = this.now();
    if (this.cached && now - this.cached.computedAt <= this.options.cacheTtlMs) {
      return this.cached.snapshot;
    }
    const snapshot = this.computeFresh(now);
    this.cached = { snapshot, computedAt: now };
    return snapshot;
  }

  private computeFresh(now: number): RoutingEvidenceSnapshot {
    const traces = this.store.list({ limit: this.options.maxTraces });
    const provider = new Map<string, Sample[]>();
    const providerModel = new Map<string, Sample[]>();
    const providerModelCapability = new Map<string, Sample[]>();
    let scannedSpans = 0;

    for (const trace of traces) {
      for (const span of trace.spans) {
        if (span.kind !== 'ai' || span.name !== 'ai.provider_execution') continue;
        scannedSpans += 1;
        const sample = sampleFromSpan(span, now);
        if (!sample) continue;
        push(provider, sample.provider, sample);
        if (sample.model) push(providerModel, dimensionKey(sample.provider, sample.model), sample);
        if (sample.model && sample.capability) {
          push(
            providerModelCapability,
            dimensionKey(sample.provider, sample.model, sample.capability),
            sample,
          );
        }
      }
    }

    const agg = (
      map: Map<string, Sample[]>,
      dimension: EvidenceDimension,
    ): Map<string, RoutingEvidence> => {
      const out = new Map<string, RoutingEvidence>();
      for (const [key, samples] of map) {
        const parts = key.split('|');
        const evidence = aggregate(
          samples,
          this.options,
          dimension,
          parts[0] ?? 'unknown',
          parts[1],
          parts[2],
        );
        if (evidence) out.set(key, evidence);
      }
      return out;
    };

    return {
      provider: agg(provider, 'provider'),
      providerModel: agg(providerModel, 'provider_model'),
      providerModelCapability: agg(providerModelCapability, 'provider_model_capability'),
      scannedTraces: traces.length,
      scannedSpans,
      computedAt: now,
    };
  }

  /** Provider-level measured evidence (undefined when no real samples exist). */
  evidenceForProvider(providerId: string): RoutingEvidence | undefined {
    return this.compute().provider.get(providerId);
  }

  /** Provider+model measured evidence (undefined when no model samples exist). */
  evidenceForModel(providerId: string, modelId: string): RoutingEvidence | undefined {
    return this.compute().providerModel.get(dimensionKey(providerId, modelId));
  }

  /** Provider+model+capability measured evidence (most specific dimension). */
  evidenceForCapability(
    providerId: string,
    modelId: string,
    capability: string,
  ): RoutingEvidence | undefined {
    return this.compute().providerModelCapability.get(
      dimensionKey(providerId, modelId, capability),
    );
  }

  /**
   * Best available dimension for routing: capability-specific when real
   * samples exist, else provider+model, else provider. Never fabricates.
   */
  bestEvidence(
    providerId: string,
    modelId?: string,
    capability?: string,
  ): RoutingEvidence | undefined {
    const snapshot = this.compute();
    if (modelId && capability) {
      const byCap = snapshot.providerModelCapability.get(
        dimensionKey(providerId, modelId, capability),
      );
      if (byCap) return byCap;
    }
    if (modelId) {
      const byModel = snapshot.providerModel.get(dimensionKey(providerId, modelId));
      if (byModel) return byModel;
    }
    return snapshot.provider.get(providerId);
  }

  /** Invalidate the cache (tests). */
  clearCache(): void {
    this.cached = null;
  }
}

function push<K>(map: Map<K, Sample[]>, key: K, sample: Sample): void {
  const list = map.get(key);
  if (list) list.push(sample);
  else map.set(key, [sample]);
}
