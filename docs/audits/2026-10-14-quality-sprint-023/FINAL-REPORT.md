# VedMoulya — Sprint 023: Integration and Architecture Closure

**Date (UTC):** 2026-10-14
**Branch:** `main` · **HEAD:** `a124274b0d1fa91f361e0a5775e144658405913a` (unchanged)
**Mode:** read-mostly architecture validation against the CURRENT working tree; focused test reuse.
**No commit, push, deployment, credential change, production-data change, or stash change occurred.**

**Required evidence read:** `docs/architecture/CANONICAL-MISSION-ARCHITECTURE.md`,
`docs/audits/2026-10-13-architecture-code-audit/FINAL-REPORT.md`,
`docs/audits/2026-10-13-quality-sprint-020B/FINAL-REPORT.md`,
`docs/audits/2026-10-13-quality-sprint-020C/FINAL-REPORT.md`,
`docs/audits/2026-10-14-quality-sprint-022/FINAL-REPORT.md`.

---

## Executive verdict: **PARTIAL**

The canonical Mission spine is **real and active** and is confirmed by source
trace, focused tests, and the Sprint 022 real-browser journey. Mission is the
sole autonomous lifecycle owner; Brain never executes Mission objectives; the
four loops remain separate; failures (verification, persistence, provider) are
surfaced honestly; recovery/continuation is governed and owner-scoped.

**One architecture-conformance gap is confirmed and left UNFIXED (recorded):**
the **Mission runtime's AI routing is NOT wired to the enterprise EI-002 /
EI-004 / RAG intelligence** the canonical document attributes to the Mission
spine via `services/api/src/infrastructure/RuntimePorts.ts`. In production the
Mission runtime builds its OWN orchestrator and routes on
`packages/mission-runtime/src/adapters/OrchestratorRoutingPorts.ts` (neutral
metadata; no measured evidence, ExecutionHealth, RAG, or strategy), while the
gateway Ask path (`this.ai`) and the per-user Ask orchestrators DO use the
enterprise intelligence. No code defect was fixed this sprint — see §5 for why
a "smallest targeted fix" was declined and what closure requires.

---

## 0. Baseline and preservation

| Item                                  | Value                                                                                                                             |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Branch / HEAD                         | `main` / `a124274b0d1fa91f361e0a5775e144658405913a`                                                                               |
| `git status --porcelain` count        | **94** (baseline from Sprint 022; unchanged)                                                                                      |
| Stashes                               | **5** preserved (`pre-security-baseline-healthprobe`, 3× `lint-staged automatic backup`, `WIP on main: release-candidate-v1.0.0`) |
| Pre-existing modified/untracked files | untouched                                                                                                                         |
| Sprint 022 report                     | present                                                                                                                           |

**Final status:** 95 paths after this report (the **only** addition is
`docs/audits/2026-10-14-quality-sprint-023/`). HEAD unchanged; 5 stashes; no
`reset`/`clean`/revert/stage/commit/push/deploy; no credential, env-config,
production-DB, paid-provider, or stash operation. **No source file was changed
this sprint.**

---

## 1. Method and what "verified" means here

Nothing below is inferred from file existence. Each edge was checked by reading
the actual caller→callee symbol, and where a runtime behaviour is claimed it is
backed by an executed test (or the Sprint 022 browser run). Static-only
conclusions are labelled as such. Environment: Node `v24.18.0`; local Docker
`vedmoulya-postgres` (pgvector/pgvector:pg16) reachable at `127.0.0.1:5432`;
real Chromium via the repo's existing Playwright config (Sprint 022).

---

## 2. Actual Mission call graph (verified edges)

Trace from the user-facing launch to UI results, working tree, with the exact
symbols that were read:

1. **UI goal-in.** `apps/web/src/app/page.tsx` (`AskAIInput`) /
   `apps/web/src/app/autonomous-builder/page.tsx` → `AICompanion.handleSend()`
   (`apps/web/src/components/AICompanion.tsx`) → `classifyAskIntent()` /
   `isGoalLikeRequest()` (`apps/web/src/lib/ask-vedmoulya.ts`).
