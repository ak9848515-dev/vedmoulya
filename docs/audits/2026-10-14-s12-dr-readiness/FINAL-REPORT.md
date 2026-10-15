# VedMoulya — S12 Blocker C: Staging Disaster-Recovery Readiness Audit

**Date (UTC):** 2026-10-14
**Branch:** `main` · **HEAD:** `a124274b0d1fa91f361e0a5775e144658405913a` (unchanged)
**Scope:** S012-C readiness audit only — no restore, failover, rollback, or destructive recovery operation executed; no production contacted; no secret accessed or disclosed.
**Safety:** no reset, clean, revert, stage, commit, push, tag, or deploy. All five stashes preserved. All tracked/untracked work and prior audit evidence untouched.

---

## Verdict: **BLOCKED** (readiness documented; drill not run)

DR readiness cannot be claimed: no authorized staging environment exists in-repo or locally, no backup artifact exists (`backups/` absent, zero `*.sql.gz`), no automated backup schedule is configured in-repo (no cron, no workflow step), and the mandatory staging drill has never run (`production-config-check` → `BACKUP / RECOVERY: OPERATOR_REQUIRED`). This report pins the recovery sequence, thresholds, existing automation vs test evidence, missing evidence, RPO/RTO measurement, and the exact operator handoff to source. **S12 remains NO-GO** until every mandatory gate passes (S012-A; S012-B; S012-C here; G1).

---

## 0. Git baseline and preservation evidence

| Item          | State                                                                                                                                                                                                                                                                                                                       |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Branch / HEAD | `main` / `a124274b0d1fa91f361e0a5775e144658405913a` (before and after; unchanged)                                                                                                                                                                                                                                           |
| Stashes       | 5/5 preserved (`pre-security-baseline-healthprobe`; 3× lint-staged backups; WIP release-candidate-v1.0.0)                                                                                                                                                                                                                   |
| Tree          | 139 short-status entries (Sprint 026 baseline + S12-4A set + S12-A/B reports); sole addition is this report directory                                                                                                                                                                                                       |
| Evidence read | `backup-restore-runbook.md` (85 lines) · `rollback-runbook.md` · `deployment-runbook.md` · `ROLLBACK_GUIDE.md` (34) · `07_Operations/BACKUP.md` · `scripts/backup.sh` (44) · `scripts/deploy/smoke-test.sh` · `BLOCKER-REPORT-S12-PRODUCTION.md` · sprint-026 `FINAL-REPORT.md` · sprint-012 checklist §C · S12-A/B reports |

---

## 1. Runbook-derived recovery sequence and acceptance thresholds

**Objectives (verbatim from `backup-restore-runbook.md`; not invented or changed):**

- **RPO ≤ 24 h** (daily full backups) + continuous WAL shipping where the managed provider supports it.
- **RTO ≤ 30 min** for a full restore (full restore takes 10–30 min with full downtime; prefer provider PITR for shorter RTO).

**Sequence (runbook §1–§6 + checklist §C):**

1. **Backup** — daily `pg_dump --format=custom --no-owner | gzip` per service DB at 02:00 UTC → S3 (or provider-managed backups preferred, PITR enabled); manual pre-release `bash scripts/backup.sh --db identity --out ./backups`. Retention: daily ≥ 30 d, monthly archive ≥ 12 mo, restore test ≥ quarterly.
2. **Stop writes** — maintenance/read-only on the affected service.
3. **Download + decompress** the target backup from S3.
4. **Restore (destructive)** — `psql "$IDENTITY_DATABASE_URL" < restore.sql`.
5. **Verify integrity** — row counts, key invariants, smoke `/api/trpc/health.check`; readiness `/health/live` + `/health/ready` (gateway init + real DB `SELECT 1`, 503 until satisfied).
6. **Resume writes** — pooled connections recover automatically.
7. **Rollback (if release-induced)** — `rollback-runbook.md` / `ROLLBACK_GUIDE.md`: redeploy previous tag (Vercel instant < 1 min; Railway < 2 min), down-migrations or restore pre-deploy backup, verify health + key flows, post-mortem ≤ 48 h.
8. **Environment recovery** — recreate env from `.env.production.example` + secrets vault (fail-fast at startup); Redis from persistence or accept cache rebuild.
9. **Record** — outcome into `09_Documents/Lessons Learned.md` (exists).

**Acceptance thresholds (checklist §C + runbook):** restore into scratch/staging succeeds and passes row-count/key invariants; readiness returns 200; restore completes **within RTO ≤ 30 min**; failover and rollback complete as documented; no destructive action against production; artifact id + integrity result + timestamps + exit codes recorded.

---

## 2. Existing automation and test evidence

