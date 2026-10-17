# VedMoulya — Identity Database Provisioning & Validation Runbook (S12 Blocker A)

| Field   | Value                                   |
| ------- | --------------------------------------- |
| Service | VedMoulya Platform — Identity           |
| Version | 1.0.0                                   |
| Updated | 2026-10-16 (S12 Blocker A / S012-A)     |
| Owner   | Deployment Operator (Platform/Identity) |

> **What this closes.** `S012-A` — the evidence gap that production has no
> managed, non-localhost identity database. Completing this runbook produces the
> exact evidence `BLOCKER-REPORT-S12-PRODUCTION.md` §1 requires.
>
> **What this does not do.** It does not deploy the application (see the
> [deployment guide](../ops/DEPLOYMENT_GUIDE.md)), does not configure backups or
> the DR drill (`S012-C` — see the
> [backup & restore runbook](./backup-restore-runbook.md)), and does not by
> itself make the release a GO. No code change is required or expected: the
> identity schema is applied by the application at boot.
>
> **Secret rule (applies to every step).** Never paste a DSN, password, key or
> token into a ticket, chat, log or commit. Record **key names, hosts as
> `<host>`, exit codes and outputs** only. Values live in the platform
> environment and the secrets vault.

---

## 1. Acceptance criteria — "S012-A is closed" means all of these

| #   | Criterion                   | Command / artifact                                   | Pass condition                                                                                                                                           |
| --- | --------------------------- | ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Fail-fast configuration     | `npm run preflight:prod -- --skip-docker` (§6)       | exit **0**; `Environment`, `Authentication`, `Database`, `Redis` all `READY`                                                                             |
| 2   | Startup doctor              | `npm run doctor:prod -- --skip-docker` (§6)          | exit **0**; `Database PASS`, `Configuration PASS`, no required `FAIL` row                                                                                |
| 3   | Schema at current version   | ledger query (§5)                                    | all five ids recorded; head = `005_timestamptz_instants`                                                                                                 |
| 4   | Deployed readiness          | `curl -fsS "$PROD_URL/health/ready"` (§6)            | HTTP **200**, `"status":"ready"`, `"checks.database.status":"healthy"`                                                                                   |
| 5   | Deploy gate                 | `bash scripts/deploy/smoke-test.sh "$PROD_URL"` (§6) | `==> Smoke test PASSED` (polls `/health/live` → gates on `/health/ready`)                                                                                |
| 6   | No fail-closed identity log | deployed server logs (§4)                            | **no** `Identity migrations table initialization failed` / `Identity users …` line                                                                       |
| 7   | Accessibility gate          | `npm run test:a11y` (§6)                             | exit **0**. A **UI** gate only: it runs port 3100, a test-only JWT secret, `A11Y_ALLOW_UI_ONLY_READINESS=true` — it does **not** prove the database path |
| 8   | Identity works end to end   | sign-up + logout round trip (§7)                     | the user row exists in `users`; logout writes a `kind = 'family'` revocation row                                                                         |
| 9   | Evidence recorded           | §10 template committed to a closure note             | dated, operator-signed, values-free                                                                                                                      |

Criterion 8 is **recommended, not optional in spirit**: criteria 1–7 prove the
database exists and is reachable; only 8 proves identity actually writes to it.

**Mapping to the blocker report's Exact Evidence Required**
(`BLOCKER-REPORT-S12-PRODUCTION.md` §1): `preflight:prod` exit 0 → **1** ·
`doctor:prod` exit 0 → **2** · `test:a11y` exit 0 → **7** · HTTP 200 from
`/health/ready` → **4** · "absence of identity-warning logs indicating
fail-closed behavior" → **6**. Criteria 3, 5, 8 and 9 are additions this
runbook makes so the closure cannot rest on gates that would pass against an
empty but reachable database.

