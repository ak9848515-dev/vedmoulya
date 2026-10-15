# VedMoulya — S12 Blocker 4A Closure Report: Durable Refresh-Token Rotation and Revocation

**Date (UTC):** 2026-10-14
**Branch:** `main` · **HEAD:** `a124274b0d1fa91f361e0a5775e144658405913a` (unchanged)
**Blocker:** S024-4A (Sprint 024 §1, Sprint 026 FINAL-REPORT.md §6 condition 4)
**Mode:** focused security closure — smallest durable design on the existing identity/auth architecture. No architecture rebuild, no parallel identity system, no production migration executed.
**Safety:** no commit, push, tag, deploy, credential change, production-data change, stash change, reset, clean, or revert. All five stashes preserved. All pre-existing working-tree changes untouched.

---

## 0. Baseline and preservation evidence

| Item                       | State             | Evidence                                                                                                                    |
| -------------------------- | ----------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Branch                     | `main`            | `git branch --show-current` → `main`                                                                                        |
| HEAD                       | `a124274…913a`    | `git rev-parse HEAD`, unchanged                                                                                             |
| Stashes                    | **5/5 preserved** | `stash@{0}` pre-security-baseline-healthprobe; `stash@{1..3}` lint-staged backups; `stash@{4}` WIP release-candidate-v1.0.0 |
| Pre-existing `M`/`??` tree | untouched         | `git status --short` still shows the Sprint 026 baseline set plus only the files listed in §5                               |
| Referenced evidence paths  | all present       | `BLOCKER-REPORT-S12-PRODUCTION.md` ✓; sprint-024 `FINAL-REPORT.md` ✓; sprint-026 `FINAL-REPORT.md` ✓                        |

---

## 1. Security contract traced before coding

**Lifecycle (actual, source-backed):**

1. **Issuance** — `TokenService.generateTokenPair()` (`TokenService.ts:45`): HS256 access JWT (15m, `type:'access'`) + HS256 refresh JWT (7d, `type:'refresh'`, random `jti`). Called from `signInWithEmail`, `signInWithGoogle`, `signUp`.
2. **Validation** — `verifyRefreshToken()` (`TokenService.ts:105`): signature/issuer/audience + `type` + `sub`/`jti`. **No denylist check existed.**
3. **Rotation** — `refreshSession()` → `refreshAccessToken()`: verify → mint. **No replay detection** — a consumed JTI stayed valid 7 days and could rotate without limit.
4. **Logout** — `signOut(userId)`: `recordLogout()` + event only. **No revocation** — refresh tokens kept working.
5. **Post-logout/rotation refresh** — accepted (the 4A gap). 6. **Expiry** — `jose.jwtVerify` enforces `exp`; no server-side cleanup existed. 7. **Persistence** — no refresh state persisted at all.

**Decisions:** refresh tokens are **self-contained JWTs** (not opaque). Denylist key = **SHA-256 of the JTI only**; raw bearer/refresh tokens are never persisted. Row expiry derives from the new JWT's `exp` (now surfaced on `RefreshTokenPayload.exp`), 7d fallback. **Access tokens have no revocation mechanism** (unchanged): logout kills the refresh family immediately; issued access tokens expire naturally ≤15 min — stated in code/tests, not claimed away. Family-vs-JTI uses an explicit `kind` column so one rotation can never nuke a family; denylist outage fails closed (refresh → `null`; logout revokes before recording and propagates store errors).

---

## 2. Smallest durable design implemented

**New file** (estate convention — `CREATE TABLE IF NOT EXISTS` + `ensureTable`, mirroring `OAuthStateStore`/`VerificationTokenStore`):

- `services/identity/src/infrastructure/persistence/RefreshTokenDenylistStore.ts` — `refresh_token_denylist(id, jti_hash UNIQUE, user_id, kind, revoked_at, expires_at)` + indexes; Postgres + InMemory implementations + env factory (Postgres in production/staging, in-memory otherwise); `revoke` (idempotent) / `isRevoked` (time-bounded) / `revokeForUser` (family marker, `kind='family'`, 7d) / `isUserRevoked` (family rows only) / `cleanup` (expired rows only).

**Modified, no parallel system:**

- `AuthService.ts` — optional `refreshTokenDenylist` (env default); `refreshSession()` fail-closed denylist+family check before minting, revokes presented JTI after minting, `null` on store failure; `signOut(userId, presentedRefreshToken?)` revokes family first, then the presented JTI, then records logout. Optional 2nd param — existing callers compile unchanged.
- `AuthRoutes.ts` — `POST /sign-out` accepts optional `{ refreshToken }` (backward compatible) and forwards it.
- `TokenService.ts` — `RefreshTokenPayload` surfaces `exp`/`iat`; verification semantics unchanged.
- `IdentityModule.ts` — registers `identity.refresh-token-denylist` (idempotent bootstrap, fire-and-forget) and injects it.
- No production config changed; no production migration executed.

