# SPRINT-037 — COST CALIBRATION (expected vs observed)

## The distinction SPRINT-037 enforces

| Side          | Source                                                                                                           | Status              |
| ------------- | ---------------------------------------------------------------------------------------------------------------- | ------------------- |
| EXPECTED cost | the orchestration plan (fabric selection evidence — `estimatedCostUsd` per step, sum only where evidence exists) | ESTIMATED / UNKNOWN |
| OBSERVED cost | the execution run (real provider telemetry via the runtime, budget accounting in `RunBudgetGuard`)               | OBSERVED / UNKNOWN  |

## Rules (absolute)

1. **UNKNOWN is never 0.** A step without evidence contributes nothing to the plan's `estimatedCostUsd` (SPRINT-036 scenario 08 proves it). The run's `spentCostUsd` reflects only what the runtime actually accounted.
2. **Observed cost comes only from the existing authorities.** The run's budget (`RunBudgetGuard`, `createExecutionBudgetConfig`) is the accounting authority; the CostLedger remains authoritative for aggregate spend. SPRINT-037 adds **no** cost engine.
3. **If actual cost cannot be measured, OBSERVED COST = UNKNOWN** — reported honestly in `integration:provider` output (`observedCost: 'UNKNOWN'` when spent == 0).
4. **Expected ≠ observed.** The plan's `estimatedCostUsd` is advisory (fabric selection evidence); the run reports what actually happened.

## Budget enforcement (fail-closed)

`integration:provider` defaults: **$0.50 max cost · 120 s max latency · 8k tokens · 10 iterations** (env-tunable via `AI_EXECUTION_MAX_*` only by explicit operator decision). A budget breach BLOCKS the run — never silently exceeded.

## Proven by tests

- `OrchestrationPlanSource.test.ts` — expected cost carried from the plan into the adapted bridge plan.
- `WorldRouter.test.ts` — the run's budget records spent cost/tokens from the step port.
- SPRINT-036 benchmark scenarios 08 (plan cost = evidence sum only) and the RunBudgetGuard tests (fail-closed).
- `integration:provider` — prints `spentCostUsd` and `observedCost` honestly.
