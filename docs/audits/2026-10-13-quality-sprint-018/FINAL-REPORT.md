# Sprint 018 — S10 · Autonomous Continuation & Recovery

**Report date:** 2026-10-13
**Baseline:** branch `main` · HEAD `a124274b` · 43 modified + 13 untracked files · 0 staged · 5 stashes (all preserved)
**Scope:** hardening of the EXISTING Mission autonomous lifecycle. No second loop, scheduler, recovery engine, router or registry was created.

---

## 1. Current lifecycle and persistence guarantees

### 1.1 The lifecycle (unchanged ownership)

| Layer                                                                                                     | Owner                                                                     | Responsibility                                                                  |
| --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Objective transitions, leases, checkpoints, bounded retries, recovery, reconciliation, terminal decisions | `packages/mission-controller/src/application/MissionControllerService.ts` | one authoritative lifecycle                                                     |
| Runtime composition, detached-loop dedupe, boot recovery, watchdog integration                            | `services/api/src/services/MissionService.ts`                             | process driver only                                                             |
| Durable mission + checkpoint persistence                                                                  | `packages/mission-runtime/src/persistence/PostgresMissionStores.ts`       | `WriteThroughDocumentStore` (sync mirror + queued write-through + boot hydrate) |
| Cadence                                                                                                   | `services/api/src/observability/mission-watchdog.ts`                      | bounded reconciliation pass (30 s base, 5 min idle backoff, overlap-guarded)    |

### 1.2 What the persistence layer actually guarantees

`WriteThroughDocumentStore.save()` is **best-effort by design**: it updates the synchronous
mirror immediately, queues the upsert, and _swallows_ a database failure (logs, re-queues,
bounded at 5 000 pending writes). A `save()` therefore resolves **before** anything is durable,
and a failed write is invisible to the caller.

`saveRequired()` is the durability **barrier**: it drains the queue, awaits the upsert, and
**throws** when Postgres rejects it. This is the mechanism Sprint 018 routes every
outcome-acknowledging transition through; best-effort writes were deliberately left untouched
everywhere else.

---

## 2. Confirmed defects fixed

| #   | Defect (evidence, pre-change)                                                                                                                                                                                                                                                                                                                                                  | Fix                                                                                                                                                                                                                                     |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | **Objective-start lease was best-effort** (`MissionControllerService.ts:575`). If the lease never became durable, a crash was indistinguishable from "never ran" and recovery would **blindly re-execute** an objective that had already started.                                                                                                                              | Durability barrier at objective start. On exhaustion the mission is held honestly **before any side effect**; nothing executes.                                                                                                         |
| D2  | **VERIFIED acknowledgement was best-effort** (`:993`). A crash could lose a verified objective and re-run it.                                                                                                                                                                                                                                                                  | Durability barrier on the attempt-final write (covers VERIFIED, FAILED and retry-counter transitions).                                                                                                                                  |
| D3  | **Terminal transition was best-effort** (`applyCommand`, `:1126`). A mission could be _reported_ complete while completion was still queued.                                                                                                                                                                                                                                   | Durability barrier on terminal commands (`COMPLETE`, `FAIL`, `CANCEL`, `REJECT_APPROVAL`) with an **honest revert** on exhaustion: state, outcome fields and the just-recorded lifecycle event are withdrawn, then the mission is held. |
| D4  | **Advisory failures destroyed verified work** (`:971–990`): `recordVerifiedOutcome` and `getAdvisorySignal` were awaited un-wrapped (unlike `recordFailedOutcome`), so a memory/experience outage aborted the objective _before_ its verified state was persisted, and the loop reported `MISSION_FAILED`.                                                                     | Both are isolated as advisory; the absence is recorded on the durable trail and the verified result is unaffected.                                                                                                                      |
| D5  | **Checkpoint contents were ignored on resume** (`resumeFromCheckpoint`, `:1033`) — existence was checked, fields were not restored.                                                                                                                                                                                                                                            | **Promote-only** restore: a checkpoint may only promote an objective the mission document does _not_ already record as verified. It never demotes, never resurrects a lease, and never double-counts `objectivesCompleted`.             |
| D6  | **In-memory latest-checkpoint selection used insertion order** while Postgres orders by `timestamp`.                                                                                                                                                                                                                                                                           | Newest-by-timestamp with a stable tie-break; unparseable timestamps are skipped ("newest valid").                                                                                                                                       |
| D7  | **`BLOCKED` had no classified recovery policy or operator action.**                                                                                                                                                                                                                                                                                                            | Pure classifier `assessBlockedRecovery` + `mayAutoResumeBlocked` (`domain/recovery-policy.ts`), exposed on the status view as `recoveryRequirement`.                                                                                    |
| D8  | **A `BLOCKED` mission could not be resumed at all.** `MissionService.resumeAutonomousLoop` treats `BLOCKED` as resumable and calls `resume`, but the state machine's transition for `BLOCKED → RUNNING` is `UNBLOCK`, which **no caller ever dispatched** — so it raised `Illegal mission transition: BLOCKED -> RESUME`. This made the documented operator action impossible. | `resumeMission` now dispatches the state machine's own `UNBLOCK` for a `BLOCKED` mission. No gate changes: callers already treated `BLOCKED` as resumable.                                                                              |
| D9  | **Write failures were invisible to callers** (base class swallows/re-queues).                                                                                                                                                                                                                                                                                                  | Bounded retry/backoff on the required path (`persistenceRetry`, default 3 attempts, 20 ms base, doubling, bounded); exhaustion raises `RequiredPersistenceError`, records `PERSISTENCE_FAILED`, and never fabricates a durable success. |

