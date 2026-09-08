# BLD-018A — Adaptive Agent Loop (Model-Driven OBSERVE → DECIDE → ACT Coordination) — Architecture + Implementation Report

**Version 1.0**
**Date: September 5, 2026**
**Status: IMPLEMENTATION COMPLETE — CONTROLLED AUTONOMY LAYER**

---

## 0. Executive Summary

The next controlled autonomy layer has been built as a new workspace package,
`@vedmoulya/adaptive-loop` (`packages/adaptive-loop`). It completes the chain:

```
GOAL → PLAN → EXECUTION → OBSERVATION → MODEL DECISION → VALIDATION → AUTHORIZATION →
ACTION → OBSERVATION → VERIFICATION → ACHIEVED
```

The **model may propose the next action** — it never becomes the security boundary.
VedMoulya remains authoritative over capabilities, tools, permissions, approvals, budgets,
routing, verification, recovery and termination. The package is a thin **coordinator**:
every executed action flows through the frozen execution ports, verification reuses the
frozen machinery, recovery reuses the frozen strategy, and no duplicate loop / registry /
router / capability / permission / verification / recovery / cost / memory system was
introduced.

The two frozen foundations are architecturally intact:

- **Agent Execution Intelligence** (`packages/agent-execution`) — the execution kernel —
  was **not modified** (files untouched; only its exports are consumed).
- **Planning Intelligence** (`packages/planning`) — the planning boundary — was **not
  modified**; this sprint consumes READY plans and (for REPLAN) adapts the `PlannerAiPort`
  shape through a narrow port.

---

## 1. Phase 1 — Inspection Results (map of existing systems)

| System                                                                                              | Location                                                             | Reused?                                                                                                                                                                                      |
| :-------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Execution kernel (Goal→Plan→Execute→Observe→Verify→Recover→Achieve, budgets, approval, traces)      | `packages/agent-execution`                                           | **Yes — authoritative, untouched**                                                                                                                                                           |
| `AgentObservation` / `AgentObservationStatus`                                                       | `packages/agent-execution/src/types`                                 | **Yes — the frozen Observation type is reused, never redefined**                                                                                                                             |
| `verifyAgainstPolicy` / `VerificationPolicy` / `VerificationVerdict`                                | `packages/agent-execution/src/domain/verification.ts`                | **Yes — COMPLETE only ever follows frozen verification evidence**                                                                                                                            |
| `decideRecovery` / `StepRecoveryPolicy`                                                             | `packages/agent-execution/src/domain/recovery.ts`                    | **Yes — bounded retry/alternate/revise/block/fail semantics**                                                                                                                                |
| `isHighRisk` / `HIGH_RISK_PERMISSION_CLASSES` / approval gates                                      | `packages/agent-execution/src/domain/approval-policy.ts`             | **Yes — high-risk tools gate at every autonomy level; the model cannot downgrade an action to dodge approval**                                                                               |
| `sanitizeTraceText` / `safeSlice`                                                                   | `packages/agent-execution/src/domain/sanitize.ts`                    | **Yes — every observation/error/rationale field is sanitized + bounded**                                                                                                                     |
| `DEFAULT_AGENT_RUN_BUDGET` / `AgentRunBudgetConfig`                                                 | `packages/agent-execution`                                           | **Yes — run budgets are hard ceilings**                                                                                                                                                      |
| `AgentAiExecutionPort` / `AgentToolExecutionPort` / `AgentToolRegistryPort` / `AgentClockPort`      | `packages/agent-execution/src/contracts`                             | **Yes — the ONLY execution paths (production: `AIOrchestrationAgentPort` → `AIOrchestrationService`, `ToolRegistryAgentPort` → `ToolRuntime`)**                                              |
| Capability taxonomy (`CapabilityType`, `CAPABILITY_TYPES`)                                          | `packages/ai`                                                        | **Yes — the ONLY capability vocabulary**                                                                                                                                                     |
| Planning boundary (`PlannerService`, templates, readiness)                                          | `packages/planning`                                                  | **Yes — READY plans in, bounded REPLAN out via a narrow port; untouched**                                                                                                                    |
| AI orchestration / routing / health / evidence / cost                                               | `packages/services`                                                  | **Yes — decision-model port is implemented over `AIOrchestrationService`**                                                                                                                   |
| Tool registry + `ToolRuntime` security chain                                                        | `packages/services/src/ai/runtime/ToolRuntime.ts`                    | **Yes — declared + model tools execute only through the frozen port**                                                                                                                        |
| Loop-engine `DecisionService` / ecosystem `DecisionModel` / world-model “normalizeObservationState” | `packages/loop-engine`, `packages/ecosystem`, `packages/world-model` | Inspected — business/evidence-state decisioning for their own engines; none implement a bounded, model-proposal-validated OBSERVE→DECIDE→ACT agent coordinator over the `AgentPlan` contract |

