# Routing Evidence — Measured Provider/Model Feedback for the Advisor

**Status:** implemented (runtime feedback loop closed end-to-end)
**Scope:** `packages/services` (runtime + advisor) · `services/api` (evidence service, ports)
**Owner:** AI Platform / Runtime

## Purpose

VedMoulya must ask _"which available AI/model is best suited to THIS task"_ — not merely
_"which provider did the user configure?"_. Static registry metadata (benchmark quality,
catalog pricing, declared latency) is a reasonable starting point, but the only evidence
that a provider/model actually performs is **real execution history**. This document
describes how real history is measured, kept honest, and fed back into the existing
`ProviderRoutingAdvisor` — without a second ledger, a second trace store, or ML.

## Architecture (what exists, what was added)

The existing execution path was:

```
request → candidate selection → advisor (order) → adapters (each its OWN fixed model) → trace
```

The gap (now closed): the advisor could recommend a provider **and model**, but runtime
adapters executed their own fixed/default model. So _routing intent ≠ executed reality_,
and traces never recorded which model actually ran — making per-model measurement impossible.

The path today:

```
request → candidate selection → advisor (provider + model) ─┐
        → RoutingIntent (selected model per provider) ─────┤
        → adapter.execute({ modelId })                      │  Phase B threading
        → ai.provider_execution span { provider, model,     │
             capability, latency_ms, tokens, cost } ────────┤
        → RoutingEvidenceService (pure query over TraceStore)┤  Phases C–J
        → candidate.measured attached in RuntimePorts ──────┘  Phase G wiring
        → next advisor.decide() weighs measured evidence
```

## Provenance — what each number is

Strict separation is enforced by construction:

| Signal                                                     | Source                        | Category                                                               |
| ---------------------------------------------------------- | ----------------------------- | ---------------------------------------------------------------------- |
| provider configured/enabled/capabilities                   | registry + preferences        | KNOWN FACT                                                             |
| model context window / capabilities                        | registry catalog              | KNOWN FACT                                                             |
| catalog quality, pricing, declared latency                 | registry catalog              | STATIC METADATA                                                        |
| health score / `quotaUsedPercent`                          | registry health snapshots     | PROVIDER HEALTH SIGNAL — **never** presented as a user account balance |
| success rate, latency, tokens, cost, timeouts, rate limits | `ai.provider_execution` spans | **MEASURED** (this service)                                            |
| anything else (account quotas, free-tier balances)         | —                             | UNAVAILABLE (never fabricated)                                         |

The `RoutingEvidenceService` returns **only** MEASURED values. Every evidence object carries
`provenance: 'MEASURED'`. Static metadata never silently becomes measured data: measured
values _augment_ the advisor's static scoring within bounded weights (see below), and the
static signal is used whenever evidence confidence is insufficient.

## Recency (deterministic, explainable, bounded)

Recent executions matter more than old ones, but the mechanism is simple and testable:

```
weight(sample) = 0.5 ^ (ageDays / halfLifeDays)        halfLifeDays default = 30
                clamped to [0.05, 1]
```

A 30-day-old sample counts half; a 60-day-old sample a quarter; samples never fully
disappear (floor 0.05) and never dominate. Weights are pure functions of the trace
timestamps and the clock — the same traces always produce the same weights. No ML, no
hidden state. This is appropriate because provider behavior drifts (deployments,
rate-limit policies, model deprecations) and stale evidence should fade — while a bounded
floor keeps cold-start from flip-flopping on a single old sample.

## Confidence / sample floor (cold start is safe)

The **effective sample count** is the sum of recency weights. Three confidence states:

| State            | Condition                                | Influence                 |
| ---------------- | ---------------------------------------- | ------------------------- |
| `INSUFFICIENT`   | effective < minSamples (default 5)       | **0** — no routing effect |
| `LOW_CONFIDENCE` | minSamples .. targetSamples (default 25) | ramps 0→1 linearly        |
| `MEASURED`       | ≥ targetSamples                          | 1                         |

Consequences, enforced by tests:

- A provider with **2/2 successful runs** has effective ≈ 2 → `INSUFFICIENT` → influence 0.
  It can NEVER beat a provider with 500/520 measured runs.
- Influence ramps _gradually_, so measured data gains weight instead of flipping routing
  on a hard threshold.
- With no traces at all (fresh install, cold start), candidates carry no `measured` field
  and the advisor behaves **exactly** as before this epic — Gemini unchanged.

## Advisor integration (additive and bounded)

The advisor's deterministic weights (`benchmark 0.5 / cost 0.2 / latency 0.15 / health 0.15`)
are preserved. Measured evidence adds **bounded, influence-scaled** terms:

| Term                                                 | Max contribution                             |
| ---------------------------------------------------- | -------------------------------------------- |
| measured reliability (success rate above 0.90 floor) | +0.12                                        |
| recent failures (windowed, ≤10 counted)              | −0.06                                        |
| measured timeout/rate-limit frequency                | −0.06                                        |
| measured p50 latency                                 | replaces static latency _only_ when MEASURED |

Each term is multiplied by `evidence.influence` (0 in cold start), so sparse data can
nudge but never overturn static metadata. All reasons remain human-readable on the
`ai.model_selection` span and the `/ai` explainSelection procedure.

## Model + capability dimensions

Execution spans now record the **actual** executed model (`model`, from the adapter
response — never the intended model as if it ran), the advisor intent (`requested_model`),
and the task capability when authoritative. The evidence service therefore aggregates at
three dimensions:

- provider
- provider + model
- provider + model + capability

The advisor consumes provider-level evidence per candidate today (its contract is
per-candidate); model/capability-level aggregates exist in the same snapshot and are
consumable the moment per-model scoring lands — no new storage required. Model-specific
evidence is never manufactured: a dimension with no real samples returns `undefined`.

## Files

| File                                                         | Change                                                                                                                                               |
| ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/services/src/ai/AIOrchestrationService.ts`         | Phase B: `RoutingIntent` threading, `modelId` to adapters, span attrs (`model`, `requested_model`, `capability`), `unsupported_model` classification |
| `packages/services/src/ai/runtime/ProviderRoutingAdvisor.ts` | `ProviderMeasuredEvidence` contract + bounded measured scoring (Phases G/H)                                                                          |
| `packages/ai/src/types/index.ts`                             | `unsupported_model` FailureReason (additive)                                                                                                         |
| `services/api/src/services/RoutingEvidenceService.ts`        | NEW — pure measured-evidence query over TraceStore (recency, confidence, dimensions)                                                                 |
| `services/api/src/infrastructure/RuntimePorts.ts`            | `createProviderIntelligencePort(…, evidence?)` attaches `measured` per candidate                                                                     |
| `services/api/src/services/ApiApplicationService.ts`         | constructs `RoutingEvidenceService` over the shared trace store; wires it into model selection + runtime                                             |
| `services/orchestrator/src/providers/*.ts`                   | adapters honor `modelId` (`request.modelId ?? this.modelId`); Mock rejects unsupported ids explicitly                                                |

## Security

Credentials are never written to traces: span attributes are structured ids
(provider/model/capability), error messages pass through the existing `redactSecrets`
pipeline, and a security test asserts key-shaped values never appear on execution spans.

## Future work (out of scope here)

- Per-model and per-capability scoring inside the advisor (evidence already keyed for it).
- Cross-user isolation for evidence aggregation when multi-tenant accounting requires it.
- Convergence with `packages/orchestration-fabric`'s separate `ProviderRouter` surface
  (documented as a future architectural recommendation, not expanded into here).
