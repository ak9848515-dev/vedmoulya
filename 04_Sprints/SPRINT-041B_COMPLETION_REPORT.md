# SPRINT-041B — COMPLETION REPORT

**Status:** 🟢 **COMPLETE (2026-08-16)**
**Type:** Verification + minimal rectification sprint
**NEW ENGINES CREATED: 0**

---

## 1. Executive verdict

🟢 **GREEN.** The first-login profile setup experience did **not** exist and was
**not** wired to the authentication lifecycle — this sprint built the missing
stack (domain → persistence → API → web client → UI → central gate) entirely
over the existing Identity Service and web auth architecture, then **verified
the full journey end-to-end in real Chrome (15/15 PASS)** with clearly-marked
LOCAL TEST accounts. Two genuine defects surfaced by live verification (the
gate not firing on client-side navigation; `?next=` lost on late-settling
queries) were fixed with minimal, convention-following corrections and locked
in with regression tests. No new engine was created; no production safeguard
was weakened; Google OAuth is untouched.

## 2. Existing profile implementation (before this sprint)

- **UI:** none. No `/onboarding` or `/profile` route; the `/settings` Profile
  tab was a static placeholder with a dead Save button.
- **API:** `PATCH /users/:id/profile` existed in `createIdentityRouter` but was
  unauthenticated, IDOR-shaped, and NOT mounted in the web app.
- **Persistence:** `UserProfile` persisted displayName/givenName/familyName/
  avatarUrl/bio/timezone/locale. **No age/gender/purpose/primaryGoal.**
- **Completion state:** did not exist anywhere.

## 3. Existing first-login routing

None. Nothing distinguished new from returning users; SPRINT-041A's signup
sent new users straight to their destination.

## 4. Root cause of the missing flow

The profile/onboarding requirement existed only in product direction — the
estate had no domain fields, no completion state, no authenticated profile API,
no UI, and no gate. SPRINT-041B added exactly those pieces in the smallest
architecture-consistent way.

## 5. Files changed

**Domain**

- `packages/domain/src/identity/value-objects/UserProfile.ts` (+age/gender/
  purpose/primaryGoal + `isComplete()`)
- `packages/domain/src/identity/factory/UserFactory.ts` (reconstruction pass-
  through)
- `packages/domain/src/identity/value-objects/__tests__/IdentityValueObjects.test.ts`

**Persistence**

- `services/identity/src/schema/users.ts` (+4 idempotent columns)
- `services/identity/src/infrastructure/persistence/PostgresIdentityRepository.ts`
- `services/identity/__tests__/PostgresIdentityRepository.test.ts`

**Identity service**

- `services/identity/src/presentation/validation/IdentitySchemas.ts`
- `services/identity/src/auth/AuthService.ts` (+getProfile/updateProfile,
  `profileComplete` in sessions)
- `services/identity/src/auth/AuthRoutes.ts` (+GET /me, PATCH /me/profile)
- `packages/services/src/identity/IdentityApplicationService.ts`
- `packages/services/src/identity/UserDTO.ts`
- `packages/services/src/identity/UserMapper.ts`
- `packages/services/src/identity/__tests__/UserMapper.test.ts`
- `services/identity/__tests__/AuthService.test.ts`, `AuthRoutes.test.ts`

**Web client**

- `apps/web/src/auth/auth-api.ts` (+getProfile/updateProfile)
- `apps/web/src/auth/session-manager.ts` (+refreshProfile/completeProfile)
- `apps/web/src/stores/auth-store.ts` (+profileComplete, setProfile)
- `apps/web/src/auth/__tests__/auth-api.test.ts`, `session-manager.test.ts`

**Web UI**

- `apps/web/src/app/onboarding/profile/page.tsx` (NEW)
- `apps/web/src/components/OnboardingRedirect.tsx` (NEW — central gate)
- `apps/web/src/components/Providers.tsx` (mount gate)
- `apps/web/src/app/onboarding/profile/__tests__/page.test.tsx` (NEW)
- `apps/web/src/components/__tests__/OnboardingRedirect.test.tsx` (NEW)

## 6. Exact rectification

Two defects found during live verification were fixed:

