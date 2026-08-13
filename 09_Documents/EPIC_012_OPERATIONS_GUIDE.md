# EPIC-012 — Operations Guide (Control Plane)

> **Date:** 2026-08-10
> **Status:** IMPLEMENTATION VERIFIED — the `ops.*` control-plane namespace is
> wired into the gateway RouterRegistry and test-verified through the real
> tRPC pipeline (21 control-plane tests + end-to-end wiring test).

## 1. Operator Setup

1. Set `OPS_OPERATOR_IDS` to the comma-separated user ids allowed to run
   platform-wide reads and control actions. **Leave unset (or empty) to deny
   all operator actions** (fail closed).
2. Set `AI_RUNTIME_LEGACY_RAW_FETCH` / provider keys per the frozen runtime
   config (unchanged).
3. Optional: activate OTel/Langfuse exporters per `EPIC_012_ARCHITECTURE`
   — the `TraceProviderOtelBridge` already adapts the frozen `OtelBridge`
   seam; point the pre-existing exporter at your OTel/Langfuse endpoint.

## 2. The `ops.*` Namespace

All procedures are authenticated. Reads are owner-scoped for non-operators;
platform-wide reads (ledger/anomalies/traces/failures/diagnostics) and control
actions require the operator gate. `ops.providerHealth` is the one platform
read available to any authenticated user — it mirrors the pre-existing
`ai.getAllProviderHealth` (no new exposure); provider **control** (disable /
enable) is strictly operator-gated.

### 2.1 Inspect

| Procedure               | What you get                                                                                                           |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `ops.listTraces`        | trace summaries (newest-first, filter by status, owner-scoped)                                                         |
| `ops.getTrace`          | full correlated trace — the whole journey in one record                                                                |
| `ops.listFailures`      | non-OK traces                                                                                                          |
| `ops.getDiagnostics`    | structured incident diagnosis (WHAT/WHEN/WHERE/WHY/attempted/providers/retries/fallbacks/evidence/user+operator steps) |
| `ops.costLedger`        | totals, by provider/application/user, per-execution rows                                                               |
| `ops.costAnomalies`     | COST_SPIKE / REPEATED_CALLS / CACHE_MISS_BURST findings                                                                |
| `ops.applicationHealth` | HEALTHY / DEGRADED / BLOCKED / FAILED / UNKNOWN per application with reasons                                           |
| `ops.providerHealth`    | live provider health from the frozen runtime                                                                           |
| `ops.alerts`            | recent alerts (operator: all; user: scoped/none)                                                                       |
| `ops.auditLog`          | operator-action audit trail (operator-only)                                                                            |

### 2.2 Control (operator-only, audited)

| Procedure                                    | Effect                                                                       |
| -------------------------------------------- | ---------------------------------------------------------------------------- |
| `ops.retry` (application)                    | `factory.resume` — failed → PLANNED, archived → DRAFT                        |
| `ops.cancel` (loop)                          | cancel an active loop run (idempotent)                                       |
| `ops.revalidate`                             | re-run build validation (`factory.build`, no generation)                     |
| `ops.requality`                              | re-run the experience quality evaluation                                     |
| `ops.disableProvider` / `ops.enableProvider` | provider lifecycle → maintenance / active (feeds the frozen routing advisor) |

Every control action emits a `control` span and an audit record.

## 3. Reconstructing an Execution (the EPIC-012 acceptance question)

1. `ops.listTraces` → find the trace (by application/execution, newest-first).
2. `ops.getTrace` → walk the spans:
   - Which AI provider was used? → `ai.run` span `provider` attribute.
   - How many tokens? What did it cost? → span attributes / `loop.step`
     events / `ops.costLedger`.
   - Was RAG used? What evidence? → `rag.search` spans + `ai.evidence`
     spans.
   - How many retries? → `ai.retry` spans (and diagnostics `retries`).
   - Why did it pass/fail? → root status + failing span `error` codes.
   - What changed / what was deployed? → factory spans + application health.
3. On failure, `ops.getDiagnostics` gives the structured answer without
   opening raw logs.

## 4. Incident Playbook (derived from diagnostics)

| Diagnosis                  | User next step                                  | Operator action                                          |
| -------------------------- | ----------------------------------------------- | -------------------------------------------------------- |
| SECURITY_BLOCK             | review security findings, resolve critical/high | remediate → `ops.retry`                                  |
| VALIDATION_FAILURE         | check failed gates (lint/typecheck/tests/build) | fix → `ops.revalidate`                                   |
| BUDGET_EXCEEDED            | reduce scope / raise budget                     | adjust budget → `ops.retry`                              |
| PROVIDER_FAILURE / TIMEOUT | retry later (runtime already retried/fell back) | `ops.providerHealth`, `ops.disableProvider` if unhealthy |
| Other                      | review diagnostics                              | `ops.retry` / `ops.requality`                            |

## 5. Alerting

Thresholds are configurable via `ops.configureAlertThresholds`
(operator-only) with validated clamps. Rules: provider error rate (default
10%), latency p95 (120 s), 429/min (10), RAG fallback rate (50%), abstention
rate (30%), cost anomaly (5× median), token anomaly (3× previous window),
quality regression (15 pts), security incident (≥1), deployment failure (≥1),
application failure (≥3). No alerts fire below threshold — expected behavior
is silent.

## 6. Operator Checklist for EPIC-012 Live Validation

- [ ] `OPS_OPERATOR_IDS` set (or documented deny-all).
- [ ] Run a real application journey (login → create → requirements → build →
      quality → deploy).
- [ ] `ops.listTraces` + `ops.getTrace` reconstruct the journey end-to-end.
- [ ] `ops.costLedger` reports tokens/cost for the journey.
- [ ] `ops.getDiagnostics` explains any failure with user + operator steps.
- [ ] `ops.auditLog` shows the operator actions performed.
