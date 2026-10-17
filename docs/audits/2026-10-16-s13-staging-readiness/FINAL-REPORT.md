# VedMoulya — S13 Staging Readiness & Operational Closure (FINAL REPORT)

**Date (UTC):** 2026-10-16
**Branch:** `main` · **Initial HEAD:** `a45e8bde` (ahead 4 / behind 0 of `origin/main`)
**Mode:** repository-backed closure. No push, deploy, production migration, paid purchase, or infrastructure change. No secret printed, logged, or committed. Local / CI / staging / production evidence are kept separate throughout.

---

## 1. Git state and preservation

| Item                | State                                                                      | Evidence                                                       |
| ------------------- | -------------------------------------------------------------------------- | -------------------------------------------------------------- |
| Initial HEAD        | `a45e8bde`                                                                 | `git rev-parse HEAD` (verified before acting)                  |
| Upstream divergence | `main` ahead 4 / behind 0 of `origin/main`                                 | `git rev-list --left-right --count main...origin/main` → `4 0` |
| Stashes             | **5/5 preserved**                                                          | `git stash list`                                               |
| Tree (initial)      | clean except the two pre-existing `lint-out.txt`, `lint-output.txt`        | `git status --short`                                           |
| Local-only commits  | `f1dbce7f`, `495dec3e`, `f50663af`, `a45e8bde` — **preserved**             | `git log`                                                      |
| Final HEAD          | the single S13 closure commit on top of `a45e8bde` (hash in `git log`; §8) | —                                                              |
| Stashes (final)     | **5/5 preserved**                                                          | `git stash list`                                               |

The two `lint-*.txt` files were inspected and **left untouched and uncommitted** (they are not part of any reviewed change).

---

## 2. S012-A — Managed identity database: **BLOCKED** (operator-owned)

**Authoritative criteria:** `BLOCKER-REPORT-S12-PRODUCTION.md` §1; `docs/audits/2026-10-14-s12-identity-readiness/FINAL-REPORT.md`; `docs/ops/DEPLOYMENT_GUIDE.md`; `03_Architecture/DATABASE_V1.md`; `packages/core/src/config/index.ts` (`requireExternalUrl('IDENTITY_DATABASE_URL', …)`).

**Requirement (repo-verifiable):** outside `NODE_ENV=development`, `IDENTITY_DATABASE_URL` is REQUIRED, must be non-loopback, and must be supplied by the platform environment (production/staging load no local env files). Identity reads only `config.database.url` — no shared-`DATABASE_URL` fallback.

**Safe checks executed this run (no external infrastructure contacted):**

| Command                                                                | Exit  | Observed                                                                                              |
| ---------------------------------------------------------------------- | ----- | ----------------------------------------------------------------------------------------------------- |
| `npx tsx scripts/preflight.ts --mode production --allow-missing-build` | **1** | `Database ✗ MISCONFIGURED`; overall `BLOCKED` — correct fail-closed                                   |
| `npx tsx scripts/doctor.ts --mode production --allow-missing-build`    | **1** | `Database FAIL — IDENTITY_DATABASE_URL is required in production (no localhost default)`; `NOT READY` |
| `npx vitest run packages/core/.../production-config-contract.test.ts`  | **0** | **15/15 passed** — non-localhost accepted, loopback/missing rejected                                  |

**Repo-verifiable vs infra-gated:**

- _Repo-verifiable (confirmed):_ PostgreSQL 16+; one DB per service; startup-idempotent DDL + identity's versioned ledger (`identity_schema_migrations`, **no down-migrations**); shared bounded pool (`DB_POOL_MIN/MAX`, `DB_CONNECT_TIMEOUT_S`, `DB_IDLE_TIMEOUT_S`, `DB_MAX_LIFETIME_S`); health contract `/health/live` → `/health/ready` (gateway + `SELECT 1`, 503 until ready) → `/health/check`; the readiness gate `IDENTITY_SCHEMA_READINESS_GATE` (opt-in).
- _Infra-gated (NOT invented):_ provider/region; TLS `sslmode`/CA (operator encodes in the DSN — no TLS flags in source); least-privilege role and rotation; network allow-list; pool sizing; the managed endpoint itself.

**Blocker:** no authorized, managed, non-localhost identity database exists in any environment reachable from this checkout. Local PostgreSQL is **not** acceptable evidence (the S12 identity report reached the same verdict).

**Operator handoff (owner: Deployment Operator, Platform/Identity — UNASSIGNED):**

1. Provision managed PostgreSQL 16+; create the identity DB + least-privilege owner role.
2. Set `IDENTITY_DATABASE_URL` (provider TLS params included) in the **platform** environment — never a developer `.env.local`. Confirm name/host via console; never print the value.
3. Set siblings in the same environment (`AUTH_JWT_SECRET`, `REDIS_URL`, per-service `*_DATABASE_URL`, `API_CORS_ORIGIN`, `APP_URL`, plus any pool overrides).
4. Redeploy; boot creates `users` + `refresh_token_denylist` (+ indexes) idempotently — no manual migration step.
5. Produce closure evidence: `npm run preflight:prod` exit 0 · `npm run doctor:prod` exit 0 · `npm run test:a11y` exit 0 · `curl -fsS $URL/health/ready` → 200 `{"status":"ready"}`.
6. Enable provider backups + PITR and schedule the quarterly restore drill (see §3).