2. **Intent routing.** ACTION → `api.mission.createAndRun`; ANSWER →
   `api.ai.stream`. — `AICompanion.tsx` `runMissionAction` / `runAnswer`.
3. **Transport + authorization.** `services/api/src/services/RouterRegistry.ts`
   (`mission` router, `heavyProcedure`) → auth middleware
   (`services/api/src/middleware/auth.ts` `createAuthMiddleware`) →
   **IDOR guard** `assertUserIdMatchesSession(ctx, rawInput)` binds
   `input.userId` to the verified session — **VERIFIED** (source).
4. **Service boundary.** `MissionRouter.createAndRun`
   (`services/api/src/routers/MissionRouter.ts`) → `MissionService.createAndRun`
   → `createMission(userId, input)` → `startAutonomousLoop` →
   `runtime.api.start` + `launchLoop` (`services/api/src/services/MissionService.ts`).
5. **Composition.** `MissionService.createRuntime()` → `createMissionRuntime()`
   (`packages/mission-runtime/src/composition/MissionRuntime.ts`) →
   `MissionControllerService` + ports (objective selector / planner / executor /
   verifier / memory / optimization / failure classifier / diagnosis / repair).
6. **Lifecycle.** `MissionControllerService.runAutonomousLoop`
   (`packages/mission-controller/src/application/MissionControllerService.ts`)
   selects (`DevelopmentObjectiveSelector`), plans
   (`MissionPlanningAdapter` → `PlanningApplicationService`/`PlannerService`),
   executes (`AgentExecutionAdapter` → `AgentExecutionService`).
7. **AI execution.** `AIOrchestrationAgentPort.execute()`
   (`packages/agent-execution/src/infrastructure/AIOrchestrationAgentPort.ts`)
   → `AIOrchestrationService.orchestrate()` (`packages/services/src/ai/`).
   The port forwards `aiSource: 'MISSION'` and mission/objective identity.
8. **Provider execution + tools.** `AIOrchestrationService` →
   `ProviderRoutingAdvisor` → registered adapter → governed `ToolRuntime`
   registry (path-jailed workspace/command tools) — no provider SDK in the
   controller/agent layers.
9. **Verify.** `verifyAgainstPolicy`
   (`packages/agent-execution/src/domain/verification.ts`).
10. **Checkpoint + persist.** Checkpoint stores → `PostgresMissionStores`
    (`packages/mission-runtime/src/persistence/`), with in-memory fallback.
11. **Memory (advisory).** `ExecutionMemoryService.ingestRun()` →
    `experience-optimization`.
12. **UI result-out.** `useMissionStatus()` poll → `MissionStatusView`
    (`MissionService.buildView`) → `MissionOverview` / `MissionResult` /
    `ObjectiveTimeline` / `MissionActivity` / `LiveMissionView`.

**Runtime corroboration:** Sprint 022 proved steps 1–5, 10 and 12 in a **real
browser** against the locally running app (goal entry → consent → opt-in launch
→ `?mission=<real id>` → live polling → terminal result), and this sprint's
integration suite (`packages/mission-runtime/src/__tests__/mission-runtime-e2e.test.ts`)
exercises 4–11 in-process.

---

## 3. Architecture conformance matrix

Legend: **VERIFIED** (active flow with proof) · **PARTIAL** (real but incomplete
/ mismatched contract) · **DORMANT** (implemented, not on the active journey) ·
**MISSING** · **BLOCKED** (evidence/infra unavailable).

