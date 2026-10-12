# VedMoulya — Post-Publication Production Readiness Checklist

| Field             | Value                                                                               |
| ----------------- | ----------------------------------------------------------------------------------- |
| Document          | Production Readiness Checklist                                                      |
| Applies to commit | `30a9f829510a316d2189c7e3631b79fe2a7f5e2c` (Sprint 012, published on `main`)        |
| Baseline state    | `origin/main` == local `main` == `30a9f829` (verified `2026-10-12`, 0 ahead/behind) |
| Owner             | UNASSIGNED — deployment operator to designate (do not treat as assigned)            |
| Related report    | [FINAL-REPORT.md](./FINAL-REPORT.md)                                                |
| Status            | No requirement below is complete. All three are operator-gated and NOT RUN.         |

This checklist documents the **three outstanding production-readiness requirements** that
the Sprint 012 evidence could not close locally. It is a plan, not evidence of completion.
It records no invented environment names, credentials, operator approvals, or completed
checks. Each requirement lists an owner, the access/configuration needed, the exact
verification command or procedure, the expected evidence and pass criteria, the actual
result so far, and its blocked/not-run status.

## Baseline verification (Step 1)

| Item                    | Verified result                                                                                      |
| ----------------------- | ---------------------------------------------------------------------------------------------------- |
| `origin/main` vs local  | Equal — both `30a9f829510a316d2189c7e3631b79fe2a7f5e2c`; 0 ahead / 0 behind                          |
| Working tree            | Clean; only the five untracked `_sprint*-live/` evidence directories                                 |
| Git stashes             | Five preserved (`stash@{0}` … `stash@{4}`), unchanged                                                |
| Preserved evidence dirs | `_sprint3-live/`, `_sprint5-live/`, `_sprint6-live/`, `_sprint7-live/`, `_sprint8-live/` — untouched |
| Sprint 012 report       | `docs/audits/2026-10-12-quality-sprint-012/FINAL-REPORT.md` present                                  |
| Separate closure doc    | None committed at this baseline; findings were recorded in review, not in a file                     |

## Safety guardrails (apply to every item below)

- Do not print credentials, connection strings, or secret values; refer to variables by name only.
- Do not load developer `.env.local` files in production/staging; the platform environment is the only source.
- Do not weaken fail-fast validation, tests, coverage thresholds, or verification requirements.
- Do not deploy, purchase, rotate credentials, migrate databases, or run destructive drills without explicit written authorization.
- Preserve the published baseline and all user work; do not push or amend commits while executing this plan.

---

## A. Identity database

**Requirement.** A managed, non-localhost `IDENTITY_DATABASE_URL` must be configured in the
authorized deployment platform so identity/auth initializes in production, with fail-closed
behavior preserved.

| Field                      | Detail                                                                                                                                                                                                                                                                                                                                    |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Responsible operator       | UNASSIGNED — the platform deployment operator who owns the managed PostgreSQL instance and the deployment environment's environment-variable settings                                                                                                                                                                                     |
| Required access/config     | Write access to the deployment platform's environment settings (e.g. the project's environment variables on Vercel, or the equivalent managed host); access to the intended managed PostgreSQL database                                                                                                                                   |
| Configuration source       | The deployment platform's environment settings only. Evidence: `apps/web/src/lib/server-env.ts` (`shouldLoadLocalEnvFiles` is false for production/staging) and `packages/core/src/config/index.ts::requireExternalUrl` (rejects missing/loopback outside development).                                                                   |
| Steps                      | 1. In the deployment platform, set `IDENTITY_DATABASE_URL` to the intended managed PostgreSQL DSN. 2. Confirm it points at the intended database (name/owner/host — verify via console, never print the value). 3. Redeploy so the value is present at process start. 4. Do **not** copy any developer `.env.local` file into production. |
| Exact verification command | `npm run preflight:prod` and `npm run doctor:prod` (production-mode config validation); then `npm run test:a11y` (accessibility gate against the production build). Optionally `npm run config:contract`.                                                                                                                                 |
| Readiness endpoints        | `/health/live` (process liveness), `/health/ready` (gateway + database reachable), `/health/check`                                                                                                                                                                                                                                        |
| Expected evidence          | `preflight:prod` / `doctor:prod` exit 0 with `IDENTITY_DATABASE_URL` reported configured; the auth route no longer logs `[auth-route] Initialization failed: IDENTITY_DATABASE_URL …`; `/health/ready` returns 200; `test:a11y` passes 6/6.                                                                                               |
| Pass criteria              | Non-loopback value present from platform config; config validators exit 0; readiness 200; accessibility gate exit 0 with the identity-initialization warning absent.                                                                                                                                                                      |
| Actual result so far       | NOT RUN against a managed production value. Local `test:a11y` passes 6/6 (exit 0) in the intentional UI-only mode, but the production server logs the fail-closed `IDENTITY_DATABASE_URL` warning because no platform value is present locally.                                                                                           |
| Status                     | BLOCKED — requires the operator to set a real managed `IDENTITY_DATABASE_URL` in the authorized platform.                                                                                                                                                                                                                                 |
| Timestamp / exit code      | Not executed for this requirement — n/a.                                                                                                                                                                                                                                                                                                  |

