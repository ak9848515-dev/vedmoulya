# SPRINT-041B — Baseline Audit

**Date:** 2026-08-16
**Type:** Verification + minimal rectification

## Determination

**PHASE 2 DETERMINATION: D + E** — _profile persistence exists but UI is
missing_ (partially) **AND** _neither UI nor first-login state exists_.

Concretely:

- **E — No profile/onboarding page exists.** There is no `/onboarding`, no
  `/profile` route. The `/settings` page has a "Profile" tab that renders
  **static placeholder content** (hardcoded values; the Save button calls
  nothing). It was never wired to any backend.
- **E — No first-login detection/routing exists.** Nothing distinguishes a new
  user from a returning one; no code redirects an incomplete user to profile
  setup.
- **D — Partial persistence exists for the NAME only.** `UserProfile`
  (packages/domain) persisted `displayName/givenName/familyName/avatarUrl/
bio/timezone/locale`. The required **Age, Gender, Purpose, Primary Goal** had
  **no persistence representation anywhere** in the identity domain.
- **The identity `PATCH /users/:id/profile` route existed but was
  unauthenticated** (no auth middleware on `createIdentityRouter`) and IDOR-
  vulnerable (target from the path, not the token) — which is why the web app
  mounts only the auth router (`/api/v1/identity/auth/[...path]`), never the
  profile router.

## Discovery evidence

| Area                                                          | Finding                                                                                                                                                                                        |
| ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/web/src/app/`                                           | No profile/onboarding route. `/settings` Profile tab = static placeholder, dead Save.                                                                                                          |
| `apps/web/src/auth/`                                          | `auth-api.ts`, `session-manager.ts`, `secure-store.ts`, `config.ts` — complete auth lifecycle (sign-in/up, refresh, restore, OAuth). No profile calls.                                         |
| `apps/web/src/stores/auth-store.ts`                           | Zustand + persist (`vedmoulya-auth` key). No profile state.                                                                                                                                    |
| `services/identity/src/auth/AuthRoutes.ts`                    | Sign-up/in/out, session, Google, refresh. No `/me` profile endpoints.                                                                                                                          |
| `services/identity/src/presentation/routes/IdentityRoutes.ts` | `createIdentityRouter` with `PATCH /users/:id/profile` — **no auth middleware, IDOR surface** (target from path).                                                                              |
| `packages/domain/src/identity/value-objects/UserProfile.ts`   | No age/gender/purpose/primaryGoal. No completeness concept.                                                                                                                                    |
| `packages/services/src/learning/LearningProfileService.ts`    | Career/learning profiles exist in other domains — **no gender/age/purpose/goal vocabulary shared** with the identity domain.                                                                   |
| Canonical docs                                                | SPRINT-040 verified the auth runtime; no onboarding/profile definition existed beyond the "previously established" first-login profile requirement (Name, Age, Gender, Purpose, Primary Goal). |

## What already worked (left unchanged)

- Identity Service sign-up/sign-in/session/refresh/sign-out (SPRINT-040).
- Web auth lifecycle: `applySession`, persist, `restoreSession`, offline
  behavior, single-flight refresh, Google OAuth flow.
- `SignInRedirect` used by 40+ protected pages.
- Dev-only email auto-verification gate (production/staging unchanged).

## What was missing (this sprint's scope)

1. Profile fields + server-derived completion state (domain + persistence).
2. Authenticated self-service `/me` + `/me/profile` endpoints (IDOR-free).
3. Web client profile surface (`refreshProfile` / `completeProfile`).
4. `/onboarding/profile` page collecting the 5 required fields.
5. A single central first-login gate (`OnboardingRedirect`) — no per-page checks.

## Boundary rules honored

- Server state is authoritative for completion — **no localStorage-only flags**,
  no email matching, no test-account detection, no hardcoded user IDs.
- No direct DB writes from the browser; no second profile repository; no second
  session implementation; Google OAuth untouched.
- Production verification rules unchanged; dev-only auto-verification untouched.
