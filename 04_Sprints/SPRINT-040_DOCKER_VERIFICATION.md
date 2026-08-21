# SPRINT-040 — Docker Verification (Phase 11)

**Result:** 🟢 VERIFIED with one honest deviation — `vedmoulya-web` is not a
Docker container in this estate; the web app runs via `next dev` and talks to
the Docker Postgres/Redis. All other requested checks pass.

---

## 1. `docker ps` (as captured)

```
NAMES                STATUS                 PORTS
vedmoulya-postgres   Up 4 hours (healthy)   0.0.0.0:5432->5432/tcp, [::]:5432->5432/tcp
vedmoulya-redis      Up 4 hours (healthy)   0.0.0.0:6379->6379/tcp, [::]:6379->6379/tcp
```

- `vedmoulya-web`: **absent from `docker ps`** — `docker-compose.yml` defines
  postgres, redis, prometheus, otel-collector and grafana only. A web Dockerfile
  exists (`apps/web/Dockerfile`) but is not wired into compose. Per the sprint
  rule "do not manufacture work", no web container was added: the end-to-end
  path is served by `next dev` against the Docker estate, which is the
  documented local development mode.

## 2. Pages

| URL                           | Result  |
| ----------------------------- | ------- |
| `http://localhost:3000/`      | **200** |
| `http://localhost:3000/login` | **200** |

## 3. Authentication against the local Identity database

Verified live against the Docker Postgres through the web app:
sign-up (201) → sign-in (200) → session (200) → sign-out (200); duplicate
email (409); validation (400); wrong password (401). See
`SPRINT-040_AUTH_VERIFICATION.md`.

The `users` table was created in `vedmoulya-postgres` by the idempotent
`ensureTable()` bootstrap (Postgres log shows the `CREATE TABLE IF NOT EXISTS
users` statements running at startup) and holds only the clearly-marked LOCAL
TEST accounts.

## 4. Captured logs (no secrets)

- Postgres: idempotent DDL execution confirmed; the `pg_type_typname_nsp_index`
  duplicate-key notice is a transient artifact of two idempotent DDL runs racing
  at first startup (harmless — `IF NOT EXISTS`), and subsequent runs are no-ops.
- Redis: `PONG` (healthy).
- Web dev log: requests logged with status codes only; **no passwords, tokens or
  secrets appear** in any captured log excerpt used in this report.

## 5. Security posture

- Production fail-fast rules unchanged: no new keys, no localhost defaults
  outside development, `AUTH_JWT_SECRET` still required, rate limiting still
  enforced, no credentials printed in logs.
- The dev-only auto-verify (D3 fix) is gated on `NODE_ENV !== production &&
!== staging` — production/staging behavior is identical to before.
