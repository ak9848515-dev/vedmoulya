# VedMoulya — S12 Blocker 4A: Durable Revocation Proven Against a Real Engine, plus the Versioned Identity Schema Layer

**Date (UTC):** 2026-10-15
**Branch:** `main` · **HEAD:** `81dd5f88462265f04b8578bbd4624072f1f79a5d` (unchanged; nothing committed, staged, pushed, tagged or deployed)
**Scope:** close the two in-repo-closable items of `BLOCKER-REPORT-S12-PRODUCTION.md` — **S024-4A** (durable refresh-token rotation/revocation) and **S024-4B** (unauthenticated identity surface) — and re-verify the remaining S12 conditions. No production system was contacted, created, migrated, restored or deployed; no paid provider call was made; no secret value is printed anywhere in this report.
**Relation to earlier documents:** this report is authoritative for the 2026-10-15 working tree. `docs/audits/2026-10-14-quality-sprint-026/S12-BLOCKER-4A-CLOSURE.md` recorded 4A as closed on an in-memory-verified `ensureTable()` design; §1.1 below explains why that evidence could not have held in production and what replaced it. The A/B/C/D/G1 conclusions in the sprint-026 and `2026-10-14-s12-*` reports are not re-litigated here except where §4 records a re-verification.

---

## 0. Verdict summary

| Item                                                           | Verdict after this session                                                                                                                        | Evidence                                              |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| **S024-4A** durable refresh-token rotation / logout revocation | **CODE COMPLETE + REAL-ENGINE VERIFIED · still OPEN** — the deployment precondition (S012-A identity database) and the merge are both outstanding | §1, §2 (`RefreshTokenDenylistStore.postgres.test.ts`) |
| **S024-4B** dormant identity user-management router            | **VERIFIED-NO-CHANGE** — fail-closed guards present; allowed _and_ denied paths asserted                                                          | §4.1 (`IdentityRoutes.test.ts`, 28 tests)             |
| **S012-A** managed identity database                           | **BLOCKED** — operator-owned, unchanged                                                                                                           | §6; `2026-10-14-s12-identity-readiness`               |
| **S012-B** funded live cloud AI                                | **BLOCKED** — fail-closed verified (`exit 2`) without spending; live completion unverified                                                        | §5                                                    |
| **S012-C** authorized staging DR drill                         | **BLOCKED** — operator-owned, unchanged                                                                                                           | §6; `2026-10-14-s12-dr-readiness`                     |
| **G1** Mission routing composition                             | **OWNER-DECISION** — unchanged; no silent behaviour switch                                                                                        | §4.2                                                  |
| **Release decision**                                           | **NO-GO** (unchanged)                                                                                                                             | §7                                                    |

**Nothing in this session changed the release decision.** What it changed is that condition 4 of the S12 reconsideration list is now backed by evidence that a real database produced, and that two defects which would have made that condition false in production were found and fixed.

---

## 1. Defects found and fixed

### 1.1 A JS `Date` wrapped in drizzle's `sql.param()` made **every identity store write throw** in production/staging

This is the defect that invalidated the earlier 4A closure evidence, which was collected against the **in-memory** store only. Production and staging select the **Postgres** implementations (`createRefreshTokenDenylistStore()`, `createOAuthStateStore()`, `createVerificationTokenStore()` all switch on `NODE_ENV`), and every `save()`/`claim()`/`revoke()` on those paths bound the expiry as `sql.param(<Date>)`.

Reproduced against the real engine, with the exact pre-fix expression shape:

```text
top    : DrizzleQueryError | Failed query: SELECT $1 AS x
cause  : TypeError | code = ERR_INVALID_ARG_TYPE |
         The "string" argument must be of type string or an instance of Buffer or ArrayBuffer.
         Received an instance of Date
```

**Root cause (narrower than it first appears):** drizzle's `sql.param()` marks the value as a _typed_ bound parameter, and the postgres-js driver then requires a string. A **bare** `${date}` interpolation is accepted by postgres-js — verified in the same probe:

| Expression                                 | Result                           |
| ------------------------------------------ | -------------------------------- |
| `sql.param(new Date())`                    | **throw** `ERR_INVALID_ARG_TYPE` |
| `sql.param(new Date())::timestamptz`       | **throw**                        |
| `sql.param(new Date())::timestamp`         | **throw**                        |
| `${new Date().toISOString()}::timestamptz` | OK                               |
| `${new Date().toISOString()}::timestamp`   | OK                               |

