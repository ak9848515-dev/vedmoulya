# Capability Intelligence + Real-Time Health + Explainable Routing

Layer on top of `ROUTING_EVIDENCE.md` (measured history) and the prior
provider/model execution alignment. Three connected increments:

1. **Capability Intelligence** — authoritative task requirements reach routing,
   and provider capability ≠ model capability is evaluated.
2. **Real-time execution health** — actual outcomes feed bounded, recoverable
   provider/model health that the next routing decision reads immediately.
3. **Explainable routing** — every decision keeps capability/health/evidence
   separation visible in its reasons.

No new provider registry, no new routing engine, no new failure taxonomy, no
new capability enum. Everything builds on the existing systems.

## 1. Capability source (authoritative only)

Task capability requirements come from the existing `CapabilityType` taxonomy
(`@vedmoulya/ai`) — the SAME vocabulary as the provider registry, model
catalog, agent/workflow `requiredCapabilities`, and the frozen AI domain
rules. Nothing is inferred from free text.

- `OrchestrateRequestDTO.requiredCapabilities?: CapabilityType[]` — the
  runtime boundary. Validated against `CAPABILITY_TYPES` before cache lookup
  or execution; deduped; included in the request-cache identity. When
  omitted the task requires exactly its routing `capability` — cold-start
  behavior is unchanged.
- The routing `capability` (the selection axis candidates were fetched
  against) is always required; caller-supplied requirements are additional
  hard gates.
- Callers that already carry authoritative multi-capability metadata (loop
  goals, workflow steps, agents) can now pass it straight through; single
  capability callers are untouched.

Capabilities the platform cannot establish are simply not expressed
(`tool_use`/`long_context` are NOT in the frozen taxonomy — no parallel enum
was invented; they stay unavailable rather than fabricated).

## 2. Capability flow

```
task (authoritative capability + optional requiredCapabilities[])
   ↓
runtime validates requiredCapabilities (CAPABILITY_TYPES)
   ↓
advisor.decide({ capability, requiredCapabilities })
   ↓
provider-level gate  — candidate.capabilities must include EVERY required cap
   ↓
model-level gate     — a model must include EVERY required cap in its OWN
                       capabilities (a vision provider's non-vision model is
                       never eligible for a vision task)
   ↓
context gate         — among qualifying models, context window ≥ tokens
   ↓
select provider + model → thread modelId → adapter executes it
```

Unknowns are conservative: a model with no declared capability list is
treated as UNKNOWN and is never excluded on an absent list — only an explicit
lack excludes. This keeps sparse registry metadata from breaking cold-start
routing. Candidates where EVERY model explicitly lacks a required capability
are ineligible (hard gate); partial provider-level support is not enough.

Model capabilities flow from the single provider registry:
`RuntimePorts` maps `model.capabilities` onto the candidate `models[]`.

## 3. Health flow (real-time, bounded, recoverable)

```
execution outcome (success | classified failure)
   ↓  HealthFeedbackPort.recordExecution (fire-and-forget)
ExecutionHealthService
   - provider scope AND provider+model scope (narrowest applicable)
   - bounded window (60 events) + recency decay (half-life 10 min,
     SAME recencyWeight as RoutingEvidenceService)
   ↓
RuntimePorts (next decision)      │  throttled persist (verdict transitions
  - UNAVAILABLE folds into        │    ≥10 s apart, or batches of ≥8)
    candidate.healthy (only while │    → existing registry recordHealthSample
    a healthy alternative exists) │    → fleet health UI stays honest
  - model-scope failures →        │
    runtimeUnavailableModelIds    │
   ↓                              │
ProviderRoutingAdvisor: DEGRADED → bounded soft penalty (−0.08) + reason;
UNAVAILABLE handled by the existing unhealthy gate. Never auto-disables.
```

Failure-consequence scoping (reuses the shared `FailureReason` taxonomy —
only `authentication_error` was added to it):

