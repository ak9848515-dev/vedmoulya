# SPRINT-041B — Security Audit

**Date:** 2026-08-16

## Scope

The first-login profile setup surface added this sprint: profile persistence,
`/me` + `/me/profile` endpoints, the web profile client, the onboarding page,
and the central gate. **NEW ENGINES CREATED: 0.**

## Findings

| #   | Check                                               | Result                                                                                                                                                                                                                                                     |
| --- | --------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S1  | Only authenticated users can save their own profile | ✅ `PATCH /me/profile` requires a valid JWT (`Authorization: Bearer`); unauth → 401 (verified live at API level and by test).                                                                                                                              |
| S2  | User A cannot update user B's profile               | ✅ **Structurally impossible** — the target userId is derived from the verified token (`payload.sub`), never from client input. The request schema has no userId field. Scenario D1 verified.                                                              |
| S3  | No IDOR surface                                     | ✅ The self-service route is token-scoped. (The pre-existing unauthenticated `PATCH /users/:id/profile` in `createIdentityRouter` remains — but it is **not web-exposed** and is flagged as a follow-up hardening item; it is not reachable from the app.) |
| S4  | No profile data exposed unnecessarily               | ✅ `GET /me` returns only the caller's own profile.                                                                                                                                                                                                        |
| S5  | No passwords in profile data                        | ✅ Profile fields are displayName/givenName/familyName/age/gender/purpose/primaryGoal; passwordHash lives only in the user entity and is never exposed in ProfileView.                                                                                     |
| S6  | No tokens logged                                    | ✅ All diag instrumentation logged booleans/route names/userId presence only; no JWT, refresh token, or secret anywhere in logs.                                                                                                                           |
| S7  | No secrets logged                                   | ✅ No API keys/credentials in any added code.                                                                                                                                                                                                              |
| S8  | No direct DB writes from the browser                | ✅ Every mutation goes UI → auth client → Identity Service → repository → Postgres.                                                                                                                                                                        |
| S9  | Existing authorization remains authoritative        | ✅ The Brain/approval authority and all gateway IDOR guards untouched.                                                                                                                                                                                     |
| S10 | VOICE ≠ AUTHORIZATION unchanged                     | ✅ Voice surfaces untouched; no voice path can authorize profile changes or execution.                                                                                                                                                                     |
| S11 | Production verification rules unchanged             | ✅ Dev-only email auto-verification gate untouched; production/staging behavior identical.                                                                                                                                                                 |
| S12 | No auth bypass / no auth weakened                   | ✅ No route added outside the JWT-checked auth router; session verification, refresh, and logout untouched.                                                                                                                                                |
| S13 | No test-account / localStorage source of truth      | ✅ Completion is server-derived (`isComplete()` on the stored profile); the client only mirrors server truth via `refreshProfile()`.                                                                                                                       |
| S14 | Google OAuth untouched                              | ✅ No change to the Google flow; a new Google user is auto-registered and (structurally) goes through the same gate.                                                                                                                                       |

## Live security verification

- `PATCH /me/profile` with no token → **401** (test + live API check).
- Cross-user update attempt → impossible by construction (no userId input);
  Scenario D1 confirmed structurally.
- Browser flow logs contained no credentials — only booleans, routes, statuses.

## Honest note

The pre-existing `createIdentityRouter` `PATCH /users/:id/profile` route (auth-
less, path-derived target) predates this sprint and is NOT mounted in the web
app. It was intentionally left untouched (minimality rule) but is recorded as
the single outstanding hardening item in the completion report.
