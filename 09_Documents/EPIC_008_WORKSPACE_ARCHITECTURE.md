# EPIC-008 — Real Application Workspace & Production UX: Architecture

**Date:** 2026-08-09 · **Epic:** EPIC-008 (PRODUCT USABILITY) · **Verdict:** 🟢 See `EPIC_008_COMPLETION_REPORT.md`

---

## 1. Scope

EPIC-008 moves VedMoulya from _"the Application Factory can generate applications"_
to _"a real user can create, inspect, modify, validate, resume and manage an
application through VedMoulya."_ This document records the architecture of the
**persistent application lifecycle**, the **isolated per-application workspace**,
the **gateway ownership boundary**, and the **/applications workspace UI**.

**Hard rule:** EPIC-008 rebuilds **nothing** from the frozen platform. It consumes
the EPIC-006 LoopEngine, the EPIC-007 Application Factory, the AI Runtime, RAG, the
ToolRuntime and the gateway's auth/rate-limit/IDOR machinery through the **existing
ports**. New code is confined to: persistence seams (a repository port + two
implementations), lifecycle operations on the existing engine, gateway router
handlers, and the workspace UI. See `09_Documents/EPIC_008_BASELINE_AUDIT.md` for
the build-vs-reuse analysis.

---

## 2. Persistent Application Lifecycle (Phase 1)

### 2.1 State machine

```
DRAFT ──approve──▶ PLANNED ──build──▶ BUILDING ──▶ VALIDATING ──▶ READY ──deploy──▶ DEPLOYED
  ▲                   │                  │              │            │
  │                   │                  └──▶ FAILED ───┘            └──▶ ARCHIVED
  │                   │                        │
  └───────────────────┴──resume──▶ DRAFT       │
                                               ▼
                                          (delete, per policy)
```

- `DRAFT` — created, specification + architecture + plan produced, **no files generated**
  (Phase 8 approval gate).
- `PLANNED` — the user approved the plan (`factory.approve`), recorded in history.
- `BUILDING` / `VALIDATING` — the bounded EPIC-006 loop is executing the application
  task graph; status transitions are persisted as the run progresses.
- `READY` — validation + security gates passed.
- `DEPLOYED` — explicit user-authorized deployment completed.
- `FAILED` — the loop terminated non-successfully (budget/iteration/validation/
  security failure); `terminationReason` + `error` are persisted for **resume**.
- `ARCHIVED` — hidden from the default list, never auto-deleted.

### 2.2 Persistence contract

New port `ApplicationProjectRepository` (`packages/app-factory/src/contracts/application-repository.ts`):

```ts
export interface ApplicationProjectRepository {
  save(project: AppProject): Promise<void>;
  get(applicationId: string): Promise<AppProject | undefined>;
  list(owner?: string): Promise<AppProject[]>;
  delete(applicationId: string): Promise<boolean>;
}
```

Two implementations:

| Implementation                  | Where                                                                      | Use                                                                                                                                                    |
| ------------------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `InMemoryApplicationRepository` | `packages/app-factory/src/infrastructure/InMemoryApplicationRepository.ts` | hermetic tests / dev; deep-clones every document so the engine can never alias internal state                                                          |
| `PostgresApplicationRepository` | `packages/app-factory/src/infrastructure/PostgresApplicationRepository.ts` | production; JSONB full-document row keyed `(application_id)` with `owner` column for owner-scoped queries; same document shape as the in-memory double |

**Restart survival:** the engine writes the complete `AppProject` document (metadata,
specification, architecture, blueprint, files, validation, security, deployment,
economics, version history, termination state) on every mutation. A user logout /
page refresh / server restart therefore loses nothing — the document is rehydrated
from the repository. Proven by `restart survival` tests in
`FactoryPersistenceLifecycle.test.ts`.

### 2.3 Lifecycle operations (added to `FactoryEngine` / `FactoryApplicationService`)

