# S14 RC Closure — Reconciled Release Gap Register

**Reconciled date (UTC):** 2026-10-18
**Scope:** `docs/audits/2026-10-16-s14-rc-closure`
**Reconciled HEAD:** `08731d2287762299479ac8be738aa0089c433ce0` (`main`, equal to `origin/main`; supersedes `afef0cb6` after audit consolidation) — confirmed by `git rev-parse HEAD` and `git rev-parse origin/main` on 2026-10-18
**Merged feature history:** PR #44 (`b8aa12bcdce095a1be2bdb649a80ff4c001741f2`) merged into `main`, followed by audit/hygiene consolidation commit `08731d22`
**Basis:** Historical snapshot from a previously preserved `stash@{0}` untracked file plus current tracked state. The TLS SNI fix that lived in that stash was **applied into commit `08731d22`**, after which the stash was dropped; **zero stashes remain** (verified 2026-10-18: `git stash list` empty, no `refs/stash`). Nothing was restored from the stash during this reconciliation.
**Safety:** No external database, environment, deployment, paid API, push, merge, or stash change was performed for this reconciliation. Secrets and credential values are excluded by policy.

## Source inventory

| Source                                                                        | Location/status on 2026-10-17                                                                                                                                                                       |
| ----------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `docs/audits/2026-10-16-s14-rc-closure/FINAL-REPORT.md`                       | Tracked in `main`; §17 records later commit state                                                                                                                                                   |
| Historical `RELEASE-GAP-REGISTER.md`                                          | **Not tracked**; earlier read-only copy was in the `stash@{0}` untracked snapshot parent `99ee76983e9840e88422d2d3316e2469ed7973cb` (that stash has since been applied into `08731d22` and dropped) |
| `docs/runbooks/identity-database-provisioning-runbook.md`                     | Tracked; added by `91003784`                                                                                                                                                                        |
| `docs/runbooks/backup-restore-runbook.md`                                     | Tracked                                                                                                                                                                                             |
| `docs/runbooks/rollback-runbook.md`                                           | Tracked                                                                                                                                                                                             |
| `docs/ops/DEPLOYMENT_GUIDE.md`                                                | Tracked                                                                                                                                                                                             |
| `docs/ops/SECRET_ROTATION.md`                                                 | Tracked                                                                                                                                                                                             |
| `BLOCKER-REPORT-S12-PRODUCTION.md`                                            | Tracked                                                                                                                                                                                             |
| `docs/audits/2026-10-12-quality-sprint-012/PRODUCTION-READINESS-CHECKLIST.md` | Tracked                                                                                                                                                                                             |
| `.github/workflows/ci.yml`                                                    | Tracked; gates G1–G8 plus Build and final `CI Result`                                                                                                                                               |
| `.github/workflows/release.yml`                                               | Tracked; manual `workflow_dispatch` only                                                                                                                                                            |

**Status legend preserved:** `OPEN` = blocked/not run · `PARTIAL` = partly satisfied · `FIXED-LOCAL` = verified on a local tree only · **Reconciliation prefix:** `RECONCILED 2026-10-17` records what changed after the historical snapshot without rewriting history.

## GAP-S14-01 — OpenRouter probe false positive

- **Severity:** Medium; user-facing honesty, no data loss.
- **Historical evidence:** FINAL-REPORT §3 Phase-2 note + §13; 2026-10-16 local family 164/164 using injected fetch doubles; OpenRouter subset 9/9; `429` taxonomy 3/3; no paid call.
- **Historical status:** `FIXED-LOCAL`; not committed/pushed/CI-verified at snapshot time.
- **Reconciliation:** `[RECONCILED 2026-10-17]` Fix commits including `e25f2c71` are now merged through `afef0cb6`; `main` CI run `39030531474` reports success for `afef0cb6`.
- **Status:** Locally fixed and merged; CI pipeline green for the **parent** commit `afef0cb6`, not for the release target `08731d22`; no live paid-provider claim.
- **Responsible role:** Engineering.
- **Prerequisites/verification:** Provider tester/orchestrator plus provider-state/UX suites; CI test/security jobs; preserve no-weakening rule.
- **Closure criterion:** Committed fix remains green in current `main` CI without weakening assertions.
- **Review flag:** Historical exact test-count wording is preserved; counts were not re-executed here.

