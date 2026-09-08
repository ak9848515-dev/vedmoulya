# BLD-024 — Mission Control + One-Button Autonomous Builder — Implementation & Verification Report

**Version 1.0**
**Date: September 6, 2026**
**Status: IMPLEMENTATION COMPLETE — PRODUCT CONTROL & OBSERVATION LAYER**

---

## 0. Executive Summary

BLD-024 turns the BLD-022/BLD-023-proven Mission Runtime into a usable VedMoulya product
experience: **open VedMoulya → Autonomous Builder → enter ONE mission → press RUN →
walk away → return and observe / pause / resume / cancel / approve**. No second autonomous
engine was created: every execution path still runs through the frozen
`MissionControllerService` → planner → agent execution → governed ToolRuntime →
verification → checkpoint chain, composed once per process by `createMissionRuntime()`.

The UI/API layer is strictly **control and observation**:

- No autonomous execution logic in the frontend; no frontend while-loop.
- Route handlers are thin: authenticate → authorize → validate → `MissionService` → envelope.
- Backend mission state is authoritative; the UI displays it and **never fabricates**
  progress percentages, provider availability, verification, or completion.

During live E2E verification, BLD-024 found and fixed a real product defect: RUN/START
previously blocked the HTTP request for the **entire** autonomous loop, making the
mission unobservable while running (and vulnerable to the Node 300 s request timeout
with a real provider). RUN/START/RESUME now return as soon as the mission is safely
persisted in its new state and the **existing** loop continues server-side, detached,
under the controller's own safety cap. The per-mission in-flight lock (double-click,
browser retry, multi-tab, refresh safety) and all ownership/state-machine rules are
unchanged in strength.

---

## 1. API Endpoints/Routes Added (tRPC `mission` namespace)

`services/api/src/services/RouterRegistry.ts` → `mission` router
(`services/api/src/routers/MissionRouter.ts`, thin transport over `MissionService`):

| Procedure              | Type                | Semantics                                                                                                                                                      |
| :--------------------- | :------------------ | :------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `mission.createAndRun` | mutation (heavy)    | CREATE → START → detached autonomous loop. Returns the persisted RUNNING mission.                                                                              |
| `mission.start`        | mutation (heavy)    | START (only from CREATED / continue when RUNNING) + detached loop. Illegal from PAUSED/WAITING_\*/BLOCKED (explicit RESUME required) and from terminal states. |
| `mission.status`       | query (standard)    | Full honest status view (owner-scoped).                                                                                                                        |
| `mission.pause`        | mutation (standard) | State-machine PAUSE — safe persisted hold; never kills the request loop abruptly.                                                                              |
| `mission.resume`       | mutation (heavy)    | RESUME / PROVIDER_AVAILABLE / START-from-CREATED + detached loop from persisted state.                                                                         |
| `mission.cancel`       | mutation (standard) | Explicit state-machine CANCEL (history preserved).                                                                                                             |
| `mission.approve`      | mutation (standard) | Operator approval through the frozen governance state machine; loop continues detached when RUNNING.                                                           |
| `mission.reject`       | mutation (standard) | Operator rejection → state machine FAILED; history preserved.                                                                                                  |
| `mission.history`      | query (standard)    | The caller's missions only, with verified counts + last checkpoint.                                                                                            |

Every handler: `standardProcedure`/`heavyProcedure` (auth + IDOR userId/session match +
rate limit) → zod input → `createMissionRouter(services.mission).<op>` → standard
`ApiResponse` envelope. No mission logic in route handlers.

## 2. UI Screens/Components Added

`apps/web/src/app/autonomous-builder/` (navigation: `navigation-store.ts` + `AppShell.tsx`):

- **`page.tsx`** — the one-button form (mission title/objective, authorized-workspace
  subpath, provider "Automatic", budget = max objectives) + RUN MISSION with
  double-click guard; browser-refresh recovery via `?mission=` URL param (observe,
  never restart); mission history list (click to re-observe); sign-in redirect.
- **`LiveMissionView.tsx`** — state chip (all 9 backend states), facts grid
  (provider/model/current objective/verified/tool calls/retries/tokens/cost/last
  checkpoint — "Unavailable" when absent), PAUSE/RESUME/CANCEL-with-confirmation,
  approval panel (WAITING_FOR_APPROVAL only), provider-wait panel
  (WAITING_FOR_PROVIDER only), verification evidence, activity log.
- **`ObjectiveTimeline.tsx`** — ✓ VERIFIED / → RUNNING / ○ PENDING / ! BLOCKED·FAILED
  with real reasons, strictly from mission state.
- **`ActivityLog.tsx`** — real structured events, newest first, bounded server-side.

