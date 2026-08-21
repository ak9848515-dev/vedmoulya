# SPRINT-037 — INTEGRATION TEST (`npm run integration:provider`)

## Purpose

The first complete real-world execution proof: PLAN → APPROVE → EXECUTE → VERIFY → MEASURE → RECORD, through the EXISTING authorities, against a REAL provider. It is **separately runnable and operator-gated** — CI never runs it; the normal test suite stays hermetic (deterministic fixtures, zero network, zero paid calls).

## Contract

| Requirement                          | Behavior                                                                                                          |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------------- |
| Explicit operator configuration      | Requires `AI_OPENAI_API_KEY` (or legacy `OPENAI_API_KEY`) + `AUTH_JWT_SECRET`                                     |
| Fails clearly without credentials    | Exit 2 with an explicit message — never a fake success                                                            |
| Strict cost/time limits              | Defaults $0.50 max cost, 120 s max latency, 8k tokens, 10 iterations (env-tunable via `AI_EXECUTION_MAX_*`)       |
| Runs only the approved safe workflow | Research → reasoning → economic analysis → verification → finalize (information/analysis only)                    |
| Machine-readable result              | JSON summary: planId, executionId, status, step dispositions, provider/model, spent cost/tokens, approval, engine |
| Never fake adapters                  | Registers ONLY the real `VercelAIProvider`; without a key it exits 2                                              |

## What the full loop proves

1. `world.orchestratePlan` over the REAL Intelligence Fabric produces a bounded plan with per-step provider bindings and `executed:false`.
2. `world.approveOrchestrationPlan` records a Brain-authority grant (grantedBy/At/scope); `executed` stays false.
3. `world.startOrchestrationPlan` (via the existing `ExecutionRunService`) resolves the APPROVED plan through the orchestration-aware plan source, executes EXECUTABLE steps through the existing step port, and accounts cost/tokens through the RunBudgetGuard.
4. Step dispositions are reported honestly (EXECUTABLE/CONFIGURE/UNAVAILABLE/WAITING_FOR_APPROVAL).

## Hermetic vs LIVE separation

| Kind        | Where                                                                          | Credentials           |
| ----------- | ------------------------------------------------------------------------------ | --------------------- |
| FIXTURE     | `ProviderOrchestrationScenarios` (SPRINT-036) — deterministic fabric/providers | none                  |
| INTEGRATION | `scripts/integration-provider.ts` — REAL authorities, REAL provider            | operator key required |
| CI          | never runs integration:provider                                                | n/a                   |

Nothing is ever labelled LIVE when it was verified only with fixtures.