> **One deliberate deviation, declared up front.** The blocker report §1's
> verbatim verification command is `npm run preflight:prod && npm run
doctor:prod && npm run test:a11y`. §6 runs both of the first two with
> `-- --skip-docker`. That flag exists because production's `Docker` row is a
> _required_ check and a managed host runs no Docker daemon, so the literal
> command fails on `Docker: DEPENDENCY_UNAVAILABLE` for a reason unrelated to
> this blocker. It softens **reachability only**: missing/loopback/placeholder
> configuration and a credential **rejection** stay hard. Record the flag in the
> evidence block (§10) — never drop it silently. If the deploying host _does_
> run a Docker daemon, run the blocker report's literal command unchanged and
> record that instead.

---

## 2. Prerequisites (operator-side)

- [ ] Written approval to provision the identity database and change the
      production platform environment (owner: Deployment Operator — Sprint 012
      records this as **UNASSIGNED**; a named individual must be recorded).
- [ ] A **managed PostgreSQL 16+** instance in the approved region. Identity
      needs **no extensions**: every statement is plain, idempotent DDL
      (create-table-if-not-exists, add-column-if-not-exists, indexes,
      alter-column-type).
- [ ] A deploy/test host that holds the production environment with **Node ≥ 20
      and npm ≥ 10**.
- [ ] A production web build if you intend to run criteria 1/2/7 on that host:
      `npm ci && npm run build:core && npm run build -w apps/web`
      (otherwise the `Production build` row blocks — see §6 note).
- [ ] `npx playwright install chromium` for criterion 7. The a11y runner
      builds `apps/web` itself when `.next` is absent, then fails closed if
      `apps/web/.next/BUILD_ID` is missing.

---

## 3. Step 1 — Provision the database and the least-privilege role

Use the provider console (preferred — it also gives you backups/PITR toggles) or
SQL. Do **not** reuse a superuser or the provider's default admin role.

```sql
-- Run as the provider's admin role, once.
CREATE ROLE vedmoulya_identity LOGIN PASSWORD '<generated-48-byte-secret>';
CREATE DATABASE vedmoulya_identity OWNER vedmoulya_identity;
```

- Generate the password with a real CSPRNG, e.g.
  `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`.
- The role owns its database and nothing else. No `CREATEDB`, no `SUPERUSER`.
- **TLS:** the DSN must encode the provider's requirement (`sslmode=require`, or
  `sslmode=verify-full` with the provider's CA). The application adds no TLS
  flags of its own — whatever the DSN says is what is used.
- **Endpoint choice:** if the provider offers both a direct endpoint and a
  transaction-mode pooler, prefer the **direct** endpoint for the value the
  application boots with. Boot runs DDL; if you choose a pooler, verify §5
  afterwards — the ledger is the proof that the DDL actually landed.
- Do not create the tables by hand. Boot creates them (§4).

Encode the DSN (placeholders — substitute, never commit):

```text
postgres://vedmoulya_identity:<password>@<host>:5432/vedmoulya_identity?sslmode=require
```

---

## 4. Step 2 — Set the platform environment and redeploy

Production and staging load **no local env file** (`scripts/lib/probes.ts`
`loadEnvironment`): the platform environment is the only source of values. Set
these in the hosting platform (and the GitHub Actions Environment used by the
deploy job), never in a developer `.env.local`.

