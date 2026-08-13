# EPIC-012 — Telemetry Model

> **Date:** 2026-08-10
> **Status:** IMPLEMENTATION VERIFIED — trace spine, engine telemetry, AI
> bridge, control-plane telemetry and alerting are implemented and tested
> (595/595 gateway tests, 457 engine tests, 13 core trace tests green).

## 1. Data Model

### 1.1 ExecutionTrace

```
ExecutionTrace {
  traceId        // stable root id ('trace-…')
  name           // root span name, e.g. 'factory.build'
  status         // TraceStatus (see 1.3)
  startedAt      // epoch ms
  endedAt?       // epoch ms
  executionId?   // shared across the whole flow
  userId?        // owner — the ONLY non-operator read scope
  applicationId?
  correlationId? // gateway request correlation
  attributes     // redacted, structured
  spans          // TraceSpan[]
}
```

### 1.2 TraceSpan

```
TraceSpan {
  spanId, traceId, parentSpanId?
  name        // stable, e.g. 'ai.run', 'rag.search', 'loop.step'
  kind        // 'engine' | 'ai' | 'rag' | 'gateway' | 'control'
  status      // TraceStatus
  startedAt, endedAt?, durationMs?
  attributes  // redacted structured key/value (never secrets, never raw prompts)
  events      // TraceEvent[] — { name, timestamp, attributes? }
  error?      // { code, message } — redacted, no stack traces
}
```

### 1.3 TraceStatus vocabulary

A superset of the loop-engine termination reasons so every engine outcome maps
1:1: `OK` · `ERROR` · `FAILED` · `ABSTAINED` · `BUDGET_EXCEEDED` · `TIMEOUT` ·
`PROVIDER_FAILURE` · `VALIDATION_FAILURE` · `SECURITY_BLOCK` ·
`USER_CANCELLED`. `normalizeTraceStatus` maps raw engine statuses (SUCCESS /
READY / DEPLOYED / CANCELLED / …) onto this fixed vocabulary.

## 2. Span Vocabulary (the correlated journey)

| Stage         | Span name                                                                                                      | kind    | Key attributes                                                                                                                 | End status                                                         |
| ------------- | -------------------------------------------------------------------------------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------ |
| Requirements  | `requirements.start/answer/plan/approve`                                                                       | engine  | session_id, phase, idea                                                                                                        | OK / VALIDATION_FAILURE                                            |
| Factory       | `factory.create` / `approve` / `build` / `resume` / `deploy`                                                   | engine  | goal, application_id, archetype, status, tokens_total, cost_usd, ai_calls, cache_hits                                          | OK / FAILED / SECURITY_BLOCK / VALIDATION_FAILURE                  |
| Loop          | `loop.run`                                                                                                     | engine  | goal, executionId                                                                                                              | OK / BUDGET_EXCEEDED / TIMEOUT / PROVIDER_FAILURE / USER_CANCELLED |
| Loop step     | `loop.step` **event**                                                                                          | —       | provider, model, tokens_total/input/output, cost_usd, latency_ms, retried, fallback_used                                       | —                                                                  |
| Experience    | `experience.evaluate` / `refine`                                                                               | engine  | verdict, overall, findings, blocking                                                                                           | OK / VALIDATION_FAILURE (NOT_READY)                                |
| RAG           | `rag.ingest` / `rag.search`                                                                                    | rag     | collection, source_id, content_chars, chunks, tokens, embedding_model, strategy, item_count, latency_ms                        | OK / FAILED                                                        |
| AI runtime    | `ai.run` / `ai.provider_execution` / `ai.retrieval` / `ai.retry` / `ai.fallback` / `ai.evidence`               | ai      | provider, model, capability, latency, tokens, cost, cache hit/miss, retry count, 429/5xx/timeout, abstention, budget rejection | OK / PROVIDER_FAILURE / TIMEOUT / ABSTAINED                        |
| Control plane | `ops.retry` / `ops.cancel` / `ops.revalidate` / `ops.requality` / `ops.disableProvider` / `ops.enableProvider` | control | target, status, cancelled, verdict, provider, to                                                                               | OK / FAILED (CONTROL_ACTION_FAILED)                                |

Every control action additionally writes an `AuditRecord` (actor, action,
target, detail, ok, timestamp).

## 3. Engine Wiring

Each engine's application service now receives a `TelemetryPort` (defaulting to
`NOOP_TELEMETRY` so behavior is unchanged when observability is disabled):

- **Loop** — `startSpan('loop.run')` kept open across the async run; ended by
  the run's terminal transition. Each step emits a `loop.step` event carrying
  authoritative per-provider tokens/cost (this is the primary cost source for
  the ledger).
- **Factory** — `withSpan` around create/approve/build/resume/deploy; build
  spans carry the economics attributes from the persisted `EconomicsTracker`.
- **Experience** — synchronous deterministic `startSpan('experience.evaluate')`
  carrying verdict/overall/findings/blocking.
- **Requirements** — `withSpan` around start/answer/plan/approve with
  session/phase attributes.
- **RAG** — `withSpan` around ingest/search with collection/chunk/strategy/
  latency attributes.

## 4. AI Runtime Bridge

`TraceProviderOtelBridge` implements the frozen `AIObservability.OtelBridge`
contract against the ExecutionTrace spine. Called inside an active engine span,
the ambient AsyncLocalStorage context parents each `ai.*` span under the
engine trace — so one trace reconstructs
`ENGINE → AI → PROVIDER → RETRY → FALLBACK → VALIDATION`. All string
attributes pass through `redactSecrets` (the same redactor the AI runtime
uses).

## 5. Metrics Mapping

Pre-existing `AIMetrics` + `MetricsRegistry` counters remain the live in-run
counters. The alert engine reads a deterministic snapshot
(`aiRequestsTotal/Failure`, `aiRateLimit429`, `aiAbstentions`,
`ragFallbackCount`, `promptCacheHitRatio`, cost baseline, failure counts from
the trace store) and applies configurable thresholds. No duplicate counters
were introduced.

## 6. Boundedness (Phase 15 compliance)

- `TraceStore`: FIFO cap 5000, optional TTL, lazy eviction.
- `AuditTrail`: ring buffer 500.
- `AlertEngine`: history ring 200.
- `ExecutionTraceProvider`: `maxOpenSpans` 10 000 hard guard (oldest dropped).
- Telemetry never throws into engine code (stores/exporter swallow failures).
- No infinite telemetry loop: the ops spans are written by the ops service
  itself and are not re-telemetrized.
