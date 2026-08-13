# EPIC-018 — AI World Scheduler & Discovery Engine: Evidence

**Status:** IMPLEMENTED + DETERMINISTICALLY VERIFIED (2026-08-11/2026-08-12)

Every claim below is backed by a repeatable command run. Verification levels
follow the platform convention — nothing is claimed beyond what was executed.
"EPIC-018 closure" refers to the runtime cadence driver sprint (2026-08-12);
the scheduler domain evidence from 2026-08-11 is preserved below.

> **Naming note:** the repo shares the EPIC-018 number between the AI World
> Scheduler epic (this file + `EPIC_018_ARCHITECTURE` / `EPIC_018_BASELINE_AUDIT`
> / `EPIC_018_SCHEDULER_POLICY` / `EPIC_018_SCHEDULER_SECURITY`) and the later
> Production Startup epic (`EPIC_018_{STARTUP_ARCHITECTURE,ENVIRONMENT_MODEL,
PREFLIGHT,SECURITY,EVIDENCE,COMPLETION_REPORT}.md`). Distinct files, shared
> prefix — see the mapping note in `04_Sprints/MASTER_ROADMAP.md`.

---

## 1. Scheduler domain (2026-08-11)

### 1.1 Package unit tests

```
npx vitest run packages/ai-world-scheduler/src
→ 2 files / 35 tests PASS
```

Covers ScheduleEngine frequencies, DiscoveryJobPolicy defaults, ChangeDetector
(NO_CHANGE / NEW / UPDATED / REMOVED / CRITICAL_CHANGE), CooldownManager,
SourcePolicyEngine (rate limits, cumulative cost, failure isolation),
DiscoveryScheduler (due-ness, duplicate-run prevention, in-flight guard,
retry/backoff, cancellation, budgets), SchedulerApplicationService (owner
scoping, run ledger) and the RunBudgetGuard→LoopBudget mapping.

### 1.2 Gateway router tests

```
npx vitest run services/api/src/__tests__/SchedulerRouter.test.ts
→ 12/12 PASS
```

getStatus · listSchedules · setSchedule (persist + job resync) · zod boundary
refusals · runNow (bounded + persisted) · cancelRun (honest NOT_RUNNING) ·
listSourcePolicies · **IDOR refusal** (foreign userId rejected at middleware) ·
owner isolation · getRuntimeStatus (inactive default + bound driver).

### 1.3 Benchmark

```
npx tsx scripts/ai-world-scheduler-benchmark.ts
→ 13/13 PASS
```

SCHEDULE → POLICY → BUDGET → DISCOVERY → EVIDENCE → CHANGE DETECTION → BRAIN →
NOTIFY: budget exhaustion → FAILED (fail-closed) · retry/backoff bounded ·
cooldown dedup · NO_CHANGE → zero notifications · CRITICAL/UPDATED/REMOVED
classified honestly · brain hand-off one evaluation per meaningful change ·
irrelevant changes never emitted · **manual/scheduled budget parity** (Run now
enforces the same budget) · owner isolation.

### 1.4 Architecture invariants (source-verified)

- **Exactly one scheduler:** `DiscoveryScheduler`; no competing engine exists.
- **Exactly one budget engine:** `RunBudgetGuard` maps run limits 1:1 onto the
  frozen `@vedmoulya/loop-engine` `LoopBudget` (verified in source).
- **Exactly one notification chain:** `SchedulerNotifyPort` →
  `EcosystemIntelligenceApplicationService.notify` (the same relevance gate
  EPIC-017's bridge uses); item cooldowns dedup; NO_CHANGE never notifies.
- **Manual = scheduled:** `runNow` = `runJob(..., { manual: true })` — same
  budget/source policies/rate limits/cooldowns/security/dedup/store; only the
  "not due" duplicate-run guard is bypassed for an explicit user request.

## 2. EPIC-018 closure — runtime cadence driver (2026-08-12)

### 2.1 What was verified by running the real application

The Playwright journey boots the real Next.js server (gateway in-process). The
server log during the run contained:

```
[WebServer] "AI World cadence tick aborted — user directory unavailable"
  error: "Failed query: select ... from \"users\" ..."
```

This is direct runtime evidence that **`scheduler.tick()` now has a real caller**:
the cadence driver started at boot, attempted its first pass, and failed closed
(bounded, honest, no crash, no partial discovery) because the identity directory
(Postgres) was unreachable in the test environment.

### 2.2 Driver unit tests

```
npx vitest run services/api/src/__tests__/scheduler-cadence.test.ts
→ 13/13 PASS
```

1. Starts correctly (singleton, status active).
2. Calls tick at the configured cadence (fake timers).
3. Never overlaps ticks (slow tick blocks the next cadence fire).
4. Tick failure never throws into the timer (error isolated + recorded).
5. Stops cleanly (interval cleared, singleton released).
6. No work after shutdown.
7. No duplicate driver instances (idempotent start).
8. Disabled driver performs no work (honest `disabled` status).
9. Scheduler's own NOT_DUE logic remains authoritative (driver never decides
   due-ness — it only supplies the heartbeat + user enumeration).
