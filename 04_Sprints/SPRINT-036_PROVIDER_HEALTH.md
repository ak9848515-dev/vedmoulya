# SPRINT-036 — PROVIDER HEALTH

## Evidence-based only (frozen)

Health comes from the existing fabric **`ProviderHealthLedger`** —
**UNKNOWN until real runtime evidence exists**. A provider is never marked
healthy merely because configuration exists.

States: `UNKNOWN` · `HEALTHY` · `DEGRADED` · `UNAVAILABLE` · `MISCONFIGURED`
(observed from calls: success / failure / timeout / quota_exhausted /
config_error, with latency).

## Plan-level mapping (honest)

The orchestrator maps the fabric's observed state to the plan step state:

| Fabric health  | Plan `providerState` |
| -------------- | -------------------- |
| HEALTHY        | AVAILABLE            |
| DEGRADED       | DEGRADED             |
| UNAVAILABLE    | UNAVAILABLE          |
| MISCONFIGURED  | ERROR                |
| UNKNOWN / none | UNKNOWN              |

A step with no selected provider reports **UNAVAILABLE** at plan time — a
selection is never fabricated and a PRIVATE step is never silently bound to a
public provider.

## Where it is surfaced

- per-step `providerState` on every orchestration plan;
- the fabric's `costSnapshot`/health remain the source of truth at execution;
- the world-model signal health (SPRINT-035) is separate — signals, not
  providers.
