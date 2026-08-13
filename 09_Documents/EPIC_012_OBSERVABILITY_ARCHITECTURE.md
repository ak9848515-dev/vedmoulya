# EPIC-012 — Observability Architecture

> **Date:** 2026-08-10
> **Status:** IMPLEMENTATION VERIFIED — OTel/Langfuse exporter activation is an
> **operator step** (the seams are wired and tested; no live vendor credentials
> were used or fabricated).
> **Companion docs:** `EPIC_012_BASELINE_AUDIT.md` (Phase 0 gap analysis),
> `EPIC_012_TELEMETRY_MODEL.md`, `EPIC_012_COST_MODEL.md`,
> `EPIC_012_SECURITY_AUDIT.md`, `EPIC_012_OPERATIONS_GUIDE.md`,
> `EPIC_012_COMPLETION_REPORT.md`.

## 1. The Core Gap That Drove This Architecture

The Phase 0 audit proved the platform already had a strong observability
foundation (metrics registry, Prometheus + OTLP exporters, AI observability
seams, health routers, audit logs, correlation IDs) but **nothing connected
`USER → APPLICATION → REQUIREMENTS → LOOP → AI → RAG → PROVIDER → QUALITY →
REFINEMENT → DEPLOYMENT` under one stable identifier spine**. RAG, LoopEngine,
Factory and Experience emitted zero telemetry events. There was no control
plane, no incident diagnostics, no alerting, and no unified cost ledger.

EPIC-012 therefore **CONNECTS and COMPLETES** the existing estate — it does
not rebuild anything.

## 2. Architecture

```
Business Engines (loop/factory/experience/requirements/rag)
      │  emit spans/events through the narrow TelemetryPort
      ▼
Telemetry Port (@vedmoulya/core — NoopTelemetryPort | ExecutionTraceProvider)
      │
      ├── ExecutionTraceProvider (AsyncLocalStorage-parented spine)
      │       └── TraceStore (bounded, owner-scoped, FIFO + optional TTL)
      │
      ├── TraceProviderOtelBridge (gateway)  ── adapts the frozen
      │       AIObservability `OtelBridge` seam onto the trace spine
      │
      └── OtelExporter / Langfuse (pre-existing seams)  ── OPERATOR ACTIVATION
```

### 2.1 Layering rule (mandatory)

Business engines depend only on the **TelemetryPort contract** — never on a
vendor SDK. The port is implemented by:

| Implementation                         | Purpose                                                                                |
| -------------------------------------- | -------------------------------------------------------------------------------------- |
| `NoopTelemetryPort` / `NOOP_TELEMETRY` | default — zero overhead, engines work unchanged with observability disabled            |
| `ExecutionTraceProvider`               | production spine — correlated, owner-scoped traces persisted to a bounded `TraceStore` |

### 2.2 Stable identifiers

Every trace carries: `traceId`, `spanId`, `parentSpanId`, `executionId`
(optional), `userId` (owner scope), `applicationId` (optional), and the
gateway `correlationId` when present. A root span's `startSpan` call receives
`executionId`/`userId`/`applicationId`; child spans inherit them onto the
trace automatically. No sensitive identifiers are exposed unnecessarily.

### 2.3 Automatic parenting via AsyncLocalStorage

`ExecutionTraceProvider.withSpan` runs its callback inside an
`AsyncLocalStorage` context. Any nested `startSpan` (AI runtime spans through
the bridge, RAG retrieval, nested engines) is automatically parented under the
ambient trace — so a single `ExecutionTrace` reconstructs the whole journey
without any manual correlation plumbing.

## 3. Adopted / Extended / New (per the audit's reuse inventory)

| Capability                                                        | Decision                                                                                                  |
| ----------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Metrics registry + Prometheus + OTLP exporter                     | **ADOPTED** — single export path, no second telemetry backend                                             |
| `AIObservability` NOOP/TEST/OTel/Langfuse seams + `redactSecrets` | **ADOPTED** — `TraceProviderOtelBridge` wires the existing `OtelBridge` seam onto the trace spine         |
| Pre-existing lightweight `Span`/`Tracer` hooks                    | **EXTENDED** — kept for OtelExporter compatibility; the ExecutionTrace is the correlated production spine |
| Health routers (platform/RAG/provider/OS)                         | **EXTENDED** — reused by the ops `providerHealth` / `applicationHealth` views                             |
| Per-service audit logs                                            | **EXTENDED** — new `AuditTrail` follows the same correlation-aware pattern for operator actions           |
| `EconomicsTracker` / `CostPlanner` / `AIMetrics`                  | **EXTENDED** — aggregated by `CostLedger` (no second accounting)                                          |
| Correlation context                                               | **ADOPTED** — propagated into traces as `correlationId`                                                   |
| Loop termination reasons (12)                                     | **EXTENDED** — mapped 1:1 onto the `TraceStatus` vocabulary                                               |

## 4. OpenTelemetry / Langfuse evaluation (Phase 2)

| Question                                    | Answer                                                                                                                                  |
| ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Compatibility with existing architecture?   | ✅ The frozen `AIObservability` already ships `OtelAIObservabilityExporter` + `OtelBridge` and a `LangfuseAIObservabilityExporter` seam |
| What does each already provide?             | OTel: batched non-blocking trace/metric export; Langfuse: AI-specific cost/token/cache observability                                    |
| Duplicate metrics / double instrumentation? | None introduced — the bridge adapts the existing seam; the engine port and the exporter never both write the same event                 |
| Provider neutrality?                        | ✅ engines only know the port; exporters are gateway-side adapters                                                                      |
| Security boundaries?                        | ✅ `redactSecrets` on every string attribute; no secrets in traces                                                                      |

**Decision:** adopt through clean adapters. `TraceProviderOtelBridge`
implements the frozen `OtelBridge` contract against the ExecutionTrace spine,
so enabling the pre-existing OTel exporter also exports the engine/AI spans.
Langfuse stays an operator-gated alternative seam (no fabricated live
evidence). No new vendor dependency was added to any package.

## 5. Control Plane (Phase 11)

The `ops.*` tRPC namespace (see `EPIC_012_OPERATIONS_GUIDE.md`) is the
operator surface. It reads the trace store, cost ledger, alert engine and
health model, and executes audited control actions (retry / cancel /
revalidate / requality / disable & enable provider). Platform-wide reads and
every control action require the `OperatorGate` (explicit allowlist from
`OPS_OPERATOR_IDS` — empty = deny-all).

## 6. Non-Goals (what this architecture deliberately does NOT do)

- No second metrics/telemetry backend — the pre-existing exporters are the
  single export path.
- No vendor coupling in business engines — the port is the only seam.
- No unbounded telemetry storage — `TraceStore` FIFO cap (5000) + optional
  TTL, `AuditTrail` ring (500), `AlertEngine` history ring (200).
- No synchronous blocking telemetry — stores are in-memory and synchronous by
  design at the gateway; exporter batching stays non-blocking.
- No fabrication of live vendor evidence — OTel/Langfuse activation is an
  operator step documented in the Operations Guide.