| #   | Edge / claim (canonical doc)                                                                            | Verdict      | Evidence                                                                                                                                                                                                                                   |
| --- | ------------------------------------------------------------------------------------------------------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | UI → `MissionRouter` → `MissionService` → `createMissionRuntime` → controller → planning/agent adapters | **VERIFIED** | Source trace §2; `mission-runtime-e2e` + Sprint 022 browser run                                                                                                                                                                            |
| 2   | Agent → `AIOrchestrationAgentPort.execute()` → `AIOrchestrationService.orchestrate()`                   | **VERIFIED** | `AIOrchestrationAgentPort.ts` is the single AI boundary; no SDK/registry duplication                                                                                                                                                       |
| 3   | `AIOrchestrationService` → `AIDomainService`/`AIRequestFactory`                                         | **VERIFIED** | static imports in `AIOrchestrationService.ts` (per audit); unchanged                                                                                                                                                                       |
| 4   | `ProviderRoutingAdvisor` on the Mission path                                                            | **VERIFIED** | `AIOrchestrationService` routes through the advisor for self-created orchestrators too                                                                                                                                                     |
| 5   | **EI-002 / EI-004 / RAG enterprise ports (`RuntimePorts.ts`) feed the Mission spine**                   | **PARTIAL**  | Gateway Ask path uses them (`ApiApplicationService.aiIntelligence`); **Mission path does NOT** — see §4                                                                                                                                    |
| 6   | `verifyAgainstPolicy` → checkpoint → Postgres → status view                                             | **VERIFIED** | `verification.ts`; live-Postgres suites 11/11 (this sprint); UI poll (Sprint 022)                                                                                                                                                          |
| 7   | Mission is the SOLE autonomous lifecycle owner                                                          | **VERIFIED** | Only `MissionControllerService.runAutonomousLoop` drives missions; `launched` per-mission in-flight lock; no other loop reaches a mission                                                                                                  |
| 8   | Brain is advisory / not a Mission executor                                                              | **VERIFIED** | zero `@vedmoulya/brain` imports in mission-controller / mission-runtime / agent-execution / `MissionService` / `MissionRouter`; Brain appears only as the opportunity-launch approval authority (`ControlRouter` + `s11-approval-binding`) |
| 9   | Four loops stay separate (controller / agent-execution / loop-engine / adaptive-loop)                   | **VERIFIED** | `MissionRuntime.ts` composes controller+planning+agent only; **no** `@vedmoulya/loop-engine` or `@vedmoulya/adaptive-loop` import in mission-runtime/controller source (only tests reference adaptive-loop)                                |
| 10  | Application Factory is a separate product path                                                          | **VERIFIED** | `FactoryEngine` imports `LoopEngine`/`generateProject`; no Mission dependency either way                                                                                                                                                   |
| 11  | Governed tool execution (no bypass)                                                                     | **VERIFIED** | execution runs through the one governed `ToolRuntime` registry built in `MissionRuntime.ts`; mission constraints gate `allowedTools` + permission classes; `verification.ts` returns **BLOCKED** (never success) for a denied command tool |
| 12  | Failure honesty — verification                                                                          | **VERIFIED** | `aggregateVerdict`/`verifyAgainstPolicy`: UNKNOWN/PARTIAL are never VERIFIED; no policy ⇒ UNKNOWN; no checks ⇒ UNKNOWN                                                                                                                     |
| 13  | Failure honesty — persistence                                                                           | **VERIFIED** | live-Postgres regression cases A–E (this sprint 11/11): write failure surfaces an error and leaves **no** durable success document                                                                                                         |
| 14  | Failure honesty — provider                                                                              | **VERIFIED** | `OrchestratorProviderAvailability` derives availability from real registered adapters + real health; unavailable ⇒ mission WAITING_FOR_PROVIDER; `LiveMissionView` reports `Unavailable` only in that state                                |
| 15  | Recovery / continuation through governed paths                                                          | **VERIFIED** | `resumeAutonomousLoop` / `approve` / `reject` use `runtime.api.*`; `recoverAllActive` + watchdog reconcile run through the frozen state machine; `recovery-policy.ts` forbids unproven auto-resume of BLOCKED                              |
| 16  | Authorization / objective ceiling / approval binding                                                    | **VERIFIED** | IDOR guard (`assertUserIdMatchesSession`); workspace jail check in `createMission`; `s10-budget-ceiling-regression` 3/3 and `s11-approval-binding` (opportunity gate) pass; owner-scoped reads                                             |
| 17  | `allowCommandExecution` reaches the service (no silent drop)                                            | **VERIFIED** | declared in the tRPC zod input, forwarded by `MissionRouter`, and honored in `isRepositoryDevelopmentMission` (`MissionService.ts:382-385`)                                                                                                |

