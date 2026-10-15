# VedMoulya — S12 Identity Readiness (Blocker A): Production Identity Database Readiness

**Date (UTC):** 2026-10-14
**Branch:** `main` · **HEAD:** `a124274b0d1fa91f361e0a5775e144658405913a` (unchanged)
**Scope:** S012-A evidence gap only — configuration, provisioning owner, and verification steps for a production identity database. No production touched, no production resources created or migrated, no secrets printed.
**Safety:** no reset, clean, revert, stage, commit, push, tag, or deploy. All five stashes preserved. All pre-existing tracked/untracked work untouched. No local-PostgreSQL result substituted for managed production readiness.

---

## Verdict: **BLOCKED** (evidence gap, operator-owned)

Production identity-database readiness cannot be claimed: no managed, non-localhost `IDENTITY_DATABASE_URL` exists in any authorized platform environment reachable from this checkout, and the repository's own production validators fail closed without one (executed below: `preflight:prod` exit 1, `doctor:prod` exit 1). What this report _does_ close is the ambiguity — the exact requirement, the confirmed-vs-unknown prerequisites, the owner, and the step-by-step handoff are now pinned to source evidence.

**S12 remains NO-GO** until all mandatory gates pass (S012-A here; S012-B provider credits; S012-C staging DR drill; G1 owner confirmation — see `BLOCKER-REPORT-S12-PRODUCTION.md`).

---

## 0. Baseline

| Item                | State                                                                                                                                                                                                                                                                                                                         |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Branch              | `main`                                                                                                                                                                                                                                                                                                                        |
| HEAD                | `a124274b0d1fa91f361e0a5775e144658405913a` (verified before and after; unchanged)                                                                                                                                                                                                                                             |
| Stashes             | 5/5 preserved (`pre-security-baseline-healthprobe`; 3× lint-staged backups; WIP release-candidate-v1.0.0)                                                                                                                                                                                                                     |
| Working tree        | Sprint 026 baseline + S12-4A working set untouched; only addition is this report directory                                                                                                                                                                                                                                    |
| Evidence paths read | `BLOCKER-REPORT-S12-PRODUCTION.md` ✓ · sprint-026 `FINAL-REPORT.md` ✓ · `S12-BLOCKER-4A-CLOSURE.md` ✓ · sprint-012 `PRODUCTION-READINESS-CHECKLIST.md` ✓ · `docs/runbooks/backup-restore-runbook.md` ✓ · `docs/ops/DEPLOYMENT_GUIDE.md` ✓ · `03_Architecture/DATABASE_V1.md` ✓ · `.env.example` + `.env.production.example` ✓ |

---

## 1. Existing production preflight requirements and evidence

**The exact requirement (source):** `packages/core/src/config/index.ts:132` — `database.url = requireExternalUrl('IDENTITY_DATABASE_URL', 'postgres://localhost:5432/vedmoulya')`. Outside `NODE_ENV=development`, the value is REQUIRED and must not match loopback (`localhost|127.0.0.1|0.0.0.0|::1`); otherwise `loadConfiguration()` throws a fail-fast `EnvironmentError` naming the key only, never the value (`requireExternalUrl`, `index.ts:243-264`). Production/staging additionally load **no local env files** (`scripts/lib/probes.ts:79-88` `loadEnvironment`; `apps/web/src/lib/server-env.ts` `shouldLoadLocalEnvFiles`) — the platform environment is the sole source.

**Safe presence verification already exists — no new infrastructure proposed:** `npm run preflight:prod` / `npm run doctor:prod` evaluate the fail-fast config and report key NAMES plus `MISCONFIGURED` reasons; `scripts/lib/probes.ts` documents "NEVER prints values", `evaluateConfig()` redacts via `redactSecretValues`, the doctor header states "NEVER contains environment values — only key NAMES", and the live reachability probe (`serviceReachable` → `probeDatabaseAuth`, `probes.ts:124-188`) runs `SELECT 1` in a child process that prints only `REACHABLE | AUTH_FAILED:<driver-code> | UNREACHABLE`. `DatabaseConnection` logs safe metadata only (`{provider:'postgres', database:'configured'}`); pool snapshots publish an opaque sha256 fingerprint, never the URL (`DatabaseManager.ts:51-55`).