**New public API** (`packages/mission-controller/src/index.ts`): `RequiredPersistenceError`,
`DEFAULT_PERSISTENCE_ATTEMPTS`, `DEFAULT_PERSISTENCE_BASE_DELAY_MS`,
`assessBlockedRecovery`, `mayAutoResumeBlocked` (+ types).

**Barrier sites** (current line numbers): objective start `:651`, objective result `:1125`,
terminal `:1360`, checkpoint witness `:1545`. Helpers: `persistRequired` `:1430`,
`holdAfterPersistenceFailure` `:1478`, `restoreVerifiedFromCheckpoint` `:1248`.

---

## 3. Crash-window matrix

Evidence file: `packages/mission-controller/src/__tests__/s10-durable-recovery.test.ts` — a
harness that models the real contract (synchronous **mirror** vs **durable** snapshot), with
deterministic failure injection and a `restart()` that rehydrates from durable state only.

| #   | Window                                                         | Behaviour after S10                                                                                                                                 | Test |
| --- | -------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ---- |
| 1   | Interruption **before** execution                              | Barrier precedes execution; nothing runs; no durable success claimed; held honestly                                                                 | ✓    |
| 2   | Interruption **during** execution                              | The lease is **durable before the executor is called**, so "ran" vs "never ran" is decidable                                                        | ✓    |
| 3   | Executed, result **not durably recorded**                      | Mission document never claims it; the checkpoint witness survives                                                                                   | ✓    |
| 4   | Verification succeeds but **checkpoint + verified state** fail | Neither witness is durable; no false success; not auto-resumed                                                                                      | ✓    |
| 5   | Checkpoint persists, **progression fails**                     | After a restart, the checkpoint is **restored** and the objective is **not re-executed**                                                            | ✓    |
| 6   | **Memory/experience** persistence fails after completion       | Advisory only: mission still completes `ACHIEVED` on real evidence                                                                                  | ✓    |
| 7   | Lease expires while a worker is still running                  | Live lease never touched; expired lease healed to `READY` — **boundary documented** (§5)                                                            | ✓    |
| 8   | **Concurrent** recovery/retry                                  | Two workers sharing a store execute **exactly once** (lease CAS); concurrent recovery heals idempotently                                            | ✓    |
| 9   | **Terminal** persistence fails                                 | No fabricated terminal outcome; the withdrawn `MISSION_COMPLETED` event is reverted; the same durable state still derives completion afterwards     | ✓    |
| 10  | **Transient / exhausted** write failures                       | Transient: retried within budget, `PERSISTENCE_RETRIED` recorded, succeeds. Exhausted: `BLOCKED`, `PERSISTENCE_FAILED`, budget stated in the reason | ✓    |

Plus: gates preserved (provider hold and pause semantics unchanged; reads never take a required
write).

---

## 4. Recovery-state policy

`assessBlockedRecovery(reason)` returns `AUTO_SAFE | OPERATOR_ACTION | EXTERNAL_CONDITION` plus a
rationale and the concrete operator action. **No block reason the system can currently produce is
provably transient-and-safe**, so nothing is auto-resumed and that is asserted rather than assumed
(`s10-recovery-policy.test.ts`):

| Reason                                                | Classification       | Operator action                                                                                |
| ----------------------------------------------------- | -------------------- | ---------------------------------------------------------------------------------------------- |
| `No selectable objective with satisfied dependencies` | `EXTERNAL_CONDITION` | satisfy the dependency, then resume                                                            |
| `Durability barrier: … could not be persisted`        | `OPERATOR_ACTION`    | confirm persistence, verify whether the interrupted objective completed, then resume or cancel |
| `Watchdog: … no progress …`                           | `OPERATOR_ACTION`    | review and resume/cancel                                                                       |
| `Recovery failed for mission: …`                      | `OPERATOR_ACTION`    | resolve the cause, then resume                                                                 |
| missing / unknown                                     | `OPERATOR_ACTION`    | never treated as recoverable                                                                   |