**Acceptance requires evidence from the intended managed database; it is NOT met.**

---

## 3. S012-C — Staging disaster-recovery drill: **BLOCKED** (not run)

**Authoritative criteria:** `docs/runbooks/backup-restore-runbook.md` (RPO ≤ 24 h; RTO ≤ 30 min; retention ≥ 30 d daily / ≥ 12 mo monthly; quarterly drill); `docs/runbooks/rollback-runbook.md`; `docs/audits/2026-10-14-s12-dr-readiness/FINAL-REPORT.md`; `BLOCKER-REPORT-S12-PRODUCTION.md` §3.

**Evidence gathered this run (no drill performed):**

| Item                                         | Result                                                                                     |
| -------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `backups/` directory                         | **absent**                                                                                 |
| `*.sql.gz` artifacts                         | **none**                                                                                   |
| Backup step in `.github/workflows/*.yml`     | **none**                                                                                   |
| `scripts/backup.sh`                          | present, but never executed here (no writes performed)                                     |
| `npx tsx scripts/production-config-check.ts` | `DATABASE OPERATOR_REQUIRED` — fails closed, never claims a configured backup was restored |
| Authorized staging environment               | **none reachable**                                                                         |

**Blocker:** no authorized staging environment, no backup artifact, no configured schedule. Per the safety constraints, a drill was **not** attempted (no restore over shared data, no infrastructure change). A configured-but-unrestored backup is not recoverability evidence.

**Operator handoff (owner: Staging/Managed-DB Owner — UNASSIGNED):** written approval + named recovery window + rollback plan; take/verify a backup (`bash scripts/backup.sh --db identity --out ./backups` or a provider snapshot) and record its id + integrity; restore into a **scratch** DB then the approved staging target; verify row counts/key invariants; `curl -fsS "$STAGING_URL/health/ready"` → 200; measure **RTO = readiness-200 − backup-start ≤ 30 min** and **RPO ≤ 24 h**; record the evidence block in `09_Documents/Lessons Learned.md`. Full procedure: `backup-restore-runbook.md` §2/§6.

---

## 4. Canonical CI E2E (G8): **NOT RUN**

Documented from `.github/workflows/ci.yml` (job `e2e`, `name: 'G8: End-to-End Tests'`):

- **Trigger:** `push`/`pull_request` to `main`/`develop`; runs after `build`. **Has not run against the current commit** — and must not be triggered by a push without authorization.
- **Service topology:** PostgreSQL 16 (`pgvector/pgvector:pg16`) + Redis 7 (`redis:7-alpine`); CI hostnames `db.ci.internal`/`redis.ci.internal` aliased to loopback; bounded `pg_isready`/`redis-cli ping` gate.
- **Seeded user:** `e2e-user` (`e2e@vedmoulya.com`) inserted idempotently (`ON CONFLICT DO NOTHING`) with the full `users` DDL — the Playwright auth helper mints a JWT for it.
- **Environment:** `AUTH_JWT_SECRET` (CI test value), `AI_ENABLE_MOCK=true`, `AI_MAX_INPUT_TOKENS/OUTPUT_TOKENS/PROVIDER_TIMEOUT_MS/TOOL_ALLOWLIST`, `EMAIL_DELIVERY_MODE=log`, per-engine `*_DATABASE_URL`, raised `RATE_LIMIT_*` tiers, `AI_WORLD_CADENCE_ENABLED=0`.
- **Execution:** `npm ci` → infra → seed → `npm run build -w apps/web` → `npx playwright install chromium` → `npm run test:e2e` (`apps/web`, `next start`, production mode).
- **Artifacts:** `apps/web/playwright-report/` uploaded on failure (`playwright-report` artifact).

**Result: NOT RUN** — no CI run exists for the current commit, and no push is authorized. The S12 read-only local subset remains as local-only context (harness proven; `networkidle` failures are a `next dev` artifact, not a product result) and is **not** a substitute for G8.

---

## 5. Staging readiness-gate evidence: **NOT VERIFIED**

No authorized deployed service exists, so `IDENTITY_SCHEMA_READINESS_GATE=1` **cannot** be confirmed in an actual deployment. The following is **local/test evidence only** (`f50663af`): the gate is proven against real PostgreSQL across `disabled` (no I/O) / `current` (200) / `behind`→`pending` (503) / `unreachable`→`unavailable` (503), with a regression suite of **25/25**. Staging readiness is **NOT** claimed.

---

## 6. Dependency advisories — decision

`npm audit --omit=dev` → **0 vulnerabilities** (production surface clean). All **12 high** advisories are **development-only** (Storybook webpack builder; commitizen/cz-conventional-changelog/find-node-modules/findup-sync/braces/micromatch; lint-staged). `npm audit fix --dry-run` proposes **no in-range fix** (only `--force`); the repo gate `npm run audit --audit-level=critical` **exits 0**.

