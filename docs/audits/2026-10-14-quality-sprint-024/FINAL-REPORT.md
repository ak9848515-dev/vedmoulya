# VedMoulya — Sprint 024: Security and Governance Closure

**Date (UTC):** 2026-10-14
**Branch:** `main` · **HEAD:** `a124274b0d1fa91f361e0a5775e144658405913a` (unchanged)
**Mode:** source-evidence audit of the current working tree + targeted security tests; no production changes.
**No commit, push, deploy, credential change, production-data change, paid AI call, or stash change occurred.**

**Evidence read:** Sprint 023 report; the frozen readiness/roadmap baseline
(`04_Sprints/MASTER_ROADMAP.md`), the production-readiness checklist
(`docs/audits/2026-10-12-quality-sprint-012/PRODUCTION-READINESS-CHECKLIST.md`),
and the P0.2–P0.5 gap evidence
(`docs/audits/2026-10-10-full-audit/GAP-REGISTER.md` G-08…G-11 and
`CODE-QUALITY-SECURITY-AUDIT.md` SEC-01…03).

---

## Executive verdict: **PARTIAL**

Most of the audited controls are **VERIFIED** against source and tests: server-side
OAuth state, the tRPC IDOR guard, owner-scoped Mission / opportunity / credential /
trace access, AES-256-GCM credential encryption, secret redaction, and a real
(honesty-preserving) rate-limiter port with memory **and** Redis backends.

