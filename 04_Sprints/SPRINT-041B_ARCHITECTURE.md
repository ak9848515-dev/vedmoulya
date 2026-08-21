# SPRINT-041B — Architecture: First-Login Profile Setup

**NEW ENGINES CREATED: 0.** Everything below composes the EXISTING estate —
no new engine, no second repository, no second session implementation.

## The first-login contract

```
NEW USER
   ↓
Create Account (/signup)
   ↓
Authenticated (existing applySession lifecycle)
   ↓
PROFILE COMPLETENESS CHECK (server-derived, single central gate)
   ↓
/onboarding/profile?next=<original destination>   (incomplete)
   ↓
Complete mandatory profile: Name, Age, Gender, Purpose, Primary Goal
   ↓
PATCH /me/profile → Identity Service → Postgres (profileComplete=true)
   ↓
router.replace(?next)  →  intended destination
```

Returning users with a completed profile NEVER see onboarding.

## Layers

### 1. Domain — `packages/domain/src/identity/value-objects/UserProfile.ts`

- Added `age`, `gender`, `purpose`, `primaryGoal` (all optional at the domain
  level; optionality is what makes "completion" meaningful).
- Added `isComplete(): boolean` — true when all four onboarding fields are
  present (displayName is already mandatory at registration). Deterministic;
  the **server** derives first-login state from this. No client flags.
- `with(props)` already supported partial updates — reused unchanged.
- `UserFactory` reconstruction passes the new fields through (no behavior change).

### 2. Persistence — `services/identity/src/schema/users.ts` + repository

- 4 additive, idempotent columns on the existing `users` table:
  `age INTEGER`, `gender TEXT`, `purpose TEXT`, `primary_goal TEXT` — added via
  `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` inside the EXISTING `ensureTable`
  bootstrap (verified live: ran against the real Docker Postgres `users` table
  on first auth call; idempotent on restart).
- `PostgresIdentityRepository` maps the new columns into/out of `UserProfile`
  (save + findById/findByEmail reconstruction).
- No new table, no new framework — the shared persistence bundle is unchanged.

### 3. Identity service — `services/identity/src/auth/`

- **`GET /api/v1/identity/auth/me`** — the JWT-authenticated read of the
  caller's own profile (userId from token → IDOR-impossible).
- **`PATCH /api/v1/identity/auth/me/profile`** — validated partial update of
  the caller's own profile through the EXISTING entity + repository. Accepts
  `displayName/givenName/familyName/age/gender/purpose/primaryGoal`; returns
  the updated `ProfileView` including server-derived `profileComplete`.
- `AuthSession` now carries `profileComplete` (server-derived) so sign-up /
  sign-in / Google sessions tell the client first-login state immediately.
- Validation: closed vocabularies for `gender` and `purpose` (the identity
  profile's own options — the estate had no shared taxonomy), age 13–120,
  name 2–100, goal 1–200. The backend remains authoritative.
- The pre-existing unauthenticated `PATCH /users/:id/profile` in
  `createIdentityRouter` is **not web-exposed** (web mounts only the auth
  router) and was left untouched (out of scope; flagged in the completion
  report as a follow-up hardening item).

### 4. Web client — `apps/web/src/auth/` + `stores/auth-store.ts`

- `auth-api.ts`: `getProfile(accessToken)` and `updateProfile(accessToken,
data)` against the new `/me` + `/me/profile` routes (same envelope/error
  conventions as the rest of the client).
- `auth-store.ts`: `AuthUser.profileComplete?: boolean` and `setProfile()`
  action (server-authoritative merge, never a client-only flag).
- `session-manager.ts`:
  - `refreshProfile()` — re-fetches `/me` after every session restore (and
    after save) so first-login routing always reflects server state; offline-
    safe (a network failure keeps the cached profile, never logs out).
  - `completeProfile(data)` — saves via the existing API and applies the
    returned server state.
- `secure-store.ts` / persist — unchanged (`vedmoulya-auth` key).

### 5. Web UI — `apps/web/src/app/onboarding/profile/page.tsx`

- Collects exactly Name (prefilled from session), Age, Gender (select), Purpose
  (select), Primary Goal — using the existing `@vedmoulya/ui` `TextField` /
  `Select` / `Button` / `Card` components and the same visual language as
  `/signup` and `/login`.
- Client-side validation mirrors the server zod contract (UX only); backend
  errors display verbatim.
- `?next=` is resolved at the point of use (submit handler + complete-user
  effect) — never cached at mount (D2 fix).
- Completed users are routed away immediately (never see onboarding again).

### 6. Central gate — `apps/web/src/components/OnboardingRedirect.tsx`

- Mounted ONCE in `Providers` (root layout) — no per-page wiring.
- Fires ONLY on explicit server-derived `profileComplete === false`; never on
  `undefined` (legacy persisted sessions and in-flight refresh are never
  bounced until the server confirms).
- Auth-flow screens excluded (`/login`, `/signup`, `/oauth2redirect`,
  `/onboarding/profile`) — no redirect loop.
- Watches `usePathname()` so it re-evaluates on every client-side route change
  (D1 fix) — the single point where registration lands an incomplete user on
  first-login setup.

## State flow (authoritative source of truth)

```
UI form → session-manager.completeProfile() → auth-api.updateProfile()
  → PATCH /api/v1/identity/auth/me/profile (JWT)
  → AuthService.updateProfile(userId-from-token, data)
  → UserProfile.with(data) → user.updateProfile() → repository.update()
  → Postgres users row
  → ProfileView { profileComplete: isComplete() } returned
  → auth-store.setProfile() → gate + pages see server truth
```

## What was deliberately NOT created

- No ProfileEngine / OnboardingEngine / UserEngine / JourneyEngine.
- No second profile repository, no direct DB writes from the browser.
- No second session implementation, no parallel token persistence.
- No parallel gender/purpose taxonomy beyond the identity profile's own
  options (the estate had none).
- No automatic verification added to production; dev-only auto-verification
  unchanged.
