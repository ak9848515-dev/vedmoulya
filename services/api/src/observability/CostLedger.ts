// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Unified Cost & Token Ledger
// EPIC-012 — Production Observability & Control Plane (Phase 8)
//
// A single economics model over the ExecutionTrace spine. Every engine
// span carries authoritative accounting attributes (loop.run →
// tokens_total/cost_usd/provider_calls; factory.build → economics tokens/
// cost/ai_calls/cache_hits; rag.search → strategy/latency; ai.* spans →
// provider/model/latency from the runtime), and loop.step events carry
// per-provider cost + tokens. The ledger aggregates these into one view:
//
//   cost per request / per application / per build / per refinement /
//   per user / by provider / by model
//
// plus anomaly detection (cost spikes, repeated identical calls, cache
// misses). It NEVER invents numbers — absent accounting attributes simply
// contribute zero. Token-budget enforcement in the frozen runtime remains
// authoritative; this ledger only MEASURES.
// ─────────────────────────────────────────────────────────────────────────────

import type { ExecutionTrace, TraceSpan, TraceStore, TraceStatus } from '@vedmoulya/core';

// ── Ledger shape ─────────────────────────────────────────────────────────────

export interface ProviderEconomics {
  provider: string;
  /** Number of AI span executions routed to this provider (from ai spans). */
  calls: number;
  /** Aggregate latency from ai.* spans (ms). */
  latencyMs: number;
  /** Tokens + cost from loop.step events (authoritative per-provider). */
  tokensInput: number;
  tokensOutput: number;
  tokensTotal: number;
  costUsd: number;
}

export interface EconomicsTotals {
  aiCalls: number;
  tokensInput: number;
  tokensOutput: number;
  tokensTotal: number;
  costUsd: number;
  cacheHits: number;
  retries: number;
  latencyMs: number;
}

export interface LedgerExecutionRow {
  executionId?: string;
  traceId: string;
  applicationId?: string;
  userId?: string;
  name: string;
  status: TraceStatus;
  tokensTotal: number;
  costUsd: number;
  aiCalls: number;
  cacheHits: number;
  startedAt: number;
  durationMs?: number;
}

export interface CostLedgerSnapshot {
  totals: EconomicsTotals;
  byProvider: ProviderEconomics[];
  byApplication: Array<{ applicationId: string } & EconomicsTotals & { executions: number }>;
  byUser: Array<{ userId: string } & EconomicsTotals & { executions: number }>;
  executions: LedgerExecutionRow[];
}

export interface CostAnomaly {
  kind: 'COST_SPIKE' | 'REPEATED_CALLS' | 'CACHE_MISS_BURST';
  severity: 'warning' | 'critical';
  executionId?: string;
  traceId?: string;
  applicationId?: string;
  userId?: string;
  message: string;
  value: number;
  threshold: number;
  detectedAt: number;
}

export interface CostLedgerOptions {
  /** Repeated-call threshold: same name+provider+user within the window. */
  repeatedCallWindowMs?: number;
  repeatedCallThreshold?: number;
  /** Cost spike: execution cost above median × multiplier. */
  costSpikeMultiplier?: number;
  /** Cache-miss burst: engine span with ai_calls ≥ N and cache_hits === 0. */
  cacheMissBurstCalls?: number;
  now?: () => number;
}

/**
 * Aggregates the ledger from the trace store. Pure query logic over stored
 * spans — no writes, no side effects, deterministic given the same traces.
 */
export class CostLedger {
  private readonly repeatedCallWindowMs: number;
  private readonly repeatedCallThreshold: number;
  private readonly costSpikeMultiplier: number;
  private readonly cacheMissBurstCalls: number;
  private readonly now: () => number;

  constructor(options: CostLedgerOptions = {}) {
    this.repeatedCallWindowMs = options.repeatedCallWindowMs ?? 60_000;
    this.repeatedCallThreshold = options.repeatedCallThreshold ?? 5;
    this.costSpikeMultiplier = options.costSpikeMultiplier ?? 3;
    this.cacheMissBurstCalls = options.cacheMissBurstCalls ?? 8;
    this.now = options.now ?? ((): number => Date.now());
  }

