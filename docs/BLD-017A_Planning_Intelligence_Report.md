# BLD-017A — Autonomous Planning Intelligence (SPRINT 1) — Architecture + Implementation Report

**Version 1.0**
**Date: September 5, 2026**
**Status: IMPLEMENTATION COMPLETE — ARCHITECTURE + IMPLEMENTATION FOUNDATION**

---

## 0. Executive Summary

The missing planning boundary of the Agent Execution Intelligence stack has been built as a
new workspace package, `@vedmoulya/planning` (`packages/planning`). It completes the chain:

```
USER GOAL → GOAL UNDERSTANDING → PLAN GENERATION → PLAN VALIDATION → READINESS CHECK →
GOVERNANCE / APPROVAL → EXISTING AGENT EXECUTION ENGINE
```

The planner **proposes**. The existing execution/governance layer (`packages/agent-execution`)
remains authoritative for what may actually execute — it was **not modified** (one root
workspace registration + eslint exception aside, nothing in the frozen kernel changed).

No duplicate planner/goal/capability/tool/router/verification/recovery/cost systems were
introduced: the package reuses the frozen `CapabilityType` taxonomy, the frozen
`AgentPlan`/`AgentPlanStep`/`AgentActionSpec`/`VerificationPolicy`/`StepRecoveryPolicy` types,
the authoritative `AgentToolRegistryPort`, the frozen `validatePlanStructure` /
`validatePlanReadiness` validators, the frozen `sanitizeTraceText` sanitizer, and — for every
AI call including AI-assisted planning — the frozen `AIOrchestrationService` (inheriting
ProviderRoutingAdvisor → RoutingEvidenceService → ExecutionHealthService → capability gates →
retry/fallback → CostLedger).

---

## 1. Phase 1 — Inspection Results (map of existing systems)

| System                                                                                                                                                                  | Location                                                                           | Reused?                                                                                                                                                    |
| :---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :--------------------------------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Agent Execution Intelligence kernel (Goal→Plan→Step→Action→Observation→Verification→Recovery→Outcome, bounded state machine, approval policy, budgets, traces)          | `packages/agent-execution`                                                         | **Yes — authoritative execution kernel, untouched**                                                                                                        |
| `AgentPlan` / `AgentPlanStep` / `AgentActionSpec` / `VerificationPolicy` / `StepRecoveryPolicy` / `ToolPermissionClass` / `AgentAutonomyLevel` / `AgentRunBudgetConfig` | `packages/agent-execution/src/types`                                               | **Yes — reused directly (Plan/Step/Action/VerificationSpec/RecoverySpec concepts are these frozen types, never redefined)**                                |
| `validatePlanStructure` / `validatePlanReadiness` (frozen plan validation)                                                                                              | `packages/agent-execution/src/domain/PlanValidator.ts`                             | **Yes — composed into the planner's validation + readiness pipeline**                                                                                      |
| `AgentExecutionService` (agent.start/status/approve/cancel/list)                                                                                                        | `packages/agent-execution/src/application`                                         | **Yes — the executor the planner hands READY plans to**                                                                                                    |
| Capability taxonomy (`CapabilityType`, `CAPABILITY_TYPES`, `QualityTier`)                                                                                               | `packages/ai`                                                                      | **Yes — the ONLY capability vocabulary; no parallel enum**                                                                                                 |
| Tool registry + security chain (`ToolRegistry`, safe deterministic tools)                                                                                               | `packages/services/src/ai/runtime/ToolRuntime.ts`                                  | **Yes — planner selects only registry-exposed tools via the frozen `AgentToolRegistryPort`; execution stays in the frozen security chain**                 |
| AI orchestration / routing (`AIOrchestrationService`, `ProviderRoutingAdvisor`, `RoutingEvidenceService`, `ExecutionHealthService`, `CostLedger`)                       | `packages/services`, `services/api`                                                | **Yes — the `AIOrchestrationPlannerPort` adapts the same runtime; no new router, no provider SDK calls, no hard-coded providers**                          |
| Verification machinery (deterministic-first policies)                                                                                                                   | `packages/agent-execution/src/domain/verification.ts`                              | **Yes — planner emits frozen `VerificationPolicy`; the engine verifies**                                                                                   |
| Recovery machinery (bounded retry/alternate/revise/block/fail)                                                                                                          | `packages/agent-execution/src/domain/recovery.ts`                                  | **Yes — planner emits frozen `StepRecoveryPolicy`; the engine recovers**                                                                                   |
| Sanitization (`sanitizeTraceText`, `safeSlice`)                                                                                                                         | `packages/agent-execution/src/domain/sanitize.ts`                                  | **Yes — planner observability sanitizes every free-text field**                                                                                            |
| Loop-engine `GoalUnderstandingService` + `TaskDecompositionService`                                                                                                     | `packages/loop-engine`                                                             | Inspected — content-loop oriented (patterns/evidence/task graphs for its own specialists); does **not** produce `AgentPlan`s                               |
| Goals package (`GoalUnderstandingService`, `TaskDecompositionService`)                                                                                                  | `packages/goals`                                                                   | Inspected — goal-registry/lifecycle oriented (categories/priorities/business tasks); does **not** produce `AgentPlan`s                                     |
| Execution-strategy `CapabilityPlannerService`, capability-marketplace `CapabilityPlanner`, brain `ParallelPlanner`                                                      | `packages/execution-strategy`, `packages/capability-marketplace`, `packages/brain` | Inspected — capability/provider planning and graph building for their own engines; none emit the `AgentPlan` contract the frozen execution kernel consumes |

