# SPRINT-036 — CAPABILITY MODEL

## Boundaries preserved (frozen)

```
CAPABILITY ≠ ROLE ≠ MODEL ≠ PROVIDER ≠ AGENT
```

- **CAPABILITY** — what work needs (marketplace capability vocabulary).
- **ROLE** — a typed responsibility any capable provider/model can fulfill
  (`RoleSpec`, world-model AI workforce).
- **MODEL** — a specific model id.
- **PROVIDER** — a specific provider id (registry).
- **AGENT** — never created by this layer; no new agent engine.

## Provider capability registry (audit result)

The existing `packages/providers` registry already exposes the capability
matrix (`ProviderCapabilityMatrixService`), provider intelligence
(`ProviderIntelligenceService`) and provider health (`ProviderHealthService`).
SPRINT-036 **reuses** it — no registry rebuild. Capability fields the estate
can expose where genuinely known: provider identity, model identity,
capabilities, modality/context/structured-output/tool/streaming support,
privacy characteristics, cost/latency/reliability observations, configuration
status.

Honesty rules (unchanged):

- unknown capability field → **UNKNOWN**
- not configured → **UNAVAILABLE / OPERATOR-REQUIRED**
- FREE ≠ zero cost · OPEN_SOURCE ≠ free to operate · LOCAL ≠ zero operational cost
  (the benchmark fixtures give local providers a small real cost on purpose)

## Capability matching in orchestration

The orchestrator passes each step's `capability` to the fabric
`selectStrategy`; the fabric (over the real registry) matches candidates by
capability. A step with **no** candidate is honestly unbound at plan time
(`providerState: UNAVAILABLE`) — a selection is never fabricated, and a
PRIVATE step is never silently bound to a public provider.
