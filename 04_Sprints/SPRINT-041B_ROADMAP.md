# SPRINT-041B — First-Login Profile Setup Verification + Rectification

**Status:** 🟢 COMPLETE (2026-08-16)
**Type:** Verification + minimal rectification sprint
**NEW ENGINES CREATED: 0**

## Mission

Verify — and only where necessary rectify — the VedMoulya first-login profile
setup experience: `Create Account → Authenticated → FIRST-LOGIN PROFILE SETUP →
Complete mandatory profile → Save → Intended destination`.

The sprint was explicitly constrained to compose the EXISTING estate (Identity
Service, session-manager, auth-store, existing UI components, existing
persistence). No ProfileEngine, OnboardingEngine, UserEngine, JourneyEngine or
duplicate identity/profile service was created.

## Why this sprint exists

SPRINT-041A added the registration UI (`/signup`) and verified it end-to-end.
But a freshly registered user went straight to their requested destination with
no first-login profile setup — even though the product direction established a
mandatory first-login profile (Name, Age, Gender, Purpose, Primary Goal).

## What the sprint established

1. **Determination: D + E** — no `/onboarding`/`/profile` page existed; the
   `/settings` "Profile" tab was a static placeholder with a dead Save button;
   no first-login detection or routing existed; the profile-completion state
   did not exist; the required Age/Gender/Purpose/Primary Goal fields had no
   persistence representation; the identity `PATCH /users/:id/profile` route
   was unauthenticated (IDOR-vulnerable) and not web-exposed.
2. **Minimal architecture-consistent additions** (all composing the existing
   estate):
   - Domain: `UserProfile` gained `age/gender/purpose/primaryGoal` + a
     deterministic `isComplete()` — the SERVER is the source of first-login
     state, never client flags.
   - Persistence: 4 additive `ALTER TABLE users ADD COLUMN IF NOT EXISTS`
     statements in the existing idempotent `ensureTable` bootstrap.
   - API: `GET /api/v1/identity/auth/me` + `PATCH /api/v1/identity/auth/me/profile`
     — JWT-authenticated, userId derived from the token (no IDOR surface).
   - Web: `useAuthStore.setProfile`, `session-manager.refreshProfile() /
completeProfile()`, the `/onboarding/profile` page, and the single central
     `OnboardingRedirect` gate mounted once in `Providers`.
3. **Two genuine defects found in live verification and fixed:**
   - **D1 — gate never fired on client-side navigation.** The gate effect
     depended only on `[hydrated, sessionReady, user, router]`; after
     registration the signup page navigates with `router.replace(next)` (client-
     side, no remount), so the gate never re-evaluated the new pathname.
     Fix: gate now watches `usePathname()` so it re-runs on every route change.
   - **D2 — `?next=` lost when the query settled after first render.** The
     onboarding page captured `next` in a mount-time `useMemo` (`[]` deps); on a
     client-side landing the query could be unsettled during first render, so a
     stale `/` was captured and the founder was redirected to `/` instead of
     `/intelligence`. Fix: `?next=` is resolved AT THE POINT OF USE (submit
     handler + complete-user effect), never cached.
4. **Real-Chrome verification: 15/15 PASS** across Scenarios A–D.

## Verification gates

| Gate                       | Result                                                       |
| -------------------------- | ------------------------------------------------------------ |
| web tests                  | **276/276 PASS** (+2 regression tests for D1/D2)             |
| typecheck (`tsc -b` + api) | **0 errors**                                                 |
| lint (touched workspaces)  | **0 errors · 0 warnings**                                    |
| `next build`               | **PASS** (58/58 pages) — dev stopped first (SPRINT-040 rule) |
| Real-Chrome Scenarios A–D  | **15/15 PASS** (LOCAL TEST accounts only)                    |
| identity suite             | **295/295 PASS** (earlier this sprint)                       |
| services/api suite         | **1010/1010 PASS** (earlier this sprint)                     |
| domain suite               | PASS (earlier this sprint)                                   |

## Honest limitations

- **Google first-login** was verified structurally (a new Google user is
  auto-registered with `displayName` and no profile fields → `profileComplete:
false` → the same gate applies), but not executed live — no Google OAuth
  credentials exist in the local runtime.
- Profile "completion" is presence-based (`isComplete()`); there is no
  re-onboarding / profile-edit screen beyond the first-login save (the
  `/settings` tab remains a placeholder — untouched, out of scope).
- The `PATCH /users/:id/profile` identity route remains unauthenticated but is
  **not web-exposed** (only the auth router is mounted in the web app); the
  self-service path used by the UI is the new token-derived `/me/profile`.

## Files changed (this sprint)

See `SPRINT-041B_COMPLETION_REPORT.md` for the full list.

## Next step (evidence-based)

A real founder can now register and complete first-login profile setup entirely
in the browser. The next highest-value follow-up is a **profile/settings edit
surface** (reuse the existing `/settings` tab) so returning users can update the
fields the identity service now persists — and wiring the Google first-login
flow through the same gate with a real OAuth credential in an operator-run
environment.
