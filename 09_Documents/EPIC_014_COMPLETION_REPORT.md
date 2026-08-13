# EPIC-014 — Capability Execution Engine: PLAN → EXECUTE → VERIFY

> **Verdict: 🟢 GREEN — IMPLEMENTATION VERIFIED** (2026-08-10)
> Baseline: [`EPIC_014_BASELINE_AUDIT.md`](./EPIC_014_BASELINE_AUDIT.md) ·
> Design: [`EPIC_014_EXECUTION_ARCHITECTURE.md`](./EPIC_014_EXECUTION_ARCHITECTURE.md) ·
> Contracts: [`EPIC_014_INTEGRATION_CONTRACTS.md`](./EPIC_014_INTEGRATION_CONTRACTS.md) ·
> Security: [`EPIC_014_SECURITY.md`](./EPIC_014_SECURITY.md) ·
> Evidence: [`EPIC_014_EVIDENCE.md`](./EPIC_014_EVIDENCE.md) ·
> Map: [`EPIC_014_IMPLEMENTATION_MAP.md`](./EPIC_014_IMPLEMENTATION_MAP.md)

---

## 1. What was built

The approved six-phase scope — **PLAN → EXECUTE → VERIFY** — delivered as a new
workspace **`@vedmoulya/execution-bridge`** layered _over_ the frozen platform.
Nothing was rebuilt: EPIC-013's `FactoryCapabilityPlan` stays the planning
artifact; EPIC-014 is the execution layer that consumes it.

| Area                 | Deliverable                                                                                                                                                                          |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Package**          | `packages/execution-bridge` — types · contracts/ports · domain · application · infrastructure (in-memory)                                                                            |
| **Domain**           | `CapabilityMapper` · `PlanRunResolver` · `StepVerifier` · `ApprovalRuntime` · `RunIntelligence` · `PreferenceLedger` · `RunBudgetGuard`                                              |
| **Application**      | `ExecutionRunService` — start / advance / approve / reject / completeHandoff / cancel / retry / get                                                                                  |
| **Infrastructure**   | `InMemoryExecutionRunStore` (bounded, owner-scoped) · `InMemoryPreferenceLedger` (bounded)                                                                                           |
| **Gateway**          | `execution.*` tRPC namespace (start / get / list / approve / reject / completeHandoff / cancel / retry / getPreferenceEvents) behind auth + rate limits + central owner guard        |
| **Gateway adapters** | `ExecutionBridgePorts` — `StepExecutionPort` over the frozen `AIOrchestratorSpecialistPort` · `PlanSource` over the capability service · env-tunable `RunBudgetGuard`                |
| **UI (Phase 6)**     | `ExecutionRunner` component embedded in `/capability-marketplace` — run progress timeline, approval prompt, manual hand-off list, preference events, no developer-console appearance |
| **Browser journey**  | `apps/web/e2e/execution-journey.spec.ts` — real Chrome: plan → execute → step completes → approval boundary → manual hand-off → resume → final state                                 |
| **Benchmark**        | `scripts/execution-benchmark.ts` — 8 scenarios comparing direct vs plan+execute; **8/8 PASS**; wired as `npm run execution:benchmark` and into the `benchmarks` chain                |

## 2. The six approved phases

### Phase 1 — Plan → Run bridge

`PlanRunResolver` maps every `FactoryCapabilityPlan` step to a bounded
disposition set — **EXECUTABLE / APPROVAL_REQUIRED / CONFIGURE_REQUIRED /
MANUAL_REQUIRED / UNAVAILABLE** — before anything executes. `CapabilityMapper`
normalizes plan step capability + candidate into the frozen
`SpecialistExecutionInput` shape (no second planning system, no new routing
engine). **Only EXECUTABLE + READY steps enter execution.** CONFIGURE pauses and
surfaces the existing configuration deep-link; EXTERNAL / MANUAL / UNAVAILABLE
steps are **never executed** — they become hand-offs, and a run that reaches one
completes honestly as `PARTIAL`.

### Phase 2 — Step verification

`StepVerifier` is the explicit execution contract: before execution it checks
capability · provider/tool · model · authentication · availability ·
configuration · evidence · budget · approval · dependencies; after execution it
checks the step actually completed, the expected artifact/result exists, and the
deterministic output contract passes. **A provider response alone is never
success** — success = execution + expected output + validation.

### Phase 3 — Approval & hand-off enforcement

`ApprovalRuntime` integrates the existing `ApprovalEngine` semantics. Steps that
require human approval (publish · send · deploy · purchase · delete · share) or
are marked `HUMAN_APPROVAL` **pause the run** at `WAITING_FOR_APPROVAL`.
Approve → the step resolves to EXECUTABLE and resumes from the correct point;
Reject → the step is marked rejected and the run continues as honest `PARTIAL`.
Manual / external / configure steps produce a clear hand-off — _"Video assembly
requires Canva configuration/manual completion"_ — never fabricated API
execution. The user always understands WHAT is blocked, WHY, WHAT to do, and
WHAT happens afterward.

### Phase 4 — Run intelligence

`RunIntelligence` tracks current · completed · failed · blocked · waiting ·
remaining steps, provider/model used, quality result, cost where known, latency
where known, failure reason, and the next action. `RunBudgetGuard` wraps the
frozen `LoopBudget` (maxIterations / maxTokens / maxCostUsd / maxLatencyMs) with
**fail-closed** enforcement — budget exhaustion mid-run marks the run `BLOCKED`
and no further provider calls occur. Iterations survive resume passes (usage
seed), so repeated resume attempts cannot circumvent the iteration budget.

