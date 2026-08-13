# EPIC-012 — Production Observability, Control Plane & Operations: Baseline Audit

> **Date:** 2026-08-10
> **Method:** every classification below was verified against source code during
> this audit — previous completion reports were NOT trusted. File references are
> listed per capability so each verdict is reproducible.
> **Verdict:** the platform has a mature-but-siloed observability estate: strong
> foundation (metrics registry, OTLP exporter, AI observability seams, health
> routers, audit logs, correlation IDs) with **no unified execution trace, no
> control plane, and no metrics/tracing emitted by RAG, LoopEngine, Factory or
> Experience engines**. EPIC-012's job is to CONNECT and COMPLETE, not rebuild.

## 1. Audit Scope

Every capability listed in the EPIC-012 mission was searched across
`packages/`, `services/`, `apps/` and `scripts/`. Classification legend:

| Class                             | Meaning                                             |
| --------------------------------- | --------------------------------------------------- |
| ✅ EXISTS AND SUFFICIENT          | implemented, tested, wired where applicable         |
| 🟡 EXISTS BUT INCOMPLETE          | present but missing wiring, depth or coverage       |
| 🔁 DUPLICATED                     | more than one implementation of the same capability |
| ❌ MISSING                        | not present in source                               |
| 📋 SHOULD ADOPT EXISTING STANDARD | OpenTelemetry / Langfuse seam already exists        |
| ⛔ NOT REQUIRED                   | intentionally out of scope                          |

## 2. Capability-by-Capability Classification

### 2.1 Core infrastructure (PH-002 foundation)

| Capability                                              | Class | Source evidence                                                                                                                                                                                         |
| ------------------------------------------------------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Metrics registry (counters/gauges/histograms/timers)    | ✅    | `packages/core/src/metrics/index.ts` — `MetricsRegistry`, `Timer`, `histogramStats` (count/sum/min/max/avg/p50/p95/p99)                                                                                 |
| Prometheus scrape export                                | ✅    | `packages/core/src/observability/prometheus.ts` + `apps/web/src/app/api/metrics/route.ts` (`GET /api/metrics`, text exposition)                                                                         |
| OTLP exporter (traces + metrics, batched, non-blocking) | ✅    | `packages/core/src/observability/otel.ts` — `OtelExporter`, interval flush, 2s abort, failure-swallowed, 10k metric bound                                                                               |
| Gateway observability startup wiring                    | ✅    | `services/api/src/observability/startup.ts` — `initGatewayObservability()` idempotent, runtime gauges, signal flush; called from `apps/web/src/app/api/trpc/[trpc]/route.ts` + `/api/metrics/route.ts`  |
| Runtime gauges (memory/CPU/uptime)                      | ✅    | `packages/core/src/observability/runtime.ts` — `recordRuntimeMetrics`, `getRuntimeInfo`                                                                                                                 |
| Correlation IDs (AsyncLocalStorage)                     | ✅    | `packages/core/src/observability/correlation.ts` — `createCorrelationId`, `runWithCorrelation`, `getCorrelationId`                                                                                      |
| Error reporting hub                                     | ✅    | `packages/core/src/observability/errorReporter.ts` — `ErrorReporterHub` (console default + optional HTTP sink), never throws                                                                            |
| TraceProvider / Span model                              | 🟡    | `packages/core/src/tracing/index.ts` — `TraceProvider`, `Span` (traceId/spanId/parent/status/error). **No production caller found outside tests** — spans are never created by real flows               |
| Redaction utilities                                     | ✅    | `packages/services/src/ai/runtime/AIObservability.ts` `redactSecrets`; `services/api/src/services/InfrastructureHealthProbe.ts` `sanitizeError`; `services/identity/src/...ErrorMapper` redacts DB URLs |

### 2.2 AI Runtime observability

