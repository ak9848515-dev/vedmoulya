# STEP 2 — D-10 Privacy & Data Lifecycle Inventory

**Sprint:** VM-QUALITY-SPRINT-004
**Baseline HEAD at step start:** `9aa302d0` (Step 1 committed)
**Method:** static trace of owners, retention declarations and enforcement call
sites. Every claim below cites a file/line. Nothing here is inferred from
documentation — a category is marked **ENFORCED** only where a code path
actually consumes the policy.

## 1. Categories, owners, policy status

| #   | Category                                         | Owner (module)                                                                                            | Stored in                                    | Retention declared                                                                                             | Enforcement                                                                                                                                                                       | Status               |
| --- | ------------------------------------------------ | --------------------------------------------------------------------------------------------------------- | -------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- |
| 1   | Account / profile / preferences / settings (PII) | `@vedmoulya/services` `IdentityApplicationService`; exposed by `services/api` `routers/IdentityRouter.ts` | `users` table (`PostgresIdentityRepository`) | Yes — `packages/information` `DEFAULT_RETENTION_DAYS` (profile/prefs/settings/identity 730d, credentials 365d) | **None** (declaration only)                                                                                                                                                       | ⚠ Gap                |
| 2   | Auth credentials (password hashes) & tokens      | `services/identity` (`PasswordService`, `TokenService`, `VerificationToken`)                              | identity tables / token store                | Yes — absolute token expiry                                                                                    | **ENFORCED** — expiry/consume paths; reuse rejected                                                                                                                               | ✅                   |
| 3   | Sessions (web)                                   | `apps/web` `auth-store`, `session-manager`                                                                | browser storage                              | Yes — `expiresAt`                                                                                              | **ENFORCED** — expiry + skew check                                                                                                                                                | ✅                   |
| 4   | Client-portal access tokens                      | `@vedmoulya/services` `content-agency/ClientOperationsApplicationService`                                 | portal access records                        | Revocation                                                                                                     | **ENFORCED** — `revokePortalAccess` + `enabled` gate (`'Portal access has been revoked'`); per-IP rate limit (Step 1)                                                             | ✅                   |
| 5   | Mission evidence / execution records             | `mission-runtime` / `mission-controller`; durable stores in `services/api` `PersistenceStores`            | durable mission store                        | Deliberately **indefinite** (integrity/audit)                                                                  | Not purged by design                                                                                                                                                              | ✅ (policy)          |
| 6   | Memory intelligence                              | `packages/memory-intelligence` (`MemoryRetentionPolicy`, `MemoryExpirationService`)                       | `PostgresMemoryRepository`                   | Yes — absolute `expiresAt` per policy at capture                                                               | **Partial** — `expire()` transitions to `expired` and optionally purges ephemeral/short-term, wired at `MemoryApplicationService` (line 551); **no scheduler/cron trigger found** | ⚠ Partial            |
| 7   | Execution memory                                 | `packages/execution-memory`                                                                               | execution-memory store                       | Yes — `retentionDays` → `expiryFor(retentionDays, nowMs)`                                                      | **ENFORCED** — per-entry absolute expiry                                                                                                                                          | ✅                   |
| 8   | Execution traces                                 | `packages/core` `tracing/trace-store.ts`                                                                  | in-process trace store                       | Yes — TTL pruning                                                                                              | **ENFORCED** — `isExpired` prune                                                                                                                                                  | ✅                   |
| 9   | Identity information model                       | `packages/information`                                                                                    | model/constants only                         | Yes — `DEFAULT_RETENTION_DAYS`, `retentionDays` field, `purged` lifecycle state                                | **None** — no consumer outside the package; nothing ever sets `purged`                                                                                                            | ⚠ Gap                |
| 10  | Process logs                                     | services (`hono/logger`), `AuditLogStore`                                                                 | process/stdout, audit store                  | Not specified in-repo                                                                                          | n/a                                                                                                                                                                               | ⚠ Policy open        |
| 11  | GitHub connection tokens                         | `packages/ecosystem-intelligence`                                                                         | connection store                             | Revocation                                                                                                     | **Partial** — local adapter is a documented no-op (`EcosystemIntelligencePorts.ts` line 69–70); real provider revoke unverified locally                                           | ⚠ Unverified (cloud) |
| 12  | Generated artifacts / local evidence logs        | mission outputs; local `.sprint*-*.log`                                                                   | workspace (untracked)                        | n/a                                                                                                            | Not committed                                                                                                                                                                     | ✅                   |

## 2. Deletion paths (authoritative trace)

- **Exposed DELETE is a SOFT archive.** `DELETE /users/:id` →
  `IdentityController.deleteUser` → `identityService.archiveUser(id)`
  (`user.archive()` + `repository.update`). The legacy Hono
  `createIdentityRouter` is **not mounted** by any server.