**Impact if shipped:** in production/staging every revocation write, every OAuth-state write and every email-verification-token write throws. `AuthService.signOut` revokes before recording logout and does **not** swallow store errors, so **logout itself would have failed**; `refreshSession` fails closed, so **no refresh could succeed at all**; Google sign-in could not record its single-use `state`; sign-up could not issue a verification token. The 4A "closure" was therefore not deployable as written.

**Fix:** every date is bound as an ISO-8601 string with an explicit cast — `${expiresAt.toISOString()}::timestamptz` — in `RefreshTokenDenylistStore`, `OAuthStateStore` and `VerificationTokenStore`. Covered end-to-end by real-PostgreSQL suites (§2), which execute the exact statements the production factories select.

### 1.2 Session-family revocation was a blanket boolean, which locked out legitimate re-sign-ins

`isUserRevoked(userId)` returned `true` for the whole 7-day marker lifetime, so a user who logged out and **signed in again** could not refresh that new session for up to 7 days. Replaced with a **time-scoped** marker:

- `familyRevokedAt(userId): Promise<Date | null>` — the instant of the most recent unexpired family revocation;
- `AuthService.refreshSession` rejects only when the presented token's `iat` is **at or before** that instant (and fails closed when the token carries no `iat`);
- `isUserRevoked` remains as a coarse predicate derived from the same value.

The Postgres marker is now read `ORDER BY revoked_at DESC LIMIT 1`, so a second logout can never be shadowed by an earlier row.

### 1.3 Rotation was not atomic — two concurrent refreshes could both mint

`revoke()` was `INSERT … ON CONFLICT DO NOTHING` and returned nothing, so a caller could not learn whether _it_ won. Added `claim(jti, userId, expiresAt): Promise<boolean>`:

- Postgres: `… ON CONFLICT (jti_hash) DO NOTHING RETURNING id` — the **unique index is the arbiter**; exactly one concurrent caller gets a row back;
- in-memory: check-and-set on a single-threaded event loop, matching the same semantics;
- `revoke()` is retained as `claim()` with the result ignored;
- `AuthService.refreshSession` **claims before minting** and rejects the loser as replay. A store failure fails closed.

`RefreshTokenDenylistStore.postgres.test.ts` asserts that three concurrent claims on one JTI produce exactly one winner (and the same for OAuth state consumption).

### 1.4 Time-zone skew on the read path (found in this session) widened the post-logout gap

The identity tables declare `timestamp WITHOUT time zone`. A value written by the database (`now()`) and read naively is decoded by postgres-js as if it were in the **Node** process's zone. Measured on this machine:

```text
DB TimeZone = Etc/UTC            Node TZ = Asia/Calcutta (offset 330 min)
original          = 2026-10-15T10:57:41.416Z
naive read back   = 2026-10-15T05:27:41.416Z   | skewMin: 330
AT TIME ZONE fix  = 2026-10-15T10:57:41.416Z   | exact: true
now() naive       = 2026-10-15T05:17:41.480Z   | skewMin: 330
now() fixed       = 2026-10-15T10:47:41.480Z   | exact vs now(): true
```

Two real consequences, both on values that cross into JS:

1. **Logout-revocation gap.** `AuthService` compares `familyRevokedAt` against the token's `iat`. A revocation instant reported 330 minutes **early** makes tokens minted up to 330 minutes _before_ the logout look newer than the revocation → they remain refreshable. The gap equals the Node/DB zone difference (zero when the process runs with `TZ=UTC`, which is the common container default, but not guaranteed by anything in this repository).
2. **Verification-token expiry.** `AuthService` compares `record.expiresAt` against `Date.now()`. With a process zone _behind_ the DB (offset in the other direction) an **expired** email-verification token would be accepted for the length of the offset.

**Fix:** both read paths now ask the database to normalise the stored wall clock back to the absolute instant it represents:

```sql
expires_at AT TIME ZONE current_setting('TimeZone') AS expires_at
```

The probe above shows this is an **exact** round trip, including for `now()`-written values. Regression pins assert fidelity in both suites: `familyRevokedAt` must be within 5 s of the real instant, and `expiresAt` within 1 s of the instant that was written.