## GAP-S14-02 — S012-A managed identity DB + schema attestation

- **Severity:** Critical/mandatory BLOCKED.
- **Evidence:** FINAL-REPORT §§6–7, criterion #22; historical `preflight:prod` exit 1 and `doctor:prod` exit 1 fail-closed; production-config contract 15/15; attestation off.
- **Root cause:** No managed non-localhost identity DB in a reachable environment; infrastructure/authorization gap, not code.
- **Dependencies:** Blocks GAP-S14-03, GAP-S14-08, and meaningful GAP-S14-09.
- **Status:** `OPEN` / BLOCKED.
- **Responsible role:** Deploy Operator, Platform/Identity, plus secrets owner.
- **Prerequisites:** Written approval; managed PostgreSQL and least-privilege role; platform environment names only; redeploy permission.
- **Verification commands:** `npm run preflight:prod -- --skip-docker`; `npm run doctor:prod -- --skip-docker`; `npm run config:contract`; ledger query proving head `005_timestamptz_instants`; deployed `/health/ready` HTTP 200; smoke script PASSED; `npm run test:a11y`; deployed-log scan; signup/logout round trip.
- **Closure criterion:** All eight runbook acceptance criteria pass against the deployed managed database; no local-database substitution.
- **Authorization required:** Yes.

## GAP-S14-03 — Preview environment missing identity secrets

- **Severity:** High; Preview cannot boot current source.
- **Evidence:** FINAL-REPORT §§7, 12.1, 16; Preview had cache/Redis names but lacked identity database/JWT values.
- **Root cause:** Incomplete platform environment configuration.
- **Dependencies:** Requires GAP-S14-02 values and secrets-owner action.
- **Status:** `OPEN`.
- **Responsible role:** Platform Engineering plus secrets owner.
- **Prerequisites:** Written approval; confirmed Preview isolation; approved Preview secrets and redeploy.
- **Verification:** Preview redeploy boots; deployed `/health/ready` returns 200; drift/unreachable behavior exercised.
- **Closure criterion:** S14 deployment boots in Preview with readiness/drift evidence.
- **Authorization required:** Yes.

## Reconciliation summary

- The stashed register contains unique release evidence: thirteen dependency-ordered gaps, checkpoints, operator handoffs, authorization drafts, and an explicit execution sequence. That structure is preserved here.
- Since the snapshot, the local commits it describes were pushed through PR #44 and merged as `afef0cb6`, then followed by the audit/hygiene consolidation commit `08731d22`. The release target is therefore `08731d22`; `afef0cb6` is its parent.
- `main` CI run `39030531474` for parent `afef0cb6` reports `completed/success`, including successful `G8: End-to-End Tests`, `G6: Security Scan` CodeQL steps, and final fail-closed `CI Result`. This updates CI-only gaps; it does not create deployment evidence, and it does not cover the release target `08731d22`.
- Stale snapshot claims are retained as history and marked `[HISTORICAL]`. Reconciliation lines are marked `[RECONCILED 2026-10-17]`; the 2026-10-18 review below adds the stash and SHA-precision corrections.
- No blocked, not-run, deployment, backup/DR, observability, rollback, or approval gate is converted to passed.

## 2026-10-18 review corrections

- **Stash inventory.** The historical text referred to five or six preserved stashes. On 2026-10-18 the repository contains **zero stashes** (`git stash list` empty; `refs/stash` unresolvable). The last known stash — whose untracked snapshot the register was based on — was applied into commit `08731d22` ("apply stashed tls fix") and dropped. No stash content is unreviewed or at risk.
- **SHA precision.** The only CI run on record (`39030531474`) is for `afef0cb6`, the **parent** of the release target. The release target `08731d22` has **not** been independently CI-verified. GAP-S14-04 and GAP-S14-05 are therefore CI-verified for `afef0cb6` only.
- **Deployment precision.** The production deployment on record (`dpl_FpjHmWmb1ZLeyUERw3U2ZBvYtqPs`, alias `vedmoulya-web.vercel.app`, `READY`, created 2026-10-15 07:12 UTC) predates `afef0cb6`/`08731d22`; the live production deployment is **not** the release target commit.
- **Working tree.** HEAD is exactly the release target `08731d22`; `main` equals `origin/main` (0/0 divergence). The tree carries only the S14 audit documentation edits plus the applied TLS SNI regression test; there is no unreviewed user work.