**Conclusion:** no existing observation/action-decision abstraction matched the sprint's
contract (a closed-set, whitelisted Decision over the frozen `AgentObservation` +
`AgentPlan` estate). The adaptive boundary was created as a new package, reusing the frozen
types and machinery directly. No duplicate of any frozen system was introduced.

---

## 2. Architecture Summary

```
packages/adaptive-loop  (@vedmoulya/adaptive-loop)
├── src/types/adaptive-loop-types.ts        Decision / ActionProposal / run state machine,
│                                            hard loop budgets, traceable decision record
├── src/contracts/adaptive-loop-ports.ts    AgentDecisionModelPort, AdaptivePlannerPort,
│                                            AdaptiveApprovalStore, AdaptiveRunStore,
│                                            AdaptiveRunObserver (+ reused frozen ports)
├── src/domain/
│   ├── observation.ts                      Observation normalization + bounded context
│   ├── decision.ts                         UNTRUSTED model output parser (whitelist)
│   ├── decision-validation.ts              Capability/tool/permission/governance gates
│   ├── loop-guard.ts                       Deterministic hard bounds + loop detection
│   ├── adaptive-context.ts                 Bounded decision context builder
│   └── adaptive-engine.ts                  The OBSERVE → DECIDE → VALIDATE → GOVERN → ACT
│                                            state machine (action-level coordinator)
├── src/application/AdaptiveLoopService.ts  Start/resume/approve/reject surface + run store
└── src/infrastructure/
    ├── AIOrchestrationDecisionPort.ts      Decision model over the frozen AIOrchestrationService
    └── InMemoryAdaptiveApprovalStore.ts    Explicit, recorded human approvals
```

### Concepts stay distinct (Phase 2) — never collapsed

| Concept                 | Representation                                                                                                                                  |
| :---------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------- |
| Goal                    | `AdaptiveRun.goal` + goalId (preserved across replan)                                                                                           |
| Plan                    | frozen `AgentPlan` (from the frozen planning boundary — READY)                                                                                  |
| Step / Action           | frozen `AgentPlanStep` / `AgentPlanStep.actions`                                                                                                |
| Observation             | frozen `AgentObservation` (normalized, sanitized, bounded)                                                                                      |
| Decision                | closed-set `AdaptiveDecision` (CONTINUE / TOOL_CALL / AI_ACTION / VERIFY / REVISE_STEP / REPLAN / COMPLETE / FAIL / REQUEST_APPROVAL / ABSTAIN) |
| ActionProposal          | `ActionProposal` — only a VALIDATED + GOVERNED proposal executes                                                                                |
| Verification / Recovery | frozen `verifyAgainstPolicy` / `decideRecovery` semantics                                                                                       |
| Outcome                 | `ACHIEVED / PARTIALLY_ACHIEVED / FAILED / BLOCKED / CANCELLED` with an explicit `terminationReason`                                             |

### The loop shape (one decision per iteration)

```
pick next pending step → EXECUTING → DECIDING (bounded context → model)
→ PROPOSED_ACTION → VALIDATING (capability/tool/permission/budget/scope)
→ GOVERNANCE (high-risk/approval gates) → EXECUTING (frozen port only)
→ OBSERVING (normalize + sanitize + bound) → VERIFYING (frozen machinery) → …
→ VERIFIED / COMPLETED / FAILED_FINAL / BLOCKED / WAITING_FOR_APPROVAL
```