**Not fixed (reported):** the columns are still `timestamp WITHOUT time zone`. The clean long-term shape is `timestamptz` on all four tables, which needs a data-affecting `ALTER … TYPE` migration; the read-path normalisation makes the boundary exact without one, so the column change is left as an owner-approved follow-up (§3).

### 1.5 There was no versioned migration layer — drift was invisible

The estate convention is "run `CREATE TABLE IF NOT EXISTS` at startup". That converges a fresh database but cannot answer the three questions a deploy depends on: _which_ changes has this database received, is it _behind_ the code about to serve traffic, and how is a change _undone_. It also tolerates a silently-missing statement until a request fails on a missing column.

Added the minimum versioned layer (`services/identity/src/infrastructure/persistence/migrations.ts`):

| Element                                     | What it provides                                                                                                       |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `identity_schema_migrations`                | The ledger — one row per applied migration, `applied_at` defaulted by the DB                                           |
| `IDENTITY_MIGRATIONS` (001–004)             | Ordered, idempotent, **reversible** steps for `users`, `refresh_token_denylist`, `oauth_states`, `email_verifications` |
| `runIdentityMigrations(db)`                 | Applies pending steps in order and records each **after** it succeeds                                                  |
| `migrationStatus(db)` / `schemaVersion(db)` | Operator introspection — "what version is this database?"                                                              |
| `assertIdentitySchemaCurrent(db)`           | Fail-fast gate: pending work is an error, not silent drift                                                             |
| `rollbackIdentityMigrations(db, { to })`    | Explicit, operator-invoked reversal (never called at boot)                                                             |
| `ensureIdentitySchema(db?)`                 | Process-wide **single-flight** bootstrap, awaited by both boot paths                                                   |

Statement text is **not duplicated**: `identitySchema.ts` holds one copy of each table's DDL, imported by both the migration path and the per-store `ensureTable()` fallbacks, so the two cannot drift apart (`PostgresIdentityRepository.runDdl` now emits the identical statements it always did, from that single source). Every `up()` is idempotent, so the first run against a **brownfield** database adopts it: the DDL is a no-op and the ledger records the version.

### 1.6 Boot-order defect: the web auth-app could start the DDL pass before registering the identity DDL

`apps/web/src/lib/auth-app.ts` started `awaitAllEngineEnsureTables()` **before** `createProductionIdentityRepository()` registered the identity entries, so on a cold serverless instance that only ever served the auth app — the `/sign-in` path on a fresh database — the `users` DDL was queued but never awaited. The repository is now resolved first, and the fire-and-forget bootstrap no longer discards its error (`.catch(() => {})` → a logged error with the reason), because a failed schema bootstrap means every auth endpoint is about to fail.

`IdentityModule`'s three independent fire-and-forget `ensureTable()` calls collapsed into **one** shared single-flight `ensureIdentitySchema()` whose failure is reported through the platform logger instead of a swallowed `console.warn`.

---

## 2. Verification executed

All commands run in this checkout. "Real engine" = PostgreSQL 16 reached at `POSTGRES_TEST_URL` (default `postgres://vedmoulya:vedmoulya-dev@localhost:5432/vedmoulya`); suites gate themselves on engine availability with the repository's established `(available ? describe : describe.skip)` convention and are isolated (per-run namespaced rows / a dedicated schema) — no table is dropped outside the suite's own schema.