Two gaps are recorded and **not fixed** (both are outside a "smallest safe
change"): (1) **refresh tokens are neither rotated nor revoked on logout**, and
closing it needs a durable token/denylist store (**BLOCKED — migration +
operational decision**); (2) the identity service's standalone REST
user-management router is mounted with **no** authorization middleware but is
**DORMANT** — it is not mounted by the running app. No source file was changed
this sprint, so no regression test was added.

---

## 0. Baseline and preservation

| Item                                  | Value                                                                                                                             |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Branch / HEAD                         | `main` / `a124274b0d1fa91f361e0a5775e144658405913a`                                                                               |
| `git status --porcelain` count        | **95** (baseline; unchanged)                                                                                                      |
| Stashes                               | **5** preserved (`pre-security-baseline-healthprobe`, 3× `lint-staged automatic backup`, `WIP on main: release-candidate-v1.0.0`) |
| Pre-existing modified/untracked files | untouched                                                                                                                         |

**Final:** 96 paths after this report (the **only** addition is
`docs/audits/2026-10-14-quality-sprint-024/`). HEAD unchanged; 5 stashes; no
`reset`/`clean`/revert/stage/commit/push/deploy; no credential, env-config,
production-DB, paid-provider, or stash operation. **No source file was changed.**

---

## 1. A — Browser-session security

| Control                                    | Verdict                        | Evidence                                                                                                                                                                                                                                                                                                            |
| ------------------------------------------ | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| OAuth `state` generation                   | **VERIFIED**                   | `services/identity/src/auth/OAuthState.ts` — `createOAuthState()` = `randomBytes(32)`, SHA-256 hash is what is persisted, 10-min TTL                                                                                                                                                                                |
| Server-side state validation               | **VERIFIED**                   | `AuthService.beginGoogleAuth` saves the hash; `signInWithGoogle` **consumes the state before any code exchange** and fails closed on store error (`AuthService.ts:200-245`)                                                                                                                                         |
| Single-use / replay                        | **VERIFIED**                   | `PostgresOAuthStateStore.consume` = one atomic `UPDATE … WHERE consumed_at IS NULL AND expires_at > now() RETURNING`; a second callback returns false                                                                                                                                                               |
| Callback handling                          | **VERIFIED**                   | `AuthRoutes.ts` `/google/callback` rejects missing `code`/`state` before exchange (fail closed); browser-navigation serves an exchange page, programmatic path verifies state in the service                                                                                                                        |
| CSRF                                       | **VERIFIED (N/A for cookies)** | The session is a **Bearer JWT in localStorage** — no session cookie is set anywhere (`grep Set-Cookie` in `services/identity/src` + `services/api/src/middleware` = none), so classic cookie-CSRF does not apply; the OAuth redirect CSRF is covered by the state token                                             |
| Auth-endpoint throttling                   | **VERIFIED (per-process)**     | `apps/web/src/lib/auth-app.ts` throttles `/sign-in`, `/sign-up`, `/refresh` per client IP via `auth-rate-limit.ts` (429 + `retry-after`)                                                                                                                                                                            |
| **Session rotation / logout invalidation** | **PARTIAL → BLOCKED**          | `AuthService.signOut` only calls `user.recordLogout()` + persist — it does **not** invalidate JWTs. `TokenService.refreshAccessToken` mints a new pair but keeps the **old refresh token valid** (no `jti` denylist/rotation). A stolen refresh token remains usable until its 7-day expiry, including after logout |

**BLOCKED dependency (refresh-token revocation):** durable revocation requires a
token/denylist store (a new table/migration) shared across instances; an
in-memory denylist would be incorrect on multi-instance production. Needs
**migration approval + an operational decision** (rotate-on-refresh + reject
revoked `jti`). Owner: Identity/Platform. Not fabricated as closed.

**Accepted design note:** storing the access token in `localStorage` exposes it to
XSS. This is a documented, deliberate trade-off (no cookie/CSRF surface); it is
recorded, not a defect under this sprint's framework.

---

## 2. B — Authorization policy (owner / tenant boundaries)

| Boundary                                         | Verdict                   | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ------------------------------------------------ | ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| tRPC IDOR guard (all `userId`-scoped procedures) | **VERIFIED**              | `services/api/src/middleware/auth.ts::assertUserIdMatchesSession` → `FORBIDDEN` when `input.userId !== ctx.userId`; applied by `authMiddleware` on `standard/heavy/search/authProcedure` (`RouterRegistry.ts:186`)                                                                                                                                                                                                                                                                                                                                                                                       |
| Mission access                                   | **VERIFIED**              | `MissionService.getMissionOwned` authorizes via `runtime.api.getStatus(missionId,userId)` then re-checks `mission.userId !== userId`; all ops owner-scoped                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| Opportunity approval & launch binding            | **VERIFIED**              | `s11-approval-binding.test.ts` (6/6): approval must exist, be granted by the owner, single-use, and **scoped to the same opportunity**; wrong scope / foreign granter / missing approval → no launch                                                                                                                                                                                                                                                                                                                                                                                                     |
| Provider credentials                             | **VERIFIED**              | Owner-scoped per-user credential store; `ProviderCredentialService.test.ts`, `provider-credentials.test.ts`, `user-provider-credentials.test.ts` pass; per-user orchestrators overlay, never replace platform providers                                                                                                                                                                                                                                                                                                                                                                                  |
| Trace / evidence reads                           | **VERIFIED**              | `ops.trace(s)` carry the session `userId` (IDOR-guarded); `OpsRouter` documents owner scoping                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| Administrative operations                        | **DORMANT (latent risk)** | The gateway has **no admin-only procedures** (uniformly user-scoped). But `services/identity/src/presentation/routes/IdentityRoutes.ts::createIdentityRouter` mounts `GET /users`, `GET /users/:id`, `GET /users/email/:email`, `PATCH /users/:id/*`, `POST /users/:id/deactivate`, **`DELETE /users/:id`** with only CORS/logger/error middleware — the existing `requireAbility`/`requireOwnership` middleware is **not** applied. **This router is not mounted by the running app** (the web app mounts only `createAuthRouter` at `/api/v1/identity/auth`; the identity package has no server entry) |

Cross-owner denial is therefore tested and verified everywhere the running app
exposes a boundary. The unguarded identity REST router is recorded as **DORMANT**;
it would be a serious authorization defect if that standalone surface were ever
mounted. Fixing it requires deciding the standalone service's auth model, so it is
recorded (owner: Identity/Platform), not patched.

---

## 3. C — Privacy and data lifecycle

| Item                                   | Verdict                    | Evidence                                                                                                                                                                                                                                                        |
| -------------------------------------- | -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Credential handling (at rest)          | **VERIFIED**               | `credential-cipher.ts` — AES-256-GCM (authenticated), scrypt-derived 32-byte key, versioned, min key length enforced, rotation invalidates sealed records (fails to "no user credential", never silent success)                                                 |
| Logs / redaction                       | **VERIFIED**               | `redactSecrets` (`packages/services/src/ai/runtime/AIObservability.ts`) applied in `MissionService.buildView`/activity; loop-failure diagnostics emit only safe scalar identifiers                                                                              |
| Memory retention / expiry              | **VERIFIED**               | `MemoryRetentionPolicy` + `MemoryExpirationService` (expire + optional purge of ephemeral items); `services/memory` retention routes                                                                                                                            |
| User PII retention / deletion / export | **PARTIAL (evidence gap)** | The only deletion path is `IdentityController.deleteUser` → `identityService.archiveUser()` — a **soft archive**, not erasure; no export ("data subject access") pathway and no retention/deletion **test matrix** for user PII. This matches the unclosed G-10 |

No retention/deletion claim beyond what is implemented is made. Closing this needs
a policy decision (retention windows, erasure vs. archival, export format) —
**recorded, not invented**.

---

## 4. D — Distributed rate limiting

| Claim                                                            | Verdict                       | Evidence                                                                                                                                                                                                                            |
| ---------------------------------------------------------------- | ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A rate-limiter **port** exists with a **Redis** (shared) backend | **VERIFIED**                  | `services/api/src/middleware/rate-limit.ts` — `RedisRateLimiter` (INCR + PEXPIRE fixed window, `distributed: true`); memory backend honestly reports `distributed: false`                                                           |
| Honest failure / degradation                                     | **VERIFIED**                  | On Redis outage: logs loudly once, degrades to per-process buckets, still enforced; `getRateLimiterStatus()` reports `degraded`; `RATE_LIMIT_BACKEND=redis` without `REDIS_URL` **fails fast** (never a silent memory fallback)     |
| Security-sensitive endpoints throttled                           | **VERIFIED**                  | tRPC tiers (`standard 100/min`, `heavy 20/min`, `search 30/min`, `auth 10/min`, `health 200/min`) applied per procedure in `RouterRegistry`; identity auth REST (`/sign-in`,`/sign-up`,`/refresh`) throttled per IP                 |
| **Distributed in production by default**                         | **PARTIAL → not distributed** | Default backend is **memory** (per-process). Distributed enforcement is an **operator configuration** (`RATE_LIMIT_BACKEND=redis` + `REDIS_URL`, documented in `.env.example:183-187`). The identity auth limiter is in-memory only |
| Bypasses                                                         | **VERIFIED**                  | Unauthenticated traffic shares one `anonymous` bucket per tier (no unknown-user bypass); rate limiting is skipped only when `NODE_ENV !== production` (intentional dev/test behavior)                                               |

Per the brief, the in-memory limiter is **not** called distributed. The Redis
implementation is real and honest, but multi-instance correctness (G-11) is an
**operator deployment decision**, not a default.

---

## 5. E — Production-readiness evidence (reassessed, no production change)

Unchanged from the Sprint 012 checklist; none can be closed locally:

| Requirement                               | Status      | Exact dependency                                                                                                                                                     |
| ----------------------------------------- | ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Identity database                         | **BLOCKED** | Operator must set a managed, non-loopback `IDENTITY_DATABASE_URL` in the platform environment; verify with `npm run preflight:prod` / `doctor:prod`, `/health/ready` |
| Live cloud AI / billing                   | **BLOCKED** | Provider **billing credits** (last result: `ai-production-verify` exit 3 / `ai-critique-verify` exit 3, no generation recorded)                                      |
| Authorized staging restore/recovery drill | **BLOCKED** | An approved staging environment + backup/restore access + a defined recovery window; none exists in-repo/locally                                                     |

---

## 6. Confirmed defects and regression tests

**None fixed this sprint; no source file changed, so no new regression test.**

- **Refresh-token rotation/revocation missing** — a real browser-session gap;
  **BLOCKED** on a durable token store (migration). See §1.
- **Dormant unauthenticated identity REST user-management router** — real but
  **not reachable** (unmounted); recorded as DORMANT. See §2.

Both are recorded with owners rather than patched, per the fix policy (fix only
**confirmed, in-scope** defects; otherwise record BLOCKED with the exact
dependency). No test was weakened, skipped, or suppressed; no authorization
bypassed; no secret logged.

---

## 7. Validation results (exact commands)

| #   | Command                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | Exit | Result                                                  |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---- | ------------------------------------------------------- |
| 1   | `npx vitest run services/identity/__tests__ apps/web/src/auth/__tests__ apps/web/src/lib/auth-rate-limit.test.ts packages/providers/src/application/__tests__/ProviderCredentialService.test.ts packages/providers/src/domain/credentials/__tests__/provider-credentials.test.ts services/api/src/__tests__/RateLimiter.test.ts services/api/src/__tests__/ProductionProviderCredentialService.test.ts packages/mission-runtime/src/__tests__/user-provider-credentials.test.ts packages/mission-runtime/src/__tests__/s11-authorization-ceiling.test.ts --reporter=dot` | 0    | **45 files · 556/556 passed**                           |
| 2   | `npm run typecheck` (`tsc -b && tsc --noEmit -p services/api`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | 0    | green                                                   |
| 3   | `npm run deps:cycles`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | 0    | `no internal dependency cycles (57 workspaces scanned)` |

Suites invoked cover: OAuth state lifecycle, auth routes/extended, session
manager, authorization service/middleware/ownership guard, rate limiter
(memory + Redis), provider credential service/cipher/ownership, and the S11
authorization-ceiling regression.

---

## 8. Remaining risks, limitations, and closure requirements

1. **Refresh-token revocation/rotation** — BLOCKED (migration + ops decision).
   Owner: Identity/Platform. _Highest-value open session-security item._
2. **Dormant identity REST user-management router** without authz — DORMANT;
   decide/guard before any standalone identity exposure. Owner: Identity/Platform.
3. **Distributed rate limiting** — the Redis backend exists but is **not the
   default**; production multi-instance abuse/cost risk persists until
   `RATE_LIMIT_BACKEND=redis` + `REDIS_URL` is set. Owner: Deployment operator.
4. **User-data erasure/export + retention test matrix** — PARTIAL; needs a policy
   decision. Owner: Product/Privacy.
5. **Production-readiness A/B/C** — BLOCKED on platform config, billing credits,
   and an authorized staging environment (unchanged).
6. **Live provider / staging / production validation** was **not** performed and
   is **not** claimed.

---

## 9. Preservation confirmation

Final HEAD `a124274b0d1fa91f361e0a5775e144658405913a`; **5 stashes**;
`git status --porcelain` = 96 (95 baseline + this report directory only). No
source file, runtime configuration, credential, database state, commit, push,
paid call, or deployment was changed. All pre-existing modified/untracked files
and every prior audit/evidence directory remain intact.

---

## 10. Closing

Sprint 024 closes the browser-session, authorization, privacy, and rate-limit
questions to the extent the current evidence and authorized infrastructure allow:
the OAuth-state, IDOR, ownership, approval-binding, credential-encryption,
redaction and rate-limiter controls are **VERIFIED**; refresh-token revocation
and the dormant identity REST surface are **precisely classified** (BLOCKED /
DORMANT) with owners and exact dependencies; and the three production-readiness
items remain **BLOCKED** on operator-gated access. Nothing was claimed closed
without sufficient evidence, and nothing was fixed that could not be fixed safely
in scope.