**Row 5 is the only non-VERIFIED edge.** No DORMANT/MISSING/BLOCKED edges were
found on the Mission spine (the audit's previously-MISSING
coordination→pipeline edges remain off-spine and out of this sprint's scope).

---

## 4. Confirmed integration gap (recorded, not fixed)

### G1 — Mission AI routing does not use the enterprise intelligence the canonical doc attributes to it (PARTIAL)

**Evidence (source, reproducible):**

- `ApiApplicationService` constructs the mission service with **no** injected
  orchestrator and **no** `runtimeOptions`:
  `new MissionService({ workspaceRoot, sql, requireDurablePersistence,
credentials, aiObservability })` (`ApiApplicationService.ts:2904`).
- `MissionService.createRuntime()` therefore composes its own orchestrator and
  passes no `orchestrator` (`MissionService.ts:454-479`).
- `MissionRuntime` applies, for a self-created orchestrator,
  `configureIntelligence(createOrchestratorRoutingPorts(orchestrator))`
  (`MissionRuntime.ts`), i.e. **`OrchestratorRoutingPorts.ts`** — whose header
  itself states the neutral profile (`NEUTRAL_BENCHMARK_SCORE = 50`, no measured
  evidence, no ExecutionHealth, no RAG, `balanced` strategy) and that
  "production keeps using the host application's fully-wired orchestrator
  (injected via `MissionRuntimeOptions.orchestrator`)". **Production does not
  inject one.**
- By contrast, the gateway's own orchestrator `this.ai` is configured with
  `this.aiIntelligence` (`createProviderIntelligencePort` with measured
  evidence + `ExecutionHealthService`, `createExecutionStrategyPort`,
  `createRagRetrievalPort`) (`ApiApplicationService.ts:1443-1456`), and the
  per-user Ask orchestrator reuses that same `aiIntelligence`
  (`ApiApplicationService.ts:1466-1478`).

**Impact:** Mission provider selection routes through the same frozen
`ProviderRoutingAdvisor` but ignores measured reliability/latency/tokens,
live execution-health verdicts, enterprise strategy, and RAG — while Ask does
not. No bypass and no fabricated success exists (both go through the advisor),
but the canonical Mission diagram's `RuntimePorts.ts` edge is inaccurate for the
Mission path.

**Why not fixed here:** the correct closure is a wiring decision at the API
composition boundary — thread the existing `aiIntelligence` ports into the
Mission runtime's shared AND per-user orchestrators (reusing the same ports; no
new authority). It changes provider-selection behaviour for every mission and
requires touching `MissionServiceOptions` + `MissionRuntimeOptions` +
`ApiApplicationService`, which exceeds a "smallest targeted fix" and could alter
routing for existing missions. Per the sprint's fix policy ("record unresolved
gaps without inventing a fix"), it is documented instead.

**Closure requirement / owner:** Platform/AI-runtime owner. Either (a) inject the
enterprise intelligence into the Mission runtime orchestrators, or (b) correct
`CANONICAL-MISSION-ARCHITECTURE.md` to show the Mission path using
`OrchestratorRoutingPorts.ts` while the Ask path uses `RuntimePorts.ts`.

---

## 5. Confirmed defects and regression tests

**None fixed.** No source-code defect was changed this sprint, so no new
regression test was added. The only non-VERIFIED edge (G1) is an architecture
wiring gap whose resolution changes behaviour beyond the sprint's smallest-fix
boundary; it is recorded with a concrete closure requirement rather than patched.

No test was weakened, skipped, or suppressed.

---

## 6. Validation results (exact commands)