| Component                    | Automation/test                                                                                                                                       | Evidence                                                                                                                                                                                                        |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Backup script                | `scripts/backup.sh` — `set -euo pipefail`; per-service `pg_dump --format=custom --no-owner \| gzip`; skips unset URLs; `--db <svc\|all>`              | Statically inspected (safe): **no `backups/` dir, no `*.sql.gz` exist** → never run here. Not unit-tested (no `backup*.test.ts` in-repo).                                                                       |
| Backup schedule              | Runbook: 02:00 UTC daily + S3 upload                                                                                                                  | **ABSENT** — no cron, no `ci.yml`/`release.yml` backup step (grep 0 matches). Operator-configured at deployment only.                                                                                           |
| PITR                         | Runbook: enable provider PITR                                                                                                                         | **ABSENT** — no provider config in-repo (platform-owned).                                                                                                                                                       |
| Restore drill                | Runbook §6 quarterly scratch restore (`psql < restore.sql`; curl health.check)                                                                        | **NOT RUN** — no authorized staging, no backup to restore.                                                                                                                                                      |
| Readiness probes             | `/health/live`, `/health/ready` (gateway + `SELECT 1`, 503 until ready), `/health/check`; `smoke-test.sh` polls live→ready (120s timeout)             | **Tested** — `health-routes.test.ts` pins contract (503 never relaxed). Executed safe: typecheck `services/api` + `services/identity` **clean**.                                                                |
| Restart/persistence recovery | `live-restart-acceptance.ts` (26/26 PASS, Sprint 012); `live-real08-postgres-recovery.ts` (9/9 PASS); `OpportunityMissionTracePostgres.test.ts` (1/1) | Local-Postgres PASS (real DB, dev machine) — **application crash-recovery, not a backup-restore drill.** Do not conflate.                                                                                       |
| Rollback automation          | Vercel instant rollback, Railway rollback, Docker rollback, `psql` restore                                                                            | **Documented, not executed** (no production deployment exists). `ROLLBACK_GUIDE.md`: newest tag `v1.0.3` never deployed.                                                                                        |
| Schema rollback              | `npx prisma migrate resolve` / `drizzle-kit drop` + `SELECT version FROM _migrations`                                                                 | **INCOMPATIBLE** — see gap (i). No Prisma/Drizzle-migrate framework in use; identity has no down-migrations.                                                                                                    |
| Config honesty gate          | `npx tsx scripts/production-config-check.ts`                                                                                                          | **Executed (safe):** `BACKUP / RECOVERY: OPERATOR_REQUIRED` — "Configure Postgres backups + restore drill; verify restart-recovery (4/4 harness)." Fails closed; never claims a configured backup was restored. |

---

## 3. Confirmed code/documentation gaps (verified safely; not fixed — audit scope)

- **(i) Schema-rollback commands target a non-existent framework.** `rollback-runbook.md` says `npx prisma migrate resolve` / `npx drizzle-kit drop` + `SELECT version FROM _migrations`; the forensic audit already flagged `npm run migrate` as nonexistent. Reality: startup-idempotent DDL (`CREATE TABLE IF NOT EXISTS`), no `_migrations` table, no identity down-migrations. **Recommendation:** replace with "restore from pre-deploy backup" (the actual path) + note idempotent DDL needs no forward migration rollback.
- **(ii) No automated backup schedule in-repo** — the 02:00 UTC cron/S3 upload is documentation-only; nothing enforces it. Operator must configure (provider backup feature preferred).
- **(iii) No backup/restore unit or integration test** — `scripts/backup.sh` untested; no test asserts dump→restore fidelity. **Recommendation:** hermetic test (local Docker postgres, scratch DB, dump/restore round-trip, row-count invariant) — safe, no staging needed.
- **(iv) No evidence-format template** — checklist lists expected evidence fields but no canonical log template exists for RPO/RTO capture.

None fixed this sprint: the mandate is to identify, not repair, absent evidence; fixing (i) is a doc edit recommended to the owner.

---

## 4. Missing operational evidence (reported as absent)

1. **Authorized staging environment** — none in-repo or locally (local Docker = dev postgres/redis only; `release.yml` uses GitHub Environments with secrets not present locally).
2. **Backup artifacts** — zero `*.sql.gz`; no `backups/` directory; no S3 objects referenced as existing.
3. **Executed restore** — no drill ever run; no row-count/invariant output; no readiness-200-after-restore record; no RTO measurement.
4. **Failover/rollback execution** — no observed failover, no executed rollback, no signed recovery logs.
5. **Backup schedule / PITR configuration** — not present in-repo; operator-configured and unverified.
6. **Retained down-migrations for last N releases** — required by runbook §3; none exist (gap i).

A configured-but-unrestored backup is **not** evidence of recoverability; nothing here implies otherwise.

---

## 5. Operator prerequisites, approvals, and drill procedure

**Owner:** Staging/Managed-Database Owner (Sprint 012: UNASSIGNED) — requires explicit written approval. Nobody in this checkout can perform these steps.

**Prerequisites:** authorized staging (or staging-equivalent) environment; managed PostgreSQL with backup/restore + PITR access; a scratch database for pre-validation; Redis if applicable; a deployed endpoint smoke-testable via `smoke-test.sh`; named recovery window + rollback plan in writing.

**Pre-drill checks (checklist §C):** confirm written approval + named window + rollback plan; confirm target is staging (never production); confirm a fresh backup exists and its integrity is verifiable (dump + `gzip -t` / `pg_restore --list`).

**Drill procedure (timing instrumented):**