| Operation | Semantics                                                                                                  | History record   |
| --------- | ---------------------------------------------------------------------------------------------------------- | ---------------- |
| `create`  | produce spec/architecture/plan (DRAFT)                                                                     | `created`        |
| `approve` | plan approval gate (PLANNED)                                                                               | `plan approved`  |
| `build`   | bounded loop execution (BUILDING→VALIDATING→READY/FAILED)                                                  | `build …`        |
| `rename`  | rename owned application                                                                                   | `renamed to "…"` |
| `archive` | ARCHIVED (never deletes)                                                                                   | `archived`       |
| `resume`  | FAILED/ARCHIVED → DRAFT, keeps plan + workspace                                                            | `resumed`        |
| `delete`  | **requires explicit `confirm: true`**; deletion is also refused while a destructive class is un-authorized | `deleted`        |
| `history` | ordered version records (created → … → current)                                                            | —                |
| `deploy`  | explicit user action through `DeploymentAdapterPort`                                                       | `deployed …`     |

Every operation first resolves the project via the **owner-scoped** `getOwned` path —
a foreign `userId` cannot resolve, rename, archive, delete, resume, or read history
of an application it does not own (**IDOR refused at the engine, not the UI**).

### 2.4 Version history (Phase 14)

Every significant transition appends an `ApplicationVersion` record:

```ts
interface ApplicationVersion {
  version: number; // monotonically increasing per application
  change: string; // human-readable, e.g. 'renamed to "Orderly Bites"'
  status: ApplicationStatus;
  author: string; // owner id
  aiTasks: number; // economics snapshot at that point
  tokens: number;
  costUsd: number;
  testsPassed: number; // validation snapshot at that point
  securityFindings: number;
  buildStatus: string;
  timestamp: string; // ISO
}
```

