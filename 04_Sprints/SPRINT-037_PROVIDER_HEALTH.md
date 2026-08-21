# SPRINT-037 — PROVIDER HEALTH

## The rule

Health is **evidence-based only**. A provider is never marked healthy because configuration exists — the fabric's `ProviderHealthLedger` derives state from ACTUAL call outcomes (`observe()`).

## States (never fabricated)

| State         | Meaning                                               |
| ------------- | ----------------------------------------------------- |
| UNKNOWN       | No observations yet — the honest default              |
| HEALTHY       | success rate ≥ 0.9 in the window                      |
| DEGRADED      | success rate ≥ 0.5 and < 0.9, or latency spike        |
| UNAVAILABLE   | success rate < 0.5, quota exhausted, or provider down |
| MISCONFIGURED | a config_error observation (credentials/endpoint)     |

The orchestration plan's `providerState` comes from `mapProviderState(healthState)` — so a fresh plan reports `UNKNOWN` for providers with no runtime evidence, and the plan adapter maps that honestly to a CONFIGURE disposition (never READY-without-evidence).

## After a real call

`integration:provider` makes a real call through the real runtime; the run's step port returns provider/model/cost/latency. Operator-fed observations (`fabric.observeOutcome`) update the ledger with genuine runtime evidence. SPRINT-037 does **not** fabricate a health update — health telemetry reflects what the operator actually runs.

## Proven by tests

- `FabricRouter.test.ts` — UNKNOWN before any observation, HEALTHY after a real success, UNAVAILABLE on quota exhaustion.
- `ProviderOrchestrationScenarios` — providerState honesty per scenario.
- `OrchestrationPlanSource.test.ts` — UNKNOWN/DEGRADED → CONFIGURE, UNAVAILABLE → UNAVAILABLE.