  compute(store: TraceStore, query: { userId?: string; limit?: number } = {}): CostLedgerSnapshot {
    const traces = store.list({ userId: query.userId, limit: query.limit ?? 500 });
    const totals: EconomicsTotals = {
      aiCalls: 0,
      tokensInput: 0,
      tokensOutput: 0,
      tokensTotal: 0,
      costUsd: 0,
      cacheHits: 0,
      retries: 0,
      latencyMs: 0,
    };
    const byProvider = new Map<string, ProviderEconomics>();
    const byApplication = new Map<string, EconomicsTotals & { executions: number }>();
    const byUser = new Map<string, EconomicsTotals & { executions: number }>();
    const executions: LedgerExecutionRow[] = [];

    for (const trace of traces) {
      const row: LedgerExecutionRow = {
        traceId: trace.traceId,
        executionId: trace.executionId,
        applicationId: trace.applicationId,
        userId: trace.userId,
        name: trace.name,
        status: trace.status,
        tokensTotal: 0,
        costUsd: 0,
        aiCalls: 0,
        cacheHits: 0,
        startedAt: trace.startedAt,
        durationMs: trace.endedAt !== undefined ? trace.endedAt - trace.startedAt : undefined,
      };

      for (const span of trace.spans) {
        this.accumulateSpan(span, totals, row, byProvider);
      }
      // loop.step events carry authoritative per-provider tokens/cost.
      for (const span of trace.spans) {
        for (const event of span.events) {
          if (event.name !== 'loop.step') continue;
          const provider = stringAttr(event.attributes?.provider);
          if (!provider) continue;
          const entry = ensureProvider(byProvider, provider);
          entry.tokensTotal += numAttr(event.attributes?.tokens_total);
          entry.tokensInput += numAttr(event.attributes?.tokens_input);
          entry.tokensOutput += numAttr(event.attributes?.tokens_output);
          entry.costUsd += numAttr(event.attributes?.cost_usd);
          row.tokensTotal += numAttr(event.attributes?.tokens_total);
          row.costUsd += numAttr(event.attributes?.cost_usd);
          totals.tokensTotal += numAttr(event.attributes?.tokens_total);
          totals.costUsd += numAttr(event.attributes?.cost_usd);
        }
      }

      executions.push(row);
      if (trace.applicationId) {
        const app = byApplication.get(trace.applicationId) ?? emptySubtotals();
        app.executions += 1;
        addTo(app, row);
        byApplication.set(trace.applicationId, app);
      }
      if (trace.userId) {
        const user = byUser.get(trace.userId) ?? emptySubtotals();
        user.executions += 1;
        addTo(user, row);
        byUser.set(trace.userId, user);
      }
    }

    return {
      totals,
      byProvider: [...byProvider.values()].sort(
        (a, b) => b.costUsd - a.costUsd || b.calls - a.calls,
      ),
      byApplication: [...byApplication.entries()]
        .map(([applicationId, e]) => ({ applicationId, ...e }))
        .sort((a, b) => b.costUsd - a.costUsd),
      byUser: [...byUser.entries()]
        .map(([userId, e]) => ({ userId, ...e }))
        .sort((a, b) => b.costUsd - a.costUsd),
      executions: executions.sort((a, b) => b.startedAt - a.startedAt),
    };
  }

  /** Detect cost/token anomalies across the retained traces. */
  detectAnomalies(store: TraceStore, query: { userId?: string } = {}): CostAnomaly[] {
    const anomalies: CostAnomaly[] = [];
    const traces = store.list({ userId: query.userId, limit: 1000 });
    const now = this.now();

    // 1. Cost spikes: executions above median × multiplier.
    const costs = traces
      .map((t) => this.traceCostUsd(t))
      .filter((c): c is number => c !== undefined && c > 0)
      .sort((a, b) => a - b);
    // Lower-middle median (stable for even-length samples). `?? 0` is required
    // by noUncheckedIndexedAccess under services/api's tsconfig.
    const median = costs.length > 0 ? (costs[Math.floor((costs.length - 1) / 2)] ?? 0) : 0;
    for (const trace of traces) {
      const cost = this.traceCostUsd(trace);
      if (cost === undefined || cost === 0 || median <= 0) continue;
      const threshold = median * this.costSpikeMultiplier;
      if (cost > threshold) {
        anomalies.push({
          kind: 'COST_SPIKE',
          severity: cost > threshold * 2 ? 'critical' : 'warning',
          traceId: trace.traceId,
          executionId: trace.executionId,
          applicationId: trace.applicationId,
          userId: trace.userId,
          message: `Execution ${trace.name} cost $${cost.toFixed(5)} — ${this.costSpikeMultiplier}× the median ($ ${median.toFixed(5)})`,
          value: cost,
          threshold,
          detectedAt: now,
        });
      }
    }

    // 2. Repeated identical AI calls: same name + provider + user in window.
    const seen = new Map<string, Array<{ traceId: string; startedAt: number }>>();
    for (const trace of traces) {
      for (const span of trace.spans) {
        if (span.kind !== 'ai') continue;
        const provider = stringAttr(span.attributes.provider) ?? 'unknown';
        const key = `${span.name}|${provider}|${trace.userId ?? ''}`;
        const list = seen.get(key) ?? [];
        list.push({ traceId: trace.traceId, startedAt: span.startedAt });
        seen.set(key, list);
      }
    }
    for (const [key, occurrences] of seen.entries()) {
      const recent = occurrences.filter((o) => now - o.startedAt <= this.repeatedCallWindowMs);
      if (recent.length >= this.repeatedCallThreshold) {
        const [name, provider, userId] = key.split('|');
        anomalies.push({
          kind: 'REPEATED_CALLS',
          severity: 'warning',
          userId: userId || undefined,
          message: `${recent.length}× repeated AI call "${name}" via ${provider} within ${this.repeatedCallWindowMs / 1000}s — check for duplicate generation/retrieval`,
          value: recent.length,
          threshold: this.repeatedCallThreshold,
          detectedAt: now,
        });
      }
    }

    // 3. Cache-miss bursts: engine span with many AI calls and zero cache hits.
    for (const trace of traces) {
      for (const span of trace.spans) {
        const aiCalls = numAttr(span.attributes.ai_calls);
        const cacheHits = numAttr(span.attributes.cache_hits);
        if (aiCalls >= this.cacheMissBurstCalls && cacheHits === 0) {
          anomalies.push({
            kind: 'CACHE_MISS_BURST',
            severity: 'warning',
            traceId: trace.traceId,
            executionId: trace.executionId,
            applicationId: trace.applicationId,
            userId: trace.userId,
            message: `${aiCalls} AI calls with zero prompt-cache hits in "${span.name}" — investigate cache key stability`,
            value: aiCalls,
            threshold: this.cacheMissBurstCalls,
            detectedAt: now,
          });
        }
      }
    }

    return anomalies.sort((a, b) => b.detectedAt - a.detectedAt);
  }