### Phase 5 — Preference feedback ledger

`PreferenceLedger` records what actually happened during execution with full
provenance — explicit (user-selected/approved/rejected) vs inferred
(behavior-derived) is always distinguished, and **inferred behavior is never
silently promoted to a permanent user preference**. Confidence is capped by
source. This is the transparent feed for EPIC-015; EPIC-015 itself is **not**
built here.

### Phase 6 — Run UI

The `ExecutionRunner` integrates directly into the existing EPIC-013 plan
experience (no disconnected dashboard). The user sees PLAN → step timeline
(✓ completed · ● running · ○ waiting · 🔒 approval · ⚠ manual) with only what
matters per step — status · capability · provider/model · progress · output ·
approval · problem · next action — advanced details behind progressive
disclosure. Premium, minimal, responsive.

## 3. Preserved invariants (verified)

- **No fabricated execution** — manual/external/unavailable steps never execute; runs complete `PARTIAL` when a required step did not run.
- **No silent provider replacement** — a user-selected model is respected; if it cannot perform the step, the run stops and explains (never silently substitutes).
- **No budget bypass** — fail-closed `LoopBudget` guards; budget failure = `BLOCKED`, no further provider calls.
- **No approval bypass** — irreversible/gated steps pause at `WAITING_FOR_APPROVAL`; rejection is honored.
- **No infinite loops / endless retry** — bounded retries inside the iteration budget; recovery considers retry → alternative (only when permitted) → human → abort.
- **No false COMPLETED** — COMPLETED only when every step completed or was legitimately skipped as unavailable.
- **No IDOR** — every run belongs to its authenticated owner; cross-user read/approve/resume/cancel refused by the central owner guard (tested).
- **No duplicated systems** — one planner (EPIC-013), one routing (EPIC-012A/B), one budget (`LoopBudget`), one validation pipeline, one telemetry spine; execution-bridge contains **zero** new routing/telemetry/validation engines.

## 4. Testing

| Suite                                                | Result                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/execution-bridge` (deterministic fixtures) | **23/23** — valid plan · mixed plan · CONFIGURE · approval gate · approval rejection · budget rejection · provider failure · retry · validation failure · partial completion · resume from checkpoint · user-selected model · provider unavailable · dependency failure · preference provenance · IDOR · ownership isolation · no false COMPLETED · no silent replacement · no execution of manual/external · double-execution re-entry guard · budget iterations across resume |
| `services/api` gateway (full suite)                  | **634/634** (28 files) — incl. `ExecutionBridgeRouter.test.ts` 6/6 through the real tRPC pipeline (start → advance → approve → completeHandoff → cancel, IDOR, preference events)                                                                                                                                                                                                                                                                                               |
| `apps/web`                                           | **120/120** (13 files)                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| Typecheck                                            | 0 errors — execution-bridge · services/api · apps/web                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ESLint                                               | 0/0 on all changed files                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| Browser journey (real Chrome, Playwright)            | **PASSED** — plan → execute → step completes → next step → approval boundary → manual hand-off → user action → resume → final state; zero console errors                                                                                                                                                                                                                                                                                                                        |
| Benchmark                                            | **8/8 PASS** — plan-to-execution success · step completion · validation correctness · approval correctness · failure handling · resume correctness · partial correctness · budget enforcement · routing correctness; quality outranks cost                                                                                                                                                                                                                                      |

## 5. Honest limitations (unchanged conventions)

- **Live provider execution** is an operator step — the deterministic runtime is
  the default (hermetic, `AI_ENABLE_MOCK`-style); no real keys on this machine,
  so no live execution is claimed.
- **External applications** (Canva, Gmail, …) remain honest manual hand-offs —
  there is no API-automation evidence, so none is claimed.
- **GitHub resources** stay EVALUATE-only; nothing is auto-cloned or installed.
- **Run persistence** is in-memory (dev/test convention); Postgres run/artifact
  stores are the documented production operator step (unchanged from D1).
- **Browser journey** covers the video-plan path on the running dev server.

## 6. Verification status legend

| Claim                                    | Status                                                                |
| ---------------------------------------- | --------------------------------------------------------------------- |
| Deterministic execution semantics        | **DETERMINISTICALLY VERIFIED** (23 package tests + 634 gateway tests) |
| Owner scoping / IDOR                     | **DETERMINISTICALLY VERIFIED**                                        |
| Approval / budget / hand-off enforcement | **DETERMINISTICALLY VERIFIED**                                        |
| Run UI wiring                            | **BROWSER VERIFIED** (`execution-journey.spec.ts`)                    |
| Benchmark (direct vs plan+execute)       | **DETERMINISTICALLY VERIFIED** (8/8)                                  |
| Live provider execution                  | **OPERATOR REQUIRED** (no credentials)                                |
| External-app / GitHub execution          | **NOT SUPPORTED** (honest hand-off / EVALUATE-only by design)         |

## 7. Docs & sync

- Written: `EPIC_014_BASELINE_AUDIT` · `EPIC_014_IMPLEMENTATION_MAP` ·
  `EPIC_014_EXECUTION_ARCHITECTURE` · `EPIC_014_INTEGRATION_CONTRACTS` ·
  `EPIC_014_SECURITY` · `EPIC_014_EVIDENCE` · `EPIC_014_COMPLETION_REPORT`.
- Synchronized: `04_Sprints/MASTER_ROADMAP` · `05_Docs/PROJECT_STATUS` ·
  `CHANGELOG.md` · `README.md` · `task_progress.md` (this report).
- `package.json` — `execution:benchmark` added to the hermetic `benchmarks` chain.