Real-time mechanism (§19): **conservative status polling** through the existing tRPC
react-query stack — 5 s while RUNNING, 15 s while PAUSED/BLOCKED/WAITING_\*, **stopped at
terminal states**. No new event infrastructure was introduced (none existed for missions).

## 3. Existing Runtime Components Reused (frozen systems untouched)

`MissionControllerService` (+ state machine, objective selection, planner, adaptive loop,
execution memory, experience optimization), `MissionRuntime`/`createMissionRuntime()`,
`MissionRuntimeApi`, `AIOrchestrationService` + provider registry/routing,
`ToolRuntime` governance, verification, `ensureMissionPersistence` (Postgres),
`registerPlatformProviders` (Ollama participates through the normal provider path),
`redactSecrets`, tRPC gateway (`standardProcedure`/`heavyProcedure`, auth, IDOR guard,
rate limiting), react-query hooks in `api-client.ts`, zustand auth store.

**MissionService (`services/api/src/services/MissionService.ts`) is the only BLD-024
application boundary** — it composes the runtime once per process, enforces ownership,
serializes loops per mission, sanitizes+bounds activity, and builds honest views. It
contains no mission logic of its own.

### BLD-024 changes inside MissionService (the one real defect fix)

- `createAndRun`/`startAutonomousLoop`/`resumeAutonomousLoop` now **detach** the
  controller loop from the HTTP request (`launchLoop`): the request returns the safely
  persisted mission; outcomes are recorded from mission state when the loop settles;
  loop errors are recorded honestly (`MISSION_FAILED` activity + server log) while
  distinguishing operator-race holds (PAUSED/WAITING_\* — no spurious error).
- START from a holding state (`PAUSED`/`BLOCKED`/`WAITING_FOR_APPROVAL`/
  `WAITING_FOR_PROVIDER`) is now **refused** — explicit RESUME is required (state-machine
  honesty; previously START silently resumed).
- APPROVE relaunches the detached loop when the state machine returns RUNNING.
- Production composition defaults: platform provider registrar (incl. Ollama) and
  `MISSION_WORKSPACE_ROOT` fallback to the repository root — without these the mission
  loop had no providers/workspace tools at all.

## 4–9. Flows

- **Creation (§4/§5):** form → `createAndRun` → zod → ownership → `controller.createMission`
  (workspace path jailed inside the authorized root; budget; READ/WRITE permission classes)
  → `controller.startMission` → detached loop → response.
- **Status (§6/§7):** poll `mission.status` → `buildView` from the persisted mission +
  actual run records (provider/model/attempts only when a run recorded them).
- **Autonomous continuation (§9):** verified objective → checkpoint → learning →
  optimization → next objective inside the frozen controller — no user interaction, no
  "Continue?" prompts anywhere.
- **Pause/Resume (§10/§11):** state-machine PAUSE (safe persisted hold) / RESUME from
  persisted state; verified objectives are never repeated (checkpoint semantics).
- **Cancel (§12):** explicit two-step confirmation in the UI → state-machine CANCEL.
- **Approval (§13):** WAITING_FOR_APPROVAL panel shows the real operation/reason/risk;
  APPROVE/REJECT delegate to the runtime API — the UI cannot grant authority and the
  model cannot approve its own action.
- **Provider wait (§14):** WAITING_FOR_PROVIDER panel states the truth (no eligible
  provider, checkpoint saved, resumable); no fabricated availability, no aggressive
  polling (15 s cadence).

## 10–13. Security

- Authentication: JWT session enforced by the gateway (public health only).
- IDOR: `userId` must match the verified session (`assertUserIdMatchesSession`).
- Ownership: every mission operation resolves through `getMissionOwned`/
  `MissionRuntimeApi.assertOwned` (owner-scoped; cross-user status/commands/history
  all denied — test-proven).
- Workspace scoping: the browser can never widen the operator-authorized root
  (jail check in `createMission`; tools are path-jailed by the governed registry).
- Secrets: provider credentials never enter mission views; activity messages pass
  `redactSecrets` and are truncated (300 chars) and bounded (200/mission).
- Security boundaries (§29) unchanged: governance > capability > tool > verification >
  runtime health > recent evidence > memory/experience > model preference; memory,
  optimization, planner, model output and UI cannot authorize.

## 14. Ollama Path

No provider-specific mission UI and no separate Ollama execution architecture. The
runtime composes with `registerPlatformProviders`, which registers `OllamaProvider`
when `AI_OLLAMA_BASE_URL` is configured — exactly the BLD-022/023 path. The UI shows
whatever provider/model the last executed run actually recorded
(e.g. `Ollama / qwen2.5-coder:3b`), otherwise "Unavailable".

## 15–18. Verification Results

