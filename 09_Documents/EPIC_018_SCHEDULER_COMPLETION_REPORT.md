# EPIC-018 — AI World Scheduler & Discovery Engine: Completion Report

**Verdict:** 🟢 **GREEN — IMPLEMENTATION VERIFIED** (2026-08-12)

Every claim is classified: **IMPLEMENTED** · **VERIFIED** (a command was run
and passed on 2026-08-12) · **OPERATOR REQUIRED** · **NOT AVAILABLE**.

> **Naming note (DOC-001):** the repo's canonical EPIC-018 number is shared by
> two historical epics: the **AI World Scheduler & Discovery Engine** (this
> report — docs prefixed `EPIC_018_SCHEDULER_*` / `EPIC_018_ARCHITECTURE` /
> `EPIC_018_BASELINE_AUDIT`) and the later **Production Startup & Environment
> Reliability** epic (docs `EPIC_018_{STARTUP_ARCHITECTURE,ENVIRONMENT_MODEL,
PREFLIGHT,SECURITY,EVIDENCE,COMPLETION_REPORT}.md`). Both are complete and
> GREEN; the prefix is shared, the files are distinct. See the mapping note in
> `04_Sprints/MASTER_ROADMAP.md`.

---

## 1. What was delivered (scheduler domain — verified 2026-08-11)

- **One scheduler:** `DiscoveryScheduler` in `@vedmoulya/ai-world-scheduler` —
  no second scheduler, cron engine, budget engine, AI World store, notification
  engine or execution engine was created.
- **ScheduleEngine** (EVERY_6_HOURS / DAILY / WEEKLY), **DiscoveryJobPolicy**
  (7 categories: critical-provider 6 h, provider/GitHub/free/local/news daily,
  deep-scan weekly), **ChangeDetector** (NO_CHANGE / NEW / UPDATED / REMOVED /
  CRITICAL_CHANGE), **CooldownManager** (item-level notification dedup),
  **SourcePolicyEngine** (enabled → cooldown → backoff → windowed rate limit →
  cumulative cost → run budget; per-source failure isolation),
  **RunBudgetGuard** mapping 1:1 onto the frozen `@vedmoulya/loop-engine`
  `LoopBudget` (maxDiscoveryCalls→maxIterations, maxSourceCalls→maxProviderCalls,
  tokens/cost/latency shared) — the ONE budget engine remains LoopBudget.
- **Bounded execution:** budget checked before AND after every run (fail-closed
  wall-clock); bounded retries with capped exponential backoff; duplicate-run
  prevention (NOT_DUE skip) and concurrent-run prevention (inFlight);
  cancellation via the store-observed `cancelRequested`; manual "Run now" takes
  the exact same bounded path (verified by benchmark parity).
- **Gateway `aiWorldScheduler.*`:** 8 procedures behind auth + rate tiers
  (standard/heavy) + zod; central IDOR guard refuses foreign userIds; owner
  isolation test-verified.
- **UI:** `/ai-world` Discovery Activity panel (per-job enable/frequency/Run now,
  next discovery, last scan, run ledger) + AI World bell (EPIC-012C surface).

## 2. EPIC-018 CLOSURE (2026-08-12) — the runtime cadence driver

The audit found the scheduler domain was complete but `scheduler.tick()` had **no
runtime caller** outside tests/benchmarks: 6-hour / daily / weekly discovery was
correctly modeled but never automatically executed. This sprint closed that gap
with the **smallest production-quality runtime mechanism**:

- **New `SchedulerCadenceDriver`** (`services/api/src/observability/scheduler-cadence.ts`):
  - **Cadence:** periodic `tick()` caller (default every 10 min; env
    `AI_WORLD_CADENCE_INTERVAL_MS`; enable/disable via
    `AI_WORLD_CADENCE_ENABLED`).
  - **No scheduling policy:** the driver NEVER decides what is due — every tick
    delegates to the existing `SchedulerApplicationService.tick(userId)`, which
    is authoritative for due-ness, enabled/disabled, cooldowns, rate limits,
    retry/backoff, duplicate-run protection, cancellation and RunBudgetGuard.
  - **Overlap guard:** a tick never starts while another is running.
  - **Graceful shutdown:** `stop()` clears the interval and releases the
    singleton; the interval is `unref()`'d (never holds the process open).
  - **Error isolation:** one user's failure never breaks the pass; a user-directory
    failure aborts the pass HONESTLY (recorded + logged, never partial
    discovery); no exception ever escapes into the timer.
  - **Owner-safe + bounded:** users come from the EXISTING identity directory
    (`IdentityApplicationService.listUsers`, paginated, hard-capped 500, then
    sliced to `maxUsersPerTick` 200); wall-clock pass bound (default 5 min,
    fail-closed truncation).
  - **No secrets:** logs carry aggregate counts only — no user ids, no keys.
  - **Idempotent start:** one singleton per process; a second `start` returns the
    existing driver.
- **Gateway truth:** `aiWorldScheduler.getRuntimeStatus` reports whether the
  cadence is actually active (`active` / `reason: enabled|disabled|not_started`,
  interval, last-tick outcome, next tick) — bound once at the route layer when
  the driver starts. Before binding (or when disabled) it honestly reports
  inactive, so the UI never claims scheduled discovery that is not running.