10. Manual Run now still uses the same bounded execution path (benchmark
    parity — no driver shortcut).
11. Budget exhaustion remains FAILED / fail-closed.
12. Per-user failures are isolated (one failing user never breaks the pass).
13. **No secrets in logs** (aggregate counts only; leak-asserted).

### 2.3 UI helper tests

```
npx vitest run apps/web/src/app/ai-world/scheduler-ui.test.tsx
→ 7/7 PASS (incl. new runtime-indicator label/color helpers)
```

### 2.4 Gateway + web regression

```
npx vitest run services/api/src/__tests__
→ 33 files / 702 tests PASS   (was 687/687 before the closure)
npx vitest run apps/web/src
→ 16 files / 166 tests PASS   (was 165/165)
npx tsc -b --pretty false     → 0 errors
npx tsc --noEmit -p apps/web/tsconfig.json → 0 errors
npx eslint <all changed files> → 0 errors
```

### 2.5 Real Chrome journey

```
cd apps/web && set -a && . ./.env.local && set +a && \
  npx playwright test e2e/ai-world-scheduler.spec.ts --project=chromium --workers=1
→ 1 passed (27.1s)
```

Discovery Activity renders · all seven schedule rows · frequency change
persisted · "Run now" completes through the bounded path · reload keeps schedule

- history (same process) · **automatic-discovery runtime indicator renders** · no
  page-level JS errors.

## 3. Honest boundaries (never claimed)

- **Live discovery** (real GitHub/news/provider sources) — NOT AVAILABLE today;
  deterministic static catalog is the hermetic default. OPERATOR REQUIRED.
- **Restart persistence** of schedules — NOT claimed (in-memory convention).
  OPERATOR REQUIRED: Postgres-backed scheduler stores.
- **Multi-replica scheduling** — the single-process driver is correct for the
  current single-instance deployment; multi-replica requires one driver instance
  - persistence + a distributed lock (documented operator step).
- **Generic notifications drawer** rendering the EPIC-015 store — future UI
  sprint; the scheduler's own panel + AI World bell surface outcomes today.

## 4. Re-verification — current working tree (2026-08-12, SPRINT-022)

Re-run of every EPIC-018 gate after the SPRINT-022 persistence work landed in
staging (no scheduler-domain changes; counts below include the new hermetic
Postgres store regression tests). Historical EPIC-018 closure totals are
preserved above; current repository totals follow:

| Gate                         | At EPIC-018 closure | Current working tree                                                                                                                       |
| ---------------------------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Scheduler package tests      | 35/35               | **42/42** (+7 `PostgresSchedulerStores` regression tests)                                                                                  |
| SchedulerRouter              | 10/10               | **12/12**                                                                                                                                  |
| Cadence driver tests         | 13/13               | **13/13**                                                                                                                                  |
| Full gateway                 | 702/702 / 33 files  | **34 files / 705 passed + 1 env-gated skip**                                                                                               |
| Web                          | 166/166             | **167/167**                                                                                                                                |
| Scheduler benchmark          | 13/13 PASS          | **13/13 PASS**                                                                                                                             |
| Typecheck (root)             | 0                   | **0**                                                                                                                                      |
| ESLint (changed + new files) | 0                   | **0**                                                                                                                                      |
| Real Chrome journey          | PASSED              | **PASSED** (1 passed; server log shows the cadence driver tick at boot + honest fail-closed `user directory unavailable` without Postgres) |

The EPIC-018 verdict is unaffected: **🟢 GREEN — IMPLEMENTATION VERIFIED.**