| Gate                                                                                                          | Result                              |
| :------------------------------------------------------------------------------------------------------------ | :---------------------------------- |
| Mission API tests (`MissionRouter.test.ts`, real tRPC + real runtime, MockProvider)                           | **12/12 passed**                    |
| Mission UI tests (`LiveMissionView.test.tsx`, jsdom)                                                          | **15/15 passed**                    |
| E2E (`apps/web/e2e/autonomous-builder.spec.ts`, Playwright vs real `next` server + real Postgres persistence) | **2/2 passed**                      |
| `npm test` (full monorepo)                                                                                    | **823 files / 10,505 tests passed** |
| `npm run typecheck`                                                                                           | **clean**                           |
| `npm run lint` (62 scopes)                                                                                    | **0 failures**                      |
| `npm run build`                                                                                               | **clean**                           |
| `npm audit --omit=dev --audit-level=high`                                                                     | **0 vulnerabilities**               |

API tests cover: createAndRun (detached, 3×VERIFIED), status honesty (checkpoints/
activity/budget), cross-user denial (status + all commands + history), IDOR rejection,
duplicate-START no-second-loop + terminal restart refusal, PAUSE during an in-flight
detached loop (safe hold, RESUME continues), START-on-PAUSED refusal,
WAITING_FOR_PROVIDER honesty (no fabricated execution, checkpoints saved), terminal-state
refusals, zod boundary validation, history scoping, and the **AUTONOMOUS CERTIFICATION**
test: ONE `createAndRun` call → 3 objectives planned, executed, VERIFIED, checkpoints
saved, continued — with no user input between objectives.

UI tests cover all 9 states, approval/provider-wait panels, Unavailable placeholders,
no-percentage assertion, actual provider/model display, cancel confirmation, and the
honest empty-activity state.

E2E covers: authenticate → open Autonomous Builder → enter ONE mission → RUN → live
state appears (real backend state, no fake %) → browser refresh keeps observing the SAME
mission (no duplicate/reset) → duplicate RUN cannot duplicate execution → history listing.

## Definition of Done — verified

Autonomous Builder UI ✅ · one-mission entry ✅ · authorized workspace ✅ · RUN ✅ ·
existing MissionRuntime executes ✅ · no second loop ✅ · accurate status ✅ ·
objective/timeline/provider/tool/verification/checkpoint display ✅ · PAUSE/RESUME/
CANCEL/APPROVE/REJECT ✅ · WAITING_FOR_PROVIDER/APPROVAL handled ✅ · history ✅ ·
browser-refresh safe ✅ · multi-tab duplicate protection (backend lock + per-mission
serialization) ✅ · authN/authZ/workspace/mission isolation ✅ · secrets sanitized ✅ ·
no fake progress ✅ · Ollama via normal provider path ✅ · 3-objective no-prompt
continuation (API certification test) ✅ · all test/typecheck/lint/build/audit gates ✅.

## LIVE VERIFIED vs CODE-PATH VERIFIED vs NOT YET LIVE

**LIVE VERIFIED (real browser, real gateway, real Postgres persistence):**
product journey (authenticate → enter ONE mission → RUN → live mission view with real
state/objectives/activity → refresh keeps observing → history), duplicate-RUN
protection, honest WAITING_FOR_PROVIDER path (this environment has no configured
provider), mission status polling.

**CODE-PATH VERIFIED (real runtime composition, deterministic MockProvider):**
3-objective autonomous continuation with zero further prompts (certification test),
PAUSE/RESUME incl. pause during an in-flight loop, APPROVE/REJECT state-machine paths,
cross-user/IDOR denial, terminal-state refusal, bounded sanitized activity.

**NOT YET LIVE (honest limitations, inherited from BLD-023 where noted):**

- Real Ollama execution through the UI: the mission path is the BLD-023-proven
  Ollama path, but this environment has no Ollama/Neon credentials live, so the UI
  journey above was live-verified with honest `WAITING_FOR_PROVIDER`, and autonomous
  execution was verified with the deterministic MockProvider. Point
  `AI_OLLAMA_BASE_URL` at a live Ollama instance to close this gap.
- Live multi-provider failover through the mission loop remains unexercised
  (BLD-023 limitation, unchanged).
- Operator-bound Git executor remains intentionally unbound (BLD-023 limitation);
  workspace mutations stay within the governed READ/WRITE tools.
- Discovery-driven future-objective continuation across process restarts needs the
  further hardening inherited from BLD-023; within a live process, RUNNING missions
  continue from persisted state, and PAUSED/WAITING_\* missions resume explicitly.
- The per-mission loop lock is per-process; a multi-replica deployment needs a
  distributed lock before RUN can be safely offered per replica.

**Success condition (§28):** proven at the API level against the real runtime
composition (certification test) and observed in the browser for state/objectives/
activity/history; the complete UI-observed 3-objective run with a real provider is
NOT YET LIVE (no provider in this environment) and is the remaining step before
BLD-025.