1. **D1 — gate never fired on client-side navigation.** The gate effect lacked
   a pathname dependency; after signup's client-side `router.replace(next)` it
   never re-evaluated. **Fix:** `OnboardingRedirect` now uses `usePathname()`
   as an effect dependency, re-firing on every route change. Regression test
   added.
2. **D2 — `?next=` lost on late-settling query.** The onboarding page captured
   `next` in a mount-time `useMemo` (`[]` deps), which could capture `/` when
   the query settled after first render. **Fix:** `?next=` is resolved at the
   point of use (submit handler + complete-user effect). Regression test added.

## 7. Profile fields verified

Name (prefilled from session), Age (13–120), Gender (closed vocabulary),
Purpose (closed vocabulary), Primary Goal (1–200) — collected via existing
`@vedmoulya/ui` components; validated client-side (mirroring the server zod
contract) with the backend authoritative.

## 8. Registration → profile → destination flow

Verified live (Scenario A): `/login?next=/intelligence` → Create Account →
`/signup` → registration (201) → session applied (`profileComplete=false`) →
gate fires at `/intelligence` → `/onboarding/profile?next=%2Fintelligence` →
fill + save → `PATCH /me/profile` (200) → `/intelligence`. ✅

## 9. Returning-user flow

Verified live (Scenarios A11 + B): completed user signs in → default
destination (`/`), never onboarding; logout/login preserves completion. ✅

## 10. Direct protected-route flow

Verified live (Scenario C): incomplete user goes directly to `/intelligence` →
redirected to `/onboarding/profile?next=%2Fintelligence`. ✅

## 11. Google first-login flow

**Structurally verified** — a new Google user is auto-registered with
`displayName` and no profile fields, so `isComplete()` is false and the same
gate applies. NOT executed live (no OAuth credentials in the local runtime).
Google code is untouched.

## 12. Persistence verification

4 new columns migrated onto the real Docker Postgres `users` table via the
existing idempotent `ensureTable` (verified live: pre-existing table, columns
added, idempotent on repeat). Profile survives refresh (A9) and logout/login
(A11/B1). Server state is authoritative.

## 13. Security verification

See `SPRINT-041B_SECURITY_AUDIT.md` — 14/14 checks pass; token-derived
ownership (no IDOR), 401 without auth, no secrets logged, no browser→DB path,
production rules unchanged, Google untouched.

## 14. Browser verification

Real Chrome (Playwright), fresh LOCAL TEST accounts only: **15/15 PASS**
(A1–A11, B1, C1–C2, D1). No fabricated verification.

## 15. Regression tests

+2 regression tests for the two live-found defects (fail against pre-fix code),
plus profile/session/client tests: web **276/276**, identity **295/295**,
api **1010/1010**, domain PASS.

## 16–18. Typecheck / Lint / Build

typecheck **0 errors** · lint **0 errors / 0 warnings** · `next build` **PASS**
(58/58 pages, dev stopped first, clean restart after).

## 19. Known limitations

- Google first-login not executed live (no credentials); structurally covered.
- Profile completion is presence-based; a full profile-edit screen (e.g. the
  `/settings` tab) remains a follow-up.
- The pre-existing unauthenticated `PATCH /users/:id/profile` identity route is
  not web-exposed but should be hardened/removed as follow-up.

## 20. NEW-ENGINE STATEMENT

**NEW ENGINES CREATED: 0.** No ProfileEngine, OnboardingEngine, UserEngine,
IdentityEngine, JourneyEngine, duplicate profile service, or duplicate
authentication service. All changes compose the existing Identity Service,
existing web auth lifecycle, existing domain entities, existing persistence,
and existing UI components.

---

## Next highest-value follow-up (evidence-based)

**Profile/settings edit surface + Google first-login live verification.** A
real founder can now register and complete first-login setup in the browser
(proven). The two remaining gaps to "real founder operation" are: (1) wiring the
existing `/settings` Profile tab to `PATCH /me/profile` so returning users can
update their profile, and (2) executing the Google first-login journey with a
real OAuth credential in an operator-run environment. Both are pure composition
over the now-verified estate.