| Key                                                                                                 | Required             | Rule enforced (fail-fast)                                                                                                                                              |
| --------------------------------------------------------------------------------------------------- | -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `IDENTITY_DATABASE_URL`                                                                             | **Yes**              | Non-empty and **not** `localhost` / `127.0.0.1` / `0.0.0.0` / `::1` outside `NODE_ENV=development`                                                                     |
| `AUTH_JWT_SECRET`                                                                                   | **Yes**              | ≥ 32 chars, not a placeholder (`secret`, `test`, `change-me`, …) in production/staging                                                                                 |
| `REDIS_URL`                                                                                         | **Yes**              | Same non-loopback rule as the database (rate limiting/sessions)                                                                                                        |
| `API_CORS_ORIGIN`                                                                                   | Strongly recommended | Public web origin. A loopback origin is `MISCONFIGURED`; unset is `DEGRADED` (cross-origin **denied**, never a wildcard)                                               |
| `KNOWLEDGE_/DECISION_/EXECUTION_/MEMORY_DATABASE_URL`                                               | Per deployed service | Each service enforces the same non-loopback rule for its own database                                                                                                  |
| `DATABASE_URL`                                                                                      | Documented           | Member of the configuration contract's `REQUIRED_PRODUCTION` set (`npm run config:contract`)                                                                           |
| `AI_DEFAULT_PROVIDER` + its key (`AI_GOOGLE_API_KEY` / `AI_OPENAI_API_KEY` / `AI_DEEPSEEK_API_KEY`) | Not for identity     | AI is never an authentication prerequisite. With no key the `AI configuration` row reports `DEGRADED` (`required: false`) — it does **not** block. Needed for `S012-B` |
| `AI_CREDENTIAL_ENCRYPTION_KEY`                                                                      | Recommended          | ≥ 16 chars — without it a user's own provider key cannot be stored (validated, then discarded)                                                                         |
| `DB_POOL_MIN` / `DB_POOL_MAX` / `DB_CONNECT_TIMEOUT_S` / `DB_IDLE_TIMEOUT_S` / `DB_MAX_LIFETIME_S`  | Optional             | Defaults `2` / `10` / `20` / `30` / `1800`. Size for the platform (cold serverless endpoints need the longer connect timeout)                                          |
| `IDENTITY_SCHEMA_READINESS_GATE`                                                                    | **Leave unset**      | Opt-in drift gate — enable only **after** §5 confirms the version (§8)                                                                                                 |

Then **redeploy**. On boot the application:

1. creates the `identity_schema_migrations` ledger,
2. applies every pending migration **in order** — `001_users`,
   `002_refresh_token_denylist`, `003_oauth_states`, `004_email_verifications`,
   `005_timestamptz_instants` — recording each as it succeeds,
3. skips already-recorded steps, so re-deploys are no-ops.

This runs as a **single-flight, awaited** boot step shared by the gateway
(`createProductionIdentityRepository` → `Identity migrations`) and the web
auth-app cold start: concurrent boot paths cannot race on the same DDL, and
traffic is not served until it resolves. There is **no manual migration step**
and **no migration CLI** — do not hand-run DDL and do not reach for
`prisma`/`drizzle-kit` (neither is used by this service).

Expected: **no** error line matching
`Identity migrations table initialization failed` or
`Identity users table initialization failed` (those carry the full cause chain —
connection, permission `42501` or schema `42P01`).

---

## 5. Step 3 — Verify the deployed schema state

Run from a host that can reach the database (the provider console's SQL editor
works too; use the query form if `psql` is unavailable).

```bash
psql "$IDENTITY_DATABASE_URL" -c "\dt"                     # or the information_schema query below
psql "$IDENTITY_DATABASE_URL" -c \
  "SELECT id, applied_at FROM identity_schema_migrations ORDER BY id;"
psql "$IDENTITY_DATABASE_URL" -c "SELECT count(*) FROM users;"
```

Expected:

| Check           | Expected result                                                                                        |
| --------------- | ------------------------------------------------------------------------------------------------------ |
| Tables          | `users`, `refresh_token_denylist`, `oauth_states`, `email_verifications`, `identity_schema_migrations` |
| Ledger          | exactly the five ids `001_users` … `005_timestamptz_instants`, each with an `applied_at`               |
| Schema version  | head = **`005_timestamptz_instants`** (the current version)                                            |
| Key index       | `rtd_jti_hash_idx` present (the arbiter that makes refresh rotation single-use)                        |
| Instant columns | `users.created_at` etc. are `timestamptz`, not `timestamp` (migration 005)                             |