With **no decision model wired**, the loop is deterministic: it executes each step's
declared actions and verifies them with the frozen machinery (the baseline used by the
integration tests and available as the cheapest production mode).

### Decision boundary (Phases 4–5)

- Model output is **UNTRUSTED INPUT**. `parseDecisionProposal` accepts **only** a
  whitelisted field set over the **closed** kind set. Unknown keys are **rejected** (never
  silently dropped). Provider/model/permission/budget/autonomy/execute/command/shell/url/SDK
  directives are rejected at parse time — the model cannot express routing or authority
  changes.
- `AgentDecisionModelPort` is implemented over the **frozen `AIOrchestrationService`**
  (`AIOrchestrationDecisionPort`) — decision calls inherit ProviderRoutingAdvisor →
  RoutingEvidenceService → ExecutionHealthService → capability gates → retry/fallback →
  CostLedger. No provider SDK is ever called; no provider is hard-coded.

### Validation + governance (Phases 6–8, 23)

- Capability whitelist derives from the goal/plan/step declarations (`allowedCapabilitiesForStep`);
  any proposal outside it is **CAPABILITY_ESCALATION → BLOCKED**. `requiredCapabilities[]`
  is preserved in full — never reduced to `[capability]`.
- Tool proposals resolve against the authoritative `AgentToolRegistryPort`; unknown tool →
  `TOOL_UNAVAILABLE`, outside the principal allowlist → `UNAUTHORIZED_TOOL`, un-granted
  permission class → `PERMISSION_DENIED`. **The model cannot grant itself permission.**
- Execution is only ever through the frozen `AgentAiExecutionPort` / `AgentToolExecutionPort`
  (ToolRuntime security chain in production). A denial is **never retried and never bypassed**.
- REVISE_STEP may touch only approach context; REPLAN is a new proposal (never a new
  authority level) and must preserve capability/tool authority or it is BLOCKED.

### Bounds + loop detection (Phases 10–11)

`checkLoopBudgets` is a deterministic guard over **hard ceilings**: decision iterations,
executed actions, tool calls, tokens, cost, wall-clock, abstains. When any budget is
exhausted the run **stops and is never asked again**; permission denials and budget
exhaustion are never retried. Repetition is detected deterministically via action
fingerprints (`detectLoop`): identical consecutive actions beyond `loopThreshold` →
**LOOP_DETECTED** → honest bounded termination. Revisions and replans are bounded by
`maxRevisions` / `maxReplans`.

### Context + traceability (Phases 17–18)

`buildDecisionContext` hands the model only: goal, current step (objective + capability),
recent observations (most recent N + a compression marker — never the full transcript),
available authorized tools, allowed capabilities, remaining budget, verification/recovery
state, allowed decision kinds. Every `AdaptiveDecisionRecord` captures decisionId/kind/
step/action/capability/tool/rationale (sanitized, ≤400)/validation/rejection reasons/
attempt/revision/replan count/timestamps, plus provider/model/tokens/cost **only when the
frozen runtime actually selected them**. No raw prompts, no secrets. No memory system was
added (Phase 19) — observations stay on the run record.

---

## 3. Files Changed (exact)

### New — `packages/adaptive-loop` (the adaptive coordination boundary)

