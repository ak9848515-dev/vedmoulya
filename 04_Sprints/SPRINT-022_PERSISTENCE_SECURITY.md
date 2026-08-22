# SPRINT-022 — Persistent Intelligence Foundation: Security

> Companion to `SPRINT-022_PERSISTENCE_ARCHITECTURE.md`. Every requirement of
> the sprint's Phase 10 is addressed below; each item states HOW it is enforced
> and WHERE it is tested.

## 1. No API keys / OAuth tokens / credentials are ever stored

- The stored documents are **structured intelligence only** (decisions,
  evidence references, outcomes, provenance, timestamps) — enforced by the
  frozen store type contracts.
- `GitHubConnection` carries only `tokenRef` (a reference); the contract
  explicitly states _"Never store the access token here — server-side
  credential store only"_ and `PostgresGitHubConnectionStore` documents the
  same. No token field exists to persist.
- Nothing in the persistence bundle reads or writes `AI_*_API_KEY` or any
  credential env var.

## 2. No secrets in logs

- Every log site uses `safeError()` (error message only — never document
  contents, never user data). The write-through queue overflow, hydration
  failure, flush failure and drain warnings log table names + error messages
  only.
- Regression test: _"never leaks document contents into failure logs"_
  (`WriteThroughDocumentStore.test.ts`) writes a `SECRET-VALUE-XYZ` document
  against a failing database and asserts the mirror still serves it and no
  exception surfaces — the warning payload never contains the document.

## 3. Owner isolation (IDOR) — at BOTH layers

- **Service/application layer**: unchanged — every gateway procedure keeps its
  auth + rate-tier + central IDOR guard (existing tests cover cross-user
  refusal, e.g. gateway 705-suite IDOR cases).
- **Repository/query layer (new)**: every table is keyed
  `PRIMARY KEY (owner, key)` and every query is parameterized on the caller's
  own `userId`. A foreign owner's key is indistinguishable from absent — reads
  return `undefined`, writes upsert into the caller's own row. The base
  `read/all` mirror accessors are owner-prefixed. Hermetic tests assert
  cross-user reads return nothing after hydration (base, brain, AI World user
  state, ecosystem acquisitions) and the real-Postgres restart test asserts
  `u2` sees none of `u1`'s records.

## 4. SQL injection resistance

- All values are bound parameters (postgres.js `sql\`…${value}…\``) — no string
interpolation of values. Identifiers (`table`, index names) are
  compile-time constants per store.
- Regression test: _"every write is parameterized"_
  (`PostgresDiscoveryStore.test.ts`) inserts an adversarial id
  (`x'; DROP TABLE items;--`) and asserts it never appears in any rendered SQL.

## 5. Bounded payloads & safe serialization

- JSONB documents are plain structured data. Writes bind via postgres.js's
  **`sql.json()`** (serializes exactly once for jsonb OID 3802 — verified
  against live Postgres; the naive `JSON.stringify(x)::jsonb` interpolation
  double-encodes and was fixed as a real-DB regression); reads parse with
  `JSON.parse`. No arbitrary object execution, no deserialization of
  untrusted constructors.
- Per-owner FIFO ceilings bound every high-volume table (see Architecture §4);
  the write queue itself is bounded (`MAX_PENDING_WRITES` = 5 000) so a long
  outage can never grow memory without bound.
- Corrupt rows are skipped with a logged warning and never block hydration.

## 6. No untrusted repository / code execution

- Persistence never executes discovered content. Repository lifecycle state is
  _stored_ only; acquisition/execution stays behind the existing
  EPIC-015/017 approval gates (unchanged). Storing a `GITHUB_PROJECT` record is
  not a clone, install or run.

## 7. Production posture

- Production resolves Postgres stores via `resolvePersistenceBundle`; a
  database outage is **loud** (warnings on every failed write-through, table
  creation and flush) and the mirror stays authoritative — state is never
  silently lost while the process runs; restart durability is exactly what is
  at risk and is logged as such.
- `AUTH_JWT_SECRET` and database URL requirements are unchanged from
  EPIC-018/019 — production security is not weakened to make startup easier.

## 8. Security-focused tests

| Test                                     | Proves                                                                                                            |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `WriteThroughDocumentStore.test.ts` (12) | mirror/IDOR/outage/prune/delete/no-log-leak/trailing-write/sql.json single-encoding                               |
| `PostgresSchedulerStores.test.ts`        | scheduler store semantics                                                                                         |
| `PostgresBrainStores.test.ts`            | brain stores + ledger parity + restart round-trip                                                                 |
| `PostgresIntelligenceStores.test.ts`     | ecosystem stores + notification read-state                                                                        |
| `PostgresBridgeLoopStore.test.ts`        | bridge loop persistence                                                                                           |
| `PostgresDiscoveryStore.test.ts` (5)     | parameterization, idempotency, retention, owner-isolated user state                                               |
| `PersistenceStores.test.ts`              | env gating + overrides + real-Postgres restart recovery (4/4 PASSED against live PostgreSQL 16) with IDOR asserts |