| failure                                | scope      | routing consequence                                              |
| -------------------------------------- | ---------- | ---------------------------------------------------------------- |
| `unsupported_model`                    | model only | model excluded; provider untouched                               |
| `authentication_error`                 | provider   | UNAVAILABLE until a success follows (ineligible, never disabled) |
| `timeout` / `rate_limited`             | both       | counts + burst/sustained verdicts                                |
| `provider_unavailable` / 5xx / network | both       | failures → verdicts                                              |
| `internal_error` (unknown)             | both       | mild failure signal                                              |

Verdict rules (deterministic, tested):

1. ≥5 consecutive failures → `UNAVAILABLE` (burst)
2. ≥4 effective samples, weighted success < 0.5 → `UNAVAILABLE` (sustained)
3. ≥4 effective samples, weighted success < 0.9 → `DEGRADED`
4. ≥2 effective samples with ≥2 consecutive failures → `DEGRADED`
5. ≥2 effective samples otherwise → `HEALTHY`
6. <2 effective samples → `UNKNOWN` (no routing effect — a one-off failure
   never flips a provider)
7. auth failure with no later success overrides to `UNAVAILABLE`

Recovery: recency decay ages failures out (half-life 10 min) and resumed
successes restore `HEALTHY`. One transient failure is noise; 20 timeouts in 5
minutes is a burst and is treated as such.

HEALTH and EVIDENCE stay separate (never one opaque number): health = “what
is happening recently?” (this service); evidence = “how has this historically
performed?” (`RoutingEvidenceService`, 30-day half-life over traces). Both
reach the advisor with distinct fields (`runtimeHealth`, `measured`).

## 4. Evidence flow (unchanged from ROUTING_EVIDENCE.md)

```
execution → ai.provider_execution span (provider, model, capability, outcome)
  → RoutingEvidenceService (trace query, recency decay, confidence ramp)
  → advisor measured[] (bounded influence; static fallback in cold start)
```

## 5. Confidence hierarchy (sparse → specific)

Same progressive confidence ladder as before; capability-specific evidence
refines model evidence, which refines provider evidence, which falls back to
static metadata — never fabricated:

```
provider+model+capability evidence  → insufficient?
provider+model evidence             → insufficient?
provider evidence                   → insufficient?
static metadata (benchmark/pricing/latency) + health
```

## 6. Explanation (real example)

Generated from actual routing inputs; reasons never invent statistics. Low
confidence simply omits evidence lines (no fake confidence):

```
SELECTED: google / gemini-2.5-pro
WHY:
  ✓ capability compatible                  (reasoning required)
  ✓ context window sufficient
  ✓ provider health acceptable
  ✓ measured reliability 97% over 214 executions   (only when MEASURED)
  ✓ measured p50 latency 1800ms                    (only when MEASURED)
  — insufficient measured evidence — selection based on capability,
    availability and static metadata               (cold start)
FALLBACK: deepseek / deepseek-chat …
```

`ai.model_selection` spans record `selected_provider`, `selected_model`,
`candidates`, and `required_capabilities` (when >1).

## 7. Files

Runtime/domain: `packages/ai/src/types` (FailureReason), `packages/services/
src/ai/AIOrchestrationService.ts`, `AIDTO.ts`, `runtime/ProviderRoutingAdvisor.ts`,
`runtime/ModelSelectionIntelligence.ts`, `runtime/index.ts`, exports.
Gateway: `services/api/src/services/ExecutionHealthService.ts` (new),
`services/api/src/infrastructure/RuntimePorts.ts`, `services/api/src/services/
ApiApplicationService.ts`, `ProviderExperienceService.ts`.

## 8. Remaining gaps (next autonomy layer)

- Wire `requiredCapabilities` from the loop/workflow executors themselves
  (today the boundary supports it; most callers still send single capability).
- Enrich health with the succeeded EMA latency if registry latency matters for
  fleet reporting.
- Multi-instance deployments: the runtime tracker is in-memory per gateway;
  persistence is throttled, so cross-instance convergence is eventual.
- `packages/orchestration-fabric` convergence remains a separate
  recommendation (documented, not merged).
