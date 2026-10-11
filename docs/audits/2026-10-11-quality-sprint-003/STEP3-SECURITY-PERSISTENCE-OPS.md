# Step 3 — Security, Persistence, and Operations Findings

Evidence-only pass. No staging environment was available, so no live
backup/restore/migration/rollback drill was performed (blocker recorded below).

## 1. API authorization inventory

Enforcement is **central**, in `services/api/src/services/RouterRegistry.ts`,
via procedure variants — not per-router files:

| Variant             | Middleware                  |          Count | Meaning                   |
| ------------------- | --------------------------- | -------------: | ------------------------- |
| `standardProcedure` | auth + rate-limit(standard) |            525 | Protected                 |
| `heavyProcedure`    | auth + rate-limit(heavy)    |            120 | Protected                 |
| `searchProcedure`   | auth + rate-limit(search)   |              5 | Protected                 |
| `authProcedure`     | auth + rate-limit(auth)     |              3 | Protected                 |
| `healthProcedure`   | rate-limit(health)          |              6 | Public, rate-limited      |
| `publicProcedure`   | metrics only                |             11 | Public, **no rate limit** |
| `baseProcedure`     | metrics only                | (variant base) | —                         |

- **Auth middleware** (`createAuthMiddleware`): calls `isAuthenticated(ctx)` then
  `assertUserIdMatchesSession(ctx, rawInput)` (IDOR guard) on **every protected
  procedure**.
- **Token verification** (`middleware/auth.ts`): HS256 via `jose`, issuer
  `vedmoulya`, audience `vedmoulya-api`, `type: 'access'`; anonymous context on
  missing/invalid token so public procedures keep working.
- **Negative-case coverage:** 14 API test files assert `UNAUTHORIZED` /
  `FORBIDDEN` / `TOO_MANY_REQUESTS`.
- **Operator gating:** `OperatorGate` with `OPS_OPERATOR_IDS` (empty = deny-all),
  enforced inside `OpsApplicationService`.

### Finding S-1 (P2, new) — portal public procedures are unrated

The `portal.*` procedures (`login`, `getDashboard`, `listContent`,
`approveContent`, `rejectContent`, `commentContent`, `downloadDeliverable`,
`listInvoices`, `getInvoice`) run on `publicProcedure` = metrics only, i.e.
**no rate limiting**. They are intentionally token-scoped (input `portalToken`),
so JWT auth does not apply, but `portal.login` in particular is exposed to
token guessing / brute force without any bound.
**Why not fixed here:** the rate limiter keys on `ctx.userId`
(`rateLimitKey`), and anonymous traffic shares a single `'anonymous'` bucket per
tier. Naively wrapping portal in `RateLimitTiers.auth` (10/min) would throttle
_all_ portal clients collectively and regress the portal. A correct fix needs
per-token/per-IP keying (a small rate-limiter API addition) — beyond a bounded
step. **Recommended:** add `checkRateLimitByKey(key, tier)` and a
`portalProcedure` variant keyed on a hash of `portalToken` (or client IP), then
add negative tests. Owner: security.

### Other security facts (verified)

- **Secret redaction:** `redactSecrets` in
  `packages/services/src/ai/runtime/AIObservability.ts:82`, applied to spans and
  payload capture; regression test `AISecurity.test.ts:207`.
- **Production dependency audit:** 0 vulnerabilities (dev-only advisories tracked
  separately, Step 6).
- No P0 authorization bypass / data-loss / fabricated-success defect found.

## 2. Persistence and durable semantics

| Property                                          | Evidence                                                                                                                                          | Status                                                  |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| Durable requirement in production                 | `requireDurablePersistence: isProductionEnvironment()` (`ApiApplicationService`)                                                                  | Enforced; tested (`MissionServiceBranches.test.ts:208`) |
| Idempotent DDL / migrations                       | `CREATE TABLE IF NOT EXISTS` convention; engine table readiness gate `ensureEngineTablesReady` in `[trpc]/route.ts`                               | Present                                                 |
| Restart recovery                                  | `startMissionWatchdog` reconciles persisted `WAITING_FOR_PROVIDER` missions on a bounded, state-based heartbeat; tests `mission-watchdog.test.ts` | Present, tested                                         |
| Graceful shutdown flush                           | `flushPersistence()` on `SIGTERM`/`SIGINT` (`[trpc]/route.ts`)                                                                                    | Present                                                 |
| AI usage durability at serverless boundary        | `flushAiUsage()` after dispatch                                                                                                                   | Present                                                 |
| Hydration ordering for persistence-mirror routers | `HYDRATION_PREFIXES` + shared `hydrationPromise`                                                                                                  | Present                                                 |

**Finding P-1 (P2):** backup/restore, migration-forward/rollback, and
interrupted-mission restart drills are **not reproducible in this environment**.

### Blocker (recorded, not simulated)

No staging database, credentials, or infrastructure are available in this
environment. Per protocol, no backup/restore/migration/rollback drill was
performed or claimed. Required to clear: a staging Postgres URL + operator
access, then run the durable mission restart and restore drills against it.

## 3. Operations

- Health endpoints (`health.live`, `health.ready`, `health.check`) and a
  scheduler/watchdog cadence driver exist.
- `HEALTHY`/readiness gate bypasses health.check so it always responds.
- **Finding O-1 (P2, carried):** no deployed/staging, rollback, or telemetry-sink
  proof.

## 4. Disposition summary

| ID                                             | Sev | Status                                                                                               | Owner    |
| ---------------------------------------------- | --- | ---------------------------------------------------------------------------------------------------- | -------- |
| S-1 portal unrated                             | P2  | **Open — documented**, fix requires per-token keying                                                 | security |
| P-1 drills                                     | P2  | **Blocked** — no staging env                                                                         | ops      |
| O-1 deploy/rollback                            | P2  | **Blocked** — no staging env                                                                         | ops      |
| D-10 carry (enumerate rate limits / retention) | P3  | **Partially resolved** — authz/rate-limit inventory above; retention/deletion enumeration still open | security |