Without `psql`:

```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' ORDER BY table_name;
```

> `migrationStatus()`, `schemaVersion()` and `assertIdentitySchemaCurrent()` are
> exported by `@vedmoulya/identity` but are **not** wired to a CLI. The ledger
> query above is their operator-facing equivalent; the opt-in readiness gate
> (§8) is their runtime equivalent.

---

## 6. Step 4 — Run the gates

```bash
export NODE_ENV=production                     # makes the fail-fast config evaluation strict
export PROD_URL="https://<deployed-host>"      # no trailing slash

npm run preflight:prod -- --skip-docker        # exit 0
npm run doctor:prod   -- --skip-docker         # exit 0
npm run config:contract                        # exit 0
npm run test:a11y                              # exit 0

bash scripts/deploy/smoke-test.sh "$PROD_URL"  # ==> Smoke test PASSED
curl -fsS "$PROD_URL/health/live"              # 200 {"status":"alive",...}
curl -fsS "$PROD_URL/health/ready"             # 200 {"status":"ready",...}
curl -fsS "$PROD_URL/health/check"             # 200 status ok|degraded (pool counters only)
```

**Why `--skip-docker`.** In production the preflight's `Docker` row is a
_required_ check, and a managed deployment host has no Docker daemon — without
the flag the run fails on `Docker: DEPENDENCY_UNAVAILABLE` even though the
database is managed and correct. `--skip-docker` softens **reachability only**:

- missing / loopback / placeholder configuration stays **hard** (never softened);
- a credential _rejection_ (PostgreSQL `28P01` / `28000` / `3D000`) stays
  **hard** and is reported as `MISCONFIGURED`, naming the variable;
- a non-loopback store is still probed **directly** (independent of Docker);
- only an _unreachable_ store is softened to `DEGRADED`.

Because reachability is softened by that flag, the authoritative reachability
proof is **`/health/ready` + the smoke test** (criteria 4–5), not the preflight.

`NODE_ENV=production` matters: the `Database`/`Redis` rows follow `--mode
production`, but the `Environment` row evaluates the fail-fast config using
`NODE_ENV`, which is what rejects loopback/placeholder secrets.

Expected preflight rows: `Environment ✓ READY` · `Authentication ✓ READY` ·
`Database ✓ READY` · `Redis ✓ READY` · `Docker ~ DEGRADED (--skip-docker)` ·
`CORS ✓ READY` (or `~ DEGRADED` if `API_CORS_ORIGIN` is unset) ·
`AI configuration ~ DEGRADED` when no AI key is set (never blocking) ·
`Production build ✓ READY` (only on a host that has run `npm run build -w
apps/web`; to isolate environment validation on a build-less host add
`--allow-missing-build`, and never treat that run as the deploy gate).

Expected doctor rows: `Node PASS` · `npm PASS` · `TypeScript runtime PASS` ·
`Environment/Database/Redis PASS` · `Docker WARN` · `Production build PASS` ·
`AI runtime`/`Default provider` (AI is non-blocking for identity) ·
`Port 3000 PASS` (**must be free** — stop any local dev server or probe another
port with `-- --port <n>`) · `Configuration PASS`.

> `Production build` and `Port 3000` are the two rows that most often fail on an
> operator workstation for reasons unrelated to the identity database. Read the
> row detail before changing anything about the database.

---

## 7. Step 5 — Prove identity works end to end (recommended)

The gates prove reachability; this proves **writes**.

1. Register one throwaway user through the deployed sign-up flow (`auth_provider = 'email'`).
2. Confirm the row landed:

   ```bash
   psql "$IDENTITY_DATABASE_URL" -c \
     "SELECT id, email, auth_provider, created_at FROM users WHERE email = '<test-user>';"
   ```