| File                                                  | Purpose                                                                                                                      |
| :---------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------- |
| `package.json`                                        | Workspace package `@vedmoulya/adaptive-loop`                                                                                 |
| `tsconfig.json`                                       | Project config (monorepo convention)                                                                                         |
| `vitest.config.ts`                                    | Test config (monorepo convention)                                                                                            |
| `src/index.ts`                                        | Package barrel                                                                                                               |
| `src/types/adaptive-loop-types.ts`                    | Decision / ActionProposal / run state machine / loop budgets / decision records                                              |
| `src/contracts/adaptive-loop-ports.ts`                | `AgentDecisionModelPort`, `AdaptivePlannerPort`, `AdaptiveApprovalStore`, `AdaptiveRunStore`, observer + reused frozen ports |
| `src/domain/observation.ts`                           | Observation normalization + bounded context (frozen `AgentObservation`, frozen sanitizers)                                   |
| `src/domain/decision.ts`                              | `parseDecisionProposal` — untrusted model-output boundary                                                                    |
| `src/domain/decision-validation.ts`                   | `validateDecision` — capability/tool/permission/governance/scope gates                                                       |
| `src/domain/loop-guard.ts`                            | `checkLoopBudgets` / `detectLoop` / fingerprints                                                                             |
| `src/domain/adaptive-context.ts`                      | `buildDecisionContext` / `pickNextPendingStep`                                                                               |
| `src/domain/adaptive-engine.ts`                       | The OBSERVE → DECIDE → VALIDATE → GOVERN → ACT engine                                                                        |
| `src/application/AdaptiveLoopService.ts`              | start/approve/reject/resume surface + `InMemoryAdaptiveRunStore`                                                             |
| `src/infrastructure/AIOrchestrationDecisionPort.ts`   | Decision model over the frozen AI runtime                                                                                    |
| `src/infrastructure/InMemoryAdaptiveApprovalStore.ts` | Explicit, recorded human approvals                                                                                           |
| `src/__tests__/fixtures.ts`                           | Deterministic fake ports (clock, AI, tools, registry, decision model, planner, plans)                                        |
| `src/__tests__/observation.test.ts`                   | 8 tests (normalize/sanitize/bound + bounded context)                                                                         |
| `src/__tests__/decision.test.ts`                      | 23 tests (closed kinds, malformed/unknown/forbidden fields, directives)                                                      |
| `src/__tests__/decision-validation.test.ts`           | 17 tests (escalation/tool/permission/governance/scope)                                                                       |
| `src/__tests__/loop-guard.test.ts`                    | 11 tests (budgets, loop detection, no-retry)                                                                                 |
| `src/__tests__/adaptive-engine.test.ts`               | 28 tests (PHASE 21 full chain + safety proofs)                                                                               |
| `src/__tests__/adaptive-loop-service.test.ts`         | 6 tests (application surface, approvals, ownership)                                                                          |

**106 tests total** in the package.

### Modified (minimal, non-execution)

| File               | Change                                                                                                                                                                                                                                                                                                                                         |
| :----------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tsconfig.json`    | Added `{ "path": "packages/adaptive-loop" }` to the build reference graph                                                                                                                                                                                                                                                                      |
| `eslint.config.js` | Added the adaptive-loop domain files (`adaptive-engine.ts`, `adaptive-context.ts`, `loop-guard.ts`) to the existing closed-key indexing exception list with explanatory comments (same proven pattern as the frozen `AgentExecutionEngine` and loop-engine exemptions; keys come from the READY plan's own validated stepIds, never raw input) |

**No files under `packages/agent-execution`, `packages/planning`, `packages/ai`,
`packages/services` or any provider/routing adapter were modified.**

---

## 4. Integration Points

| Point                                 | How                                                                                                                                                                                                                 |
| :------------------------------------ | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| READY plan in                         | `AdaptiveLoopService.start({ goal, plan, autonomyLevel, allowedTools, grantedPermissionClasses, budget, loopBudgets })` — the plan comes from the frozen planning boundary; the engine walks it in dependency order |
| Decision model                        | `AgentDecisionModelPort` over the frozen `AIOrchestrationService` (production: `AIOrchestrationDecisionPort`); deterministic CONTINUE mode when unwired                                                             |
| AI actions                            | frozen `AgentAiExecutionPort` only (production: `AIOrchestrationAgentPort` → routing/health/evidence/cost)                                                                                                          |
| Tool calls                            | frozen `AgentToolExecutionPort` + `AgentToolRegistryPort` only (production: `ToolRegistryAgentPort` → `ToolRuntime` security chain)                                                                                 |
| Verification                          | frozen `verifyAgainstPolicy` (+ optional model verifier port) — step-level and goal-level; UNKNOWN is never silent success                                                                                          |
| Recovery                              | frozen `decideRecovery` semantics with the loop's hard ceilings; permission/budget denials never retried                                                                                                            |
| Approvals                             | `AdaptiveApprovalStore` (production: in-memory store; `AdaptiveLoopService.approve/reject` is the only human surface)                                                                                               |
| Replan                                | `AdaptivePlannerPort.replan` → a new candidate plan is readiness-gated and authority-checked before it can replace the run's plan                                                                                   |
| Capabilities / sanitization / budgets | `@vedmoulya/ai` `CapabilityType`, frozen `sanitizeTraceText`, frozen `DEFAULT_AGENT_RUN_BUDGET`                                                                                                                     |

---

## 5. Complete Execution-Chain Proof (PHASE 21)

The full chain below is exercised end-to-end in `adaptive-engine.test.ts` against the
**real `PlannerService`** (deterministic repository-fix template → 7 AI steps, READY) with
the real `AdaptiveEngine`:

```
USER GOAL  “Analyze this repository and fix the failing tests.”
  → Goal Understanding            PlannerService.derive()            ✅ (goalId, normalized, capabilities)
  → Plan Generation                repository-fix template (7 steps)  ✅
  → Plan Validation                validateGeneratedPlan              ✅ (no issues)
  → Readiness                      computePlanReadiness = READY       ✅
  → Execution (adaptive loop)      AdaptiveEngine.run(run)
      → Observation               normalized AgentObservation per action ✅
      → Model Decision            AI_ACTION('reasoning') proposed     ✅ (decision record APPROVED)
      → Validation                capability whitelist                ✅
      → Authorization             frozen AgentAiExecutionPort         ✅ (ai.calls = 8, provider/model recorded)
      → Action → Observation      executed + normalized               ✅
      → Verification              7/7 steps VERIFIED (frozen rules)   ✅
  → ACHIEVED                       outcome=ACHIEVED, GOAL_VERIFIED, state=VERIFIED ✅