| #   | What                                                | Command                                                                                 | Result                                                                                                                                                                                                                                                                                                                                                          |
| --- | --------------------------------------------------- | --------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Identity module, everything                         | `npx vitest run services/identity`                                                      | **39 files · 488/488 passed, exit 0**                                                                                                                                                                                                                                                                                                                           |
| 2   | Durable denylist vs **real engine**                 | `npx vitest run services/identity/__tests__/RefreshTokenDenylistStore.postgres.test.ts` | **4/4 passed** — atomic claim survives a new store instance; 3 concurrent claims → 1 winner; family revocation time-precise + durable + per-user; expired rows stop blocking while live evidence is retained                                                                                                                                                    |
| 3   | OAuth state + verification store vs **real engine** | `npx vitest run services/identity/__tests__/IdentityStores.postgres.test.ts`            | **4/4 passed** — the exact writes that used to throw; single-use across instances; concurrent callbacks → 1 winner; expired state fails closed; token single-use, one active token per user, per-user revocation; **instant fidelity within 1 s**                                                                                                               |
| 4   | Versioned migrations vs **real engine**             | `npx vitest run services/identity/__tests__/migrations.postgres.test.ts`                | **6/6 passed** — virgin DB reports all pending; whole set applies once and creates all five tables; **idempotent against a brownfield DB with data preserved**; `DELETE`d ledger row is detected as drift and repaired; single-flight returns the same run to two concurrent boot paths; rollback to `001_users` drops 3 tables then re-applies them functional |
| 5   | Migration runner, hermetic                          | `npx vitest run services/identity/__tests__/migrations.test.ts`                         | **9/9 passed**                                                                                                                                                                                                                                                                                                                                                  |
| 6   | Whole repository                                    | `npm run typecheck`                                                                     | **exit 0**                                                                                                                                                                                                                                                                                                                                                      |
| 7   | Whole repository                                    | `npm run lint`                                                                          | **exit 0 — 58/58 scopes, 0 failed**                                                                                                                                                                                                                                                                                                                             |
| 8   | Whole repository                                    | `npm run format`                                                                        | **exit 0 — all matched files use Prettier code style**                                                                                                                                                                                                                                                                                                          |
| 9   | Whole repository                                    | `npm test`                                                                              | **1,004 files · 13,234 tests passed, exit 0**                                                                                                                                                                                                                                                                                                                   |
| 10  | Whole repository — production build                 | `npm run build`                                                                         | **exit 0** across every workspace (incl. the Next.js production build), 0 errors                                                                                                                                                                                                                                                                                |
| 11  | S024-4B authorization surface, both directions      | `npx vitest run services/identity/__tests__/IdentityRoutes.test.ts`                     | **28/28 passed** — 401/403 for absent, invalid, insufficient-ability and non-owner callers; 200 for permitted ones                                                                                                                                                                                                                                              |
| 12  | S012-B fail-closed path (no credential)             | `OPENAI_API_KEY= AI_OPENAI_API_KEY= npx tsx scripts/ai-production-verify.ts`            | **exit 2** — `LIVE VALIDATION BLOCKED`, exact operator steps printed, no provider call attempted (§5)                                                                                                                                                                                                                                                           |
| 13  | The pre-fix defect, reproduced                      | `sql.param(new Date())` against the engine (§1.1 table)                                 | **throw** `ERR_INVALID_ARG_TYPE` — the fix is aimed at a reproduced cause, not a suspected one                                                                                                                                                                                                                                                                  |

The regression pins introduced by §1.4 are deliberately sensitive to the skew they guard: a naive read shifts the value by 330 minutes on this machine, which is 19,800,000 ms — three orders of magnitude outside the 5 s / 1 s bounds, so the assertions fail loudly if the normalisation is ever removed.

---

## 3. Known limitations (reported, not hidden)

1. **The drift gate is not wired into `/health/ready`.** `assertIdentitySchemaCurrent()` exists, is tested and is exported, but nothing in the running app calls it. Boot applies every pending migration before traffic can arrive, so a _healthy_ process is never served a stale schema — but "database is behind" does not yet turn readiness into a 503. Wiring it is a runtime behaviour switch and is therefore left to an explicit platform-owner decision, exactly as the sprint-026 methodology requires. The code comments say so at the point of definition.
2. **Cross-_process_ bootstrap is not serialised.** `ensureIdentitySchema()` is single-flight **within one process**; two Node processes booting simultaneously against a fresh database can both run the DDL. Every statement is `IF NOT EXISTS` and every ledger write is `ON CONFLICT DO NOTHING`, so the outcome is convergent, but PostgreSQL can still raise a transient `duplicate key value violates unique constraint "pg_type_typname_nsp_index"` for concurrent `CREATE TABLE IF NOT EXISTS`. In this repository both boot paths wrap the pass so the error is **logged, not fatal**, and the other process leaves the schema in place — so the impact is transient log noise, not an outage. A true fix needs a session-scoped `pg_advisory_lock` held across the whole run on a single connection, which the pooled `db.execute()` path cannot express; it is deliberately not attempted here.
3. **The tables remain `timestamp WITHOUT time zone`** (§1.4). Reads are now exact; the column type itself is the residual design smell.
4. **Nothing is merged.** All of the above is an uncommitted working tree at HEAD `81dd5f88`. S024-4A's own evidence requirement is _"an approved migration implementing a durable JWT denylist table is **merged**"_ — that is not satisfied by this report.
5. **Not executed in this environment:** `npm run test:a11y`, `npm run preflight:prod` / `npm run doctor:prod` (both exit 1 by design here — no managed identity database), the Playwright E2E set, `npm run quality` benchmarks, and any restore/failover drill. Each is network/credential/platform dependent; the earlier reports document the same.
6. **Live cloud AI generation remains unverified** (§5). The mock provider is a test fixture, never a production fallback.