## GAP-S14-04 — CI G8 production-mode E2E

- **Severity:** High/mandatory.
- **Historical evidence:** `[HISTORICAL]` No run for the then-current local candidate; push not authorized at snapshot time.
- **Reconciliation:** `[RECONCILED 2026-10-17]` `main` CI run `39030531474` for `afef0cb6` reports `completed/success`, including `G8: End-to-End Tests` and final `CI Result`. The release target `08731d22` is the **child** of `afef0cb6`, so this evidence does **not** cover the exact release SHA.
- **Status:** CI-verified for parent SHA `afef0cb6`; **NOT yet CI-verified for the release target `08731d22`**.
- **Responsible role:** CI owner for future reruns.
- **Prerequisites/verification:** Exact-SHA rerun for `08731d22` (or explicit acceptance of parent-SHA coverage); current run ID and per-job output.
- **Closure criterion:** Green G8 for the exact SHA being released.
- **Review flag:** Retain the run/job URLs in the release record.

## GAP-S14-05 — SAST CodeQL

- **Severity:** Medium/mandatory-but-CI-only.
- **Historical evidence:** `[HISTORICAL]` No local equivalent; CI unknown at snapshot time.
- **Reconciliation:** `[RECONCILED 2026-10-17]` `main` CI `G6: Security Scan` success includes CodeQL analysis and SARIF upload steps. This covers parent SHA `afef0cb6`, not the release target `08731d22`.
- **Status:** CI-verified pipeline-level for parent `afef0cb6`; not yet verified for `08731d22`.
- **Responsible role:** CI/security owner.
- **Prerequisites/verification:** Review Code Scanning alerts separately if release policy requires an alert inventory.
- **Closure criterion:** CodeQL check green for the release SHA with no unresolved blocking alert.
- **Authorization required:** No additional external action identified.

## GAP-S14-06 — Secret-scan gate script defect

- **Severity:** Low; gate-output defect, not a leak.
- **Historical evidence:** PowerShell automatic-variable collision fixed by renaming to `$matchCount`; full five-root local scan reported exit 0 with fixture/build-output hits only.
- **Historical status:** `FIXED-LOCAL`.
- **Reconciliation:** `[RECONCILED 2026-10-17]` Fix commit `22f6c505` is merged; `scripts/s56-secret-scan.ps1` is changed in the merge diff; current CI security job reports success. Historical full-scan logs remain non-durable.
- **Status:** Merged and pipeline-green; durable full-scan log remains unavailable.
- **Responsible role:** Engineering.
- **Prerequisites/verification:** `powershell -File scripts/s56-secret-scan.ps1`; expect exit 0 and numeric hit count; verify zero overlap with changed/shipped source.
- **Closure criterion:** Current merged script passes and any required durable log is attached separately.
- **Review flag:** Historical elapsed-time and hit-breakdown wording is preserved, not re-executed here.

## GAP-S14-07 — Twelve dev-only high advisories

- **Severity:** Low; production audit clean.
- **Evidence:** FINAL-REPORT §8; `npm audit --omit=dev --audit-level=high` clean; twelve dev-only highs with no in-range fix; gates exit 0.
- **Status:** `OPEN` as accepted risk; owner Platform Engineering.
- **Responsible role:** Platform Engineering.
- **Prerequisites/verification:** `npm audit --omit=dev --audit-level=high`; `npm audit --audit-level=critical`.
- **Closure criterion:** Revisit only when a non-breaking fix lands; no suppression or forced upgrade without approval.
- **Authorization required:** Platform Engineering risk decision.

## GAP-S14-08 — Staging readiness + smoke NOT VERIFIED

- **Severity:** High/mandatory.
- **Evidence:** FINAL-REPORT criterion #24 and §7; live alias checks are explicitly not staging evidence; Preview cannot boot until GAP-S14-03 is fixed.
- **Dependencies:** GAP-S14-02 and GAP-S14-03.
- **Status:** `OPEN`.
- **Responsible role:** Platform Engineering plus Deploy Operator.
- **Prerequisites:** Authorized staging/Preview deployment of the exact release SHA.
- **Verification:** Deployed `/health/ready` 200; drift/unavailability exercised; smoke script PASSED.
- **Closure criterion:** S14 SHA readiness and smoke evidence from the deployed environment.
- **Authorization required:** Yes.