| Capability                                                                                          | Class | Source evidence                                                                                                                                                                                                                                                     |
| --------------------------------------------------------------------------------------------------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AI metrics (requests/success/failure/latency/tokens/cost/fallback/rate-limit/cache/provider-health) | ✅    | `packages/services/src/ai/AIMetrics.ts` singleton; emitted from `AIOrchestrationService.ts` on every call                                                                                                                                                           |
| AI observability abstraction (NOOP/TEST/OTel/Langfuse seams)                                        | ✅    | `packages/services/src/ai/runtime/AIObservability.ts` — `AIObservability`, `Noop/Test/Otel/Langfuse` exporters, `redactSecrets`, payload-capture policy, user/tenant correlation flag                                                                               |
| AI span export wired in production                                                                  | ❌    | Gateway never passes an exporter — `AIOrchestrationService` defaults to `new AIObservability()` (NOOP). `OtelAIObservabilityExporter` + `OtelBridge` exist (`packages/services/src/ai/runtime/AIObservability.ts:126-153`) but have **no production instantiation** |
| Provider-level tracing (traceId per call)                                                           | ✅    | `VercelAIProvider.ts` / `OpenAIProvider.ts` / `MockProvider.ts` return `traceId` (`openai-…`, `mock-…`)                                                                                                                                                             |
| Provider health (live)                                                                              | ✅    | `services/orchestrator/src/providers/*Provider.getHealth()` + `services/api/src/routers/AIRouter.ts` (`ai.getAllProviderHealth`, `ai.getProviderHealth`)                                                                                                            |
| Time-to-first-token telemetry                                                                       | ❌    | not captured in the AI span model                                                                                                                                                                                                                                   |
| Retry/fallback/429/5xx/timeout telemetry                                                            | 🟡    | counted in `AIMetrics` (recordFailure/recordFallback/recordRateLimit) but not correlated per-execution                                                                                                                                                              |
| Structured-output failure / abstention / budget rejection telemetry                                 | 🟡    | events exist in runtime logic; not emitted as distinct telemetry events                                                                                                                                                                                             |
| Langfuse exporter                                                                                   | 📋    | `LangfuseAIObservabilityExporter` seam exists (endpoint + x-langfuse keys, batched, failure-swallowed) — **operator activation only**, never fabricate live evidence                                                                                                |

### 2.3 RAG observability

| Capability                                                                                                                   | Class | Source evidence                                                                                                                                              |
| ---------------------------------------------------------------------------------------------------------------------------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| RAG health + readiness (strict production gate)                                                                              | ✅    | `services/api/src/routers/RagRouter.ts` — `getHealth`/`getReadiness` (vector store reachability, embedding model, production strictness)                     |
| Per-query RAG telemetry (latency, candidates, selected/excluded, strategy, embedding usage, evidence state, cache, fallback) | ❌    | **No telemetry found** in `packages/rag/src` (verified by search: no `metrics.observe`, no `AIMetrics`, no trace events). `rag.getStats` returns counts only |
| Owner isolation of retrieval metadata                                                                                        | ✅    | `RagRouter` procedures are user-scoped; `PostgresRagRepository` owner-keyed (contract-tested)                                                                |
| Retrieval quality / grounding success / conflict detection telemetry                                                         | 🟡    | EvidenceEvaluator classifies (SUFFICIENT/PARTIAL/INSUFFICIENT/CONFLICTING) but results are not exported as metrics/traces                                    |

### 2.4 LoopEngine observability

| Capability                                                                                                          | Class | Source evidence                                                                                                                          |
| ------------------------------------------------------------------------------------------------------------------- | ----- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Run persistence (full LoopRun incl. budget/result/termination)                                                      | ✅    | `packages/loop-engine/src/infrastructure/LoopRunStore.ts` (in-memory; Postgres seam)                                                     |
| Loop telemetry events (per iteration, specialist, task, provider, latency, evidence, critic verdict, termination)   | ❌    | **No metrics/tracing in `packages/loop-engine`** (verified by search). `LoopRunStore` persists the final run; no per-step events emitted |
| Termination-reason classification (SUCCESS/FAILED/ABSTAINED/BUDGET_EXCEEDED/TIMEOUT/SECURITY_BLOCK/USER_CANCELLED…) | 🟡    | `loop-types.ts` has termination reasons (12); persisted but not exported as telemetry                                                    |

### 2.5 Application Factory observability

| Capability                                                                                                  | Class | Source evidence                                                                                                                                                                                     |
| ----------------------------------------------------------------------------------------------------------- | ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| EconomicsTracker (AI calls, tokens, cost, cache hits, iterations, retries, provider usage, generation time) | ✅    | `packages/app-factory/src/domain/EconomicsTracker.ts`; persisted on the application document; estimate-before vs actual-after                                                                       |
| Application lifecycle persistence (timeline reconstructable from document)                                  | ✅    | EPIC-008 `ApplicationVersion` history + full project document persistence                                                                                                                           |
| Factory telemetry events (per-stage duration, AI calls, files changed, security findings, quality score)    | ❌    | EconomicsTracker stays in the domain; **no metrics/trace events emitted**                                                                                                                           |
| Application health field                                                                                    | 🟡    | `FactoryApplicationDTO.health` (`healthy`/`unhealthy`/`unknown`) exists but is a coarse boolean from the last build; no HEALTHY/DEGRADED/BLOCKED/FAILED/UNKNOWN model with active-issue aggregation |