- **A hard delete exists but is unreachable from production routes.**
  `IdentityApplicationService.deleteUser` calls `repository.delete(userId)` with
  **no cascade** to derived records. Its only caller is its own unit test. No Hono
  route, tRPC procedure or gateway procedure invokes it.
  → Recorded as **latent** (dead code with no auth/cascade semantics), not a live
  defect. Disposition: keep out of any route until a cascade + audit design exists.
- **Latent public identity routers.** `createIdentityTrpcRouter`
  (`services/identity/.../trpc/IdentityRouter.ts`) builds **public** `t.procedure`
  endpoints (no auth) including `archiveUser`, `updateProfile`, `listUsers`,
  `getUserByEmail`. It is exported but referenced **only by its own test** — not
  mounted. Same for the Hono `createIdentityRouter`.
  → Disposition: **latent risk**. If ever mounted it is unauthenticated. Requires
  a product decision (delete vs. guard-then-mount); documented, not invented.

## 3. Access-control verification (live gateway)

The canonical gateway (`services/api/src/services/RouterRegistry.ts`) protects
identity data on two independent layers:

1. **Authentication** — `authProcedure` = `baseProcedure.use(authMiddleware)…`;
   `authMiddleware` calls `isAuthenticated(ctx)` and rejects anonymous callers.
2. **Ownership (IDOR guard)** — the same middleware calls
   `assertUserIdMatchesSession(ctx, rawInput)`, which throws `FORBIDDEN` whenever a
   procedure input carries a `userId` that differs from the session's
   (`services/api/src/middleware/auth.ts` line 135). This applies to every
   authenticated tier (`authProcedure`, `standardProcedure`, `heavyProcedure`,
   `searchProcedure`).

**Verified end-to-end this step.** The prior unit coverage exercised the guard in
isolation and the identity happy path; it did **not** prove the guarantee through
the real pipeline. Added:

- `services/api/src/__tests__/router-registry.test.ts` →
  `identity rejects cross-user profile access (IDOR guard)`: an authenticated
  caller with `userId = 'rr-other-user'` calling
  `identity.getProfile({ userId: 'rr-t-user' })` and `updateProfile({...})` both
  reject with `FORBIDDEN`.

Result: **1 passed** (file: 1 passed / 38 skipped, `-t "IDOR guard"`). This is the
privacy §3 guarantee exercised through the interface the client actually uses.

Exposure tiers without a JWT: `publicProcedure` (health/public reads only) and
`portalProcedure` (token-scoped client portal, IP-rate-limited) — both covered by
the Step 1 matrix.

## 4. Tests covering implemented deletion/retention

| Behavior                                           | Test                                                                                   | Status      |
| -------------------------------------------------- | -------------------------------------------------------------------------------------- | ----------- |
| Soft archive on DELETE                             | `services/identity/__tests__/IdentityController.test.ts` ("archives (deletes) a user") | ✅ existing |
| Archive rejects unknown user (`NotFoundError`)     | `packages/services/src/identity/__tests__/IdentityApplicationService.test.ts`          | ✅ existing |
| Hard delete path                                   | `IdentityApplicationService.test.ts` (service-level only; route-unreachable)           | ✅ existing |
| Cross-user identity read/update denied via gateway | `router-registry.test.ts` (new, §3)                                                    | ✅ **new**  |
| Memory expiration transitions/purge                | `packages/memory-intelligence` expiration tests                                        | ✅ existing |
| Execution-memory expiry                            | `packages/execution-memory` retention tests                                            | ✅ existing |
| Token expiry / reuse                               | `services/identity` VerificationToken/TokenService suites                              | ✅ existing |

## 5. Open policy questions (require a product decision — not invented here)

1. **Account erasure semantics.** Should a user-initiated delete be a hard
   erase-with-cascade (GDPR-style), or is soft archive the intended policy? The
   hard `deleteUser` path exists but is unwired and has no cascade — its intent is
   undocumented. _Decision needed before wiring._
2. **`packages/information` retention enforcement.** `DEFAULT_RETENTION_DAYS`,
   per-type `retentionDays` and the `purged` lifecycle state are declared but
   nothing consumes or reaches them. Should a purge job enforce them, and on what
   cadence? _Adding an arbitrary period would be inventing policy — deferred._
3. **Memory expiration scheduling.** `MemoryExpirationService` is callable but has
   no automatic trigger; memories expire only when `expire()` is invoked. Should a
   periodic sweep (watchdog/scheduler) own this? _Deferred._
4. **Log retention.** Process/audit log retention period and ownership are not
   specified in-repo.
5. **Latent unauthenticated identity routers.** Delete, or authenticate-then-mount?
6. **Live GitHub token revocation.** Unverifiable locally (deterministic adapter is
   a no-op); requires cloud credentials to confirm.

## 6. Disposition

Acceptance for Step 2 is met at the level the repository's product policy supports:
an inventory exists, every category has an owner and a policy status, and every
**implemented** deletion/retention behavior has a test (one new gateway-level
privacy test added). Four gaps are recorded as open with explicit owners-blocks
rather than silently "fixed" with invented retention periods.
