# EPIC-012 — Cost & Token Model

> **Date:** 2026-08-10
> **Status:** IMPLEMENTATION VERIFIED — the unified economics view is derived
> from the trace spine and tested (cost per request / application / build /
> refinement / user / provider / model + anomaly detection).

## 1. Mandate and Principle

Phase 8 of EPIC-012 requires a **single unified economics model**: tokens,
cost, latency, provider, model, application, execution, user, cache savings —
with anomaly detection for cost spikes, repeated calls, duplicate retrieval,
duplicate generation, unnecessary refinement, cache misses and provider
inefficiency.

**Principle:** the ledger **MEASURES — it never accounts twice and never
invents numbers**. Existing token-budget enforcement in the frozen runtime
(`LoopBudget` ITERATION_LIMIT + independent token budget, `maxInputTokens` /
`maxOutputTokens` guards) remains authoritative. Absent accounting attributes
contribute zero.

## 2. Data Flow

```
Engine spans/events (loop.step events = authoritative per-provider tokens+cost)
        │
        ▼
TraceStore (bounded, owner-scoped ExecutionTraces)
        │
        ▼
CostLedger.compute()  →  CostLedgerSnapshot
CostLedger.detectAnomalies()  →  CostAnomaly[]
```

The ledger is a **pure query over stored spans** — deterministic, no writes,
no side effects.

## 3. The Ledger Model

### 3.1 CostLedgerSnapshot

| Section         | Contents                                                                                                                              |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `totals`        | aiCalls, tokensInput, tokensOutput, tokensTotal, costUsd, cacheHits, retries, latencyMs                                               |
| `byProvider`    | per provider: calls, latencyMs, tokensInput/Output/Total, costUsd (sorted by cost)                                                    |
| `byApplication` | per application: totals + executions                                                                                                  |
| `byUser`        | per user: totals + executions                                                                                                         |
| `executions`    | per trace: executionId, traceId, applicationId, userId, name, status, tokensTotal, costUsd, aiCalls, cacheHits, startedAt, durationMs |

This answers: **cost per request / per application / per build / per
refinement / per user / by provider / by model**, plus cache savings
(cacheHits) and retry counts.

### 3.2 Cost anomaly detection

| Anomaly                  | Kind               | Trigger (defaults)                                       |
| ------------------------ | ------------------ | -------------------------------------------------------- |
| Cost spike               | `COST_SPIKE`       | execution cost > median × 3 (critical above × 6)         |
| Repeated identical calls | `REPEATED_CALLS`   | ≥ 5 ai spans with same name+provider+user within 60 s    |
| Cache-miss burst         | `CACHE_MISS_BURST` | ≥ 8 ai calls with 0 prompt-cache hits on one engine span |

All thresholds are configurable via `CostLedgerOptions`; anomalies carry
severity, trace/execution/application/user scope, message, value, threshold
and detection time.

## 4. Span Attribute Conventions (the accounting contract)

| Attribute                                         | Meaning                                                                    |
| ------------------------------------------------- | -------------------------------------------------------------------------- |
| `tokens_total` / `tokens_input` / `tokens_output` | token accounting on engine spans and `loop.step` events                    |
| `cost_usd`                                        | provider cost (loop.step events are the authoritative per-provider source) |
| `ai_calls`                                        | number of AI executions inside a factory/build span                        |
| `cache_hits`                                      | prompt-cache hits for the execution                                        |
| `provider` / `model`                              | provider and model for ai spans                                            |
| `latency_ms`                                      | span duration for provider latency views                                   |

`CostLedger.accumulateSpan` aggregates ai spans (calls, latency, retries) and
engine spans (tokens, cost, cache hits); `loop.step` events are summed into
the provider entries and the row totals. Per-provider token splits only exist
where the span data carries them — the ledger never fabricates splits.

## 5. Alert Integration

The alert engine's `cost_anomaly` rule consumes the ledger-derived median
baseline + most expensive execution (`ops.metricsSnapshot`); the
`token_anomaly` rule compares current vs previous window spend. Thresholds are
configurable and validated (clamped). See `EPIC_012_TELEMETRY_MODEL.md` §5.

## 6. What Is NOT Re-Tracked (reuse)

- `EconomicsTracker` (factory domain) — still authoritative for per-application
  estimate-vs-actual; its figures ride on the factory span attributes.
- `CostPlanner` (requirements pre-build estimate) — unchanged.
- `AIMetrics` cost counter — unchanged; the ledger reads trace data, not a
  second set of counters.

## 7. Boundedness

Ledger queries are capped (`limit` default 500, anomalies scan ≤ 1000 traces);
aggregation is in-memory and deterministic; the trace store bounds retention.
Observability can never become an unbounded memory or cost sink.