### 2.6 Experience / Quality observability

| Capability                                                                      | Class | Source evidence                                                                                     |
| ------------------------------------------------------------------------------- | ----- | --------------------------------------------------------------------------------------------------- |
| Quality evaluation (10 dimensions, findings with evidence class)                | ✅    | `packages/experience/src/domain/QualityEvaluator.ts`, `VisualCriticEngine`, evidence-first findings |
| Traceability engine (requirement → decision → component → file → test → review) | ✅    | `packages/experience/src/domain/TraceabilityEngine.ts`                                              |
| Quality/refinement telemetry events                                             | ❌    | findings are returned to the UI; **no telemetry events emitted**                                    |

### 2.7 Economics / cost

| Capability                                                                            | Class | Source evidence                                                                                              |
| ------------------------------------------------------------------------------------- | ----- | ------------------------------------------------------------------------------------------------------------ |
| Per-application cost/token accounting                                                 | ✅    | `EconomicsTracker` (factory) + `CostPlanner` (requirements, pre-build estimate) + `AIMetrics` cost counter   |
| Unified cross-provider/model/execution/user cost ledger                               | ❌    | each tracker is siloed; no aggregate query surface                                                           |
| Cost anomaly / repeated-call / duplicate-retrieval / unnecessary-refinement detection | ❌    | not present                                                                                                  |
| Cache-savings aggregation                                                             | 🟡    | `PromptCacheManager` hit/miss feeds `AIMetrics`; no per-application savings figure                           |
| Token-budget enforcement remains authoritative                                        | ✅    | `LoopBudget` (ITERATION_LIMIT + independent token budget); runtime `maxInputTokens`/`maxOutputTokens` guards |

### 2.8 Health & platform status

| Capability                                                                                  | Class | Source evidence                                                                                                  |
| ------------------------------------------------------------------------------------------- | ----- | ---------------------------------------------------------------------------------------------------------------- |
| Platform health router (check/live/ready/version + components + response times + readiness) | ✅    | `services/api/src/routers/HealthRouter.ts`                                                                       |
| Infrastructure probes (DB SELECT 1, Redis PING, sanitized errors)                           | ✅    | `services/api/src/services/InfrastructureHealthProbe.ts`                                                         |
| OS health (engines + pipeline + diagnostics + snapshots) + scheduler                        | ✅    | `services/api/src/routers/OSRouter.ts` + `services/api/src/observability/os-health-scheduler.ts` (5-min cadence) |
| RAG health/readiness                                                                        | ✅    | `RagRouter.getHealth/getReadiness`                                                                               |
| Provider health view (live)                                                                 | ✅    | `ai.getAllProviderHealth`                                                                                        |

### 2.9 Control plane / operator surface

| Capability                                                                                  | Class | Source evidence                                                                                                                    |
| ------------------------------------------------------------------------------------------- | ----- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Inspect executions / traces / failures / cost / quality / deployments                       | ❌    | **no control-plane router or namespace** (health + OS routers are read-only status views)                                          |
| Operator actions (retry/cancel/disable provider/invalidate cache/re-run validation/quality) | ❌    | **not present**                                                                                                                    |
| Audit trail for operator actions                                                            | ❌    | per-service audit logs exist (Identity/Memory/Knowledge/Decision/ExecutionAudit with correlationId) but no operator-action auditor |

### 2.10 Incident diagnostics & alerting

| Capability                                                                                                                                          | Class | Source evidence                                                            |
| --------------------------------------------------------------------------------------------------------------------------------------------------- | ----- | -------------------------------------------------------------------------- |
| Structured incident diagnostics (WHAT/WHEN/WHERE/WHY/attempted/provider/retries/fallback/evidence/user+operator steps)                              | ❌    | `terminationReason` + typed errors exist but no diagnostic bundle endpoint |
| Alerting (provider outage, latency/429/5xx/RAG/abstention spikes, cost/token anomaly, quality regression, security, deployment/application failure) | ❌    | **not present** (would sit on the metrics registry + health routers)       |