**Executed evidence (safe local checks, nothing contacted or mutated):**

| Command                                                                                       | Exit  | Result                                                                                                                                                                        |
| --------------------------------------------------------------------------------------------- | ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npx tsx scripts/preflight.ts --mode production --allow-missing-build`                        | **1** | `BLOCKED` — `DATABASE ✗ MISCONFIGURED: IDENTITY_DATABASE_URL is required in production (no localhost default)` (also AUTH_JWT_SECRET, REDIS_URL MISCONFIGURED; CORS DEGRADED) |
| `npx tsx scripts/doctor.ts --mode production --allow-missing-build`                           | **1** | `NOT READY` — `Database FAIL: IDENTITY_DATABASE_URL is required in production (no localhost default)` (plus AUTH_JWT_SECRET, REDIS_URL, build, port rows)                     |
| `npx vitest run src/config/__tests__/production-config-contract.test.ts` (in `packages/core`) | **0** | **15/15 passed** — the validator contract itself is pinned: non-localhost accepted, loopback/missing rejected, no fixture secret leaks into diagnostics                       |

**Readiness gate downstream:** `GET /health/ready` (`apps/web/src/app/health/ready/route.ts`) returns 200 only when gateway-initialized **and** `databaseManager.health()` (`SELECT 1`, 5s bound) is healthy in production/staging; error text is sanitized via `sanitizeDbError`. The deploy gate (`scripts/deploy/smoke-test.sh`) polls `/health/live` and gates on `/health/ready`, not on the tRPC procedure.

---

## 2. Confirmed vs unknown managed-database prerequisites

**Confirmed from repository evidence (do not re-provision outside these):**

- **Engine:** PostgreSQL 16 (`03_Architecture/DATABASE_V1.md` §1; deployment guide step 2: "provision PostgreSQL 16+").
- **Topology:** one database per service in production (`IDENTITY_DATABASE_URL` + `KNOWLEDGE/DECISION/EXECUTION/MEMORY_DATABASE_URL`; `.env.production.example:40-44`); single-instance layout also documented as acceptable. Identity reads only `config.database.url` (`IDENTITY_DATABASE_URL`); it has no shared-`DATABASE_URL` fallback.
- **Migration procedure:** none beyond startup — every repository bootstraps idempotently (`CREATE TABLE IF NOT EXISTS` + `ADD COLUMN IF NOT EXISTS` + indexes; identity `users` + email/google indexes via `runDdl()`; S12-4A adds `refresh_token_denylist` via `ensureTable()`, wired fire-and-forget in `IdentityModule` and awaited in `createProductionIdentityRepository()` / web `auth-app` cold start). No Drizzle Kit files, no down-migrations for identity.
- **Connection/pooling:** shared bounded pool via `DatabaseManager` (`DB_POOL_MIN` 2, `DB_POOL_MAX` 10, `DB_CONNECT_TIMEOUT_S` 20 for cold serverless endpoints, `DB_IDLE_TIMEOUT_S` 30, `DB_MAX_LIFETIME_S` 1800). Env-tunable; no per-engine pools.
- **Backup expectations:** daily full `pg_dump` 02:00 UTC per service DB + provider PITR preferred; retention ≥30d daily + 12mo monthly; quarterly restore drill (runbook §§1–2, 6). RPO ≤24h, RTO ≤30min.
- **Health checks:** `/health/live` → `/health/ready` (gateway + `SELECT 1`, 503 until satisfied) → `/health/check` (pool counters, zero connection details).

**Unknown — operator-owned, NOT invented here:** provider choice and region; TLS mode/CA (`sslmode`) — no TLS flags in source, operator encodes them in the DSN; role/password rotation, least-privilege role, network allow-list; backup-vendor implementation and the authorized staging instance; production pool sizing (defaults are starting points, not a sizing claim).

---

## 3. Operator ownership and step-by-step handoff

**Owner:** Deployment Operator (Platform/Identity) — individual unassigned (Sprint 012 records UNASSIGNED). Nobody in this checkout can perform these steps.

1. Provision managed PostgreSQL 16+; create the identity database + least-privilege owner role.
2. In the platform environment settings (never a developer `.env.local`), set `IDENTITY_DATABASE_URL` to the managed DSN (provider TLS params included). Confirm name/owner/host via console; never print the value.
3. Set sibling secrets in the same platform environment (`AUTH_JWT_SECRET`, `REDIS_URL`, per-service `*_DATABASE_URL`, pool overrides if sized, `API_CORS_ORIGIN`, `APP_URL`).
4. Redeploy. On boot, `users` + `refresh_token_denylist` (+ indexes) create idempotently — no manual migration step.
5. From an operator shell: `npm run preflight:prod` → exit 0; `npm run doctor:prod` → exit 0; `npm run test:a11y` → exit 0, no identity warning; `curl -fsS $PROD_URL/health/ready` → HTTP 200 `{status:"ready"}`.
6. Enable backups + PITR per runbook §1; schedule the quarterly scratch-restore drill (§6).
7. Record the four outputs + `/health/ready` body as S012-A closure evidence in a follow-up audit note.

---

## 4. Safe verification commands and expected outcomes

| Command (operator env only)          | Expected                              | Current local outcome (this checkout)                                               |
| ------------------------------------ | ------------------------------------- | ----------------------------------------------------------------------------------- |
| `npm run preflight:prod`             | exit 0, all REQUIRED rows `READY`     | exit 1, `Database ✗ MISCONFIGURED` — correct fail-closed, no secret printed         |
| `npm run doctor:prod`                | exit 0, `Database PASS`, config clean | exit 1, `Database FAIL` — correct fail-closed                                       |
| `npm run test:a11y`                  | exit 0, no identity warning           | not re-run here; Sprint 012 records 6/6 UI-only local pass with the warning present |
| `curl -fsS $PROD_URL/health/ready`   | HTTP 200 `{status:"ready"}`           | n/a — no deployment exists                                                          |
| `npm run config:contract` (optional) | exit 0                                | contract suite green in `packages/core` (15/15, executed §1)                        |

No new verification tooling proposed: existing scripts already verify presence without printing credentials (§1).

---

## 5. S12-4A closure artifact verification

Checked without changing unrelated files: `RefreshTokenDenylistStore.ts` ✓, `RefreshTokenDenylistStore.test.ts` ✓, `RefreshTokenRotation.test.ts` ✓, `S12-BLOCKER-4A-CLOSURE.md` ✓ all exist; `AuthService.ts` carries the denylist wiring, `AuthRoutes.ts:200` forwards `signOut(payload.sub, presented)`, `IdentityModule.ts:97` registers the store — consistent with the closure report's §5 list and its evidence (71/71 focused, full suite green, typecheck clean). The 4A `ensureTable()` migration runs automatically against the provisioned identity database on first boot — which is exactly why S012-A (this report) is its deployment precondition.

---

## 6. Remaining approvals; S12 disposition

- **S012-A (this report):** platform approval to provision the managed identity DB + write platform env vars + redeploy + run the four verification commands. No code or migration approval needed (no source change proposed; identity DDL is startup-idempotent with no down-migrations).
- **Still outstanding:** S012-B provider credits, S012-C staging DR drill (signed RTO ≤30min logs), G1 owner confirmation.
- **Explicit statement: S12 remains NO-GO until every mandatory gate passes with authorized evidence.** Production identity readiness is NOT claimed — no managed value exists, both production validators exit 1 locally by design, and no local-PostgreSQL result has been substituted.

---

## 7. Preservation confirmation

HEAD `a124274b0d1fa91f361e0a5775e144658405913a`; 5/5 stashes intact; no stage/commit/push/tag/deploy/reset/clean/revert; no secret printed; no production contacted, created, or migrated; local `preflight:prod`/`doctor:prod` read the local environment only. Sole addition: this report directory.