---

## B. Live cloud AI

**Requirement.** Live cloud AI generation must be validated against a real provider with
billing credits. Authentication or provider negotiation alone is **not** proof of successful
generation.

| Field                      | Detail                                                                                                                                                                                                                                                                                                                                    |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Responsible operator       | UNASSIGNED — the account operator who owns the OpenAI account/billing (or the designated provider owner). This checklist does not purchase credits or change credentials.                                                                                                                                                                 |
| Required access/config     | Resolution of the provider billing-credit limitation on the account; the documented environment for the verifiers (`OPENAI_API_KEY` for the OpenAI-targeted scripts, plus `AUTH_JWT_SECRET`). Do not spend money or rotate credentials autonomously.                                                                                      |
| Exact verification command | `npm run ai:production:verify` followed by `npm run ai:critique:verify` (or `npx tsx scripts/ai-production-verify.ts` / `scripts/ai-critique-verify.ts`) under the documented environment.                                                                                                                                                |
| Expected evidence          | Both scripts exit 0 with real live-call counts and provider/model results recorded (not merely "provider configured"). A non-zero exit or a "LIVE VALIDATION BLOCKED" message means generation did not happen and must not be recorded as success.                                                                                        |
| Pass criteria              | `ai-production-verify` exits 0 with successful live generation, token accounting, and the full Phase 1 checklist; `ai-critique-verify` exits 0 with the live AI critique executed (not just the deterministic critic).                                                                                                                    |
| Actual result so far       | Last executed during Sprint 012: `scripts/ai-production-verify.ts` exit 3 and `scripts/ai-critique-verify.ts` exit 3. Provider auth and model negotiation succeeded; the real OpenAI call was refused with a no-billing-credits error. `ai-critique-verify` reported 4/5 implementation checks passing with the live AI critique blocked. |
| Status                     | BLOCKED — billing credits are the only recorded blocker. Not re-run here (a re-check would consume a billed call if credits were added).                                                                                                                                                                                                  |
| Preserved fallback         | The local Ollama provider path remains verified (real provider registered and successful reasoning calls during the Sprint 012 recovery harnesses). Do not remove it.                                                                                                                                                                     |
| Timestamp / exit code      | 2026-10-12 · `ai:production:verify` exit 3 · `ai:critique:verify` exit 3 (both BLOCKED, no generation).                                                                                                                                                                                                                                   |

---

## C. Staging recovery and restore

**Requirement.** Backup, restore, failover, and rollback must be exercised on an **authorized**
staging environment with a managed database — never against production or an unapproved
environment.