## GAP-S14-09 — S012-C staging DR drill BLOCKED

- **Severity:** Critical/mandatory BLOCKED.
- **Evidence:** FINAL-REPORT criterion #23 and §9; no authorized staging, backups, artifacts, or CI backup step.
- **Dependencies:** Authorized staging plus GAP-S14-10.
- **Status:** `OPEN` / BLOCKED.
- **Responsible role:** Staging/DB Owner, currently UNASSIGNED in source material.
- **Prerequisites:** Written authorization and recovery window; backup capture; scratch then staging restore.
- **Verification:** Drill log with invariants, readiness 200, and measured RTO/RPO.
- **Closure criterion:** RTO ≤ 30 minutes and RPO ≤ 24 hours demonstrated and recorded.
- **Authorization required:** Yes.

## GAP-S14-10 — Backup schedule / PITR absent

- **Severity:** High/mandatory BLOCKED.
- **Evidence:** FINAL-REPORT criterion #25 and §9; helper script present but never executed in the audit; no schedule, PITR, or artifacts.
- **Status:** `OPEN` / BLOCKED.
- **Responsible role:** Platform/DevOps plus DB Owner.
- **Prerequisites:** Provider backup configuration permission.
- **Verification:** Provider shows active schedule and PITR window covering RPO ≤ 24 hours; config evidence without secrets.
- **Closure criterion:** Active backup/PITR configuration recorded.
- **Authorization required:** Yes.

## GAP-S14-11 — Live observability / rollback not executed

- **Severity:** Medium/mandatory NOT RUN.
- **Evidence:** FINAL-REPORT criterion #26 and §9; runbooks present and internally consistent; no deployment existed to observe or roll back.
- **Dependencies:** GAP-S14-08 staging deployment.
- **Status:** `OPEN` / NOT RUN.
- **Responsible role:** Platform Engineering.
- **Prerequisites:** Staging deployment permission.
- **Verification:** Staging deploy log, observability snapshot, rollback rehearsal note.
- **Closure criterion:** Staging observability and rollback rehearsal completed and recorded.
- **Authorization required:** Yes for staging/deployment actions.

## GAP-S14-12 — Canonical production origin mismatch

- **Severity:** Low hygiene/non-defect.
- **Evidence:** FINAL-REPORT §12 revision; intended canonical origin does not resolve; no custom domain attached; local-agent allow-list entry currently inert.
- **Status:** `OPEN` as clarified hygiene.
- **Responsible role:** Platform Engineering/DNS owner, currently marked unknown in source material.
- **Prerequisites/verification:** DNS lookup, project domain panel, allow-list grep.
- **Closure criterion:** Attach domain plus DNS or scope/remove the allow-list entry and record the decision.
- **Authorization required:** DNS/project owner decision when scheduled; safe to defer past RC.

## GAP-S14-13 — Release hygiene/process

- **Severity:** Medium traceability.
- **Historical evidence:** `[HISTORICAL]` Six local-only commits, thirteen modified files, untracked work, five stashes.
- **Reconciliation:** `[RECONCILED 2026-10-17]` That framing is stale. PR #44 is merged; `main` equals `origin/main` at `08731d22` (target SHA); `main` CI reported success for parent `afef0cb6`; working tree holds only the S14 audit changes; **zero stashes remain** (verified 2026-10-18), not five or six.
- **Status:** Partially superseded; push/CI portion is satisfied for parent `afef0cb6`, while deployment/approval hygiene remains open.
- **Responsible role:** Repository Owner for future pushes; Engineering for local commits.
- **Prerequisites/verification:** Clean-except-agreed status; intended commits visible in history; register tracked.
- **Closure criterion:** Register tracked plus deployment/approval evidence completed.
- **Review flag:** Do not reuse the historical ahead counts as current state.

---

## Execution sequence preserved

1. GAP-S14-01 plus GAP-S14-06 → commit via GAP-S14-13 → unblock GAP-S14-04/05 CI.
2. GAP-S14-02 → unblock GAP-S14-03 → unblock GAP-S14-08 → unblock GAP-S14-11.
3. GAP-S14-10 plus staging environment → unblock GAP-S14-09.
4. GAP-S14-07 accepted risk; GAP-S14-12 low hygiene anytime.
5. Preview boot, staging smoke, alias liveness, backup schedule, DR drill, G8, and CodeQL remain distinct checks.