3. Sign in, then sign out, and confirm logout durably revoked the refresh family:

   ```bash
   psql "$IDENTITY_DATABASE_URL" -c \
     "SELECT count(*) FILTER (WHERE kind = 'family') AS families,
             count(*)                            AS rows
      FROM refresh_token_denylist;"
   ```

4. Record the row id and the counts as evidence; remove the throwaway user
   before go-live and record the cleanup.

---

## 8. Step 6 — Backups, PITR, and the opt-in drift gate

- **Backups (hands off to `S012-C`).** Configure daily full backups per service
  database at 02:00 UTC (or the provider's managed backup feature — preferred)
  with PITR enabled, retention ≥ 30 d daily / ≥ 12 mo monthly, and schedule the
  quarterly scratch-restore drill. See
  [backup & restore runbook](./backup-restore-runbook.md) §1/§6.
- **Drift gate (only after §5 passes).** Set
  `IDENTITY_SCHEMA_READINESS_GATE=1` and redeploy, then re-check readiness:

  | Readiness response                                | Meaning                                  | Action                                                                |
  | ------------------------------------------------- | ---------------------------------------- | --------------------------------------------------------------------- |
  | `200`, `checks.identitySchema.status = "current"` | Ledger matches the deployed code         | Keep the gate enabled                                                 |
  | `503`, `status = "pending"` + `pendingMigrations` | The database is behind the deployed code | Find why boot migration did not complete; do **not** disable the gate |
  | `503`, `status = "unavailable"`                   | Schema state could not be determined     | Investigate reachability/permissions; the gate fails closed           |

  While the flag is unset the gate performs no I/O and the response is
  byte-identical to the standard contract.

---

## 9. Troubleshooting (symptom → cause → action)

| Symptom                                                                                                                 | Cause                                                  | Action                                                                                                   |
| ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------- |
| `Identity migrations table initialization failed` / `Identity users table initialization failed` in logs                | Database unreachable, credentials wrong, or DDL denied | Check the DSN, `sslmode`, network allow-list and role grants; verify with §5                             |
| `Environment ✗ MISCONFIGURED` + `IDENTITY_DATABASE_URL must be set to a non-localhost URL outside NODE_ENV=development` | Unset or loopback DSN                                  | Fix the platform value (and confirm you exported `NODE_ENV=production`)                                  |
| `Database ✗ MISCONFIGURED: IDENTITY_DATABASE_URL is required in production (no localhost default).`                     | Not set for the strict mode                            | Set it in the platform environment                                                                       |
| `Database … REJECTED the credentials (driver code 28P01 / 28000)`                                                       | Wrong password/role (or rotated)                       | Rotate/synchronise the credential; **this is never softened by `--skip-docker`**                         |
| `driver code 3D000`                                                                                                     | Database does not exist                                | Create it (§3)                                                                                           |
| `Database … not reachable at its URL host:port`                                                                         | Network allow-list, DNS, endpoint asleep               | Open the allow-list; a suspended managed endpoint can take >8 s to wake                                  |
| `no pg_hba.conf entry` / `server does not support SSL`                                                                  | Wrong `sslmode` for the endpoint                       | Correct the DSN (`require`, or `verify-full` + CA)                                                       |
| `Authentication ✗ MISCONFIGURED: AUTH_JWT_SECRET is missing or too short (< 32 chars)`                                  | Missing/weak secret                                    | Generate ≥ 32 chars; rotating it invalidates all sessions ([secret rotation](../ops/SECRET_ROTATION.md)) |
| `CORS ~ DEGRADED: API_CORS_ORIGIN is not set`                                                                           | Cross-origin requests are denied by design             | Set the public origin if a browser client calls the API cross-origin                                     |
| Readiness `503` with `checks.database.status = "unhealthy"`                                                             | Gateway up, `SELECT 1` failing                         | Fix the database; readiness is never relaxed to pass                                                     |
| Readiness `503` with `checks.identitySchema.status = "pending"`                                                         | Gate enabled and the DB is behind                      | See §8                                                                                                   |
| `Port 3000 FAIL — OCCUPIED` (doctor)                                                                                    | Local server running                                   | Stop it, or `-- --port <n>`                                                                              |
| `Production build ✗ BLOCKED` (preflight)                                                                                | No `apps/web/.next/BUILD_ID` on this host              | `npm run build -w apps/web` (or `--allow-missing-build` to isolate env checks only)                      |
| Pool exhaustion / high latency under load (`/health/check` counters)                                                    | Pool too small for the workload                        | Raise `DB_POOL_MAX` (default 10) or use the provider's pooled endpoint                                   |

---

## 10. Evidence block (copy into the closure note)

```text
S012-A — Identity database provisioning evidence
Date (UTC):            <YYYY-MM-DDTHH:MM:SSZ>
Operator:              <name>   Approval reference: <ticket/decision id>
Provider / region:     <provider> / <region>          (no host details if policy forbids)
Engine version:        PostgreSQL <major.minor>
DSN variable names:    IDENTITY_DATABASE_URL (+ siblings)  — values never recorded

preflight:prod   exit=<0|1>   flags=<--skip-docker|none>   rows: Environment=<>, Authentication=<>, Database=<>, Redis=<>, Docker=<>
doctor:prod      exit=<0|1>   rows: Database=<>, Configuration=<>, Port 3000=<>
config:contract  exit=<>
test:a11y        exit=<>
smoke-test.sh    result=<PASSED|FAILED>
/health/live     HTTP <code>
/health/ready    HTTP <code>  body=<sanitized JSON>
/health/check    HTTP <code>  status=<ok|degraded>

schema ledger head:    <e.g. 005_timestamptz_instants>   (ids: 001…005)
identity end-to-end:   user row id=<id>; refresh_token_denylist family rows=<n>
fail-closed log scan:  no 'Identity migrations table initialization failed'  [confirmed]
drift gate:            IDENTITY_SCHEMA_READINESS_GATE=<unset|1>  readiness=<code>
backups/PITR:          owner=<name>  (S012-C; not part of this closure)

Signed off by: <name>  at <UTC>
```

---

## 11. Rollback / safe state

- **Undo the gate only:** unset `IDENTITY_SCHEMA_READINESS_GATE` and redeploy —
  the readiness response returns to the standard contract.
- **Undo a release:** redeploy the previous known-good release; the schema is
  forward-only at boot, so the schema-rollback path is **restore from the
  pre-deploy backup** (see [backup & restore runbook](./backup-restore-runbook.md)
  §3 and the [rollback runbook](./rollback-runbook.md)).
- **Undo the credential:** rotate the role password in the provider console and
  update `IDENTITY_DATABASE_URL` in the platform environment; never leave the
  old value in any shell history or ticket.
- **Do not** delete the database or its role to "start over" while the deployed
  application is live — that takes authentication down for every user with no
  in-memory fallback.

---

## 12. Safety rules for the operator

1. No secret value is ever printed, copied into a ticket, or committed — record
   names and exit codes.
2. Work on **staging first** where one exists; production only with the written
   approval from §2.
3. Nothing in this runbook is destructive: provisioning, environment changes and
   redeploys are additive. The only destructive operation referenced is the
   restore in the backup runbook, which requires its own approval.
4. If a gate fails, fix the cause. Never disable a gate, soften a check, or
   substitute a local database result to make the evidence look complete.

---

**Related:** [Deployment guide](../ops/DEPLOYMENT_GUIDE.md) ·
[Backup & restore runbook](./backup-restore-runbook.md) ·
[Rollback runbook](./rollback-runbook.md) ·
[Secret rotation](../ops/SECRET_ROTATION.md) ·
[Production blocker report (S012-A…D)](../../BLOCKER-REPORT-S12-PRODUCTION.md) ·
[S12 identity readiness audit](../audits/2026-10-14-s12-identity-readiness/FINAL-REPORT.md)