**Decision: no change applied.** These are dev-tooling-only with no production exposure; forcing majors/overrides is not justified by evidence. Status: **accepted / documented** (owner: Platform Engineering; revisit if a non-breaking fix lands upstream).

---

## 7. Release checklist

| Gate                              | Result                   | Note                                                   |
| --------------------------------- | ------------------------ | ------------------------------------------------------ |
| Repository truth / preservation   | **PASS**                 | §1                                                     |
| Formatting (repo-wide Prettier)   | **PASS**                 | re-run on S13 docs                                     |
| `git diff --check`                | **PASS**                 | no whitespace errors                                   |
| Config contract                   | **PASS**                 | `npm run config:contract`                              |
| Typecheck                         | **PASS (reused)**        | S12 `f50663af`; no code changed by S13                 |
| Lint                              | **PASS (reused)**        | S12 `f50663af`                                         |
| Tests                             | **PASS (reused)**        | S12: 1005 files / 0 fail; **+25/25** gate suite re-run |
| Coverage                          | **PASS (reused)**        | S12: 28/28 workspaces                                  |
| Production build / bundle budgets | **PASS (reused)**        | S12 `f50663af`                                         |
| Security audit                    | **PASS (critical gate)** | 12 dev-only high advisories accepted (§6)              |
| Secret scan                       | **PASS**                 | no real secrets; test fixtures only                    |
| Quality gates                     | **PASS (reused)**        | S12: 18/18                                             |
| Accessibility                     | **PASS (reused)**        | S12: 6/6                                               |
| Migration / schema-drift          | **PASS (local)**         | real-PostgreSQL suites + gate states                   |
| **S012-A** managed identity DB    | **BLOCKED**              | §2 — no managed endpoint                               |
| **S012-C** staging DR drill       | **BLOCKED**              | §3 — no staging / no backup                            |
| **CI G8 E2E**                     | **NOT RUN**              | §4 — no run for current commit                         |
| **Staging readiness gate**        | **NOT VERIFIED**         | §5 — no deployed service                               |
| Deployment smoke                  | **NOT RUN**              | no authorized deployment                               |

Code gates marked "reused" are unchanged since commit `f50663af`; S13 changed **Markdown only**, so those gates are not invalidated and were not needlessly re-run.

---

## 8. Changes and commits

S13 reviewed changes (this commit, on top of `a45e8bde`):

- `docs/audits/2026-10-16-s13-staging-readiness/FINAL-REPORT.md` — **new** (this report).
- `docs/runbooks/backup-restore-runbook.md` — §3 "Schema Rollback" corrected to the repository's actual path (no Prisma/Drizzle Kit/`_migrations`; startup-idempotent forward-only DDL; restore-from-pre-deploy-backup), removing an operational instruction that could not run.

Prior commits relied on (unchanged): `a45e8bde` (S12 evidence report), `f50663af` (S012-B close + readiness-gate fix), `495dec3e`, `f1dbce7f` (local-only). No push.

---

## 9. Residual risks, owners, next actions

| Risk / gap                              | Owner                                   | Next action                                                                                             |
| --------------------------------------- | --------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| S012-A: no managed identity DB          | Deployment Operator (Platform/Identity) | Provision + set platform env + produce §2 evidence                                                      |
| S012-C: no staging / no DR drill        | Staging/Managed-DB Owner                | Authorize staging; run the drill per §3                                                                 |
| Readiness gate unverified in deployment | Platform Engineering                    | Confirm `IDENTITY_SCHEMA_READINESS_GATE=1` and DB at `005_timestamptz_instants` on the deployed service |
| CI G8 never run for current commit      | CI Owner                                | Authorize a run for the S13 commit (no push without approval)                                           |
| 12 dev-only high advisories             | Platform Engineering                    | Accept (documented) or adopt a future non-breaking fix                                                  |
| Local-only commits not pushed           | Repository Owner                        | Authorize push when ready                                                                               |

---

## 10. Recommendations

- **LOCAL CANDIDATE — GO (local evidence only).** Supported by: full test suite 1005/0, coverage 28/28, typecheck/lint/build/bundle/security/quality/a11y green (commit `f50663af`), readiness-gate 25/25 plus real-PostgreSQL drift/unreachable behavior, and the read-only local E2E harness proven. This is a **local** statement and says nothing about a deployed environment.
- **STAGING — CONDITIONAL GO.** Conditional on the authorized environment being provisioned and evidenced: managed identity DB (§2), CI G8 E2E run (§4), and deployed readiness (`IDENTITY_SCHEMA_READINESS_GATE=1`, `/health/ready` 200, drift → 503) (§5). None are met today.
- **PUBLIC PRODUCTION — NO-GO.** Mandatory S012-A and S012-C remain unresolved, the deployment readiness gate is unverified, and CI G8 has not run for the current commit. **No** production readiness is claimed from local or CI-only evidence.
