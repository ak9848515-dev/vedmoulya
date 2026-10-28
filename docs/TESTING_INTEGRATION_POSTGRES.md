# PostgreSQL integration suites — prerequisites & safe local run

Most of the test suite is hermetic: unit tests and the coverage gate never need a
database. A small number of **integration** suites talk to a real PostgreSQL
server and are therefore **skipped by default**. This note records why they skip
and how to run them safely against a throwaway local instance.

Nothing here is required for `npm test` or `npm run test:coverage`.

## Why the suites are skipped

There are two independent gates.

### 1. `CONTENT_AGENCY_TEST_DATABASE_URL` — payment integrity (MISSION 002)

`services/content-agency/src/__tests__/payment-integrity.postgres.test.ts`
(14 tests) is skipped because `CONTENT_AGENCY_TEST_DATABASE_URL` is unset.

A database URL alone is not enough. The suite only runs when **all three** hold:

| Prerequisite         | Requirement                                             |
| -------------------- | ------------------------------------------------------- |
| Environment variable | `CONTENT_AGENCY_TEST_DATABASE_URL` is set and non-empty |
| Host                 | exactly `localhost`, `127.0.0.1` or `[::1]`             |
| Database name        | contains `test`                                         |

If any condition fails, the file falls back to `describe.skip`. This is
deliberate: the suite **drops and recreates the `public` schema** between
migration cases, so it must be impossible to point it at a real database by
accident.

### 2. `POSTGRES_TEST_URL` — the remaining persistence suites

These suites probe the server with `SELECT 1` and skip when it is unreachable:

- `services/identity/__tests__/*.postgres.test.ts`
- `services/knowledge/src/infrastructure/persistence/__tests__/*.postgres.test.ts`
- `packages/mission-runtime/src/__tests__/s10-postgres-*.test.ts`
- `services/api/src/__tests__/*Postgres.test.ts`, `PersistenceStores.test.ts`

They default to `postgres://vedmoulya:vedmoulya-dev@localhost:5432/vedmoulya`
and only run when that server actually answers. Unlike the payment suite they
create their own tables and clean up with scoped `DELETE`s — they do not drop
the schema.

## Safe local procedure

Use a disposable container on a non-default port. Never reuse a configured or
production DSN.

```bash
# 1. Throwaway server (port 5433 so it cannot collide with a real one)
docker run -d --name vedmoulya-pg-test \
  -e POSTGRES_PASSWORD=pw -p 127.0.0.1:5433:5432 postgres:16-alpine

# 2. A database whose name contains "test"
docker exec vedmoulya-pg-test createdb -U postgres m002_test

# 3. Payment-integrity suite (host is loopback, db name contains "test")
CONTENT_AGENCY_TEST_DATABASE_URL='postgres://postgres:pw@127.0.0.1:5433/m002_test' \
  npx vitest run services/content-agency/src/__tests__/payment-integrity.postgres.test.ts

# 4. Other persistence suites
POSTGRES_TEST_URL='postgres://postgres:pw@127.0.0.1:5433/m002_test' \
  npx vitest run services/identity/__tests__/IdentityStores.postgres.test.ts

# 5. Tear down
docker rm -f vedmoulya-pg-test
```

On Windows the same commands work in Git Bash; only the shell syntax for
setting the variable differs if you use PowerShell.

## Guardrails

- Bind the container to `127.0.0.1`, never `0.0.0.0`.
- Always use a database whose name contains `test`.
- Never supply a hosted/production DSN (Neon, RDS, staging, …) to either
  variable. The payment suite will drop the `public` schema.
- These suites are not part of the coverage gate; skipping them does not lower
  any coverage metric because the transport adapters are excluded from the
  coverage `include` globs.

## Unit coverage of the same behavior

`services/content-agency/src/__tests__/payment-settlement.unit.test.ts` covers
the settlement decision logic (idempotent retries, insert races, evidence
gating, invoice settlement, partial payment totals) against a scripted
transaction double, and `packages/domain/src/content-agency/__tests__/` covers
the money, evidence and idempotency primitives. Those run on every `npm test`.
The PostgreSQL suite adds only the transport-level checks (real
`SELECT … FOR UPDATE`, real unique indexes, real migrations).
