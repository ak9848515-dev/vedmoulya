# SPRINT-041B — Test Report

**Date:** 2026-08-16

## Gates

| Gate                       | Result                                                        |
| -------------------------- | ------------------------------------------------------------- |
| web suite                  | **276/276 PASS** (247 → 276, +29 this sprint)                 |
| identity suite             | **295/295 PASS** (283 → 295, +12 this sprint)                 |
| services/api suite         | **1010/1010 PASS** (unchanged — no regression)                |
| domain suite               | PASS                                                          |
| typecheck (`tsc -b` + api) | **0 errors**                                                  |
| lint (touched workspaces)  | **0 errors · 0 warnings**                                     |
| `next build`               | **PASS** (58/58 pages — +1 onboarding; dev stopped first)     |
| Real-Chrome diag           | **15/15 PASS** (Scenarios A–D, LOCAL TEST accounts)           |
| DB migration               | verified live against Docker Postgres (4 columns, idempotent) |

## Tests added (regression coverage for this sprint's fixes)

### Web — `apps/web/src/components/__tests__/OnboardingRedirect.test.tsx` (10 tests)

Existing 8 + **1 regression test**:

- **"fires when the user lands on a protected route via CLIENT-SIDE navigation
  after signup"** — reproduces D1: renders at `/signup` (excluded, no redirect),
  then rerenders with pathname `/intelligence` → asserts the gate fires with
  `?next=` preserved. This test FAILS against the pre-fix code (the effect
  never re-ran on pathname change).

### Web — `apps/web/src/app/onboarding/profile/__tests__/page.test.tsx` (9 tests)

Existing 8 + **1 regression test**:

- **"resolves ?next= AT SUBMIT TIME — a late-settling query must not be lost"**
  — reproduces D2: renders with no query at mount, then the query settles to
  `?next=/intelligence` before submit → asserts the save redirects to
  `/intelligence` (not `/`). FAILS against the pre-fix mount-time `useMemo`.

### Web — `apps/web/src/auth/__tests__/` (44 tests)

- `auth-api.test.ts`: `getProfile` + `updateProfile` (request shape, envelope
  parsing, auth header, error mapping).
- `session-manager.test.ts`: `refreshProfile` (applies server profile; offline
  keeps cached; no access token → no-op), `completeProfile` (ok path applies
  profile; offline error; server error surfaced).

### Identity — `services/identity/__tests__/` (295 total)

- `AuthService.test.ts`: sign-up/sign-in sessions carry `profileComplete:false`
  for new users; `getProfile` returns the stored profile + completion;
  `updateProfile` persists each field, re-derives completion, and is
  token-scoped.
- `AuthRoutes.test.ts`: `GET /me` (200, 401 unauth), `PATCH /me/profile`
  (200, 401 unauth, validation errors 400, vocabularies enforced).
- `PostgresIdentityRepository.test.ts`: updated the DDL-call assertion to
  include the 4 new idempotent ALTERs.

### Domain — `packages/domain/.../IdentityValueObjects.test.ts`

- `UserProfile.isComplete()`: incomplete (missing any field) → false; all four
  present → true; `with()` merges partial updates.

## Why no new engine tests / benchmark changes

This sprint added no engines and touched no benchmark harnesses — all existing
benchmarks remain green (verified earlier in SPRINT-041; unchanged this sprint).

## Notes

- The `next build` ran with the dev server fully stopped and a fresh `.next`
  (the SPRINT-040 collision rule), then dev was restarted cleanly and the
  15/15 browser diag was re-run green against the restarted server.