**Conclusion:** no existing system produces the `AgentPlan` contract that
`AgentExecutionService.start()` already documents as “produced by the existing planning
layer”. The planning boundary genuinely did not exist, so it was created as a new package —
**reusing** the frozen execution types rather than redefining them.

---

## 2. Architecture Summary

```
packages/planning  (@vedmoulya/planning)
├── src/types/planning-types.ts              Goal, GoalUnderstanding, PlanConstraint,
│                                            PlanReadiness, PlanGenerationResult
├── src/contracts/planning-ports.ts          PlannerAiPort (narrow); reuses
│                                            AgentToolRegistryPort + AgentClockPort
├── src/domain/
│   ├── goal-understanding.ts                Deterministic GoalUnderstandingService
│   ├── planner-templates.ts                 Smallest-viable deterministic plans
│   │                                        (repository-fix 7-step + generic)
│   ├── plan-proposal.ts                     UNTRUSTED AI output parser → frozen AgentPlan
│   ├── plan-validation.ts                   Pure validation pipeline (9 gates)
│   ├── plan-readiness.ts                    Deterministic READY | BLOCKED
│   └── planner-service.ts                   GOAL → UNDERSTAND → GENERATE → VALIDATE → READINESS
├── src/application/PlanningApplicationService.ts   Full chain into AgentExecutionService
└── src/infrastructure/AIOrchestrationPlannerPort.ts  Adapter over the frozen AI runtime
```

### Distinct concepts (Phase 2) — never collapsed

| Concept              | Representation                                                                      |
| :------------------- | :---------------------------------------------------------------------------------- |
| Goal                 | `GoalInput` (raw goal + context + constraints)                                      |
| GoalUnderstanding    | `GoalUnderstanding` (normalized, explained, explicit unknowns)                      |
| Plan                 | frozen `AgentPlan`                                                                  |
| PlanStep             | frozen `AgentPlanStep`                                                              |
| ActionSpec           | frozen `AgentActionSpec`                                                            |
| VerificationSpec     | frozen `VerificationPolicy`                                                         |
| RecoverySpec         | frozen `StepRecoveryPolicy`                                                         |
| PlanConstraint       | `PlanConstraint` (autonomy/budget/tools/permissions/verification/recovery ceilings) |
| PlanReadiness        | `PlanReadiness` (READY / BLOCKED with reasons)                                      |
| PlanGenerationResult | `PlanGenerationResult` (plan + readiness + observability)                           |

### Data flow

