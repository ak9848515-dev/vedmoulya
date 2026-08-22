# SPRINT-022 — Persistent Intelligence Foundation: Architecture

> Status: 🟡 **IMPLEMENTED — real-Postgres execution verification is OPERATOR REQUIRED**
> (2026-08-12). The write-through Postgres stores, wiring, hermetic tests and
> this documentation are implemented and verified against deterministic fakes;
> the cross-family restart-recovery test is **written and env-gated** but could
> not be executed here because the Docker daemon on this machine will not start
> and no local Postgres exists. See `SPRINT-022_COMPLETION_REPORT.md`.

## 1. Goal

Replace the critical in-memory intelligence stores with **durable, owner-scoped
Postgres persistence** while preserving every frozen engine, port and boundary.
No memory engine, scheduler, budget engine, notification engine, execution
engine or intelligence engine is rebuilt or duplicated.

## 2. The pivotal constraint: synchronous ports

The EPIC-016/017/018/020 intelligence store ports are **synchronous**
(`save(): void`) — the frozen domain contracts. The existing EI Postgres
repositories (app-factory, requirements) use async ports, so they cannot be
copied. Resolution — **write-through Postgres stores**:

1. The authoritative **in-memory mirror** serves the synchronous contract
   (reads never touch the database — zero latency regression);
2. Every mutation is written through to Postgres **asynchronously** — one
   idempotent parameterized upsert/delete bound via **`sql.json()`** (exactly
   one JSON encoding — verified against live Postgres; the naive
   `JSON.stringify(x)::jsonb` interpolation double-encodes and was fixed as a
   real-DB regression), error-isolated (a failed write
   never throws into a caller or crashes a pass);
