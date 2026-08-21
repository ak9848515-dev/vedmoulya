# SPRINT-040 — Local Runtime Verification

**Result:** 🟢 VERIFIED — the local runtime now supports the complete
register → observe → score → discover → validate → recommend path over Docker
Postgres/Redis, with the web app served by `next dev` (port 3000).

---

## 1. Docker estate (as-found, verified healthy)

| Component                   | Status                              | Notes                                                                                                                                             |
| --------------------------- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `vedmoulya-postgres`        | Up (healthy) · `0.0.0.0:5432->5432` | pgvector/pg16; dev credentials `vedmoulya/vedmoulya-dev` from compose                                                                             |
| `vedmoulya-redis`           | Up (healthy) · `0.0.0.0:6379->6379` | `redis-cli ping` → `PONG`                                                                                                                         |
| `vedmoulya_default` network | Present                             |                                                                                                                                                   |
| `vedmoulya-web`             | **Not a container**                 | No web service in `docker-compose.yml` (a Dockerfile exists but is unwired). The web app is served by `next dev` — the documented local dev path. |

## 2. Web ↔ PostgreSQL

- The web app resolves `IDENTITY_DATABASE_URL` (now set in `apps/web/.env.local`
  to `postgres://vedmoulya:vedmoulya-dev@localhost:5432/vedmoulya` — dev creds
  from compose, gitignored, no API keys).
- `@vedmoulya/identity` is consumed **from source** (workspace symlink →
  `services/identity/src`), so identity changes are live without rebuilds.
- Identity DB init follows the estate convention now: `initializeDatabase()`
  opens the pool, and the repository's idempotent `ensureTable()` creates the
  `users` table + email/google_id unique indexes on every startup (see
  `SPRINT-040_BASELINE_AUDIT.md` D1).
- Redis is not required by the exercised path (rate limiting is in-memory by
  default, `RATE_LIMIT_BACKEND=memory`); it runs healthy and unused for the
  verified flow.

## 3. Web app pages

| URL                           | Result   |
| ----------------------------- | -------- |
| `http://localhost:3000/`      | HTTP 200 |
| `http://localhost:3000/login` | HTTP 200 |

## 4. Identity database configuration

- `AUTH_JWT_SECRET` (already present in `.env.local`) — required, fail-fast, no default.
- `IDENTITY_DATABASE_URL` — added for the local Docker Postgres (dev-only config).
- Production fail-fast rules untouched: `requireExternalUrl` still rejects
  localhost defaults outside NODE_ENV=development; no new keys introduced.

## 5. Session lifecycle (verified live)

POST `/api/v1/identity/auth/sign-up` → 201 session (access + refresh tokens)
→ POST `/sign-in` → 200 session → GET `/session` (Bearer) → 200
`{userId, email, role}` → POST `/sign-out` → 200. Details in
`SPRINT-040_AUTH_VERIFICATION.md`.

## 6. Runtime defects resolved during verification

1. `users` table missing → `ensureTable()` bootstrap (D1).
2. DB credentials missing → `IDENTITY_DATABASE_URL` in `.env.local` (D2).
3. Registered users could not sign in (no verification delivery) →
   dev/test-only auto-verify in `AuthService.signUp` (D3).
4. Next dev cache corruption (`vendor-chunks/@vercel.js`) → `.next` cleared;
   restart with clean cache (D4, environment artifact only).

## 7. Honest limitations

- `vedmoulya-web` is not a Docker container (documented, not a defect of the
  local runtime path — `next dev` is the intended dev server).
- The evidence loop / world stores write through the shared persistence bundle;
  live external world signals and real provider execution remain
  **OPERATOR-REQUIRED** — nothing here fabricates data.