1. **T0** (record `date -u +%FT%TZ`) — take/verify backup: `bash scripts/backup.sh --db identity --out ./backups` (or provider snapshot); record artifact id + integrity result.
2. **T1** — validate into scratch: `psql "$SCRATCH_DATABASE_URL" < restore.sql`; row-count/key-invariant checks (e.g. `SELECT count(*) FROM users;` + table/index existence per service).
3. **T2** — restore on approved staging target: stop writes → download → `psql "$STAGING_URL" < restore.sql`.
4. **T3** — readiness: `curl -fsS "$STAGING_URL/health/live"` then `/health/ready` → HTTP 200 `{"status":"ready"}`; optionally `bash scripts/deploy/smoke-test.sh "$STAGING_URL"`.
5. **T4** — failover/rollback per `rollback-runbook.md`; complete the post-rollback verification checklist (health 200, routes 200, latency normal, logs clean).
6. **T5** — record end timestamp; compute **RTO = T3 − T0 ≤ 30 min**; compute **RPO** = age of backup used ≤ 24 h. Record both with evidence lines, exit codes, artifact ids. Record outcome in `09_Documents/Lessons Learned.md`.

---

## 6. RPO/RTO measurement and documentation

- **RTO:** wall-clock from restore-start (T0) to readiness-200 (T3) on the restored target; must be **≤ 30 min** (runbook mandatory). Timestamps via `date -u +%FT%TZ` at each step; exit codes recorded per command.
- **RPO:** interval between the last successful backup (or PITR WAL segment) and the simulated failure point; must be **≤ 24 h** with daily backups (tighter with PITR). Derived from the backup artifact's creation timestamp vs failure timestamp.
- **Documentation:** one evidence block per drill — artifact id, integrity result, per-step timestamps, exit codes, row-count/invariant outputs, readiness status, observed failover/rollback result, computed RTO/RPO vs thresholds, operator name + approval reference — retained with the audit trail (checklist §C "Expected evidence"). No template exists yet (gap iv).

---

## 7. Rollback, data-integrity, and post-recovery verification requirements

- **Rollback:** `ROLLBACK_GUIDE.md` §Procedure — assess → notify → redeploy previous known-good tag → down-migrations or restore pre-deploy backup → verify health endpoints `status: ok` + key flows (auth/dashboard/search) smoke-pass → post-mortem ≤ 48 h. Critical triggers (immediate rollback): HTTP 5xx > 0, auth/dashboard/search broken, data-integrity issue, security incident.
- **Data integrity:** after a rollback following a data-affecting release, verify **row counts and key invariants against the pre-deploy backup before resuming writes** (`ROLLBACK_GUIDE.md` §Data Integrity); restore step 4 performs the same invariant checks.
- **Post-recovery:** `/health/ready` 200 (gateway + `SELECT 1`), `/health/live` 200, `/health/check` clean, pooled connections re-established, no fail-closed startup warnings, stakeholders notified. `smoke-test.sh` automates the ready-gate (120s bounded).

---

## 8. Exact remaining dependencies and ownership

| Dependency                                                                                           | Owner                         | Evidence to produce                                      |
| ---------------------------------------------------------------------------------------------------- | ----------------------------- | -------------------------------------------------------- |
| Authorized staging environment + written approval + recovery window                                  | Staging/DB Owner (UNASSIGNED) | Approval record + named window                           |
| Managed PG backup schedule (02:00 UTC daily) + PITR enabled + retention (≥30d daily / ≥12mo monthly) | Platform Engineering / DevOps | Provider console evidence + first successful artifact id |
| Executed drill: RTO ≤ 30 min, RPO ≤ 24 h, invariants pass, readiness 200                             | Staging/DB Owner              | Signed recovery log per §5/§6 → `Lessons Learned.md`     |
| Rollback executed + post-rollback checklist complete                                                 | Platform Engineering          | Rollback history row + checklist evidence                |
| Fix gap (i) schema-rollback doc commands (doc-only, no creds needed)                                 | Platform Engineering          | Corrected runbook lines                                  |
| Optional: hermetic dump/restore round-trip test (gap iii)                                            | DevOps/Eng                    | Test file + green run                                    |

---

## 9. Preservation confirmation; S12 disposition

HEAD `a124274b0d1fa91f361e0a5775e144658405913a`; 5/5 stashes intact; no stage/commit/push/tag/deploy/reset/clean/revert; no secret accessed or disclosed; no production contacted; no restore/failover/rollback executed (runbooks and scripts inspected instead of executed against infrastructure); sole addition is this report directory. Safe checks executed: `production-config-check` (reports OPERATOR_REQUIRED — honest), `backup.sh` static inspection (no artifacts exist), typecheck `services/api` + `services/identity` clean, `smoke-test.sh` inspected (not run — no deployed endpoint).

**Explicit statement: S12 remains NO-GO until every mandatory release gate is satisfied with authorized evidence.** DR readiness is NOT claimed — no authorized staging environment exists, no backup has ever been restored, and the mandatory drill is BLOCKED / NOT RUN. A configured backup that was never restored is not recoverability evidence.