Retained semantics: approval holds, provider holds, budget and suitability gates are untouched by
any recovery pass; `recoverAllActive` and `reconcileAbandonedExecutions` never resume `BLOCKED`.
Retry counters and the loop safety cap continue to survive restarts (no reset path added).

---

## 5. Lease and multi-process safety

- **Acquisition is genuinely protected across processes.** `PostgresMissionStore.acquireObjectiveLease`
  performs read/check/write inside a transaction with `SELECT … FOR UPDATE`; verified against real
  PostgreSQL with **two independent connections** — exactly one winner.
- **Every attempt re-acquires a fresh lease** (fresh TTL), so multi-attempt objectives are covered.
- **Boundary (documented, not claimed as exactly-once): two windows remain.**
  1. A **single execution longer than `leaseTtlMs`** (default 60 s) can have its lease treated as
     expired and its objective healed to `READY`, after which another worker may run it. Mitigation:
     configure `leaseTtlMs` above the longest expected attempt. `DEFAULT_LEASE_TTL_MS` was
     deliberately **not** changed (it trades false-steals against delayed crash recovery).
  2. Plain mission `save()` writes remain **last-writer-wins** across replicas; the lease protects
     _acquisition_, not concurrent document writes. Operators should run the watchdog on one replica
     (`MISSION_WATCHDOG_ENABLED=0` elsewhere), as the existing driver documentation already states.
  3. If a database outage spans the whole retry budget **and** the lease TTL, the durable snapshot
     may still describe an interrupted objective as `RUNNING`; reconciliation will then heal and
     re-run it. This is inherent to an ambiguous interruption and cannot be removed without
     exactly-once side-effect support; when the checkpoint witness landed, the restore path prevents
     the re-run instead (§2 D5).
- No claim of exactly-once external execution is made anywhere in this report.

---

## 6. PostgreSQL evidence

Local, already-authorized Docker PostgreSQL was available and used — **no** production/Neon target,
no environment or credential changes:

```
vedmoulya-postgres   pgvector/pgvector:pg16   0.0.0.0:5432->5432/tcp
POSTGRES_TEST_URL = postgres://vedmoulya:vedmoulya-dev@localhost:5432/vedmoulya   (default)
server: PostgreSQL 16.14 (Debian 16.14-1.pgdg12+1)
```

`packages/mission-runtime/src/__tests__/s10-postgres-durability.test.ts` — **6/6 passed**, using
independent connections and fresh store/controller instances (`describe.skip` if PG is absent):

1. durable **lease CAS** admits exactly one winner across two independent connections, and the
   winner's lease is visible to a third fresh connection;
2. a **required write is durable for a fresh connection** (verified state + outcome survive);
3. a **checkpoint written through the barrier** is durable for a fresh connection;
4. a **failed required write throws and creates no durable state** (unwritable table);
5. **recovery heals an abandoned objective across process-like boundaries**, and the healing itself
   is durable for a further fresh process;
6. **boundary**: a live lease is never stolen across connections.

---

## 7. Files changed (S10 only)

**Added**

- `packages/mission-controller/src/domain/recovery-policy.ts`
- `packages/mission-controller/src/__tests__/s10-durable-recovery.test.ts`
- `packages/mission-controller/src/__tests__/s10-checkpoint-fidelity.test.ts`
- `packages/mission-controller/src/__tests__/s10-recovery-policy.test.ts`
- `packages/mission-runtime/src/__tests__/s10-postgres-durability.test.ts`
- `docs/audits/2026-10-13-quality-sprint-018/FINAL-REPORT.md` (this file)

**Modified (minimal, additive)**

- `packages/mission-controller/src/application/MissionControllerService.ts` — barrier, bounded
  retry, honest holds, advisory isolation, checkpoint restore, `UNBLOCK` resume, checkpoint
  `required` option.
- `packages/mission-controller/src/contracts/mission-ports.ts` — `CheckpointStore.saveRequired?`.
- `packages/mission-controller/src/infrastructure/InMemoryCheckpointStore.ts` — `saveRequired`,
  newest-valid selection.
- `packages/mission-controller/src/index.ts` — exports.
- `packages/mission-runtime/src/persistence/PostgresMissionStores.ts` — `PostgresCheckpointStore.saveRequired`.
- `services/api/src/services/MissionService.ts` — activity-kind union + `recoveryRequirement` on
  the status view.
- `services/api/src/__tests__/services/MissionServiceBranches.test.ts` — +4 S10 view tests.

