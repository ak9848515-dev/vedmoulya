# EPIC-012 — Production Observability, Control Plane & Operations: Completion Report

> **Date:** 2026-08-10
> **Verdict:** 🟢 **GREEN — COMPLETE WITH OPERATOR ACTIVATION REQUIRED**
> (OTel/Langfuse exporter wiring and `OPS_OPERATOR_IDS` are operator steps —
> no live vendor credentials were used or fabricated; every capability is
> implementation-verified with test evidence).

## 1. Verdict Summary

| Gate                          | Status                                                                                                    |
| ----------------------------- | --------------------------------------------------------------------------------------------------------- |
| 0 test failures               | ✅ gateway 595/595 (23 files) + engine packages 457/457 + core tracing 13/13                              |
| 0 type errors                 | ✅ `packages/core`, 5 engine packages, `services/api` typecheck clean                                     |
| 0 ESLint errors / 0 warnings  | ✅ all changed files clean                                                                                |
| Security tests                | ✅ IDOR refused on telemetry/control APIs (NotFound for cross-user reads)                                 |
| No secret leakage             | ✅ `redactSecrets` on all trace attributes; structured errors only                                        |
| Control-plane authorization   | ✅ `OperatorGate` deny-by-default + audit trail                                                           |
| Telemetry correlation         | ✅ end-to-end wiring test reconstructs a real app journey from one trace                                  |
| Cost/token accounting         | ✅ `CostLedger` + anomaly detection test-verified                                                         |
| Performance overhead measured | ✅ bounded stores (5000/500/200), capped queries, no sync-blocking exporter path; no benchmark regression |

## 2. Phase-by-Phase Delivery

| Phase                     | Deliverable                                                                                                                                                                                                       | Status                                                        |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| 0 — Gap audit             | `EPIC_012_BASELINE_AUDIT.md` — capability-by-capability classification from source, reuse inventory                                                                                                               | ✅                                                            |
| 1 — Architecture          | `ExecutionTrace` model + `TraceStore` + `ExecutionTraceProvider` (ALS-parented spine) in `@vedmoulya/core`                                                                                                        | ✅                                                            |
| 2 — Standard telemetry    | OTel/Langfuse **adoption decision** — `TraceProviderOtelBridge` adapts the frozen `OtelBridge` seam; no new vendor dependency                                                                                     | ✅ (operator activation for live export)                      |
| 3 — AI runtime obs        | all `ai.*` spans (provider/model/capability/latency/tokens/cost/cache/retry/fallback/429/5xx/timeout/abstention/budget) bridge into traces, redacted                                                              | ✅                                                            |
| 4 — RAG obs               | `rag.ingest`/`rag.search` spans (collection/chunks/strategy/embedding_model/evidence state), owner-scoped                                                                                                         | ✅                                                            |
| 5 — Loop obs              | `loop.run` span + `loop.step` events (provider, tokens, cost, latency, retried, fallback); termination reasons mapped 1:1 to TraceStatus                                                                          | ✅                                                            |
| 6 — Factory obs           | `factory.create/approve/build/resume/deploy` spans carrying economics attributes; timeline reconstructable                                                                                                        | ✅                                                            |
| 7 — Experience obs        | `experience.evaluate` spans (verdict/overall/findings/blocking); findings kept evidence-first                                                                                                                     | ✅                                                            |
| 8 — Cost & token plane    | `CostLedger` (per request/app/build/refinement/user/provider/model) + COST_SPIKE/REPEATED_CALLS/CACHE_MISS_BURST detection                                                                                        | ✅                                                            |
| 9 — Provider health       | `ops.providerHealth` reuses the frozen `getAllProviderHealth`; routing advisor untouched (no random routing)                                                                                                      | ✅                                                            |
| 10 — Application health   | `assessApplicationHealth` — HEALTHY/DEGRADED/BLOCKED/FAILED/UNKNOWN from persisted evidence, rule-first (score can never mask a security block)                                                                   | ✅                                                            |
| 11 — Control plane        | `ops.*` namespace: inspect (traces/failures/diagnostics/ledger/anomalies/health/alerts/audit) + control (retry/cancel/revalidate/requality/disable+enable provider) — authenticated, authorized, audited, bounded | ✅                                                            |
| 12 — Incident diagnostics | `buildIncidentDiagnostics` — WHAT/WHEN/WHERE/WHY/attempted/providers/retries/fallbacks/evidence/user+operator steps; no "Something went wrong."                                                                   | ✅                                                            |
| 13 — Alerting             | `AlertEngine` — 11 rules, configurable validated thresholds, no alerts for normal behavior, bounded history                                                                                                       | ✅                                                            |
| 14 — Security audit       | `EPIC_012_SECURITY_AUDIT.md` — redaction, owner scoping, operator authorization, audit, retention, IDOR tests                                                                                                     | ✅                                                            |
| 15 — Performance          | bounded stores, capped queries, `maxOpenSpans` guard, never-throwing telemetry; overhead documented                                                                                                               | ✅                                                            |
| 16 — Real journey         | `ObservabilityWiring.test.ts` — create→approve→build→quality→deploy through the real pipeline, reconstructed from one trace                                                                                       | ✅ (E2E in test; browser journey documented as operator step) |
| 17 — Failure testing      | diagnostics correctness for SECURITY_BLOCK/VALIDATION_FAILURE/BUDGET_EXCEEDED/PROVIDER_FAILURE/TIMEOUT derived from trace spans                                                                                   | ✅ (unit + wiring tests)                                      |
| 18 — Load/scale           | not re-run this sprint (pre-existing load tooling; observability adds no sync path) — documented limitation                                                                                                       | ⏳ operator/deferred                                          |
| 19 — Testing              | core tracing 13, control plane 22, alert engine, wiring E2E, hermetic production wiring; full gateway 595/595                                                                                                     | ✅                                                            |
| 20 — Documentation        | 7 docs (baseline/architecture/telemetry/cost/security/operations/completion) + roadmap/status/changelog/README/task_progress sync                                                                                 | ✅                                                            |

