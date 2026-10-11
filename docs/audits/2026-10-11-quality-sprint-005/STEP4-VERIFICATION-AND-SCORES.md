# STEP 4 — Verification, results and updated scores

## 1. Exact commands and results

| Command                                                                                                        | Result                                                     |
| -------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| `npm run typecheck` (`tsc -b && tsc --noEmit -p services/api`)                                                 | **exit 0**                                                 |
| `npx vitest run services/api/src/__tests__/errorChain.test.ts`                                                 | **7 passed**                                               |
| `npx vitest run services/knowledge/.../PostgresKnowledgeRepository.postgres.test.ts`                           | **1 passed (real Postgres, 3.9s)**                         |
| `npx vitest run services/api/src/__tests__/errorChain.test.ts …ConnectionBudgetConcurrency… PersistenceStores` | **15 passed (3 files)**                                    |
| `npx vitest run services/api/src/__tests__/BrainRouter.test.ts BrainDashboardService.test.ts`                  | **31 passed (2 files)**                                    |
| `npx eslint services/api/src/infrastructure/errorChain.ts …/ProductionRepositories.ts`                         | **0 errors**                                               |
| `npx tsx scripts/_diag-knowledge-graph.ts` (post-repair)                                                       | `ensureTable OK · searchNodes OK · all 4 tables present`   |
| `scripts/live-mission-acceptance.ts` (local Ollama, local PG)                                                  | `mission_mv3hetrj_1` **COMPLETED**; checkpoint VERIFIED    |
| `scripts/live-mission-acceptance.ts` (local Ollama, Neon)                                                      | `mission_mv3hq08s_1` **LIVE MISSION ACCEPTANCE: PASS**     |
| Approval handoff (`MissionClientOpsHandoffService`, `mission_mv3hetrj_1`)                                      | `pendingApproval=true`, external submission **NO**, exit 0 |
| Full `npm run test` / `npm run lint` (repo-wide)                                                               | **not run** (time/CPU) — reported as not run               |

The knowledge real-Postgres test and the api suites ran against the real local
PostgreSQL; no in-memory database was substituted for a persistence test.

## 2. What each fix/regression test covers

| Change                                                          | Regression test                                                       |
| --------------------------------------------------------------- | --------------------------------------------------------------------- |
| `describeErrorChain()` + DDL bootstrap root-cause logging       | `services/api/src/__tests__/errorChain.test.ts` (7 tests)             |
| Knowledge DDL bootstrap + `ILIKE` search work against a real DB | `PostgresKnowledgeRepository.postgres.test.ts` (real Postgres, gated) |

## 3. Score comparison (baseline weights, **unchanged**)

| Dimension                  |   Weight | Base (004) | Now |            Weighted |
| -------------------------- | -------: | ---------: | --: | ------------------: |
| Architecture               |      15% |        6.8 | 6.8 |                1.02 |
| End-to-end functionality   |      15% |        7.8 | 8.0 |                1.20 |
| AI intelligence            |      12% |        7.4 | 7.5 |                0.90 |
| Runtime / recovery         |      12% |        6.9 | 7.0 |                0.84 |
| Tests                      |      10% |        8.1 | 8.2 |                0.82 |
| Security                   |      10% |        7.5 | 7.5 |                0.75 |
| Persistence                |       8% |        6.3 | 6.8 |                0.54 |
| UX / accessibility         |       8% |        7.0 | 7.0 |                0.56 |
| Performance                |       5% |        5.5 | 5.5 |                0.28 |
| Documentation / operations |       5% |        7.2 | 7.4 |                0.37 |
| **Total**                  | **100%** |    **7.2** |     | **7.28 → 7.3 / 10** |

**Why each change (and nothing more):**

- **Persistence +0.5** — durable mission persistence is now _proven_, not asserted:
  a real Postgres holds the mission as `COMPLETED/ACHIEVED` and a `VERIFIED`
  checkpoint, read back independently of the runtime (`mission_mv3hetrj_1`; plus
  the Neon `COMPLETED` row for `mission_mv3hq08s_1`). It is held to 6.8 (not higher)
  because memory/learning produced **no durable entry** and the managed-Neon route
  is intermittently unreachable.
- **End-to-end functionality +0.2** — a **fresh** mission completed the full path
  with a real local provider and independent artifact verification. It is not raised
  further because this is the mission harness, not the browser journey (D-08a).
- **AI intelligence +0.1** — real local-provider generation succeeded end-to-end
  (`cloud tokens 0 / local tokens 188`); no live _cloud_ success exists.
- **Runtime/recovery +0.1** — D-08b (knowledge-graph DDL/query) is root-caused and
  resolved in the local environment; no staging drill was performed.
- **Tests +0.1** — two new regression suites, one of which exercises a real
  PostgreSQL.
- **Documentation +0.2** — sprint-005 evidence set (this folder).
- **Unchanged** — Architecture (no split performed; `RouterRegistry.ts` untouched
  by constraint), Security (no new control), UX/accessibility (no browser change),
  Performance (no measurement).

**Nothing is raised on documentation alone; every increase is backed by a fresh
runtime or test artifact.**

## 4. Remaining defects and next actions

| ID              | Sev | Status               | Next action                                                                                                                                          |
| --------------- | --- | -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| D-08a           | P2  | Open                 | Pin `e2e/brain.spec.ts` to the local Ollama route (or fund a cloud key)                                                                              |
| —               | P2  | Open                 | Mission persistence on managed Neon intermittently `ENOTFOUND`; add operator retry/backoff or a reliable endpoint                                    |
| —               | P3  | Open                 | Durable **execution-learning** entry not produced for a clean success — investigate `ExecutionMemoryService` trigger/ingest and ensure a final flush |
| D-09            | P2  | Blocked              | No staging backup/restore/rollback/restart drill (not authorized)                                                                                    |
| D-02            | P2  | Open                 | Oversized composition files (not touched — sprint constraint)                                                                                        |
| D-10a/b/c, D-07 | P3  | Open / dispositioned | unchanged from sprint 004                                                                                                                            |