| #   | Command                                                                                                                                                                                                                                                                 | Exit | Result                                                                            |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- | --------------------------------------------------------------------------------- |
| 1   | `npx vitest run packages/mission-runtime/src/__tests__ packages/mission-controller/src/__tests__ packages/agent-execution/src/__tests__ --reporter=dot`                                                                                                                 | 0    | **Test Files 52 passed \| 2 skipped (54) · Tests 532 passed \| 11 skipped (543)** |
| 2   | `POSTGRES_TEST_URL=postgres://vedmoulya:vedmoulya-dev@127.0.0.1:5432/vedmoulya npx vitest run packages/mission-runtime/src/__tests__/s10-postgres-persistence-regression.test.ts packages/mission-runtime/src/__tests__/s10-postgres-durability.test.ts --reporter=dot` | 0    | **2 files · 11/11 passed** (real local PostgreSQL)                                |
| 3   | `npx vitest run services/api/src/__tests__/s11-approval-binding.test.ts services/api/src/__tests__/MissionRouter.test.ts services/api/src/__tests__/MissionRouterCommandGrant.test.ts services/api/src/__tests__/mission-watchdog.test.ts --reporter=dot`               | 0    | **4 files · 33/33 passed**                                                        |
| 4   | `npm run typecheck` (`tsc -b && tsc --noEmit -p services/api`)                                                                                                                                                                                                          | 0    | green                                                                             |
| 5   | `npm run deps:cycles`                                                                                                                                                                                                                                                   | 0    | `no internal dependency cycles (57 workspaces scanned)`                           |
| 6   | Sprint 022 browser acceptance (reused): `npx playwright test e2e/missions-ux04-e2e-acceptance.spec.ts --project=chromium`                                                                                                                                               | 0    | 4 passed — real browser, locally running app (see Sprint 022 report)              |

**The 2 skipped files in run #1 are exactly the live-PostgreSQL suites**, skipped
because their default target is `localhost:5432`, which on this Windows host
resolves to IPv6 and times out (the Docker port is published `0.0.0.0:5432`).
They were re-run successfully via `127.0.0.1` (run #2). This is an
**environment/host** nuance, not a product defect.

---

## 7. Remaining risks, limitations, and closure requirements

1. **G1 (Mission routing intelligence)** — PARTIAL; closure owned by the
   Platform/AI-runtime owner (§4). Highest-value open item.
2. **Live AI-provider execution was NOT exercised** this sprint (no provider
   credential; `AI_ENABLE_MOCK=false`). Mission steps 7–8 were verified by
   source + in-process integration tests, not by a real model generation. No
   live-provider, staging, or production validation is claimed.
3. **Static-negative classifications** (Brain-not-executor, loop separation)
   rest on import/caller inspection of the current tree, not dynamic tracing.
4. **PostgreSQL evidence is local-development only** (Docker container; Sprint
   020C's caveat still stands).
5. **`localhost`→IPv6 host nuance** makes the live-PG suites self-skip unless
   `POSTGRES_TEST_URL` targets `127.0.0.1`; a small test-harness hardening
   (default to `127.0.0.1`) would remove the ambiguity — out of scope here.

---

## 8. Preservation confirmation

Final HEAD `a124274b0d1fa91f361e0a5775e144658405913a`; **5 stashes**;
`git status --porcelain` = 95 (94 baseline + this report directory only). No
source file, runtime configuration, credential, database state, commit, push,
stash, or deployment was changed. All pre-existing modified/untracked files and
every prior audit/evidence directory remain intact.

---

## 9. Closing

Sprint 023 closes the architecture-vs-code question for the Mission spine: the
canonical lifecycle is active, singular, honest, governed and owner-scoped —
**VERIFIED** by source trace, focused tests and the Sprint 022 browser journey —
with one concrete, reproducible integration gap (**G1: Mission routing
intelligence not wired to the enterprise ports**) recorded as **PARTIAL** with a
named owner and two acceptable closure paths. Nothing was closed that the
evidence does not prove.
