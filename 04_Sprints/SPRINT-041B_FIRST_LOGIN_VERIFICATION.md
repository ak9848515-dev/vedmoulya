# SPRINT-041B — First-Login Flow Verification

**Date:** 2026-08-16
**Result:** 🟢 **15/15 PASS** in real Chrome (Playwright) — LOCAL TEST accounts only.

## Scenarios verified

### Scenario A — fresh user first-login profile (11 checks)

| #   | Check                                                              | Result |
| --- | ------------------------------------------------------------------ | ------ |
| A1  | /login → "Create an account" → /signup, `?next=` preserved         | ✅     |
| A2  | after registration → **/onboarding/profile (gate fired)**          | ✅     |
| A3  | `?next=/intelligence` preserved on onboarding                      | ✅     |
| A4  | "Complete your profile" rendered                                   | ✅     |
| A5  | Required fields present (Name, Age, Gender, Purpose, Primary Goal) | ✅     |
| A6  | Empty submit blocked by validation (age required)                  | ✅     |
| A7  | No navigation on invalid submit                                    | ✅     |
| A8  | Save → original `?next` destination (/intelligence)                | ✅     |
| A9  | Refresh keeps session at /intelligence — **no onboarding bounce**  | ✅     |
| A10 | Logout → /login                                                    | ✅     |
| A11 | Completed user re-login → destination, **NOT onboarding**          | ✅     |

### Scenario B — completed user login bypasses onboarding (1 check)

| #   | Check                                                            | Result |
| --- | ---------------------------------------------------------------- | ------ |
| B1  | Completed user signs in → default destination (/), no onboarding | ✅     |

### Scenario C — incomplete user direct protected-route access (2 checks)

| #   | Check                                                         | Result |
| --- | ------------------------------------------------------------- | ------ |
| C1  | Direct /intelligence as incomplete user → /onboarding/profile | ✅     |
| C2  | `?next=/intelligence` preserved through the gate              | ✅     |

### Scenario D — cross-user update (structural, 1 check)

| #   | Check                                                                                                | Result |
| --- | ---------------------------------------------------------------------------------------------------- | ------ |
| D1  | Profile save has NO userId field — target derived from verified JWT; IDOR impossible by construction | ✅     |

## Defects found and fixed during verification

### D1 — Gate never fired on client-side navigation (ROOT CAUSE of the original failure)

- **Symptom:** after registration the user landed on `/intelligence` instead of
  `/onboarding/profile` — yet direct URL access to `/intelligence` as an
  incomplete user DID redirect. Inconsistent behavior.
- **Root cause:** `OnboardingRedirect`'s effect depended on
  `[hydrated, sessionReady, user, router]` — **not the pathname**. The effect
  ran once at mount on `/signup` (an excluded auth-flow screen) and never
  re-ran when signup's `router.replace(next)` navigated to `/intelligence`
  (client-side navigation does not remount `Providers`).
- **Fix:** the gate now reads `usePathname()` and includes it in the effect
  deps, re-evaluating on every client-side route change.
- **Proof:** browser trace showed the gate effect firing at `/intelligence`
  after the signup redirect, routing to `/onboarding/profile?next=%2Fintelligence`.

### D2 — `?next=` lost when the query settled after first render

- **Symptom:** after saving the profile, the user landed on `/` instead of
  `/intelligence` even though the URL was `/onboarding/profile?next=%2Fintelligence`.
- **Root cause:** the onboarding page captured `next` in a mount-time `useMemo`
  (`[]` deps). On a client-side landing the query string can be unsettled
  during first render, so the memo captured `/` and never recomputed — the
  submit handler redirected with the stale value.
- **Fix:** `?next=` is now resolved **at the point of use** (in the submit
  handler and in the complete-user redirect effect), never cached at mount.
- **Proof:** save-time log showed `next=/intelligence` with the query present,
  and the user landed on `/intelligence`.

## Browser flow captured (Scenario A trace)

```
/login?next=/intelligence
  → Create an account
  → /signup?next=/intelligence
  → POST /api/v1/identity/auth/sign-up (201)
  → applySession (user.profileComplete=false — server-derived)
  → router.replace('/intelligence')  [client-side]
  → OnboardingRedirect re-fires at /intelligence (D1 fix)
  → /onboarding/profile?next=%2Fintelligence
  → empty submit → validation blocks (age required)
  → fill Name(prefilled)/Age/Gender/Purpose/Primary Goal
  → PATCH /api/v1/identity/auth/me/profile (200, profileComplete=true)
  → router.replace(resolveNext())  [D2 fix]
  → /intelligence
  → refresh → session + completion intact, no bounce
  → logout → /login
  → re-login → / (no onboarding)
```

## Security checks observed during the live flow

- `PATCH /me/profile` without a token → 401 (verified at API level).
- No userId in the profile-save payload — token-derived target only.
- No credentials/JWTs logged anywhere (all diag logs used booleans, route
  names, and userId presence).
- No direct DB access from the browser — every mutation goes through the
  existing Identity Service via the web auth client.
