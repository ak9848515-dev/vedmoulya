# EPIC-014 — Implementation Map (PLAN → EXECUTE → VERIFY)

> **Status:** Phase-0 reconnaissance complete (2026-08-10) — **implemented & verified**
> (see [EPIC_014_COMPLETION_REPORT.md](./EPIC_014_COMPLETION_REPORT.md)). Every reuse below
> cites the exact frozen artifact. No duplicate intelligence/execution/validation/telemetry
> systems are created.

---

## 1. Reuse map (frozen artifacts consumed as-is)

| Requirement                   | Reused from                                                                                                          | How                                                                                                                                               |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| The plan                      | `@vedmoulya/capability-marketplace` `FactoryCapabilityPlan` + `CapabilityPlanner`                                    | The execution engine consumes a REAL plan (steps, candidates, automation, irreversible, humanApprovalPoints, recommendations). No second planner. |
| Irreversible-action semantics | `ApprovalEngine` (`decide`) + plan's `humanApprovalPoints` / `step.irreversible`                                     | Approval gating at execution time re-checks the plan's own approval points.                                                                       |
| Quality-first selection       | `QualityFirstSelector` (already baked into the plan's `selectedCandidateId`)                                         | Execution binds the plan's selection — never re-ranks.                                                                                            |
| Bounded execution             | `@vedmoulya/loop-engine` `LoopBudget` (maxIterations/maxTokens/maxCostUsd/maxLatencyMs, fail-closed pre-call guards) | `RunBudgetGuard` wraps `LoopBudget`; budget failure → `BLOCKED`, never silent.                                                                    |
| Provider execution            | `AIOrchestratorSpecialistPort` (gateway adapter over `AIOrchestrationService`) via `SpecialistExecutionPort`         | Gateway `StepExecutionPort` adapter maps a plan step → bounded specialist call (capability mapping + constraints).                                |
| Validation                    | Runtime's own `validationDecision` (structured-output validation) + deterministic output-contract checks             | `StepVerifier` pre/post checks; success = EXECUTION + OUTPUT + VALIDATION. No second validation engine.                                           |
| Checkpoints                   | Loop-engine `runId` resumption pattern                                                                               | Execution checkpoints persisted after every completed step; resume continues from the first non-completed step.                                   |
| Owner/IDOR                    | Gateway middleware (`auth`, `assertRateLimit`) + owner-scoped service methods (same as `capability.*`)               | Every `execution.*` procedure owner-guards on `run.ownerId === ctx.userId`.                                                                       |
| Telemetry                     | `@vedmoulya/core` `ExecutionTrace`/`TelemetryPort`                                                                   | Runs carry `executionId · planId · ownerId · traceId`; gateway emits a run span via the existing spine. No new telemetry.                         |
| Budget config                 | `ProductionAIConfig` (`AI_MAX_INPUT_TOKENS`/`AI_MAX_OUTPUT_TOKENS`/`AI_PROVIDER_TIMEOUT_MS`)                         | Default execution budget derives from the same production constants.                                                                              |

## 2. NEW — `packages/execution-bridge` (the only new workspace)

```
src/
  types/execution-types.ts        — ExecutionRun · StepRun · dispositions · states ·
                                     checkpoint · artifact · handoff · verification ·
                                     preference event (Phase 5)
  contracts/execution-ports.ts    — StepExecutionPort · BudgetPort(over LoopBudget) ·
                                     PreferenceLedgerPort · ExecutionRunStore · ClockPort
  domain/
    CapabilityMapper.ts           — EPIC-013 CapabilityId ↔ @vedmoulya/ai CapabilityType
                                     (unmapped → no execution path → honest UNAVAILABLE)
    PlanRunResolver.ts            — PHASE 1: plan step → EXECUTABLE / CONFIGURE /
                                     WAITING_FOR_APPROVAL / MANUAL_REQUIRED / UNAVAILABLE
    StepVerifier.ts               — PHASE 2: pre/post verification contract
    ApprovalRuntime.ts            — PHASE 3: approval gate + resume from checkpoint
    RunIntelligence.ts            — PHASE 4: current/remaining/failed/next-action view
    PreferenceLedger.ts           — PHASE 5: provenance events (explicit > inferred)
    RunBudgetGuard.ts             — LoopBudget wrapper (fail-closed)
  application/
    ExecutionRunService.ts        — start · advance · approve/reject · completeHandoff ·
                                     cancel · get/list · ledger — owner-scoped
  infrastructure/
    InMemoryExecutionRunStore.ts  — bounded FIFO (owner-scoped)
    InMemoryPreferenceLedger.ts
  __tests__/
    ExecutionRunService.test.ts   — the 20 deterministic scenarios
```

## 3. Gateway (EXTEND, no new engines)

- `routers/ExecutionRouter.ts` — `execution.*` handlers: `start / get / list / approve / reject /
completeHandoff / cancel / preferences` — `assertRateLimit` + owner guard (IDOR → FORBIDDEN).
- `RouterRegistry` — `execution: router({…})` namespace with zod inputs (userId always present).
- `ApiApplicationService` — constructs `ExecutionRunService` wired to:
  `this.capability.getPlan(ownerId, planId)` (the REAL plan store) + a gateway `StepExecutionPort`
  over `AIOrchestratorSpecialistPort(this.ai)` + `LoopBudget` config from `ProductionAIConfig`.

## 4. UI (PHASE 6 — integrated into the existing EPIC-013 experience)

- `/capability-marketplace` page gains an **Execute plan** action on the plan header.
- NEW `components/capability/ExecutionRunView.tsx` — premium step timeline:
  `✓ done · ● running · ○ waiting · 🔒 approval · ⚠ manual · ⚙ configure`, per-step
  provider/model · progress · output (progressive disclosure) · approval card
  (WHAT/WHY/WHICH/COST/DATA/IRREVERSIBLE) · hand-off card (WHAT is blocked · WHY ·
  WHAT you do · WHAT happens after + Done) · cancel. No developer-console look.
- `lib/api-client.ts` — `useExecution*` hooks mirroring the `capability.*` hook pattern.

## 5. Build order

1. Package scaffolding → types → contracts → domain → application → infra → index
2. Deterministic tests (20 scenarios) — green before any gateway work
3. Gateway wiring + router tests (IDOR/ownership through the real tRPC pipeline)
4. UI (page + ExecutionRunView + hooks)
5. Full validation (typecheck ×4 · vitest · eslint) + code review
6. Real Chrome journey (plan → execute → step completes → approval/manual boundary → resume)
7. Benchmark (`scripts/execution-benchmark.ts`) + docs (SECURITY/COMPLETION/EVIDENCE + sync)