  // ── Internals ──────────────────────────────────────────────────────────────

  private accumulateSpan(
    span: TraceSpan,
    totals: EconomicsTotals,
    row: LedgerExecutionRow,
    byProvider: Map<string, ProviderEconomics>,
  ): void {
    if (span.kind === 'ai') {
      const provider = stringAttr(span.attributes.provider) ?? 'unknown';
      const entry = ensureProvider(byProvider, provider);
      entry.calls += 1;
      entry.latencyMs += span.durationMs ?? 0;
      totals.aiCalls += 1;
      totals.latencyMs += span.durationMs ?? 0;
      row.aiCalls += 1;
      if (span.name === 'ai.retry') totals.retries += 1;
    }
    // Engine spans carry authoritative economics attributes.
    const tokensTotal = numAttr(span.attributes.tokens_total);
    if (tokensTotal > 0) {
      totals.tokensTotal += tokensTotal;
      row.tokensTotal += tokensTotal;
      const provider = stringAttr(span.attributes.provider);
      if (provider) ensureProvider(byProvider, provider).tokensTotal += tokensTotal;
    }
    const tokensInput = numAttr(span.attributes.tokens_input);
    const tokensOutput = numAttr(span.attributes.tokens_output);
    if (tokensInput > 0 || tokensOutput > 0) {
      totals.tokensInput += tokensInput;
      totals.tokensOutput += tokensOutput;
    }
    const cost = numAttr(span.attributes.cost_usd);
    if (cost > 0) {
      totals.costUsd += cost;
      row.costUsd += cost;
    }
    const cacheHits = numAttr(span.attributes.cache_hits);
    if (cacheHits > 0) {
      totals.cacheHits += cacheHits;
      row.cacheHits += cacheHits;
    }
  }

  private traceCostUsd(trace: ExecutionTrace): number | undefined {
    let cost = 0;
    let found = false;
    for (const span of trace.spans) {
      const c = numAttr(span.attributes.cost_usd);
      if (c > 0) {
        cost += c;
        found = true;
      }
      for (const event of span.events) {
        if (event.name === 'loop.step' && numAttr(event.attributes?.cost_usd) > 0) {
          cost += numAttr(event.attributes?.cost_usd);
          found = true;
        }
      }
    }
    return found ? cost : undefined;
  }
}

function ensureProvider(map: Map<string, ProviderEconomics>, provider: string): ProviderEconomics {
  const existing = map.get(provider);
  if (existing) return existing;
  const entry: ProviderEconomics = {
    provider,
    calls: 0,
    latencyMs: 0,
    tokensInput: 0,
    tokensOutput: 0,
    tokensTotal: 0,
    costUsd: 0,
  };
  map.set(provider, entry);
  return entry;
}

function emptySubtotals(): EconomicsTotals & { executions: number } {
  return {
    aiCalls: 0,
    tokensInput: 0,
    tokensOutput: 0,
    tokensTotal: 0,
    costUsd: 0,
    cacheHits: 0,
    retries: 0,
    latencyMs: 0,
    executions: 0,
  };
}

function addTo(target: EconomicsTotals & { executions: number }, row: LedgerExecutionRow): void {
  target.aiCalls += row.aiCalls;
  target.tokensTotal += row.tokensTotal;
  target.costUsd += row.costUsd;
  target.cacheHits += row.cacheHits;
}

function numAttr(value: string | number | boolean | undefined): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function stringAttr(value: string | number | boolean | undefined): string | undefined {
  return typeof value === 'string' ? value : undefined;
}