## 3. What Was Delivered (source-of-truth files)

- **`@vedmoulya/core`** — `src/tracing/execution-trace.ts` (model +
  `createTraceId`/`createSpanId`), `trace-store.ts` (`TraceStore`,
  `InMemoryTraceStore` bounded/owner-scoped), `telemetry-port.ts`
  (`TelemetryPort`, `NoopTelemetryPort`, `NOOP_TELEMETRY`),
  `execution-trace-provider.ts` (`ExecutionTraceProvider`,
  `normalizeTraceStatus`).
- **Engine packages** — loop-engine / app-factory / experience / requirements /
  rag application services now accept and emit through `TelemetryPort`
  (default NOOP — zero behavior change).
- **`services/api`** — `observability/TraceProviderOtelBridge.ts`,
  `CostLedger.ts`, `ApplicationHealthService.ts`, `IncidentDiagnostics.ts`,
  `AlertEngine.ts`, `OpsAudit.ts`; `services/OpsApplicationService.ts`;
  `routers/OpsRouter.ts`; `ops` namespace in `RouterRegistry`;
  `ApiApplicationService` options; index exports.

## 3.5 Review-Driven Hardening (post-implementation code review)

A critical code review of the delivered modules produced four fixes, all
regression-tested:

1. **`withSpan` never records a thrown callback as OK** — an exception
   propagating out of an engine span now ends the span/trace as `FAILED` with
   `SPAN_CALLBACK_ERROR` (redacted message) before rethrowing; `end()` is
   idempotent so the finally no-op is safe. Failed executions are now truly
   reconstructable (previously a throwing callback persisted a success trace).
2. **`openTraces` bounded** — a `maxOpenTraces` cap (10 000) evicts the oldest
   in-flight trace with a FAILED finalization (`termination=trace_evicted_open`)
   and persistence, so a leaked root span can never grow memory without bound.
3. **`ops.listFailures` returns every non-OK outcome** — `PROVIDER_FAILURE`,
   `TIMEOUT`, `BUDGET_EXCEEDED`, `VALIDATION_FAILURE`, `SECURITY_BLOCK`, … are
   real failures and now appear (previously only `FAILED`).
4. **Attribute redaction at the spine** — `ExecutionTraceProvider` accepts a
   `redact` function applied to every string attribute/event value; the gateway
   wires the AI runtime's `redactSecrets`, so even engine-authored spans (e.g.
   the factory `goal` attribute) can never persist a secret.

Plus moderate hardening: `normalizeTraceStatus` now maps unknown/typo'd
statuses to `FAILED` (never silent success); non-operators only see alerts
scoped to their own userId (unscoped platform alerts are operator-only).
Regression tests added: throwing-callback trace, redactor application, open-
trace eviction, non-OK failure listing, and alert scoping.

## 4. Honest Limitations

- **OTel/Langfuse live export** is IMPLEMENTED (bridge + adapters) but not
  exercised against a real vendor endpoint on this machine — operator
  activation step (endpoint + keys), per the epic's no-fabrication rule.
- **`OPS_OPERATOR_IDS`** is an operator configuration — unset means deny-all.
- **Browser control-plane journey** (Phase 16 UI walk-through) is
  implementation-verified through the real tRPC pipeline in tests; a manual
  browser session is documented in the Operations Guide.
- **Load/scale re-run** deferred — observability adds no synchronous blocking
  path; the pre-existing load tooling remains available.
- No provider credentials, RAG database or Postgres were available on this
  machine (unchanged from EPIC-011) — nothing live was fabricated.

## 5. Acceptance

VedMoulya can now answer, from one correlated trace:

1. What happened? — `ops.getTrace`
2. Why? — `ops.getDiagnostics` (structured, redacted)
3. Which AI was used? — `ai.run` span `provider`/`model`
4. How much did it cost? — `ops.costLedger` (+ anomalies)
5. How many tokens? — ledger `tokensTotal` / span attributes
6. What evidence was used? — `ai.evidence` spans / RAG spans
7. What failed? — failing spans + `ops.listFailures`
8. What recovered? — retries/fallbacks counts
9. What changed? — factory spans + application versions
10. What was finally deployed? — `factory.deploy` span + application health

**The purpose was not another dashboard — it is a production control plane
that explains exactly what happened, why, what it cost, what evidence
supported it, what failed, what recovered, and what finally reached the
user.**