---

## 4. Re-verification of the adjacent gaps (no code change)

### 4.1 S024-4B — dormant identity router

`createIdentityRouter(identityService, auth)` requires an access-token verifier as a **non-optional argument** and throws at runtime if it is absent, so the module cannot be constructed into an unguarded user-management surface, and it remains **unmounted** by the running application (which mounts only `createAuthRouter`). `IdentityRoutes.test.ts` (**28 tests, exit 0**) asserts both directions, not just the happy path: **401** without a token (and the service is never reached), **401 TOKEN_INVALID** for a bad token, **403** for a plain user on the user list, on email lookup, on activate/deactivate, and for a non-owner on read/profile/authentication-check, with **200** for the permitted moderator/admin/owner cases. Verdict: **VERIFIED-NO-CHANGE**.

### 4.2 Mission lifecycle (Group C)

`npx vitest run packages/mission-controller packages/mission-runtime services/api/src/services/__tests__/MissionService.test.ts` → **50 files · 465/465 passed, exit 0**. The state machine is strict in the way the "false success" concern requires: `COMPLETE` is reachable **only** from `RUNNING`, and `COMPLETED`/`FAILED`/`CANCELLED` are distinct terminal states with **no** outgoing transitions. The previously-reported honesty defect (a `CANCELLED` mission rendered as "Mission Failed") was fixed in an earlier session and remains covered. G1 (the canonical architecture document attributing enterprise intelligence composition to Mission routing that `RuntimePorts` does not inject) is **unchanged and still an OWNER-DECISION** — deliberately not switched, because doing so would silently change provider selection.

### 4.3 Resilience (Group E)

Liveness and readiness are correctly separated and were confirmed by reading the routes: `/health/live` is a pure process-alive signal (no database, no engine, no DDL) returning 200; `/health/ready` requires **gateway initialised AND a real `SELECT 1`** within a bounded timeout and returns **503** until both hold; `/health/check` reports pool counters and status only (no connection details). The 503 contract is pinned by `health-routes.test.ts` and was not relaxed. Rate-limit topology honesty (`RATE_LIMIT_BACKEND=redis` for multi-instance, honest in-process degradation otherwise) was verified in sprint 026 and is unchanged.

---

## 5. S012-B — live provider acceptance: BLOCKED, and why it was not attempted

A real `OPENAI_API_KEY` **is** present in this shell environment (length 164; the value was never read, printed or transmitted). Running the verifier with it would have executed a **billed** provider call. That is an external-spend action the task did not authorise, so it was **not run**. Instead the fail-closed path was verified with the credential explicitly blanked, which proves the script refuses rather than fabricating live evidence:

```text
$ OPENAI_API_KEY= AI_OPENAI_API_KEY= npx tsx scripts/ai-production-verify.ts
✗ LIVE VALIDATION BLOCKED — no real provider key is configured.
  IMPLEMENTATION VERIFIED · LIVE VALIDATION BLOCKED (operator step)
  This script exits non-zero now because a live call did NOT happen.
exit 2
```

**S012-B stays BLOCKED and no live-completion claim is made anywhere in this report.** The exact prerequisite is unchanged: a funded provider credential in an authorised environment, then `npm run ai:production:verify && npm run ai:critique:verify` both exiting 0. This is the one remaining acceptance journey that could not be exercised; it is blocked by _authorisation to spend_, not by code.

---

## 6. What is still required from the operator (unchanged)

| Blocker | Owner                            | Evidence still required                                                                                                        |
| ------- | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| S012-A  | Deployment Operator (Platform)   | Managed non-localhost `IDENTITY_DATABASE_URL`; `preflight:prod` + `doctor:prod` + `test:a11y` exit 0; `/health/ready` HTTP 200 |
| S012-B  | Deployment Operator (AI/Finance) | Funded credentials; both AI verifiers exit 0 with a real completion                                                            |
| S012-C  | Staging/DB Owner                 | Authorised staging; executed restore drill with RTO ≤ 30 min logged and readiness 200 after restore                            |
| 4A      | Platform Engineer (Identity)     | **Approval + merge of this change set**, then the single-use/revocation checks against the provisioned identity database       |