1. **Goal Understanding (Phase 3)** — deterministic normalization: capability inference
   (frozen taxonomy), constraints, verification expectations, expected outcome, autonomy +
   budget merging. Unknowns are listed in `unknownAspects` — never inferred. Underspecified
   goals → `clarificationNeeded` (BLOCKED, never guessed).
2. **Plan Generation (Phase 4/5)** — smallest viable plan. Default is deterministic
   templates (repository-fix canonical 7-step example + generic fallback). AI-assisted mode
   (`mode: 'ai'`) goes through `PlannerAiPort` → frozen runtime → **untrusted** proposal.
3. **Validation (Phase 4/8/9/11)** — `validateGeneratedPlan`: structural/DAG (frozen),
   capability membership, tool availability (authoritative registry), permission classes
   (the planner cannot grant itself permission), budget (deterministic estimate), verification
   (missing ⇒ explicit UNKNOWN, never silent success), bounded recovery, boundary discipline
   (no provider/model directives, known kinds, whitelisted fields only).
4. **Readiness (Phase 10)** — `computePlanReadiness` aggregates validation issues + frozen
   feasibility (`canRoute` via the runtime's selection intelligence) into READY | BLOCKED
   with explainable reasons. Obvious impossibilities are discovered before execution.
5. **Execution (Phase 16)** — `PlanningApplicationService.planAndExecute` hands a **READY**
   plan to the frozen `AgentExecutionService`, which re-validates, enforces the security
   chain, approval gates and budgets. BLOCKED plans are never executed.

### Planner safety boundary (Phase 11)

- AI output is parsed by `parsePlanProposal`: whitelisted keys only (unknown fields —
  including any provider/model directive — are rejected), frozen capabilities only, bounded
  recovery by construction, valid verification kinds, bounded plan/step/action sizes.
- The planner has **no tool execution port** and **no provider SDK access**; every AI call
  (including planning itself) inherits the runtime's routing/health/evidence/cost stack.
- AI failure / malformed output / evidence-first abstention → honest fallback to the
  deterministic template with the reason recorded (`plannerAi.failureReason` sanitized).

### Observability (Phase 13)

`PlanGenerationResult` records: original goal, normalized goal, planId, plan version,
source (deterministic / ai / ai-fallback), readiness + blocked reasons, selected
capabilities (full set), selected tools, verification kinds, bounded recovery summary,
planner provider/model/tokens/cost/latency, planning latency. All free text sanitized with
the frozen `sanitizeTraceText` — no raw prompts, no secrets.

---

## 3. Files Changed (exact)

### New — `packages/planning` (the planning boundary)

| File                                                                 | Purpose                                                                   |
| :------------------------------------------------------------------- | :------------------------------------------------------------------------ |
| `packages/planning/package.json`                                     | Workspace package `@vedmoulya/planning`                                   |
| `packages/planning/tsconfig.json`                                    | Project config (monorepo convention)                                      |
| `packages/planning/vitest.config.ts`                                 | Test config (monorepo convention)                                         |
| `packages/planning/src/index.ts`                                     | Package barrel                                                            |
| `packages/planning/src/types/planning-types.ts`                      | Goal/GoalUnderstanding/PlanConstraint/PlanReadiness/PlanGenerationResult  |
| `packages/planning/src/contracts/planning-ports.ts`                  | `PlannerAiPort`; re-exports `AgentToolRegistryPort`/`AgentClockPort`      |
| `packages/planning/src/domain/goal-understanding.ts`                 | `GoalUnderstandingService`                                                |
| `packages/planning/src/domain/planner-templates.ts`                  | `PLAN_TEMPLATES` + `selectTemplate`                                       |
| `packages/planning/src/domain/plan-proposal.ts`                      | `parsePlanProposal` / `planFromProposal` (untrusted input boundary)       |
| `packages/planning/src/domain/plan-validation.ts`                    | `validateGeneratedPlan` (9 validation gates)                              |
| `packages/planning/src/domain/plan-readiness.ts`                     | `computePlanReadiness` + `READINESS_BLOCK_CODES`                          |
| `packages/planning/src/domain/planner-service.ts`                    | `PlannerService` (the planning pass)                                      |
| `packages/planning/src/application/PlanningApplicationService.ts`    | Full chain into `AgentExecutionService`                                   |
| `packages/planning/src/infrastructure/AIOrchestrationPlannerPort.ts` | `PlannerAiPort` over the frozen AI runtime                                |
| `packages/planning/src/__tests__/fixtures.ts`                        | Deterministic fakes (clock, planner AI, registry, executor ports)         |
| `packages/planning/src/__tests__/goal-understanding.test.ts`         | 9 tests                                                                   |
| `packages/planning/src/__tests__/plan-proposal.test.ts`              | 15 tests (untrusted-input safety)                                         |
| `packages/planning/src/__tests__/plan-validation.test.ts`            | 9 tests                                                                   |
| `packages/planning/src/__tests__/planner-service.test.ts`            | 24 tests (PHASE 14 scenarios)                                             |
| `packages/planning/src/__tests__/planning-integration.test.ts`       | 6 tests (GOAL → … → EXECUTION)                                            |
| `packages/planning/src/__tests__/planner-templates.test.ts`          | 7 tests (template catalog: content/analysis/learning/generic/specificity) |

### Modified (minimal, non-execution)

| File                | Change                                                                                                                                                                                                                                 |
| :------------------ | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tsconfig.json`     | Added `{ "path": "packages/planning" }` to the build reference graph                                                                                                                                                                   |
| `package.json`      | _(no change to scripts)_                                                                                                                                                                                                               |
| `package-lock.json` | Purely additive: registers the `@vedmoulya/planning` workspace link **and** the previously-unlinked `@vedmoulya/agent-execution` workspace link (it post-dated the last `npm install`); no dependency versions changed                 |
| `eslint.config.js`  | Added `packages/planning/src/domain/plan-proposal.ts` to the existing closed-union `security/detect-object-injection` exception list (same proven pattern as `ToolRuntime.sanitizePayload`; keys come from the parser's own whitelist) |

**No files under `packages/agent-execution`, `packages/ai`, `packages/services`, or any other
frozen execution/security/routing system were modified.**

---

## 4. Integration Points

| Point                                        | How                                                                                                                                                                                                    |
| :------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Plan → execution                             | `PlanningApplicationService.planAndExecute` → `AgentExecutionService.start({ userId, goal, goalId, plan, autonomyLevel, budget })` — only for READY plans                                              |
| Capabilities                                 | `@vedmoulya/ai` `CapabilityType` / `CAPABILITY_TYPES` / `QualityTier` (frozen)                                                                                                                         |
| Plan/Step/Action/Verification/Recovery types | `@vedmoulya/agent-execution` frozen types (re-exported, never redefined)                                                                                                                               |
| Structural validation                        | frozen `validatePlanStructure` (composed)                                                                                                                                                              |
| Feasibility validation                       | frozen `validatePlanReadiness` over the runtime's `canRoute` (composed)                                                                                                                                |
| Tool intelligence                            | frozen `AgentToolRegistryPort` (the same port the execution engine consumes); production wiring reuses `ToolRegistryAgentPort` + `ToolRegistry`                                                        |
| AI/routing                                   | `AIOrchestrationPlannerPort` over `AIOrchestrationService.orchestrate` — inherits ProviderRoutingAdvisor, RoutingEvidenceService, ExecutionHealthService, capability gates, retry/fallback, CostLedger |
| Sanitization                                 | frozen `sanitizeTraceText`                                                                                                                                                                             |
| Governance                                   | approval gates remain in the frozen engine (verified: approval-required steps pause `WAITING_FOR_APPROVAL`)                                                                                            |

---

## 5. Test Results

| Check                              | Result                                                                                                                                                 |
| :--------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Full-repo tests (`npm test`)       | **10,085 / 10,085 passed** (baseline 10,009 + 70 planning tests + 6 gateway planning router tests; 786 test files)                                     |
| Typecheck (`npm run typecheck`)    | ✅ clean (`tsc -b` + `tsc --noEmit -p services/api`)                                                                                                   |
| Lint (`npm run lint`)              | ✅ 57 scopes, 0 failed                                                                                                                                 |
| Production build (`npm run build`) | ✅ clean                                                                                                                                               |
| Audit (`npm run audit`)            | ✅ no criticals (exit 0) — vulnerability set identical to baseline (faker-js/storybook/fast-uri/js-yaml transitive dev-deps, untouched by this sprint) |

### PHASE 14 scenario coverage (all green)

1. valid simple goal → valid READY plan ✅
2. multi-step goal → dependency DAG (7-step repository-fix template) ✅
3. multi-capability goal preserves ALL capabilities (never reduced) ✅ (+ explicit `CAPABILITY_NOT_COVERED` warning when a fixed template cannot cover an inferred capability)
4. unavailable capability → BLOCKED (`CAPABILITY_NOT_ROUTABLE`) ✅
5. unavailable tool → BLOCKED (`TOOL_UNAVAILABLE`, never fabricated) ✅
6. unauthorized tool → BLOCKED (`INSUFFICIENT_PERMISSION`) ✅
7. invalid dependency → BLOCKED (`DEPENDENCY_UNKNOWN`) ✅
8. circular dependency → BLOCKED (`DEPENDENCY_CYCLE`) ✅
9. missing verification → explicit UNKNOWN warning (default) / BLOCKED (`requireVerification`) ✅
10. budget violation → BLOCKED (`BUDGET_EXCEEDED`, deterministic estimate) ✅
11. permission escalation attempt → rejected (`INSUFFICIENT_PERMISSION` + high-risk gate warning) ✅
12. unknown planner-generated tool → rejected ✅
13. planner cannot bypass routing (provider/model directives rejected at parse; no provider in any produced plan) ✅
14. planner cannot bypass ToolRuntime (planner has no tool execution port; tool calls execute only through the frozen engine — verified in integration) ✅
15. recovery remains bounded (parse caps + constraint ceilings; infinite/unbounded rejected) ✅
16. Gemini regression — none: no provider/routing code touched ✅
17. existing Agent Execution Intelligence tests remain green ✅
18. existing routing tests remain green ✅
19. planner AI failure handled honestly (fallback + sanitized recorded reason) ✅
20. malformed AI planner output rejected safely ✅

---

## 6. Security Validation

- **AI output is untrusted**: every proposal is parsed with a whitelist; unknown keys,
  provider/model directives, unknown capabilities, malformed verification/recovery, duplicate
  ids and oversized plans are rejected — never silently dropped.
- **Permission boundary**: the planner cannot grant itself permission; every tool must exist
  in the authoritative registry and its permission class must be within the principal's
  granted classes. High-risk classes surface a governance-gate warning.
- **No provider bypass**: the planner never calls provider SDKs and never hard-codes a
  provider/model; all AI calls (including planning) flow through the frozen routing stack.
- **No tool bypass**: the planner has no tool execution surface; tool calls execute only
  through the frozen engine's security chain (proven by integration test asserting the tool
  observation lands on the execution run, not the planner).
- **Bounded by construction**: plan size, action count, instruction length, recovery
  attempts/revisions and budgets are all capped deterministically.
- **Observability sanitized**: failure reasons and all recorded text pass through the frozen
  `sanitizeTraceText` (credential patterns redacted — verified by test).
- **Governance authoritative**: approval-required/high-risk steps pause the run
  `WAITING_FOR_APPROVAL`; nothing executes past a gate without a recorded human decision.

---

## 7. Remaining Gaps (deliberate)

1. **No UI, no public API router** (per PHASE 15) — the package is a domain/application
   boundary; wiring a tRPC/HTTP surface is a later sprint.
2. **Deterministic planning is the default**; AI-assisted planning is opt-in (`mode: 'ai'`).
   Deterministic-first is the smallest viable and cheapest path; AI planning inherits the
   full routing stack when enabled.
3. **Budget estimates are conservative upper bounds** (1,500 tokens/AI action/attempt,
   ~$2/1M tokens). They are deliberately pessimistic; real execution usage is governed by the
   frozen engine's budgets.
4. **Goal capability inference is keyword-based** — heuristics can miss or over-match; the
   planner treats the understanding as a proposal and records uncovered capabilities
   explicitly rather than silently dropping them.
5. **The deterministic repository-fix template assumes test-oriented goals**; other
   domains use the generic 3-step template. Template catalog growth is future work.
6. **Planner AI calls use `reasoning` as the planning capability** through the existing
   routing stack; no new capability was invented.
7. **`npm audit` vulnerability set is the pre-existing baseline** (no criticals; unchanged
   by this sprint — the lockfile diff is purely additive workspace links).

---

## 7b. Post-Sprint Follow-ups (BLD-017A follow-up work)

Landed on top of the frozen Sprint 1 foundation (all gates re-verified):

| Deliverable                           | What                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | Where                                                                                                                              |
| :------------------------------------ | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------- |
| Deterministic template catalog growth | **content** (5-step), **analysis** (4-step), **learning** (5-step) templates added in specificity order before the generic fallback — each with bounded recovery + verification on every step + frozen `validatePlanStructure`-clean DAGs                                                                                                                                                                                                                                                                        | `packages/planning/src/domain/planner-templates.ts` + `planner-templates.test.ts` (7 tests)                                        |
| Live end-to-end demo                  | **`npm run planning:demo`** — the FULL production chain with the real `AIOrchestrationService` (+ `configureIntelligence` ports), `ToolRegistry`/`registerSafeTools`, `ToolRegistryAgentPort`, `AIOrchestrationAgentPort`, `AIOrchestrationPlannerPort`, `AgentExecutionService`, `PlanningApplicationService`. 12/12 checks: deterministic plan → READY → 7 steps executed → **ACHIEVED**; AI proposal via real runtime → parsed → READY → **ACHIEVED**; fabricated-tool proposal → **BLOCKED**, never executed | `scripts/planning-demo.ts`                                                                                                         |
| Planning benchmark                    | **`npm run planning:benchmark`** — deterministic vs AI mode over all 5 templates × 3 runs: latency, cost, tokens, ready-rate; deterministic = $0 + zero AI calls, AI = measured $0.0001 + ~518 tokens/plan through the runtime. Assertions deterministic (every run READY, AI usage recorded honestly). Added to the `benchmarks` chain + CI/release workflows                                                                                                                                                   | `scripts/planning-benchmark.ts`                                                                                                    |
| Public API router                     | **`planning.plan`** (GOAL → … → READINESS, no execution) and **`planning.planAndExecute`** (READY-only handoff to the frozen executor) exposed through the gateway tRPC registry (heavy tier, auth + IDOR). Wired in `ApiApplicationService` with ONE shared `ToolRegistryAgentPort` across planner + executor                                                                                                                                                                                                   | `services/api/src/routers/PlanningRouter.ts`, `RouterRegistry.ts`, `ApiApplicationService.ts` + `PlanningRouter.test.ts` (6 tests) |

Test counts after follow-ups: **planning 70 tests** (63 sprint + 7 templates), **gateway planning 6 tests**, full repo **10,085 / 10,085**. Typecheck, lint (57 scopes), production build all clean.

---

## 8. Gemini / Provider Behavior — Explicit Confirmation

**Gemini behavior is completely unchanged.** No provider adapter, routing rule, health
record, evidence record, cost record or model configuration was touched. The planning
package never names a provider (its AI boundary passes capability + prompt only; the frozen
`AIOrchestrationService` decides routing). All provider tests (Gemini, DeepSeek, OpenAI,
OpenAI-compatible, Google, Vercel AI, Mock) remain green in the 10,085-test run, and the
`services/orchestrator` provider adapters were not modified.

---

## Declaration

**BLD-017A — Autonomous Planning Intelligence (SPRINT 1)**  
**Version 1.0**  
**IMPLEMENTATION COMPLETE — ARCHITECTURE + IMPLEMENTATION FOUNDATION**

The `@vedmoulya/planning` package completes GOAL → UNDERSTANDING → PLAN → VALIDATION →
READINESS → EXISTING AGENT EXECUTION while the existing execution/security/routing
boundaries remain authoritative and untouched.