- **UI:** a minimal runtime indicator in the Discovery Activity panel
  (label + cadence detail + status color) driven by `getRuntimeStatus` — honest
  wording ("Automatic discovery active · every 10 min" only when the driver is
  genuinely active; "not started" / "off (operator)" otherwise).
- **Env docs:** `AI_WORLD_CADENCE_ENABLED` / `AI_WORLD_CADENCE_INTERVAL_MS`
  added to `.env.example` + `.env.production.example` with the single-instance
  guidance.

### Deployment / multi-instance posture (decision)

- The current deployment is a **single Next.js server process** (the gateway runs
  inside it via the tRPC route handler) — a single-process driver is the correct
  and safe boundary today.
- **No distributed lock exists** in the architecture (verified — no leader
  election / cron infra). For future multi-replica deployments the documented
  operator rule is: run the cadence on **exactly one instance**
  (`AI_WORLD_CADENCE_ENABLED=0` on all but one) until scheduler state
  persistence + a distributed lock are in place. Documented as an operator
  requirement — NOT silently solved.

### Persistence decision (honest)

- Scheduler state (schedules/runs/cooldowns/source policies) remains **in
  memory** — the existing convention. **Restart persistence is NOT claimed.** A
  process restart resets schedules to the seeded defaults (and re-runs the boot
  tick). Postgres-backed stores remain a documented **operator step**, consistent
  with every other in-memory store in the platform.
- The EPIC-018 acceptance criteria are satisfied without restart persistence:
  the scheduler's job is bounded, automatic, owner-scoped, cadence-driven
  execution in the running process — which this closure delivers and verifies.

### Notification decision (honest)

- Scheduler notifications flow through the existing EPIC-015 notification store
  (relevance-gated, cooldown-deduped, never NO_CHANGE spam) — **no second
  notification system.**
- The generic LifeOS notifications drawer still renders placeholder entries
  (pre-existing `MOCK_NOTIFICATIONS`); wiring the real store into that drawer is
  a **UI surface task for a future sprint** and is NOT required for EPIC-018
  acceptance — the scheduler's own Discovery Activity panel + AI World bell
  already surface discovery outcomes honestly. Documented, not hidden.

## 3. Tests added (EPIC-018 closure)

- `services/api/src/__tests__/scheduler-cadence.test.ts` — **13 tests**:
  starts correctly · ticks at the configured cadence (fake timers) · no
  overlapping ticks · tick failure never throws into the timer · stops cleanly ·
  no run after shutdown · singleton (no duplicate driver) · disabled driver does
  no work · scheduler NOT_DUE authority preserved · manual Run now still bounded ·
  budget exhaustion fail-closed · per-user error isolation · **no secrets in
  logs**.
- `services/api/src/__tests__/SchedulerRouter.test.ts` — **+2 tests**:
  `getRuntimeStatus` honest inactive before binding + active when bound.
- `apps/web/src/app/ai-world/scheduler-ui.test.tsx` — **+1 test**: runtime
  indicator label/color helpers.
- `apps/web/e2e/ai-world-scheduler.spec.ts` — extended: asserts the automatic
  discovery indicator renders.

## 4. Validation (commands run 2026-08-12)

| Gate                                                         | Result                                                                                                                     |
| ------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------- |
| ai-world-scheduler package                                   | **35/35** pass                                                                                                             |
| SchedulerRouter + router-registry (gateway)                  | **45/45** pass (SchedulerRouter 12/12)                                                                                     |
| Full gateway suite                                           | **702/702 · 33 files**                                                                                                     |
| Web suite                                                    | **166/166**                                                                                                                |
| Scheduler benchmark (`npm run ai-world:scheduler:benchmark`) | **13/13 PASS**                                                                                                             |
| Root typecheck (`tsc -b`)                                    | **0 errors**                                                                                                               |
| Web typecheck (`tsc --noEmit -p apps/web`)                   | **0 errors**                                                                                                               |
| ESLint (all changed files)                                   | **0 errors**                                                                                                               |
| Real Chrome Playwright journey                               | **PASSED** (27.1 s — Discovery Activity → schedules → change frequency → Run now → reload persistence + runtime indicator) |

The benchmark output additionally demonstrated live-driver evidence in the
Playwright server log: `"AI World cadence tick aborted — user directory
unavailable"` — the driver genuinely runs at boot and fails closed when the
identity directory (Postgres) is unreachable, exactly as designed.

## 5. Security verification

- Auth/IDOR unchanged: `getRuntimeStatus` rides `standardProcedure` (auth +
  rate tier + central `assertUserIdMatchesSession`).
- Driver logs aggregate-only (test-verified: no secrets).
- Driver executes NO discovery itself — all discovery flows through the
  scheduler's existing security chain (source policies, security scanner,
  relevance gate, budgets, approval boundaries untouched).
- No approval/security boundary weakened; no untrusted repo/tool auto-execution.

## 6. Remaining operator requirements

- **Postgres** for scheduler store persistence (schedules survive restart).
- **Live discovery sources** (real GitHub/provider/news adapters) — the
  deterministic static catalog remains the hermetic default.
- **Multi-replica deployments:** run the cadence on exactly one instance until
  persistence + a distributed lock exist.
- **Generic notifications drawer:** wire the EPIC-015 store into the LifeOS
  drawer (future UI sprint).
