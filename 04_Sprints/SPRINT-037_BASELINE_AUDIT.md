# SPRINT-037 — BASELINE AUDIT

**Source of truth = source code.** This audit records what was verified in the repository on 2026-08-15 before SPRINT-037 changes, and the honest activation state.

## What is IMPLEMENTED (verified from source)

| Capability                                      | Implementation                                                                                                                                                                                            | Tests                                               |
| ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| Multi-provider orchestration plan               | `packages/world-model/src/domain/MultiProviderOrchestrator.ts` — per-step fabric selection, bounds, ActionClassPolicy, bounded retry/fallback; `executed:false` + `authorizationRequired:true` structural | `ProviderOrchestrationScenarios` 11/11 + unit tests |
| Per-step provider binding + WHY + expected cost | `OrchestratedStep` (providerId/modelId/strategy/reasons/expectedCostUsd)                                                                                                                                  | yes                                                 |
| Provider health (evidence-only)                 | `ProviderHealthLedger` (fabric) → `mapProviderState` → UNKNOWN until observed                                                                                                                             | yes                                                 |
| Cost policy + bounds                            | `CostPolicyGuard` / `RunBudgetGuard` / fabric `validateWorkflow` (WorkflowBounds)                                                                                                                         | yes                                                 |
| Brain approval authority                        | `BrainApplicationService.approve/reject/requestApproval` (frozen)                                                                                                                                         | brain 152/152                                       |
| Execution bridge                                | `ExecutionRunService` (plan → run → step port → verify → budget) — the ONLY runtime path                                                                                                                  | gateway 1000/1                                      |
| Plan source (marketplace)                       | `createExecutionPlanSource` (capability marketplace plans)                                                                                                                                                | `GatewayPorts`                                      |
| World model service                             | `WorldModelService` — orchestratePlan, listOrchestrationPlans                                                                                                                                             | world-model 220 (after SPRINT-037)                  |
| Command Center read model                       | `world.commandCenter` — TODAY/PORTFOLIO/INTELLIGENCE/AUTOMATION/APPROVALS                                                                                                                                 | yes                                                 |

## What is CONFIGURED (operator environment — checked via `production-config-check`)

| Item                       | Status 2026-08-15                                                                    | Evidence                                                  |
| -------------------------- | ------------------------------------------------------------------------------------ | --------------------------------------------------------- |
| AI providers (runtime key) | **OPERATOR_REQUIRED** — no real key present                                          | `production-config-check`: AI PROVIDERS OPERATOR_REQUIRED |
| Postgres                   | not required for hermetic gates (dev in-memory); production requires operator config | config check                                              |
| World signals              | OPERATOR_REQUIRED (no `WORLD_SIGNAL_BASE_URL`)                                       | honest UNAVAILABLE                                        |
| STT/TTS                    | OPERATOR_REQUIRED (no `VOICE_STT_*`/`VOICE_TTS_*`)                                   | voice.status MOCK                                         |
| Redis                      | OPTIONAL (in-memory rate limiter default)                                            | config check                                              |

## What is OPERATOR-REQUIRED (genuinely cannot run today)

- **A real provider key + a real provider call.** SPRINT-037 provides the seam (`integration:provider`) and the harness; the actual live run is an operator step. **No fabricated SUCCESS is claimed.**

## What is EXECUTABLE TODAY (hermetic)

- Plan creation (any provider state), Brain-gated approval, bridge submission, step disposition resolution (EXECUTABLE/CONFIGURE/UNAVAILABLE/WAITING_FOR_APPROVAL), budget/verification accounting — all verified with deterministic fixtures.
- `npm run integration:provider` — exits 2 with a clear message without a key; runs the full real loop when a key is configured.

## SPRINT-037 action (what this sprint changed)

1. `WorldModelService.getOrchestrationPlan` + `approveOrchestrationPlan` (through `WorldApprovalPort` → Brain; `executed:false` never flipped).
2. Gateway `OrchestrationPlanSource` — APPROVED-only adaptation of an orchestration plan into the EXISTING bridge plan shape (closed capability vocabulary; unmapped → honest non-adaptable).
3. `world.approveOrchestrationPlan` + `world.startOrchestrationPlan` procedures.
4. Command Center AUTOMATION surfaces orchestration plans (status + approved flag).
5. `npm run integration:provider` — the operator live-loop proof.