---

## Identity readiness executable sequence

Use names only; no values are included. All external provisioning and environment writes require prior written approval.

1. Obtain written approval and ticket reference from Platform/Identity Deploy Operator and secrets owner.
2. Provision managed PostgreSQL and least-privilege application role in the authorized environment.
3. Configure platform environment names: `IDENTITY_DATABASE_URL`, `AUTH_JWT_SECRET`, `REDIS_URL`, plus per-service URLs and optional `IDENTITY_SCHEMA_READINESS_GATE`.
4. Redeploy the exact release SHA through the approved deployment path.
5. Run `npm run preflight:prod -- --skip-docker`; require exit 0 with Environment, Authentication, Database, and Redis READY.
6. Run `npm run doctor:prod -- --skip-docker`; require exit 0 with Database PASS and Configuration PASS.
7. Run `npm run config:contract`; require exit 0.
8. Query the identity schema ledger; require all five migration IDs with head `005_timestamptz_instants`.
9. Request deployed `/health/ready`; require HTTP 200 with healthy database status.
10. Run `bash scripts/deploy/smoke-test.sh "$PROD_URL"`; require PASSED.
11. Run `npm run test:a11y`; require exit 0, recognizing it is UI-only and does not prove the database path.
12. Perform signup/logout round trip; confirm user persistence and deny-list behavior.
13. Scan deployed logs for absence of fail-closed identity-migration errors.
14. Complete the runbook evidence block with dates, command exits, ledger head, smoke result, readiness codes, drift-gate setting, operator name, and approval reference.

Implementation anchors verified in the current tree:

- Engine/CLI: `packages/core/src/startup/preflight.ts`, `packages/core/src/startup/doctor.ts`, `scripts/preflight.ts`, `scripts/doctor.ts`
- Package commands: `preflight`, `preflight:prod`, `doctor`, `doctor:prod`, `config:contract`, `test:a11y`
- Persistence/ledger: `services/identity/src/infrastructure/persistence/migrations.ts`, `identitySchema.ts`, `DatabaseConnection.ts`, `PostgresIdentityRepository.ts`, `RefreshTokenDenylistStore.ts`, `VerificationTokenStore.ts`, `OAuthStateStore.ts`
- Tests: `services/identity/__tests__/migrations.test.ts`, `migrations.postgres.test.ts`, `IdentityStores.postgres.test.ts`, `RefreshTokenDenylistStore*.test.ts`, `RefreshTokenRotation.test.ts`, `packages/core/src/config/__tests__/production-config-contract.test.ts`, `packages/core/src/startup/__tests__/preflight.test.ts`, `packages/core/src/startup/__tests__/doctor.test.ts`
- Readiness: `apps/web/src/app/health/ready/route.ts`, `apps/web/src/lib/identity-schema-gate.ts`, `apps/web/src/app/health/__tests__/ready-identity-schema-gate.test.ts`
- Deployment/smoke: `scripts/deploy/smoke-test.sh`, `docs/runbooks/identity-database-provisioning-runbook.md`, `docs/ops/DEPLOYMENT_GUIDE.md`, `docs/runbooks/backup-restore-runbook.md`, `docs/runbooks/rollback-runbook.md`, `docs/ops/SECRET_ROTATION.md`

## Contradictions and review labels

- Stashed register says GAP-S14-01/06 were not committed; later history and PR #44 show those fixes merged. Preserved as historical wording; reconciliation status above supersedes only the commit/CI portion.
- Stashed register counts six local-only commits/eleven local commits/five stashes in different addenda; current verified state (2026-10-18) is merged `main` at `08731d22` with **zero stashes** — the last stash was applied into `08731d22` and dropped. Do not use stale counts operationally.
- Prior audit text described CI as not run for the local candidate; `main` CI run `39030531474` reports success for parent `afef0cb6`. This changes CI-only gates, not deployment gates, and does not cover the release target `08731d22`.
- Exact CVE/test-count/log-duration wording from history is preserved but not re-proven in this read-only sprint.

15. Keep the restored backup path ready under the separate backup/DR approval before any destructive validation.