| Field                         | Detail                                                                                                                                                                                                                                                                                                                                          |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Responsible operator          | UNASSIGNED — the staging/managed-database owner. Requires explicit written approval for a recovery window and backup/restore access.                                                                                                                                                                                                            |
| Required access/config        | An authorized staging (or staging-equivalent) environment; managed PostgreSQL backup/restore and point-in-time-recovery access; Redis (if applicable); a scratch database for restore validation. No such environment is configured in this repository or the local environment.                                                                |
| Reference procedures          | `docs/runbooks/backup-restore-runbook.md` (backup, restore, schema rollback, environment recovery, restore testing), `docs/runbooks/rollback-runbook.md`, `docs/runbooks/deployment-runbook.md`, helper `scripts/backup.sh`.                                                                                                                    |
| Pre-checks (before any drill) | Confirm written approval + named recovery window + rollback plan; confirm the target is staging, not production; confirm a fresh backup exists and its integrity is verifiable.                                                                                                                                                                 |
| Procedure outline             | 1. Take/verify a current backup (e.g. `bash scripts/backup.sh --db identity --out ./backups`, or the managed provider's snapshot). 2. Validate the backup (restore into a scratch database). 3. Perform the restore on the approved staging target. 4. Run readiness/failover checks. 5. Execute rollback per the runbook. 6. Capture evidence. |
| Exact verification commands   | `psql "$SCRATCH_DATABASE_URL" < restore.sql` then `curl -fsS "$SCRATCH_URL/api/trpc/health.check"` (per the backup/restore runbook's restore test); readiness endpoints `/health/live` and `/health/ready`.                                                                                                                                     |
| Expected evidence             | Backup artifact identifier and integrity result; restore completion within the documented RTO (≤ 30 min); row-count/key-invariant checks; readiness 200 after restore; failover/recovery observation; rollback confirmed; timestamps and exit codes recorded.                                                                                   |
| Pass criteria                 | Restore into the scratch/staging target succeeds and passes invariants; readiness returns 200; failover and rollback complete as documented; no destructive action against production.                                                                                                                                                          |
| Actual result so far          | NOT RUN. No authorized staging environment exists in this repository or locally; local Docker provides only development `postgres` and `redis`. The `release` workflow deploys to GitHub Environments per stage with secrets not present locally.                                                                                               |
| Status                        | BLOCKED — requires an approved staging environment, backup/restore access, and a defined recovery window.                                                                                                                                                                                                                                       |
| Timestamp / exit code         | Not executed — n/a.                                                                                                                                                                                                                                                                                                                             |

---

## Completion evidence summary

| Requirement          | Owner      | Required access/config                           | Verification command / procedure                                                      | Expected evidence / pass criteria                          | Actual result                                   | Status / timestamp   |
| -------------------- | ---------- | ------------------------------------------------ | ------------------------------------------------------------------------------------- | ---------------------------------------------------------- | ----------------------------------------------- | -------------------- |
| A. Identity database | UNASSIGNED | Platform env write + managed PostgreSQL access   | `npm run preflight:prod`; `npm run doctor:prod`; `npm run test:a11y`; `/health/ready` | Validators exit 0; warning absent; readiness 200; a11y 6/6 | Local a11y 6/6 (UI-only); no platform value set | BLOCKED — n/a        |
| B. Live cloud AI     | UNASSIGNED | OpenAI billing credits + documented env          | `npm run ai:production:verify`; `npm run ai:critique:verify`                          | Both exit 0 with real live generation                      | Sprint 012: exits 3 and 3 — no-credits block    | BLOCKED — 2026-10-12 |
| C. Staging recovery  | UNASSIGNED | Authorized staging env + backup/restore + window | `docs/runbooks/backup-restore-runbook.md` procedure; `curl …/health.check`            | Restore + invariants pass; readiness 200; rollback OK      | No staging environment available                | BLOCKED — NOT RUN    |

## Concrete implementation defects discovered

None. The Sprint 012 verification pass found no implementation defect:
the identity-warning behavior is intentional fail-closed configuration
(`shouldLoadLocalEnvFiles` + `requireExternalUrl`), the cloud-AI result is a provider
billing/operator limitation, and the staging gap is an environment/authorization gap.
No code change is warranted by this checklist.

## Not-run / blocked summary

- **A. Identity database** — BLOCKED on an authorized platform `IDENTITY_DATABASE_URL`.
- **B. Live cloud AI** — BLOCKED on provider billing credits (last result: exit 3 / exit 3, no generation).
- **C. Staging recovery & restore** — BLOCKED on an authorized staging environment and recovery window.

Stop here. Do not execute paid or staging operations until the owning operator provides
explicit authorization and the required access.