No file outside the Mission lifecycle was edited. The 43 pre-existing modified files and 13
untracked files (provider/usage work, Sprint 015 PostgreSQL test, Sprint 016/S8, Sprint 017/S9,
evidence files) and all 5 stashes are untouched; nothing was staged, committed, pushed, deployed,
reset or reverted, and no credentials or environment values were changed.

---

## 8. Commands and results (exact)

| Command                                                                                       | Result                                | Exit |
| --------------------------------------------------------------------------------------------- | ------------------------------------- | ---- |
| `cd packages/mission-controller && npx vitest run`                                            | 23 files / **271 passed** (+29 S10)   | 0    |
| `cd packages/mission-runtime && npx vitest run`                                               | 24 files / **180 passed** (+6 S10 PG) | 0    |
| `cd services/api && npx vitest run`                                                           | 117 files / **1960 passed** (+4 S10)  | 0    |
| `npm run typecheck` (`tsc -b && tsc --noEmit -p services/api`)                                | no errors                             | 0    |
| `npm run deps:cycles`                                                                         | OK — no cycles (57 workspaces)        | 0    |
| `cd packages/mission-controller && npx eslint <5 changed files>`                              | clean                                 | 0    |
| `cd packages/mission-runtime && npx eslint src/persistence/PostgresMissionStores.ts`          | clean                                 | 0    |
| `cd services/api && npx eslint src/services/MissionService.ts`                                | clean                                 | 0    |
| `cd packages/mission-runtime && npx vitest run src/__tests__/s10-postgres-durability.test.ts` | 6 passed against PG 16.14             | 0    |

**Pre-existing lint failure (NOT introduced, NOT fixed):**
`cd services/api && npx eslint src/services/ApiApplicationService.ts` →
`957:23 error @typescript-eslint/no-unnecessary-boolean-literal-compare` (exit 1). The file is part
of the pre-existing working-tree changes and was not touched by this sprint.

---

## 9. Findings inspected but intentionally left unchanged

| Finding                                                                     | Reason for no change                                                                                                                                                                        |
| --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `WriteThroughDocumentStore.save()` swallows failures and queues them        | Shared by every enterprise-intelligence store; the barrier is applied only where an acknowledgement would otherwise be false. Converting it globally was explicitly forbidden by the brief. |
| `MAX_PENDING_WRITES = 5 000` queue with oldest-write eviction               | Pre-existing bounded behaviour; only affects restart durability during a long outage and is already logged. Not on an acknowledgement path.                                                 |
| `DEFAULT_LEASE_TTL_MS = 60 s`                                               | Changing it trades false steals against delayed crash recovery — a deployment policy, not a defect. Documented instead.                                                                     |
| `recoverMission` re-inspects the repository for stale objectives            | Pre-existing conservative behaviour (SKIP only, never VERIFY); out of S10 scope.                                                                                                            |
| `detectStuckMission` is not called by the watchdog pass                     | Pre-existing; the watchdog reconciles abandoned executions and provider waits. Its `BLOCKED` output is now covered by the recovery policy. Marked as a follow-up, not silently changed.     |
| `resumeFromCheckpoint` advancing exactly one objective                      | Pre-existing semantics; S10 added field restoration, not a behaviour change.                                                                                                                |
| Best-effort writes for the discovery, provider-hold and approval-hold paths | These are recoverable _holds_, not acknowledgements, so making them blocking would add a failure mode without removing a false success.                                                     |
| The 48 pre-existing provider/usage, S8 and S9 changes                       | Explicitly preserved.                                                                                                                                                                       |

---

## 10. Remaining limitations and blockers

1. **Ambiguous completion under a total outage** — if a database outage spans the retry budget and
   the lease TTL, an interrupted objective can be re-run by reconciliation. There is no exactly-once
   side-effect mechanism in the estate, and this report does not claim one. Mitigated by the
   checkpoint witness restore whenever the checkpoint write landed.
2. **Multi-replica writes are last-writer-wins** (lease CAS excepted). Single-writer watchdog
   deployment is required, as the existing driver documentation states.
3. **Single-attempt lease longevity** — a single execution longer than `leaseTtlMs` is treated as
   abandoned. Configure `leaseTtlMs` above the longest attempt.
4. **A held mission needs an operator once persistence recovers** (by policy — the reason is
   classified and exposed; the resume path now works). Truly transient outages are absorbed by the
   bounded retry before a hold happens.
5. **Not exercised here:** live provider generation, browser/UI acceptance, and any test against
   production or Neon (prohibited). No test changes `NODE_ENV`, database targets or credentials.

**Definition of done:** a fresh runtime can resume from durable Mission state without rerunning
verified work, without falsely acknowledging unpersisted success, without bypassing any gate, and
without retrying ambiguous side effects unsafely. Verified by the crash-window suite, the
checkpoint-fidelity suite, the recovery-policy suite and the PostgreSQL cross-connection evidence.