Note the coupling: the 4A migration runs automatically on first boot against the **managed identity database**, so **S012-A is 4A's deployment precondition**. They close together or not at all.

---

## 7. Release decision

**NO-GO — unchanged, and no in-repo change can alter it.** Three of the four reconsideration conditions are operator-gated (managed identity database, funded provider credits, authorised staging for a restore drill). The fourth — durable token revocation — is now **code-complete and verified against a real PostgreSQL engine**, but it is **unmerged**, and it cannot be merged-and-deployed ahead of condition 1 because its migration is what runs against that database.

The honest summary: this session removed the _code_ blockers and produced the first evidence for 4A that a real database generated. It did not, and cannot, remove the _authorisation and infrastructure_ blockers.

---

## 8. Files changed (uncommitted working tree)

**New**

| File                                                                     | Purpose                                                                           |
| ------------------------------------------------------------------------ | --------------------------------------------------------------------------------- |
| `services/identity/src/infrastructure/persistence/identitySchema.ts`     | Single source of truth for all four tables' DDL                                   |
| `services/identity/src/infrastructure/persistence/migrations.ts`         | Ledger, ordered migrations, status, drift gate, rollback, single-flight bootstrap |
| `services/identity/__tests__/migrations.test.ts`                         | Hermetic runner coverage (9 tests)                                                |
| `services/identity/__tests__/migrations.postgres.test.ts`                | Real-engine migration coverage, isolated schema (6 tests)                         |
| `services/identity/__tests__/IdentityStores.postgres.test.ts`            | Real-engine OAuth/verification coverage + instant fidelity (4 tests)              |
| `services/identity/__tests__/RefreshTokenDenylistStore.postgres.test.ts` | Real-engine durable revocation coverage (4 tests)                                 |
| `docs/audits/2026-10-15-s12-4a-durable-revocation/FINAL-REPORT.md`       | This report                                                                       |

**Modified**

| File                                                                             | Change                                                                                                  |
| -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `services/identity/src/infrastructure/persistence/RefreshTokenDenylistStore.ts`  | `claim()` arbiter, time-scoped `familyRevokedAt`, ISO+cast binding, tz-normalised read, injectable pool |
| `services/identity/src/infrastructure/persistence/VerificationTokenStore.ts`     | ISO+cast binding, tz-normalised read, injectable pool                                                   |
| `services/identity/src/infrastructure/persistence/OAuthStateStore.ts`            | ISO+cast binding, injectable pool                                                                       |
| `services/identity/src/infrastructure/persistence/PostgresIdentityRepository.ts` | DDL from the shared statement source (text unchanged)                                                   |
| `services/identity/src/auth/AuthService.ts`                                      | Claim-before-mint rotation, time-scoped family check, fail-closed store errors                          |
| `services/identity/src/infrastructure/di/IdentityModule.ts`                      | One shared single-flight schema bootstrap, errors logged not swallowed                                  |
| `services/identity/src/index.ts`                                                 | Exports for the migration surface                                                                       |
| `apps/web/src/lib/auth-app.ts`                                                   | DDL registration ordered before the sequential pass; failure no longer silent                           |
| `services/api/src/infrastructure/ProductionRepositories.ts`                      | Versioned identity migrations join the awaited boot pass                                                |
| `services/identity/__tests__/RefreshTokenDenylistStore.test.ts`                  | Atomic-claim and timestamp-marker assertions                                                            |
| `services/identity/__tests__/RefreshTokenRotation.test.ts`                       | Post-logout re-sign-in now proves the _new_ session works while old tokens stay dead                    |

---

## 9. Preservation confirmation

HEAD `81dd5f88462265f04b8578bbd4624072f1f79a5d` before and after. No commit, push, tag, deploy, reset, clean, checkout or revert was executed. The pre-existing uncommitted changes that were already in this tree (including `AuthService.ts` and the identity route guards from prior sessions) were left in place and are reported rather than rewritten away. No secret value appears in this report or in any command output it quotes: the provider key is reported by name and length only. No production system, database or provider account was contacted, and no billed operation was performed.