### 2.11 Security & privacy of telemetry

| Capability                           | Class | Source evidence                                                                                      |
| ------------------------------------ | ----- | ---------------------------------------------------------------------------------------------------- |
| Redaction of secrets in spans/errors | ✅    | `redactSecrets` + `sanitizeError` + error-mapper redaction; AISecurity tests assert no leakage       |
| Cross-user telemetry isolation       | 🟡    | audit + RAG procedures are user-scoped; **no telemetry/control API exists to test IDOR against yet** |
| Authorization on operator actions    | ❌    | no control plane exists                                                                              |
| Retention controls                   | ❌    | not present (no telemetry store)                                                                     |

### 2.12 Performance / load

| Capability                                                                         | Class | Source evidence                                                                                       |
| ---------------------------------------------------------------------------------- | ----- | ----------------------------------------------------------------------------------------------------- |
| Observability-overhead measurement                                                 | 🟡    | exporter is batched + failure-swallowed + bounded (10k) by design; **no measured overhead benchmark** |
| Load/scale test (concurrent executions, telemetry events, CPU/memory/latency/cost) | ❌    | `scripts/load-test.mjs` exists (HTTP load) but no observability-focused scale test                    |

## 3. Reuse Inventory — What EPIC-012 MUST NOT Duplicate

| Already exists                                                   | EPIC-012 must…                                                                               |
| ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `MetricsRegistry` + Prometheus + OTLP exporter + gateway startup | reuse as the single metrics/trace export path — do NOT build a second telemetry backend      |
| `AIObservability` NOOP/TEST/OTel/Langfuse seams + redaction      | wire the OTel/Langfuse exporter at the gateway (clean adapter), do NOT create new AI tracing |
| `OtelExporter`/`TraceProvider`                                   | adopt as the trace spine (bridge AI + engine spans through it)                               |
| Health routers (platform/RAG/provider/OS)                        | extend, do not duplicate                                                                     |
| Per-service audit logs (correlationId)                           | reuse the pattern for operator-action audit                                                  |
| `EconomicsTracker`/`CostPlanner`/`AIMetrics`/`LoopRunStore`      | aggregate into a unified economics view — do not re-track costs a second way                 |
| Correlation context                                              | propagate the correlationId into the execution trace                                         |

## 4. The Core Gap (drives the architecture)

**There is no `ExecutionTrace`.** Today:

- providers return `traceId` per call; audit logs carry `correlationId`; metrics are in one registry — but nothing connects
  `user → application → requirements → loop → AI → RAG → provider → quality → refinement → deployment`
  under one stable `executionId`/`traceId`/`spanId` spine.
- RAG, LoopEngine, Factory and Experience emit **zero** metrics/tracing events (verified in source).
- There is no control plane, no incident-diagnostics bundle, no alerting, and no unified cost ledger.

Everything else (Phase 3 AI, Phase 4 RAG health, Phase 5 termination classification, Phase 6 factory economics, Phase 7 quality model, Phase 9 provider health, Phase 10 partial app health, Phase 14 redaction) already has a foundation to EXTEND.

## 5. Suggested Build Order (respecting the audit)

1. **ExecutionTrace spine (Phase 1)** — stable `requestId`/`executionId`/`applicationId`/`userId` + `spanId` propagation through the existing `TraceProvider`/`OtelExporter`; bridge `AIObservability` exporter at the gateway (Phase 2 adoption — OTel preferred, Langfuse operator-gated).
2. **Engine telemetry events (Phases 3–7)** — emit metrics/span events from RAG, Loop, Factory, Experience via a narrow Telemetry Port (engines stay vendor-agnostic).
3. **Unified economics (Phase 8)** — aggregate `EconomicsTracker` + `AIMetrics` + cost planner into a queryable cost ledger with anomaly detection (no second accounting).
4. **Application health model (Phase 10)** — HEALTHY/DEGRADED/BLOCKED/FAILED/UNKNOWN from build+test+security+quality+AI+RAG+deployment signals.
5. **Control plane (Phase 11) + incident diagnostics (Phase 12) + alerting (Phase 13)** — auth+audited operator namespace; alerts on existing thresholds.
6. **Security audit of telemetry (Phase 14) + overhead measurement (Phase 15) + failure tests (Phase 17) + load (Phase 18) + tests (Phase 19) + docs (Phase 20).**

Nothing below is started yet — this document is Phase 0 only, per the epic's mandatory ordering.