3. **Hydrate at boot** loads persisted rows into the mirror (before the
   cadence driver's first tick — no post-restart duplicate runs);
4. **Flush at shutdown** drains pending writes (bounded, loud on failure).

Fully-async ports (AI World `DiscoveryStore`) map 1:1 onto Postgres — no mirror.

## 3. Persistence map (12 required families → 19 tables)

All tables use the shared document schema `(owner TEXT, key TEXT, doc JSONB,
created_at, updated_at, PRIMARY KEY (owner, key))` plus two AI World tables.

| Family                             | Postgres store (port unchanged)              | Table                                                       |
| ---------------------------------- | -------------------------------------------- | ----------------------------------------------------------- |
| AI World discovery state           | `PostgresDiscoveryStore` (async port)        | `ai_world_discovery_items`, `ai_world_discovery_user_state` |
| Scheduler schedules                | `PostgresScheduleStore`                      | `ai_world_schedules`                                        |
| Scheduler jobs/policies            | `PostgresJobStore`                           | `ai_world_jobs`                                             |
| Scheduler run history              | `PostgresRunStore` (ledger 50)               | `ai_world_runs`                                             |
| Source rate-limit policies         | `PostgresSourcePolicyStore`                  | `ai_world_source_policies`                                  |
| Scheduler cooldowns/cancellation   | `PostgresCooldownStore`                      | `ai_world_cooldowns`                                        |
| Brain tasks                        | `PostgresBrainTaskStore` (50/owner)          | `brain_tasks`                                               |
| Brain decisions                    | `PostgresBrainDecisionStore` (200/task)      | `brain_decisions`                                           |
| Intelligence opportunities         | `PostgresOpportunityStore` (100/owner)       | `brain_opportunities`                                       |
| Intelligence events                | `PostgresIntelligenceEventStore` (200/owner) | `brain_intelligence_events`                                 |
| Brain outcome memory (learning)    | `PostgresOutcomeMemory` (100/owner)          | `brain_outcome_memory`                                      |
| Provider adaptive scores           | `PostgresAdaptiveScoreLedger`                | `adaptive_score_ledger`                                     |
| GitHub connections (metadata only) | `PostgresGitHubConnectionStore`              | `ecosystem_github_connections`                              |
| Repository lifecycle               | `PostgresLifecycleStore`                     | `ecosystem_lifecycle_records`                               |
| Recommendations                    | `PostgresRecommendationStore`                | `ecosystem_recommendations`                                 |
| **Notifications**                  | `PostgresNotificationStore` (200/owner)      | `ecosystem_notifications`                                   |
| Acquisition plans                  | `PostgresAcquisitionStore`                   | `ecosystem_acquisitions`                                    |
| Bridge loop runs                   | `PostgresBridgeLoopStore` (50/owner)         | `bridge_loop_runs`                                          |

## 4. Schema design (Phase 3)

- Every record carries `owner` (user id) + a stable business key; `doc` is
  bounded JSONB of **structured intelligence only** — decisions, selected
  provider/resource, confidence, evidence references, outcome, failure
  classification, user preference, approval, cost/resource facts, timestamps,
  provenance. **Never** hidden chain-of-thought, never secrets/tokens/keys.
- Composite `PRIMARY KEY (owner, key)` enforces owner isolation **at the query
  level** — a foreign owner can never address another user's row, and
  idempotent upserts (ON CONFLICT DO UPDATE / DO NOTHING) mean **restart never
  duplicates** records.
- `updated_at` index per table (`(owner, updated_at DESC)`) for bounded,
  deterministic owner-scoped reads.
- Migrations follow the repository convention: idempotent
  `CREATE TABLE IF NOT EXISTS` + `CREATE INDEX IF NOT EXISTS` on every startup
  (fire-and-forget, never blocks boot; the existing EI factories do the same).
- **Bounded retention** matches the in-memory FIFO conventions
  (Phase 9): run ledger 50, brain tasks 50, decisions 200/task, opportunities
  100, events 200, outcomes 100, notifications 200, bridge loops 50, AI World
  items 300. User decisions/approvals are **never** auto-deleted by age; the
  bounds are per-owner FIFO ceilings for high-volume operational records.

## 5. Ports (Phase 4) — nothing new, nothing renamed

The store contracts are **reused as-is** from each package's
`contracts/` (e.g. `BrainTaskStore`, `BrainDecisionStore`,
`OpportunityStore`, `IntelligenceEventStore`, `BrainMemoryPort`,
`BrainExperiencePort`, `DiscoveryStore`, scheduler `*Store`s, ecosystem
`*Store`s, `BridgeLoopStore`). Domain/application code continues to depend on
ports only. The only new code is the `WriteThroughDocumentStore` base in
`@vedmoulya/core` (a persistence helper, not a port) and the concrete
Postgres implementations.

## 6. Runtime selection (Phase 6)

One resolver — `resolvePersistenceBundle()` in
`services/api/src/infrastructure/PersistenceStores.ts` — builds the whole
bundle:

- **development/test**: deterministic in-memory stores (unchanged hermetic
  convention — unit tests and benchmarks never touch a database);
- **production/staging (NODE_ENV)**: Postgres write-through stores over ONE
  lazy shared pool (`createEISql('vedmoulya-persistence')`, no network I/O at
  construction; table creation idempotent + fire-and-forget).
- CI e2e runs `next start` (NODE_ENV=production) and therefore takes the
  Postgres path with `AI_ENABLE_MOCK=true` — it **degrades gracefully** against
  an unreachable database (loud warnings, mirror stays authoritative), exactly
  like every other EI engine factory. This is honest, documented, and proven by
  the passing browser journey.
- Partial overrides let tests/operators swap individual seams.

`ApiApplicationService` receives the bundle once and injects the same stores
into AI World, Scheduler, Brain, Intelligence and Bridge — engines never know
which backend backs their ports. Boot (`route.ts`) awaits
`hydratePersistence()` **before** the cadence driver starts; SIGTERM/SIGINT
triggers `flushPersistence()`.

## 7. Restart recovery & concurrency (Phases 7–8)

- **Recovery**: state written by instance A is read by a fresh instance B over
  the same database (`hydrate()` at boot) — schedules, runs, Brain tasks,
  decisions, opportunities, events, learning/outcome records, adaptive scores,
  notifications (including read state), bridge loops and AI World user state.
- **No duplicates**: upserts are keyed on stable ids (ON CONFLICT), discovery
  items are ON CONFLICT DO NOTHING, outcome memory upserts by (user, task).
- **Concurrency**: single-owner writes converge via idempotent upserts; the
  drain loop is re-entrancy-safe (a `draining` guard + capture-and-clear
  batches + re-queue-on-failure, bounded by `MAX_PENDING_WRITES` = 5 000);
  `drain()` loops until quiescent so a write that lands while a drain is
  awaiting SQL is still persisted (regression-tested). No distributed lock is
  invented — the existing single-instance deployment and the scheduler's own
  duplicate/concurrent-run prevention remain authoritative; multi-replica
  scheduling stays a documented operator step.

## 8. Honest boundaries

- **VERIFIED**: hermetic write-through/hydrate/retention/IDOR/outage tests
  (42 + 1 env-gated), gateway suite 34 files / 705 + 1, web 167, typecheck 0,
  lint 0.
- **OPERATOR REQUIRED**: real-Postgres execution of the cross-family
  restart-recovery test (`POSTGRES_TEST_URL`), real production infrastructure,
  and the production database itself.
- **NOT CHANGED**: in-memory stores remain the dev/test/hermetic default;
  nothing is silently lost — a DB outage degrades to mirror-consistent
  operation with loud logging.