Versions are **append-only** (rollback is a forward `resume` to a previous plan —
destructive rollback is not implemented, per the epic's "do not implement
destructive rollback without safeguards").

---

## 3. Isolated Workspace (Phase 2)

Reused as-is from EPIC-007 (no rebuild): `WorkspacePort` + `InMemoryWorkspace` +
`FileOperationLayer` (`READ→PLAN→PATCH→TEST→REVIEW` + rollback + audit trail) +
`ExecutionPolicy` (READ_ONLY / SAFE_WRITE / DESTRUCTIVE_WRITE / NETWORK / DATABASE /
DEPLOYMENT / SECRET_ACCESS / CODE_EXECUTION).

EPIC-008 adds: the **workspace is rehydrated with the persisted project files** on
`getDetail` so a resumed application shows its real files, and the workspace id is
the application id — **cross-application file access is prevented by construction**
(the workspace key is `applicationId`, and the ownership check runs before any
workspace touch). No new filesystem surface was added; the UI file tab renders only
files already present in the workspace via the existing file-operation layer.

---

## 4. Gateway Wiring (Phase 1/22)

### 4.1 Production repository

`services/api/src/infrastructure/ProductionRepositories.ts` gains
`createProductionApplicationRepository()` — mirrors the existing production-repository
pattern (lazy config; Postgres when `DATABASE_URL` present, in-memory double
otherwise, never silent about the choice in production validation).

### 4.2 Service options

`ApiApplicationServiceOptions` gains `factoryRegistry?: ApplicationProjectRepository`.
The default construction keeps the EPIC-007 behavior (in-memory), so existing
harnesses are unchanged; production wiring passes the Postgres-backed repository.

### 4.3 Router handlers

`services/api/src/routers/FactoryRouter.ts` — all handlers now **async**, and the
interface grows the lifecycle surface:

```
create / approve / build / status / getDetail / deploy / list
rename / archive / delete / resume / history
vcInit / vcBranch / vcCommit / vcDiff / vcHistory / vcPreparePullRequest
```

### 4.4 tRPC registration (RouterRegistry)

`factory.*` is registered on the **authenticated** procedures with the existing
tiering (`create`/`build` = heavy tier with rate limits; everything else standard).
Zod inputs added for the new procedures (`factoryRenameInput`, `factoryArchiveInput`,
`factoryDeleteInput`, `factoryResumeInput`, `factoryHistoryInput`). The `ctx.userId`
from auth is passed to every handler — a caller can only ever operate on its own
applications (`ctx` is never derived from the input).

---

## 5. /applications Workspace UI (Phase 3)

### 5.1 Structure

- `apps/web/src/app/applications/page.tsx` — shell + create flow:
  - **Goal entry** with three example goals (ABAP Debugger Assistant, Restaurant App,
    AI App Builder) — one click starts UNDERSTAND→SPECIFY→ARCHITECT→PLAN;
  - **Plan approval panel** (goal, requirements, unresolved questions, architecture,
    technology, AI capabilities, files to create, expected tests, security
    considerations, estimated tokens/cost/time) with **APPROVE / EDIT / CANCEL**;
  - application list (name, archetype, status chip, updated) — ARCHIVED apps can be
    resumed from here.
- `apps/web/src/app/applications/workspace.tsx` — `ApplicationWorkspace` with the
  required navigation:

```
Overview · Specification · Architecture · Plan · Build · Files · Diff ·
Tests · Security · History · Deployment · Settings
```

| Tab           | Shows                                                                                                                                                                     | Backed by                                  |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| Overview      | status, validation summary, economics (AI calls, tokens, cost, iterations), termination reason                                                                            | `factory.status` / `factory.getDetail`     |
| Specification | requirements (+unresolved), architecture, task graph                                                                                                                      | `getDetail.specification`                  |
| Architecture  | technology, capabilities, providers, data model                                                                                                                           | `getDetail.architecture`                   |
| Plan          | goal, files to create/modify, expected tests, estimates                                                                                                                   | `getDetail.plan`                           |
| Build         | **real** live-build panel (current task, specialist, iteration, progress, tokens, estimated cost, elapsed time, status) — rendered from the persisted detail, never faked | `factory.build` + polling `factory.status` |
| Files         | secure explorer — folders/files, type, modified time, validation state; open/view via the workspace file layer only                                                       | `getDetail.files`                          |
| Diff          | before/after file content with the task that created the change, reason, specialist, validation status                                                                    | `getDetail.diffs`                          |
| Tests         | validation dashboard: lint / typecheck / tests / build / security gates with PASS or %                                                                                    | `getDetail.lastValidation`                 |
| Security      | findings by category (auth, IDOR, secrets, dependencies, injection, unsafe ops, network, tools) with severity; CRITICAL/HIGH block READY                                  | `getDetail.securityReport`                 |
| History       | version records (version, date, change, author, AI tasks, tests, security, build status)                                                                                  | `factory.history`                          |
| Deployment    | build/test/security status, environment, estimated cost, target — **DEPLOY is an explicit button**, never automatic                                                       | `factory.deploy`                           |
| Settings      | rename, archive, resume, delete (with explicit confirm)                                                                                                                   | `factory.rename/archive/resume/delete`     |

### 5.2 Responsive + honest UX

- Desktop and mobile layouts; no raw stack traces — failures render a human
  message from `err.message` with an "attempt again" affordance (never a dump).
- Loading / empty / error states on every data tab.
- Dark-mode class usage consistent with the rest of the app.

### 5.3 API client

`apps/web/src/lib/api-client.ts` gains the lifecycle hooks:

`useFactoryRename`, `useFactoryArchive`, `useFactoryDelete`, `useFactoryResume`,
`useFactoryHistory` (+ the existing create/approve/build/status/detail/deploy/list/vc*
hooks). All mutations pass `userId` + `applicationId` from the authenticated store —
there is no client-side "other user" path.

---

## 6. Security Model (Phase 22)

| Threat                             | Control                                                                                                                     | Where           |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | --------------- |
| Cross-user application access      | engine `getOwned(userId)` — never resolvable by foreign owner                                                               | engine          |
| Cross-user file access             | workspace keyed by `applicationId`; ownership check precedes any workspace touch                                            | engine + router |
| Unauthorized deployment            | deploy is an explicit mutation on the authenticated procedure; engine requires the DEPLOYMENT execution class               | router + engine |
| Unauthorized destructive operation | delete requires `confirm: true`; DESTRUCTIVE_WRITE blocked unless authorized                                                | router + engine |
| Secret exposure                    | persisted documents are application-authored files in the isolated workspace; no secret material is ever read from the host | engine          |
| Path traversal / unsafe file ops   | file operations only through `FileOperationLayer` + `ExecutionPolicy` (no raw fs surface)                                   | engine          |
| Tool permission escalation         | frozen `ToolRegistry` allowlist only (echo, current_time, calculator)                                                       | reused          |

Verified deterministically by the ownership-denial tests in
`FactoryLifecycleRouter.test.ts` (rename/archive/delete/resume/history on a foreign
application all reject) and the engine-level lifecycle tests.

---

## 7. File Inventory (new/changed in EPIC-008)

**packages/app-factory**

- `src/types/app-types.ts` — `ApplicationVersion`, status transitions, persisted project doc
- `src/contracts/application-repository.ts` — **new** port
- `src/infrastructure/InMemoryApplicationRepository.ts` — **new** double
- `src/infrastructure/PostgresApplicationRepository.ts` — **new** production repo
- `src/domain/FactoryEngine.ts` — async persistence + lifecycle ops + version history + **Phase 11 bounded repair loop** (`MAX_REPAIR_ATTEMPTS = 6`; diagnose → patch → diff → re-validate; `REPAIR_LIMIT_REACHED` on exhaustion; validation seam for tests)
- `src/application/FactoryApplicationService.ts` — async + lifecycle methods
- `src/application/__tests__/FactoryPersistenceLifecycle.test.ts` — **new** (roundtrip, restart survival, ownership, policy, history)
- `src/domain/__tests__/RepairLoop.test.ts` — **new** (bounded 6-attempt loop, diagnose→patch→re-validate→READY, REPAIR_LIMIT_REACHED + FAILED, no-op stop → VALIDATION_FAILURE, convergence)
- `src/infrastructure/__tests__/PostgresApplicationRepository.test.ts` — **new** (DDL, JSONB round-trip, owner-scoped list, delete via hermetic fake-sql)
- `src/infrastructure/__tests__/InMemoryApplicationRepository.test.ts` — **new** (deep-clone, owner-scoped list, delete)
- `src/application/__tests__/FactoryApplicationService.test.ts`, `src/domain/__tests__/FactoryEngine.test.ts`, `FactoryEngineEdgeCases.test.ts`, `RemainingBranches.test.ts` — async-updated

**services/api**

- `src/infrastructure/ProductionRepositories.ts` — `createProductionApplicationRepository`
- `src/services/ApiApplicationService.ts` — options wiring
- `src/routers/FactoryRouter.ts` — async handlers + lifecycle surface
- `src/services/RouterRegistry.ts` — `factory.*` routes + zod inputs
- `src/__tests__/FactoryLifecycleRouter.test.ts` — **new** gateway lifecycle + ownership tests

**apps/web**

- `src/lib/api-client.ts` — lifecycle hooks
- `src/app/applications/page.tsx` — create flow + plan approval + list
- `src/app/applications/workspace.tsx` — **new** 12-tab workspace

---

## 8. Known Limitations (honest)

- **Live journey is an operator step.** The full create→approve→build→files→tests→
  security→deploy journey is executed deterministically over the mock AI runtime in
  tests. Running it against live providers requires operator credentials
  (`npm run ai:smoke:live` path) and is not claimed here (same machine constraint as
  AI-RUNTIME-003/EPIC-007: no Docker/WSL for live DB).
- **Preview (Phase 13)** of generated UIs is out of scope of this implementation
  because the generated artifacts are validated structured projects, not running
  web builds; the UI shows the validation/security evidence instead and never
  claims visual quality it did not render.
- **Rollback** is forward-only via `resume`; destructive rollback is intentionally
  not implemented (safeguards requirement).
- Postgres persistence is tested through the contract + in-memory double; the SQL
  path requires a live database (documented operator step, same as RAG).
