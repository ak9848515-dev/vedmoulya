# SPRINT-035 — DATA INTEGRITY

**Idempotency, boundedness, owner scoping and durable persistence across the SPRINT-034/035 surfaces**
**Date:** 2026-08-15 · **No silent duplication. No unbounded history.**

## Stable-key idempotency (verified by tests)

| Surface                     | Stable key                                                                           | Duplicate behavior                                                              |
| --------------------------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------- |
| Business units              | `name`                                                                               | upsert — same id returned, never duplicated                                     |
| Roles                       | `name`                                                                               | upsert                                                                          |
| Workflows                   | `goal`                                                                               | upsert                                                                          |
| Outcome evidence            | `(kind, opportunityId)`                                                              | upsert — one record per (kind, opportunity)                                     |
| Blueprint approval requests | `(blueprintId, stepId)`                                                              | upsert — one request per (blueprint, step); re-request returns the same request |
| Timeline events             | typed stable key (`opportunity:<id>`, `outcome:<stableKey>`, `approval:<stableKey>`) | skipped when seen — never duplicated                                            |
| Revenue streams             | `name`                                                                               | upsert (SPRINT-033)                                                             |

## Boundedness

- World graph: **200 entities / 500 relations per owner** (FIFO eviction) — unchanged.
- Timeline: `limit` ≤ 50, paginated with `offset` + `hasMore` — no unbounded history queries.
- Signals: 25 per kind, 256 KB payload cap, 10 s timeout — read-through, never stored.
- Blueprint decomposition: depth ≤ 8 · tasks ≤ 24 · fan-out ≤ 8 · calls ≤ 64 · cost ≤ $5 · time ≤ 600 s (unchanged, frozen).

## Owner scoping

Every store is owner-keyed (`PRIMARY KEY (owner, key)` in Postgres). Cross-owner
queries return empty; IDOR is prevented at the gateway (standardProcedure) and at the
store level. Timeline is composed only from the caller's own stores.

## Durable persistence

Both new store families (outcome evidence, blueprint approvals) ship in-memory + Postgres
write-through via the shared `WriteThroughDocumentStore`, wired in the persistence
bundle (`PersistenceStores.ts`). Real-Postgres restart-recovery harness: **4/4 PASS** (unchanged).

## Duplicate-signal note

Signals are **read-through** — the adapter fetches, sanitizes and returns; nothing is
stored. A duplicate source observation is simply a fresh read. There is no signal store,
so there is nothing to deduplicate — by design (live world data is never persisted as facts).

## Verification

- `WorldModelService.test.ts` — "never duplicates timeline events (stable-key idempotency)",
  "keeps the timeline owner-scoped (cross-owner isolation)", "records VERIFIED-only evidence
  with stable-key idempotency".
- `WorldRouter.test.ts` — business-unit and revenue-stream upsert tests.
- `InMemoryWorldStores.test.ts` + `PostgresWorldStores.test.ts` — new store families.
- Full suites: world-model 200, api 985+1skip, web 216, voice 115 — all green.