```

Additional full-chain scenarios proven:

- **same flow → blocked unauthorized tool** — model proposes `fabricated.tool` /
  `admin.purge` (registered but outside the principal allowlist) → run **BLOCKED**
  (`TOOL_UNAVAILABLE` / `UNAUTHORIZED_TOOL`), the tool port was **never called** (0
  executions) ✅
- **same flow → capability escalation** — model proposes `AI_ACTION('vision')` on a
  reasoning-only plan → run **BLOCKED** `CAPABILITY_ESCALATION`, AI port **never called** ✅
- **same flow → repeated loop → bounded termination** — identical consecutive actions
  beyond `loopThreshold` → **LOOP_DETECTED**, `FAILED_FINAL`, third repetition never
  executed ✅
- **same flow → permission denial** — frozen port denies → **BLOCKED**
  `PERMISSION_DENIED` after exactly ONE attempt (never retried, never bypassed) ✅
- **same flow → approval gate** — high-risk tool at `CONTROLLED_AUTONOMOUS` / every tool
  at `ASSISTED` → **WAITING_FOR_APPROVAL**; resumes only after an explicit human approve;
  reject → `APPROVAL_REJECTED` ✅

## 6. Security-Boundary Proof

Malicious / invalid model decisions **cannot bypass** (all verified by tests; each rejected
decision leaves the execution ports untouched):

- **Capabilities** — `AI_ACTION('vision')` outside the plan whitelist → BLOCKED
  `CAPABILITY_ESCALATION`; escalation hidden in `requiredCapabilities[]` also rejected;
  full `requiredCapabilities` always preserved ✅
- **Permissions** — un-granted permission class → `PERMISSION_DENIED`; tool outside the
  principal allowlist → `UNAUTHORIZED_TOOL`; runtime denial never retried ✅
- **ToolRuntime** — unknown/fabricated tools → BLOCKED with **zero** tool-port calls; the
  only tool execution path is the frozen `AgentToolExecutionPort` (asserted via call
  counts) ✅
- **AIOrchestrationService** — provider/model/`execute`/`command`/`shell`/`url`/`sdk`/
  `bypass` directives rejected at parse time; every AI action executes only through the
  frozen `AgentAiExecutionPort` ✅
- **Governance** — the model cannot approve itself (no model-facing approve path exists;
  resume without a recorded human decision is refused); a high-risk action cannot be
  downgraded to dodge approval (`requiresApproval` derives from the authoritative registry,
  never from the model) ✅
- **Verification** — a model `COMPLETE` claim with unverified steps is refused
  (`VERIFICATION_BLOCKED`); UNKNOWN is never success; the goal is only `ACHIEVED` after
  step + goal-level verification evidence ✅
- **Budgets** — decision iterations / actions / tool calls / tokens / cost / wall-clock /
  abstains are hard ceilings; exhaustion stops the run before another consult/action; no
  retry of permission denial or budget exhaustion ✅
- **Replan / revision** — replans beyond `maxReplans` BLOCKED; a replan that widens
  capability authority BLOCKED (`CAPABILITY_ESCALATION`); revisions bounded ✅
- **Malformed / unknown output** — non-JSON, unknown kinds, unknown keys, oversized output
  and model runtime errors are rejected or abstained honestly — never executed, loop stays
  bounded ✅
- **Observations** — secrets (API keys, tokens) are redacted by the frozen sanitizer
  before they reach observations or the model context; observation count and length are
  bounded ✅

## 7. Test Results

| Check                              | Result                                                                                                                                         |
| :--------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------- |
| Full-repo tests (`npm test`)       | **10,191 / 10,191 passed** (baseline 10,085 + 106 new adaptive-loop tests; 792 test files)                                                     |
| Typecheck (`npm run typecheck`)    | ✅ clean (`tsc -b` + `tsc --noEmit -p services/api`)                                                                                           |
| Lint (`npm run lint`)              | ✅ 58 scopes, 0 failed                                                                                                                         |
| Production build (`npm run build`) | ✅ clean                                                                                                                                       |
| Audit (`npm run audit`)            | ✅ exit 0 (`--audit-level=critical`, no criticals) — vulnerability set identical to the pre-existing baseline (transitive dev-deps, untouched) |

### PHASE 20 scenario coverage (all green)

observation normalization ✅ · sanitization (secrets never leak) ✅ · oversized-truncation ✅ ·
valid CONTINUE/TOOL_CALL/AI_ACTION/VERIFY/COMPLETE/FAIL/REQUEST_APPROVAL/ABSTAIN ✅ ·
malformed rejected ✅ · unknown kind rejected ✅ · unknown tool rejected ✅ · unauthorized tool
rejected ✅ · capability escalation rejected ✅ · requiredCapabilities preserved ✅ ·
provider directive rejected ✅ · model directive rejected ✅ · permission escalation rejected ✅ ·
budget escalation rejected ✅ · autonomy escalation rejected ✅ · ToolRuntime sole tool path ✅ ·
AIOrchestrationService sole AI path ✅ · verification prevents false completion ✅ ·
bounded decision loop ✅ · repeated-action loop detection ✅ · bounded revision ✅ ·
bounded replan ✅ · permission denial no retry ✅ · budget exhaustion no retry ✅ ·
model failure handled honestly ✅ · tool failure becomes observation ✅ ·
verification failure becomes observation/recovery ✅ · replan preserves authority ✅ ·
approval resumes only after explicit approval ✅ · Gemini regression ✅ ·
existing Agent Execution tests ✅ · existing Planning tests ✅ · existing routing tests ✅

## 8. Performance / Loop-Bound Information

| Bound                                     | Default ceiling          | Enforcement point                                             |
| :---------------------------------------- | :----------------------- | :------------------------------------------------------------ |
| Decision iterations (model consultations) | 40                       | before each consult — the model is never asked when exhausted |
| Executed actions                          | 24                       | before each action execution                                  |
| Tool calls                                | 8                        | before each tool call                                         |
| Retries (recovery attempts per step)      | 2 (frozen `maxAttempts`) | frozen `decideRecovery`                                       |
| Revisions (`REVISE_STEP`)                 | 2                        | validation + dispatch                                         |
| Replans                                   | 2                        | validation + dispatch                                         |
| Wall-clock                                | 300 000 ms               | per loop iteration (deterministic clock in tests)             |
| Cumulative tokens                         | 64 000                   | per loop iteration                                            |
| Cumulative cost                           | 1.0 USD                  | per loop iteration                                            |
| Abstains                                  | 3                        | per loop iteration → honest `ABSTAIN_LIMIT_EXCEEDED`          |
| Repeated identical actions                | 3 (`loopThreshold`)      | deterministic `detectLoop`                                    |

Loop behavior is deterministic and **O(1) bounded**: no blind repetition, no infinite loop,
no re-consult after exhaustion. The engine's loop-guard unit tests (11) plus engine tests
pin these behaviors. All test runs are deterministic-clock driven (no wall-clock flakes).

## 9. Remaining Gaps (deliberate)

1. **No UI and no public API router** (per PHASE 22) — this sprint is the domain/application
   layer; the tRPC surface for the adaptive loop is future work (the `planning.*` router from
   the previous sprint remains the gateway path into planning + execution).
2. **No memory system** (per PHASE 19) — observations live on the run record only; memory
   learning is a future sprint. An `AdaptiveRunObserver` seam is provided so a future
   sprint can attach without touching the engine.
3. **Deterministic mode is the default** — model-driven DECIDING is opt-in via
   `AgentDecisionModelPort`; deterministic CONTINUE mode executes the declared READY plan
   with frozen verification (cheapest, smallest viable).
4. **The approval store is in-memory** — a durable/persistent store (and run store) is a
   production-wiring follow-up; the `AdaptiveApprovalStore` / `AdaptiveRunStore` contracts
   keep that additive.
5. **The engine executes one action per decision iteration** (single-step lookahead).
   Multi-action batching / branching continuation is future work and would go through the
   same validation + governance chain.
6. **Replanning honors the original plan's declared capability/tool surface** — a replan
   may not widen it; replans that need genuinely new authority must be requested by a human
   (out of scope here).
7. **Tool-call schema validation** is enforced by the frozen ToolRuntime at execution (the
   engine does not re-implement zod schemas); malformed arguments produce a failed
   observation and bounded recovery, matching the frozen chain's behavior.

## 10. Gemini Regression — Explicit Confirmation

**Gemini behavior is completely unchanged.** No provider adapter, routing rule, health
record, evidence record, cost record or model configuration was touched. The adaptive-loop
package never names a provider: the decision port passes capability + prompt only, and the
frozen `AIOrchestrationService` decides routing; execution and verification use the frozen
ports/machinery. All provider tests (Gemini, DeepSeek, OpenAI, OpenAI-compatible, Google,
Vercel AI, Mock) remain green in the 10,191-test run, and `services/orchestrator` provider
adapters were not modified.

## 11. Foundations Intact — Explicit Confirmation

- **Agent Execution Intelligence** (`packages/agent-execution`) remains architecturally
  intact and authoritative for what may actually execute: capabilities, permissions,
  approvals, budgets, verification and recovery all flow through its frozen machinery. It
  was **not modified**.
- **Planning Intelligence** (`packages/planning`) remains architecturally intact and is the
  only producer of plans: the adaptive loop consumes READY plans and issues bounded replans
  as new proposals through a narrow port (never a new authority level). It was **not
  modified**.
- No duplicate loop engine, tool registry, model router, capability taxonomy, permission
  system, verification system, recovery system, cost ledger or memory system was
  introduced.

---

## Declaration

**BLD-018A — Adaptive Agent Loop (Model-Driven OBSERVE → DECIDE → ACT Coordination)**  
**Version 1.0**  
**IMPLEMENTATION COMPLETE — CONTROLLED AUTONOMY LAYER**

The `@vedmoulya/adaptive-loop` package proves the complete chain
GOAL → PLAN → VALIDATION → EXECUTION → OBSERVATION → MODEL DECISION → VALIDATION →
AUTHORIZATION → ACTION → OBSERVATION → VERIFICATION → ACHIEVED, while malicious or invalid
model decisions cannot bypass capabilities, permissions, ToolRuntime,
AIOrchestrationService, governance, verification or budgets.
