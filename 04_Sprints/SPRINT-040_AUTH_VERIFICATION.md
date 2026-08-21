# SPRINT-040 — Authentication Verification

**Result:** 🟢 VERIFIED — the existing Identity Service (no users inserted
directly into PostgreSQL; no hardcoded credentials in source) now completes the
full registration → session lifecycle against the local Docker Postgres.

Surface: `POST /api/v1/identity/auth/sign-up` (email, password, displayName,
optional givenName/familyName) served in-process by the web app.

---

## 1. Live results (LOCAL TEST accounts, `@vedmoulya.local`, `LOCAL TEST`-marked)

| #   | Step                                                           | Result                                                       |
| --- | -------------------------------------------------------------- | ------------------------------------------------------------ |
| 1   | Sign-up (valid input)                                          | **201** `{success:true, data:{userId, email, role, tokens}}` |
| 2   | Duplicate email sign-up                                        | **409** `REGISTRATION_FAILED — "Email already registered"`   |
| 3   | Invalid input (bad email / short password / short displayName) | **400** `VALIDATION_ERROR` with per-field details            |
| 4   | Sign-in (correct credentials)                                  | **200** session with access + refresh tokens                 |
| 5   | Sign-in (wrong password)                                       | **401** `AUTH_FAILED — "Invalid email or password"`          |
| 6   | Session verification (Bearer access token)                     | **200** `{userId, email, role}`                              |
| 7   | Sign-out                                                       | **200** `{success:true}`                                     |
| 8   | Session verification without token                             | **401** `NO_TOKEN`                                           |

## 2. Verification details

- **No direct DB inserts** — registration goes through the Identity Service
  (`AuthService.signUp` → `UserFactory` → `PostgresIdentityRepository`).
- **No credentials in source** — the local DB URL lives in the gitignored
  `apps/web/.env.local` (dev credentials already public in `docker-compose.yml`);
  `AUTH_JWT_SECRET` was already present and required (fail-fast, no default).
- **Passwords never logged** — verified: identity logs record `{userId}` only;
  no password/secret fields printed anywhere in the captured logs.
- **Duplicate email enforced at two layers**: app-level `findByEmail` check
  (409) AND the `users_email_idx` unique index (database backstop).
- **Brute-force throttle** active on `/sign-in`, `/sign-up`, `/refresh`
  (per-client-IP in-memory, 429 `RATE_LIMITED`).

## 3. Defect fixed (D3) — registered users could not sign in

- **Observation:** a fresh email/password sign-up returned a session, but
  sign-in failed with `AUTH_FAILED — "Email not verified"`.
- **Root cause:** the domain rule blocks sign-in for `pending && !emailVerified`
  (`IdentityDomainService.canAuthenticate`), and the estate has **no email
  verification delivery anywhere** (no SMTP usage in the identity service, no
  verify endpoint). Google sign-in auto-verifies (`newUser.verifyEmail()`) —
  the only path that could ever complete locally.
- **Fix (minimal, mirrors the existing Google path):** in `AuthService.signUp`,
  when `NODE_ENV` is neither `production` nor `staging`, the new user's email is
  verified at registration (explicitly typed `string` for the web build's
  literal-union `NODE_ENV` typing).
- **Production/staging unchanged:** users stay unverified; the domain rule still
  blocks sign-in until a real verification flow ships (documented pre-existing
  gap, not weakened).
- **Tests added:** dev/test verifies the new email; production leaves it
  unverified; duplicate email; generic failure.

## 4. Honest notes

- Three LOCAL TEST users exist in the local `users` table (all `@vedmoulya.local`
  test accounts; one from before the D3 fix remains honestly unverified).
- No fabricated customers, revenue or business data was created by the auth flow.