---

## 3. Regression coverage (all green, executed)

| Suite                  | Command (in `services/identity`)                                                   | Exit | Result                                                                                                                                          |
| ---------------------- | ---------------------------------------------------------------------------------- | ---- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| New denylist store     | `npx vitest run __tests__/RefreshTokenDenylistStore.test.ts`                       | 0    | **5/5** — hash-only storage, idempotent single-use, rotation≠family, expiry-bounded revocation, cleanup keeps live evidence, no false positives |
| New rotation lifecycle | `npx vitest run __tests__/RefreshTokenRotation.test.ts`                            | 0    | **3/3** — rotate-once-then-replay-rejected, logout-revokes-family, outage-fails-closed                                                          |
| Route contract         | `npx vitest run __tests__/AuthRoutes.test.ts __tests__/AuthRoutesExtended.test.ts` | 0    | green incl. new S024-4A forwarding test + updated single-arg assertions                                                                         |
| Focused total          | the four files in one run                                                          | 0    | **4 files · 71/71 passed**                                                                                                                      |
| Full identity suite    | `npx vitest run`                                                                   | 0    | **all files passed, 0 failed** (output-tail `error` lines are expected log lines from fail-closed negative tests)                               |
| Typecheck              | `npx tsc --noEmit -p .`                                                            | 0    | clean                                                                                                                                           |

Pre-existing tests touched: `AuthRoutes.test.ts` (`signOut` → `('u1', undefined)` + new forwarding test), `AuthRoutesExtended.test.ts` (`('user-1', undefined)`). No test weakened, skipped, or suppressed. (`IdentityRoutes.test.ts`/`IdentityRoutes.ts` diffs are pre-existing baseline changes, not mine.)

---

## 4. S12 reconsideration — condition 4 evidence

Sprint 026 FINAL-REPORT.md §6 condition 4 required: _"An approved migration implementing a durable JWT denylist table is merged, closing the logout revocation gap (4A)."_ Evidence delivered (uncommitted working tree, HEAD unchanged):

- Migration: `PostgresRefreshTokenDenylistStore.ensureTable()` — idempotent `CREATE TABLE IF NOT EXISTS refresh_token_denylist` + indexes, bootstrapped from `IdentityModule` in production/staging; **not executed against production** (no prod credentials used, no deployment).
- Enforcement: revocation checked in the actual refresh path (`AuthService.refreshSession`); logout invalidates the family (`signOut` → `revokeForUser`); rotation is single-use (presented JTI revoked post-mint, idempotent); expiry + `cleanup()` bound retention without deleting live replay evidence; fail-closed on store failure.
- Verification: the table above (71/71 focused, full suite green, typecheck clean).

---

## 5. Files changed (this sprint only)

| File                                                                            | Change                                                           |
| ------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| `services/identity/src/infrastructure/persistence/RefreshTokenDenylistStore.ts` | **new** — store, schema bootstrap, Postgres + in-memory, factory |
| `services/identity/src/auth/AuthService.ts`                                     | denylist wiring, rotation + family revocation, fail-closed paths |
| `services/identity/src/auth/AuthRoutes.ts`                                      | optional `refreshToken` on `/sign-out`                           |
| `services/identity/src/auth/TokenService.ts`                                    | `exp`/`iat` surfaced on `RefreshTokenPayload`                    |
| `services/identity/src/infrastructure/di/IdentityModule.ts`                     | store registration + injection                                   |
| `services/identity/__tests__/RefreshTokenDenylistStore.test.ts`                 | **new** — 5 store tests                                          |
| `services/identity/__tests__/RefreshTokenRotation.test.ts`                      | **new** — 3 lifecycle tests                                      |
| `services/identity/__tests__/AuthRoutes.test.ts`                                | updated assertion + new forwarding test                          |
| `services/identity/__tests__/AuthRoutesExtended.test.ts`                        | updated assertion                                                |
| `docs/audits/2026-10-14-quality-sprint-026/S12-BLOCKER-4A-CLOSURE.md`           | this report                                                      |

Remaining S12 blockers (unchanged, operator-gated): S012-A identity database, S012-B provider billing credits, S012-C staging DR drill — see `BLOCKER-REPORT-S12-PRODUCTION.md`.

**Verdict: S024-4A CLOSED with evidence.** The stateless-JWT logout-revocation gap is fixed by the smallest durable design on the existing architecture: rotation is single-use, logout revokes the refresh family durably, replay fails closed, and raw tokens are never persisted.
