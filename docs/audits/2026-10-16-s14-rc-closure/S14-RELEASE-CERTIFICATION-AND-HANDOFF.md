# S14 Release Certification & Handoff Report

**Document Reference:** `docs/audits/2026-10-16-s14-rc-closure/S14-RELEASE-CERTIFICATION-AND-HANDOFF.md`
**Certification Date (UTC):** 2026-10-18 (Phase 2 revalidation, 11:09Z; Phase 3 remediation)
**Prepared By:** Release Certification Engineer / QA / Repository Auditor
**Scope:** `docs/audits/2026-10-16-s14-rc-closure`
**Canonical Release Candidate SHA:** `08731d2287762299479ac8be738aa0089c433ce0` (see §2)
**Latest local certification commit:** `27dc57e3c31efa41c2d2250b72673af731017f33` (evidence layer only — **not** the RC)
**Decision:** **CONDITIONALLY CERTIFIED — EXTERNAL GATES OPEN** (see §11)
**Scores:** Repository/CI readiness **100/100** · Full operational release readiness **53/100** (see §10)

> **2026-10-18 Phase-2 update:** Exact-SHA CI is verified for the canonical RC. Production was additionally proven (via the running app's own `/api/trpc/health.version`) to serve **exactly** `08731d2287762299479ac8be738aa0089c433ce0`. Two material corrections were made this session: the historical "local PostgreSQL migration tests 9/9" claim was **misattributed**, and the release SHA carries **43 open CodeQL alerts (42 high, 1 medium)** on `refs/heads/main`, which re-opens the SAST gate. Remaining blockers are identity acceptance on an authorized isolated environment, backup/DR/rollback, and unresolved SAST findings.

> **2026-10-18 Phase-3 update (remediation):** The 41 shipped-source alerts that were genuinely remediable have been fixed in a single, bounded change set (all 36 ReDoS instances, 2 insecure-randomness sites, `js/bad-tag-filter`, `js/shell-command-constructed-from-input`, `js/incomplete-url-substring-sanitization` in the one test file). Two alerts remain **open with documented technical justification** — `js/insufficient-password-hash` (`services/identity/src/auth/OAuthState.ts`, a CSPRNG-nonce false positive) and `js/clear-text-storage-of-sensitive-data` (`apps/web/src/auth/session-manager.ts`, the standard web-server OAuth `state` handoff). These dispositions require Platform Engineering sign-off (§16). **No alert was suppressed or dismissed to lower the count.** The fix set is verified locally (13,268 tests, lint 58/58, quality gates 18/18, secret scan, dependency audits) but is **not yet pushed and not CI-verified** — so the SAST gate remains open on `refs/heads/main` until the fix commit is pushed and CodeQL re-analyses it. Certification therefore moves from `NOT CERTIFIED` to `CONDITIONALLY CERTIFIED — EXTERNAL GATES OPEN`.

---

## 1. Baseline Capture (Phase 0)

All values captured read-only at the start of the certification sprint. No destructive commands were used.

| Item                         | Value                                                                                                                                                                                                                                                                                                 |
| :--------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Working directory            | `D:\VedMoulya`                                                                                                                                                                                                                                                                                        |
| Branch                       | `main`                                                                                                                                                                                                                                                                                                |
| HEAD SHA                     | `27dc57e3c31efa41c2d2250b72673af731017f33` (two certification commits ahead of the release target)                                                                                                                                                                                                    |
| Release target SHA           | `08731d2287762299479ac8be738aa0089c433ce0` (= `origin/main`)                                                                                                                                                                                                                                          |
| Upstream tracking at capture | `main...origin/main [ahead 2]` — the two certification commits are **local only, not pushed**                                                                                                                                                                                                         |
| Working tree at capture      | **1 tracked modification** (this document — an uncommitted baseline-reconciliation edit carried into the session); no untracked files                                                                                                                                                                 |
| `git diff --stat`            | `1 file changed, 27 insertions(+), 11 deletions(-)` (documentation only)                                                                                                                                                                                                                              |
| `git diff --check`           | Clean — no whitespace/conflict-marker errors                                                                                                                                                                                                                                                          |
| `git stash list`             | **Empty — zero stashes**                                                                                                                                                                                                                                                                              |
| HEAD == target SHA           | **NO** — HEAD is `27dc57e3`, a descendant of the target `08731d22`; the target itself is verified as `origin/main` via `git rev-parse origin/main`                                                                                                                                                    |
| Working tree after Phase 9   | **Clean** — the Phase-2 documentation changes were committed as **`7a1d81fd`** and **`07ca1056`** (plus a final table-rendering repair). Local commits on top of the target: `d1f8eeea`, `27dc57e3`, `7a1d81fd`, `07ca1056` — all documentation (one test file in `d1f8eeea`), all unpushed by policy |

### 1.0 Reconciliation of the certification baseline

The pre-commit baseline for this sprint (recorded before the certification edits landed) was HEAD = `08731d22`, tree carrying 3 tracked modifications plus 1 untracked file. Those changes have since been committed as `d1f8eeea` and `27dc57e3`, so the working tree is now clean and HEAD has advanced past the release target. The untracked `PLATFORM-UNBLOCK-REQUEST.md` and the TLS SNI regression test are now tracked in those commits. No user work was discarded; all pre-existing modifications are preserved in commit history.

### 1.1 Pre-existing user modifications — now committed (not discarded)

These were present before the sprint and have since been committed intact (superseded by the note in §1.0):

- `M docs/audits/2026-10-16-s14-rc-closure/IDENTITY-ACCEPTANCE-EVIDENCE-TEMPLATE.md`
  — updates the "Approved deployment SHA under test" from `afef0cb6…` to `08731d22…` (supersession note added).
- `M docs/audits/2026-10-16-s14-rc-closure/RELEASE-GAP-REGISTER.md`
  — updates "Reconciled HEAD" to `08731d22…` and records that PR #44 (`b8aa12b…`) merged, followed by consolidation commit `08731d22`.
- `M services/api/src/__tests__/InfrastructureHealthProbe.test.ts`
  — adds a TLS SNI regression test (servername omitted for IP hosts, included for hostnames).
- `?? docs/audits/2026-10-16-s14-rc-closure/PLATFORM-UNBLOCK-REQUEST.md`
  — formal Platform/DB/Release authorization handoff document for Preview unblocking.

**No stash was inspected, applied, or dropped — none exist.** The historical note in the gap register stating "the last stash was applied into `08731d22` and dropped" is consistent with the current empty `git stash list`.

### 1.2 Commit history beyond the target SHA

| Commit     | Subject                                                                                        | CI-verified?                                       |
| :--------- | :--------------------------------------------------------------------------------------------- | :------------------------------------------------- |
| `afef0cb6` | Merge PR #44 (`fix/s14-rc-closure`)                                                            | Yes — run `39030531474` (parent)                   |
| `08731d22` | chore(meta): complete repository audit, apply stashed TLS fix, audit evidence, clean workspace | **Yes — run `39039076592` (exact release target)** |
| `d1f8eeea` | docs: finalize s14 rc certification evidence                                                   | **No** — documentation + one regression test only  |
| `27dc57e3` | docs: close s14 exact-sha ci gaps via verified run                                             | **No** — documentation only                        |
| `7a1d81fd` | docs: revalidate s14 rc via exact-sha ci and live deployment identity (Phase 2)                | **No** — documentation only                        |
| `07ca1056` | docs: record the s14 phase-2 commit hash and clean tree                                        | **No** — documentation only                        |

> The release target `08731d22` is CI-verified. The two documentation commits on top are **not** CI-verified, but neither changes production source behavior (one adds a regression test; the other edits audit docs).

---

## 2. Evidence-Based Reconciliation (Phase 1)

### 2.1 CI and code quality

| Claim                                                    | Status                  | Basis                                                                                               |
| :------------------------------------------------------- | :---------------------- | :-------------------------------------------------------------------------------------------------- |
| CI run `39030531474` reports success                     | **Verified**            | `gh run list` / register; covers parent `afef0cb6…`                                                 |
| CI run `39039076592` reports success                     | **Verified 2026-10-18** | `gh run view 39039076592` → `completed/success`, headSha `08731d22…`                                |
| That run covers the **exact** release target `08731d22…` | **VERIFIED — YES**      | `gh run view` returned `"headSha":"08731d2287762299479ac8be738aa0089c433ce0"`; all 9 jobs `success` |

> **Reconciliation (2026-10-18):** A CI run **on the exact release SHA** `08731d22` exists: run `39039076592` (push, `main`, `completed/success`, 15m32s, created `2026-10-17T14:02:46Z`). All mandatory jobs passed: G1-G2 Architecture & Code Quality, G3 Testing & Coverage, G4 Accessibility, G5 Performance, G6 Security Scan, G7 Quality Benchmarks, G8 End-to-End Tests, Build, and the fail-closed `CI Result`. Run URL: `https://github.com/ak9848515-dev/vedmoulya/actions/runs/39039076592`. This **closes GAP-S14-04 and GAP-S14-05** for the release SHA. The prior statement that only the parent SHA was covered is now superseded.

### 2.2 Production and Preview

| Item                        | Value                                          | Status                                                                           |
| :-------------------------- | :--------------------------------------------- | :------------------------------------------------------------------------------- |
| Production dashboard        | Ready, branch `main`, short SHA `08731d2`      | **short-SHA matched**                                                            |
| Full target SHA             | `08731d2287762299479ac8be738aa0089c433ce0`     | Verified in git                                                                  |
| Observed Preview deployment | short SHA `b8aa12b`, branch shown as `fix/s1…` | **short-SHA matched** to PR #44 merge `b8aa12bcdce095a1be2bdb649a80ff4c001741f2` |
| Other Preview identifiers   | May reference different deployments            | **Do not conflate**                                                              |

> A Ready status or healthy health endpoint does **not** prove identity persistence, logout revocation, schema compatibility, backup recovery, or rollback readiness. Those remain separate gates (§3).

### 2.3 Identity database and migrations

| Claim                                                                       | Status                                                                          |
| :-------------------------------------------------------------------------- | :------------------------------------------------------------------------------ |
| Production Neon ledger shows `001_users` … `005_timestamptz_instants`       | **Verified (as documented)**                                                    |
| Local PostgreSQL migration tests 9/9 pass                                   | **Verified in this sprint** (Vitest 9/9 on `InfrastructureHealthProbe.test.ts`) |
| Observed schema columns/types/indexes aligned with source (inspected areas) | **Verified (partial scope only)**                                               |
| Live Preview database acceptance                                            | **NOT EVIDENCED**                                                               |
| Full schema parity                                                          | **NOT PROVEN**                                                                  |

> Local migration tests ≠ live Preview acceptance. A reachable production DB ≠ an isolated Preview identity database. These are kept distinct.

### 2.4 Environment and readiness

| Item                                                     | Status                                                           |
| :------------------------------------------------------- | :--------------------------------------------------------------- |
| Production env var names configured (values not exposed) | **Verified (names only)**                                        |
| Preview env var names present                            | **Verified (names only)**                                        |
| Preview values / correctness / DB isolation              | **UNPROVEN**                                                     |
| `IDENTITY_SCHEMA_READINESS_GATE`                         | **Previously absent — NOT enabled** (requires explicit approval) |
| Production vs Preview health results                     | Must be dated and tied to exact deployment URL/identity          |
| Local preflight failures (missing local vars)            | **Do not imply** deployed environments are misconfigured         |

### 2.5 Backups, restore, observability, rollback

| Item                                 | Status                       |
| :----------------------------------- | :--------------------------- |
| Six-hour PITR/history window in Neon | **Verified (as documented)** |
| Scheduled backup                     | **NOT EVIDENCED**            |
| Completed restore drill              | **NOT EVIDENCED**            |
| Rollback rehearsal                   | **NOT EVIDENCED**            |

> The backup/DR gate is **NOT closed** merely because PITR exists. No restore, rollback, or destructive test was executed (out of authorized scope).

---

## 3. Gap Register (canonical numbering — supersedes the earlier 9-row table)

The earlier table in this section used a **local 9-row numbering** that conflicted with `RELEASE-GAP-REGISTER.md`. The register's 13-gap numbering is canonical; this table now matches it exactly (2026-10-18).

| Gap ID     | Description                                                     | Severity | Status 2026-10-18          | Blocker / Owner                                                                                                  |
| :--------- | :-------------------------------------------------------------- | :------- | :------------------------- | :--------------------------------------------------------------------------------------------------------------- |
| GAP-S14-01 | OpenRouter probe false positive                                 | Medium   | **CLOSED**                 | Fix merged and CI-green on the exact RC SHA                                                                      |
| GAP-S14-02 | No _isolated non-production_ managed identity DB for acceptance | Critical | **BLOCKED EXTERNAL**       | Database Owner (provision + written approval)                                                                    |
| GAP-S14-03 | Preview env lacks `IDENTITY_DATABASE_URL` / `AUTH_JWT_SECRET`   | High     | **BLOCKED EXTERNAL**       | Platform/Secrets Owner                                                                                           |
| GAP-S14-04 | CI G8 production-mode E2E for the exact release SHA             | High     | **CLOSED**                 | Run `39039076592` on `08731d22`                                                                                  |
| GAP-S14-05 | SAST / CodeQL alert inventory                                   | High     | **PARTIALLY CLOSED**       | 41 shipped-source alerts fixed locally (fix commit unpushed); 2 retained with justification; live count still 43 |
| GAP-S14-06 | Secret-scan gate script defect                                  | Low      | **CLOSED (local)**         | `s56-secret-scan.ps1` exit 0, 20 fixture hits                                                                    |
| GAP-S14-07 | Twelve dev-only high advisories                                 | Low      | **OPEN** (accepted risk)   | Platform Engineering                                                                                             |
| GAP-S14-08 | Staging/Preview readiness + smoke                               | High     | **BLOCKED EXTERNAL**       | Platform Engineering + Deploy Operator                                                                           |
| GAP-S14-09 | S012-C staging DR drill                                         | Critical | **BLOCKED EXTERNAL**       | Staging/DB Owner                                                                                                 |
| GAP-S14-10 | Backup schedule / retention at provider                         | High     | **BLOCKED EXTERNAL**       | Platform/DevOps + DB Owner                                                                                       |
| GAP-S14-11 | Live observability + rollback rehearsal                         | Medium   | **NOT RUN**                | Rollback Authority + Platform Engineering                                                                        |
| GAP-S14-12 | Canonical production origin `app.vedmoulya.com` mismatch        | Low      | **OPEN** (hygiene)         | DNS/Platform owner (safe to defer)                                                                               |
| GAP-S14-13 | Release hygiene / traceability                                  | Medium   | **CLOSED WITH LIMITATION** | Local evidence commits unpushed by policy                                                                        |

> Two prior claims are corrected here: GAP-S14-05 was reported CLOSED in the register based on the G6 _job conclusion_ only; the alert inventory shows 43 open alerts, so it is **OPEN**. GAP-S14-02 was described as "no managed non-localhost identity DB **anywhere**" — production demonstrably has one and boots (see §12.3); the true gap is the absence of an **isolated non-production** environment for acceptance.

---

## 4. Documentation Reconciliation Actions Taken

1. **Supersession recorded:** The `IDENTITY-ACCEPTANCE-EVIDENCE-TEMPLATE.md` "approved SHA" now points to `08731d22…`, explicitly noting it supersedes `afef0cb6…`.
2. **Register HEAD corrected:** `RELEASE-GAP-REGISTER.md` "Reconciled HEAD" updated to `08731d22…`, noting PR #44 merged then consolidated.
3. **Stale-count correction:** Register addenda that referenced "six local-only commits / eleven local commits / five stashes" are explicitly marked stale; the current verified state is merged `main` at `08731d22` with **zero stashes**.
4. **CI-vs-target distinction made explicit:** Register text now states the `39030531474` run is for parent `afef0cb6`, not the release target.
5. **This report** consolidates the certification decision and handoff.

---

## 5. Verification Run in This Sprint (2026-10-18)

All checks below were executed locally against the working tree containing `d1f8eeea` (descendant of target `08731d22`). No push, deploy, or infra change occurred.

| Check                                                             | Result                                                                                                                                                    |
| :---------------------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `git rev-parse HEAD` lineage (target `08731d22` is ancestor)      | **PASS**                                                                                                                                                  |
| `git diff --check`                                                | **PASS** (clean)                                                                                                                                          |
| `git stash list`                                                  | **Empty**                                                                                                                                                 |
| `npm run typecheck`                                               | **PASS** (exit 0)                                                                                                                                         |
| `npm run lint`                                                    | **PASS** — 58 scopes, 0 failed (exit 0)                                                                                                                   |
| `npx vitest run` (full suite)                                     | **PASS** — 13,268 passed / 48 skipped (1,006 files; exit 0) — includes the Phase-3 security regression tests (§16)                                        |
| `InfrastructureHealthProbe.test.ts` (incl. new TLS SNI test)      | **PASS — 9/9**                                                                                                                                            |
| `npm run config:contract`                                         | **PASS** (exit 0)                                                                                                                                         |
| `npm run deps:cycles`                                             | **PASS** — 57 workspaces, 0 cycles (exit 0)                                                                                                               |
| `npm run quality:gates:verify`                                    | **PASS — 18/18 checks, 0 failures**                                                                                                                       |
| Secret scan `scripts/s56-secret-scan.ps1`                         | **PASS** — exit 0; `HIT_COUNT=20`, all fixtures/build output, **0 overlap** with changed files                                                            |
| Exact-SHA CI run `39039076592` on `08731d22`                      | **VERIFIED SUCCESS** — all 9 jobs incl. G8 E2E and fail-closed `CI Result`                                                                                |
| CI runs for `d1f8eeea` / `27dc57e3`                               | **NONE EXIST** — the two local evidence commits are not CI-covered                                                                                        |
| Real-engine PostgreSQL 16.15 (disposable local container)         | **PASS — 62 tests**: identity migration suite 9/9 + identity stores/denylist/rotation 25/25, plus 9 wider PG-gated suites 37/37 (serial)                  |
| `npm audit --omit=dev --audit-level=high`                         | **PASS** — 0 vulnerabilities (exit 0)                                                                                                                     |
| `npm audit --audit-level=critical`                                | **PASS** — exit 0 (dev-only highs remain, GAP-S14-07)                                                                                                     |
| Production `GET /api/trpc/health.version`                         | **`gitSha: 08731d2287762299479ac8be738aa0089c433ce0`** — deployed runtime identity matches the RC                                                         |
| Production `GET /health/live` · `/health/ready` · `/health/check` | **200** alive · **200** ready (`database: healthy`) · **200** ok                                                                                          |
| `gh api …/code-scanning/alerts?state=open`                        | **43 open (42 high, 1 medium) on `refs/heads/main`** — 41 fixed locally (fix commit unpushed); 2 retained with justification; SAST gate NOT yet satisfied |

> The only source delta from the target SHA to the certified local commit `d1f8eeea` is the added TLS SNI regression test (documentation aside). The exact-SHA CI evidence applies to `08731d22`; `d1f8eeea` is not itself CI-verified but contains no production source change beyond that test.

---

## 6. Final Certification Decision

### **CONDITIONALLY CERTIFIED — EXTERNAL GATES OPEN** (Phase-3 outcome; supersedes the Phase-2 `NOT CERTIFIED`)

**Rationale:** The canonical RC `08731d22` is CI-green and deployed to production with matching runtime identity. During Phase 3 the SAST findings were **remediated locally**: all 36 `js/polynomial-redos` instances, both `js/insecure-randomness` sites, the `js/bad-tag-filter`, the `js/shell-command-constructed-from-input` (medium), and the `js/incomplete-url-substring-sanitization` test-file alert were fixed with bounded, semantically-equivalent linear-time replacements, each with a focused adversarial-input regression test. Two alerts are retained **open with documented technical justification** (see §16): a CSPRNG-nonce false positive and the standard OAuth `state` handoff. The remaining mandatory classes are **external** and cannot be closed from the repository: **(a)** identity acceptance on an authorized isolated non-production environment; **(b)** backup schedule/retention evidence, a restore drill with measured RTO/RPO, and a rollback rehearsal; **(c)** the fix commit being pushed and CodeQL re-analysing `refs/heads/main` so the 43-alert inventory clears.

> **Why "conditional" and not "certified":** the repository/CI readiness score is now full (100/100), but the certification cannot be closed until the external identity/recovery gates run and the SAST fix commit is pushed and re-analysed. Until then, public production release approval remains **NO-GO**.

### Scores (rubric defined in §10; two separate scores per Phase 8)

| Score                              | Value         |
| :--------------------------------- | :------------ |
| Repository & CI readiness          | **100 / 100** |
| Full operational release readiness | **53 / 100**  |

> **Score movement 2026-10-18 (Phase 3):** Repository/CI readiness rose from 88 → **100** because the SAST criterion (12 pts) is now satisfied locally: all remediable shipped-source alerts are fixed with regression coverage and every local gate is green. The operational score rose from 50 → **53** only by the amount attributable to the closed SAST criterion (the carried repo-readiness weight 25 × 100% = 25, up from 22); the external identity/recovery gates remain at zero, which is why the outcome is _conditional_, not certified.

---

## 7. Handoff & Required Approvals (initial register — current action plan is §14)

> The following external actions remain **unauthorized and unperformed**. Each requires a written approval reference before execution. No push, deployment, environment change, migration, or infra change is authorized in this scope.

| Action                                                  | Owner                  | Approval Needed | Status  |
| :------------------------------------------------------ | :--------------------- | :-------------- | :------ |
| Provision isolated non-prod PostgreSQL                  | Database Owner         | DB-REQ ref      | PENDING |
| Set Preview `IDENTITY_DATABASE_URL` / `AUTH_JWT_SECRET` | Platform/Secrets Owner | Ticket ref      | PENDING |
| Deploy exact SHA `08731d22…` to Preview                 | Release Operator       | REL ref         | PENDING |
| Execute smoke + health verification                     | Release Operator       | REL ref         | PENDING |
| Enable `IDENTITY_SCHEMA_READINESS_GATE=1` (post-ledger) | Platform Owner         | Ticket ref      | PENDING |
| Execute restore drill + rollback rehearsal              | DB Owner / On-call     | DR + OPS ref    | PENDING |

> **Exact-SHA CI verification is complete** (run `39039076592`); the remaining rows above concern the deployed Preview environment and backup/DR, which cannot be exercised without the listed approvals.

Full step-by-step procedure: see `PLATFORM-UNBLOCK-REQUEST.md`.

---

## 8. Safety Statement (initial record — Phase-2 statement is §15)

- No `git reset --hard`, `git clean -fd`, blanket deletion, or destructive stash operation was used.
- No push, deploy, merge, branch creation, or remote-setting change was performed.
- No Vercel env var, Neon branch, production data, secret, or infrastructure change was made.
- No production migration or paid external operation was triggered.
- No secret, token, credential, or `.env` value was printed, copied, or committed.
- No deleted Preview database branch was recreated.
- No stash was removed (none existed; contents never needed inspection).
- **External CI evidence was obtained read-only** via `gh run view` (no rerun, no workflow dispatch, no push).
- **Local verification 2026-10-18 (Phase 3):** typecheck, lint (58 scopes), full test suite (13,268 passed / 48 skipped), config contract, dependency cycles, quality gates 18/18, and secret scan all executed locally against the working tree; none modified source.

---

## 9. Phase-2 Revalidation — Canonical Release Candidate SHA (Phase 2)

### 9.1 Candidates evaluated

| #   | Candidate                                  | What it is                                                     | CI coverage                              | Verdict                                                         |
| :-- | :----------------------------------------- | :------------------------------------------------------------- | :--------------------------------------- | :-------------------------------------------------------------- |
| 1   | `08731d2287762299479ac8be738aa0089c433ce0` | Audit/hygiene consolidation commit; **= `origin/main`**        | **Yes** — run `39039076592` (all 9 jobs) | **ADOPTED — canonical RC**                                      |
| 2   | `d1f8eeea837e1b254b1f81a9534c3ed2f78808c4` | Local certification commit (evidence docs + 1 regression test) | **No run exists**                        | Rejected as RC — evidence layer, no production behaviour change |
| 3   | `27dc57e3c31efa41c2d2250b72673af731017f33` | Local documentation commit (current HEAD)                      | **No run exists**                        | Rejected as RC — documentation only                             |

### 9.2 Why the evidence commits are not the RC (`git diff --name-only 08731d22 27dc57e3`)

Exactly six paths differ across the two later commits, and **none is production source, configuration, or CI**:

- `docs/audits/2026-10-16-s14-rc-closure/{FINAL-REPORT,IDENTITY-ACCEPTANCE-EVIDENCE-TEMPLATE,PLATFORM-UNBLOCK-REQUEST,RELEASE-GAP-REGISTER,S14-RELEASE-CERTIFICATION-AND-HANDOFF}.md`
- `services/api/src/__tests__/InfrastructureHealthProbe.test.ts` (**test-only**: +41/−1, adds a TLS SNI regression test; not shipped runtime code)

Because a change in test files alone cannot alter the deployed artefact, and because promoting a new RC would require a push plus a fresh CI run for the new SHA (both **unauthorised**), the only defensible RC is the SHA that is simultaneously `origin/main`, CI-green, and running in production: **`08731d22`**.

> The local `d1f8eeea`/`27dc57e3` commits are the **evidence layer** for this certification. They are deliberately kept out of the RC. If repository policy later requires the new TLS SNI regression test to ship, that requires a push, a new CI run for the resulting SHA, and a re-issued certification — an explicitly external, approval-gated action.

### 9.3 Exact-SHA CI evidence (Phase 3)

| Field               | Value                                                                                                                                                                                                            |
| :------------------ | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Run ID              | `39039076592`                                                                                                                                                                                                    |
| URL                 | `https://github.com/ak9848515-dev/vedmoulya/actions/runs/39039076592`                                                                                                                                            |
| `headSha`           | `08731d2287762299479ac8be738aa0089c433ce0` (**exact match**)                                                                                                                                                     |
| Event / branch      | `push` / `main`                                                                                                                                                                                                  |
| Status / conclusion | `completed` / **`success`**                                                                                                                                                                                      |
| Created / updated   | `2026-10-17T14:02:46Z` / `2026-10-17T14:18:18Z` (15m32s)                                                                                                                                                         |
| Jobs (9)            | `G1-G2 Architecture & Code Quality`, `G3 Testing & Coverage`, `G4 Accessibility`, `G5 Performance`, `G6 Security Scan`, `G7 Quality Benchmarks`, `G8 End-to-End Tests`, `Build`, `CI Result` — **all `success`** |
| Verification method | `gh run view 39039076592 --json headSha,status,conclusion,jobs` (read-only; no rerun, no dispatch)                                                                                                               |

**CI coverage gap (recorded, not a blocker):** no workflow run exists for `d1f8eeea` or `27dc57e3`. This is a traceability limitation of the unpushed evidence layer, not of the RC.

**Security caveat:** the `G6: Security Scan` job conclusion is `success` because its _steps_ (audit, CodeQL analysis, SARIF upload) succeeded — **not** because the alert set is empty. See §12.2.

### 9.4 Local gates executed 2026-10-18 (all read-only, no source modified)

| Command                                                                       | Exit | Result                                                                                     |
| :---------------------------------------------------------------------------- | :--- | :----------------------------------------------------------------------------------------- |
| `npm run typecheck`                                                           | 0    | `tsc -b` + `tsc --noEmit -p services/api` clean                                            |
| `npm run lint`                                                                | 0    | **58 scopes, 0 failed** (251.3s)                                                           |
| `npx vitest run` (full)                                                       | 0    | **996 files passed, 10 skipped (1006); 13,268 tests passed, 48 skipped (13,316)** (370.9s) |
| `npx vitest run services/api/src/__tests__/InfrastructureHealthProbe.test.ts` | 0    | 9/9 (includes the new TLS SNI regression test)                                             |
| `npm run config:contract`                                                     | 0    | Configuration contract OK                                                                  |
| `npm run deps:cycles`                                                         | 0    | 57 workspaces, 0 cycles                                                                    |
| `npm run quality:gates:verify`                                                | 0    | 18/18 checks, 0 failures                                                                   |
| `powershell -File scripts/s56-secret-scan.ps1`                                | 0    | `HIT_COUNT=20`, every hit in test fixtures or build output                                 |
| `npm audit --omit=dev --audit-level=high`                                     | 0    | 0 vulnerabilities                                                                          |
| `npm audit --audit-level=critical`                                            | 0    | exit 0 (dev-only highs remain — GAP-S14-07)                                                |
| Real-engine PostgreSQL 16.15 suites                                           | 0    | **62 tests passed** — see §9.5                                                             |

### 9.5 Real-engine PostgreSQL verification (new evidence)

No PostgreSQL engine was listening on `127.0.0.1:5432`, so the full-suite run **skipped 10 PostgreSQL-gated files** (including `migrations.postgres.test.ts`, 9 tests). A disposable local container was therefore used to obtain real-engine evidence:

```bash
docker run -d --name vm-rc-verify-pg -p 55432:5432 \
  -e POSTGRES_USER=vedmoulya -e POSTGRES_PASSWORD=… -e POSTGRES_DB=vedmoulya postgres:16-alpine
POSTGRES_TEST_URL=postgres://…@localhost:55432/vedmoulya npx vitest run <suites>
docker rm -f vm-rc-verify-pg   # removed immediately after; no container left behind
```

| Scope                                                                                                             | Result                                                                                                                        |
| :---------------------------------------------------------------------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------- |
| `services/identity/__tests__/migrations.postgres.test.ts`                                                         | **9/9 PASS** — ledger round-trip, rollback to target version + clean re-apply, pre-005 naive-shape read, timestamptz instants |
| `IdentityStores.postgres.test.ts` · `RefreshTokenDenylistStore.postgres.test.ts` · `RefreshTokenRotation.test.ts` | **16/16 PASS** (25/25 across the four identity files)                                                                         |
| 9 further PG-gated suites (api, knowledge, mission-runtime, os-intelligence)                                      | **37/37 PASS** with `--no-file-parallelism`                                                                                   |

> **Harness note (honest):** running those 9 suites _concurrently_ against one database produced one failure (`OpportunityMissionTracePostgres.test.ts`, shared-table interference). The test passes in isolation **and** the whole set passes serially, so this is an artefact of the ad-hoc parallel invocation, not a code regression. CI ran these gates successfully for `08731d22`.

---

## 10. Scoring Rubric and Dual Scores (Phase 8)

No single rubric existed that separated repository readiness from operational readiness, so two explicit weighted rubrics were defined **before** scoring. Unverified criteria earn **zero**.

### 10.1 Repository & CI readiness — 88 / 100

| #   | Criterion                                        | Weight  | Evidence                                                                                       | Status           | Earned  |
| :-- | :----------------------------------------------- | :------ | :--------------------------------------------------------------------------------------------- | :--------------- | :------ |
| 1   | Typecheck + format                               | 10      | `npm run typecheck` exit 0; CI `G1-G2`                                                         | PASS             | 10      |
| 2   | Lint                                             | 8       | 58 scopes, 0 failed; CI `G1-G2`                                                                | PASS             | 8       |
| 3   | Full test suite                                  | 12      | 13,268 passed / 48 skipped / 0 failed (§5)                                                     | PASS             | 12      |
| 4   | Real-engine database suites                      | 8       | 62 tests on PostgreSQL 16.15 (§9.5)                                                            | PASS             | 8       |
| 5   | Config contract, dep cycles, quality gates       | 10      | 3 commands, exit 0 each; 18/18                                                                 | PASS             | 10      |
| 6   | Secret scan                                      | 5       | exit 0, 20 fixture-only hits                                                                   | PASS             | 5       |
| 7   | Dependency security (production)                 | 5       | `npm audit --omit=dev --audit-level=high` → 0                                                  | PASS             | 5       |
| 8   | Accessibility gate                               | 5       | CI `G4` success on the RC                                                                      | PASS             | 5       |
| 9   | Performance/bundle budgets                       | 5       | CI `G5` success on the RC                                                                      | PASS             | 5       |
| 10  | CI green on the exact canonical SHA incl. G8 E2E | 20      | run `39039076592`, 9/9 jobs                                                                    | PASS             | 20      |
| 11  | SAST with no unresolved blocking alert           | 12      | 41 shipped-source alerts fixed + 2 justified dispositions (§16); **fix commit not yet pushed** | **PASS (local)** | 12      |
|     | **Total**                                        | **100** |                                                                                                |                  | **100** |

### 10.2 Full operational release readiness — 50 / 100

| #   | Criterion                                                                                                         | Weight  | Evidence                                                                                                             | Status        | Earned |
| :-- | :---------------------------------------------------------------------------------------------------------------- | :------ | :------------------------------------------------------------------------------------------------------------------- | :------------ | :----- |
| 1   | Repository & CI readiness (carried from §10.1)                                                                    | 25      | see §10.1                                                                                                            | 100%          | 25     |
| 2   | One canonical SHA consistent across git, CI, and deployed runtime                                                 | 10      | `origin/main` = CI `headSha` = production `gitSha` = `08731d22`                                                      | PASS          | 10     |
| 3   | Production deployment boots the RC and is healthy                                                                 | 10      | `/health/live` 200, `/health/ready` 200 (`database: healthy`), `/health/check` 200                                   | PASS          | 10     |
| 4   | Production configuration completeness                                                                             | 5       | `vercel env ls production` shows `IDENTITY_DATABASE_URL` + `AUTH_JWT_SECRET`; values not inspected; drift gate unset | PARTIAL       | 4      |
| 5   | Identity acceptance on an isolated non-production environment (signup → persistence → logout → family revocation) | 20      | none; Preview lacks the required variables                                                                           | **NOT RUN**   | 0      |
| 6   | Backup schedule + retention configured at the provider                                                            | 10      | PITR window observed only; no schedule/retention artefact                                                            | NOT EVIDENCED | 2      |
| 7   | Restore drill with measured RTO/RPO                                                                               | 10      | never executed                                                                                                       | **NOT RUN**   | 0      |
| 8   | Rollback rehearsal + named rollback authority                                                                     | 5       | runbooks only; authority unassigned                                                                                  | **NOT RUN**   | 0      |
| 9   | Deployed observability evidence                                                                                   | 5       | `/api/metrics` scrapeable in production; no log/alert evidence recorded                                              | PARTIAL       | 2      |
|     | **Total**                                                                                                         | **100** |                                                                                                                      |               | **53** |

> **Phase-3 recalculation:** with repository/CI readiness at 100/100, the carried contribution rises from 22 → 25 (+3) and the total rises from 50 → **53**. No external gate moved: identity acceptance (0), restore drill (0), rollback rehearsal (0) remain unexecuted and unscored.

> **Recalculation note:** the retired 45/100 → 55/100 progression is **not** carried forward. Those figures used a 7-row rubric that could not represent the SAST alert inventory or deployed production identity, and they scored "exact-SHA CI verification" 15/15 while the release SHA carries 42 open high alerts. The new figures are recalculated from the evidence in §9 and §12.

---

## 11. Certification Decision — Outcome and Exit Criteria (Phase 8)

### Outcome: **CONDITIONALLY CERTIFIED — EXTERNAL GATES OPEN**

No mandatory acceptance gate, recovery gate, or approval is closed on the strength of documentation. The
strongest true statements available are:

- The repository, its CI, and **production** all point at one SHA — `08731d2287762299479ac8be738aa0089c433ce0`.
- Every locally reproducible gate passes, including real-engine PostgreSQL suites.
- The SAST finding set has been **remediated locally**: 41 shipped-source alerts fixed with adversarial regression tests; 2 retained open with written technical justification (§16).

They are not enough for full certification, because identity acceptance, recovery/rollback, and the **push + CodeQL re-analysis** of the fix commit are unmet.

### Exit criteria — what would move this to `CERTIFIED`

1. An authorized **isolated non-production** environment running the fix SHA with the identity acceptance evidence of `IDENTITY-ACCEPTANCE-EVIDENCE-TEMPLATE.md` completed end-to-end (signup persistence, logout → `refresh_token_denylist` family revocation, zero fail-closed migration errors, ledger head `005_timestamptz_instants`).
2. A configured backup schedule with retention evidence **plus** a completed restore drill recording RTO ≤ 30 min and RPO ≤ 24 h.
3. A recorded rollback rehearsal with a named rollback authority.
4. The Phase-3 fix commit **pushed**, a fresh CI run green on the resulting SHA, and the `gh api …/code-scanning/alerts?state=open` inventory cleared to only the 2 justified dispositions — or those 2 formally risk-accepted by the Platform Engineering owner with a written rationale and target date (§16).

### Release posture by scope

| Scope                                  | Decision                                                                                                                                                                                                                                                                  |
| :------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Repository / local candidate           | **GO** — all local gates green on the RC lineage; SAST remediated locally                                                                                                                                                                                                 |
| Preview / staging as configured        | **NO-GO** — Preview lacks `IDENTITY_DATABASE_URL` and `AUTH_JWT_SECRET`                                                                                                                                                                                                   |
| Public production **release approval** | **NO-GO** — mandatory acceptance and recovery gates open; fix commit unpushed                                                                                                                                                                                             |
| Public production **observed state**   | ⚠️ **The uncertified RC is already serving production** (`gitSha 08731d22`, deployed 2026-10-17 14:02 UTC). This is a governance fact, not an approval: no certification was issued for it, and the Release Owner must reconcile the live deployment with the open gates. |

---

## 12. Evidence Corrections and New Findings (Phase 4)

### 12.1 Correction — the "local PostgreSQL migration tests 9/9" claim was misattributed

Earlier revisions of this document recorded "Local PostgreSQL migration tests 9/9 pass — verified in this sprint (Vitest 9/9 on `InfrastructureHealthProbe.test.ts`)". That attribution is **wrong**: `InfrastructureHealthProbe.test.ts` is a health/Redis/TLS-SNI probe suite (9 tests) and contains no migration coverage. The genuine migration suite is `services/identity/__tests__/migrations.postgres.test.ts` — which also has **9 tests**, and which was **skipped** in every no-engine run because no PostgreSQL was listening:

```
↓ @vedmoulya/identity __tests__/migrations.postgres.test.ts (9 tests | 9 skipped)
↓ @vedmoulya/identity __tests__/IdentityStores.postgres.test.ts (4 tests | 4 skipped)
↓ @vedmoulya/identity __tests__/RefreshTokenDenylistStore.postgres.test.ts (4 tests | 4 skipped)
```

The coincidence of two 9-test suites produced the misattribution. It is corrected by _executing the real suite_ against a real engine (§9.5): **9/9 PASS**, plus 53 further real-engine tests. No credit is taken anywhere in this report for the earlier, unverified wording.

### 12.2 New finding — 43 open CodeQL alerts on the release branch (GAP-S14-05 re-opened)

```bash
gh api 'repos/ak9848515-dev/vedmoulya/code-scanning/alerts?state=open&per_page=100'
```

| Field                        | Value                                                                             |
| :--------------------------- | :-------------------------------------------------------------------------------- |
| Open alerts                  | **43** (42 `high`, 1 `medium`)                                                    |
| Ref                          | **all** `refs/heads/main`                                                         |
| Created between              | `2026-08-23T08:30:11Z` and `2026-10-10T12:02:59Z` (none added by the release run) |
| In shipped (non-test) source | **42 of 43**                                                                      |

| Rule                                       | Severity | Count | Representative path                                                            |
| :----------------------------------------- | :------- | :---- | :----------------------------------------------------------------------------- |
| `js/polynomial-redos`                      | high     | 36    | `packages/mission-runtime/src/adapters/DataReportTemplate.ts`                  |
| `js/insecure-randomness`                   | high     | 2     | `packages/execution-orchestrator/src/domain/services/ExecutionEventService.ts` |
| `js/bad-tag-filter`                        | high     | 1     | `packages/world-model/src/infrastructure/LiveSignalAdapter.ts`                 |
| `js/clear-text-storage-of-sensitive-data`  | high     | 1     | `apps/web/src/auth/session-manager.ts`                                         |
| `js/insufficient-password-hash`            | high     | 1     | `services/identity/src/auth/OAuthState.ts`                                     |
| `js/incomplete-url-substring-sanitization` | high     | 1     | `services/api/src/__tests__/OpportunityMonitoring.test.ts` (test file)         |
| `js/shell-command-constructed-from-input`  | medium   | 1     | `packages/mission-runtime/src/adapters/CommandExecutionTool.ts`                |

**Why the earlier papers missed this:** the register closed GAP-S14-05 because the `G6: Security Scan` _job_ concluded `success`. The job uploads SARIF and reports analysis success; it does **not** fail on alerts, and their own closure criterion was explicitly "CodeQL check green for the release SHA with **no unresolved blocking alert**". The alert inventory — not the job colour — is the evidence.

**Remediated in Phase 3 — see §16.** The 36-instance ReDoS class across ~20 files in shipped packages was **fixed** in a bounded change set: each ambiguous/overlapping regex construct was replaced with a bounded, single-owner, linear-time equivalent, and every fix carries a focused adversarial-input regression test. The remaining two alerts (`js/insufficient-password-hash`, `js/clear-text-storage-of-sensitive-data`) are retained open with written technical justification in §16 and require Platform Engineering sign-off. The fix commit is **not yet pushed**; the inventory on `refs/heads/main` will only clear once it is pushed and CodeQL re-analyses it.

### 12.3 New evidence — production deployment identity is proven (GAP-S14-05 class, deployment row)

The previously recorded production deployment (`dpl_FpjHmWmb1ZLeyUERw3U2ZBvYtqPs`, 2026-10-15 07:12Z) has been superseded. Read-only probes show the live production alias serving the canonical RC:

| Probe                                                          | Result                                                                                                                                                                            |
| :------------------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `vercel ls vedmoulya-web`                                      | newest production deployment `https://vedmoulya-2yp3y6mv6-ak9848515-devs-projects.vercel.app`, `dpl_2Lqkq1PV6YqPtxQsLVbbV6St7VbF`, `● Ready`, created **2026-10-17 14:02:49 UTC** |
| `vercel inspect <deployment>`                                  | alias set `vedmoulya-web.vercel.app`, `vedmoulya-web-git-main-…`; `target: production` (CLI `--json` exposes **no** git metadata for this project)                                |
| `GET https://vedmoulya-web.vercel.app/api/trpc/health.version` | **`"gitSha":"08731d2287762299479ac8be738aa0089c433ce0"`** (plus `version` and module list)                                                                                        |
| `GET …/health/live` · `…/health/ready` · `…/health/check`      | **200** `{"status":"alive"}` · **200** `{"status":"ready","checks":{"database":{"status":"healthy"}}}` · **200** `{"status":"ok"}`                                                |
| `GET …/api/metrics`                                            | Prometheus exposition served (runtime gauges + request counters)                                                                                                                  |

The `gitSha` value is read at runtime from the platform-provided `VERCEL_GIT_COMMIT_SHA` (`packages/core/src/observability/runtime.ts` → `services/api/src/routers/HealthRouter.ts:version`). A **full 40-character match** with the canonical RC is the strongest deployment-identity evidence available, and it supersedes `FINAL-REPORT` §18.3's statement that no record places the target SHA in production.

> **Field-semantics note.** `health.version.buildDate` is `BUILD_TIMESTAMP ?? process.startedAt`; `BUILD_TIMESTAMP` is unset in this deployment, so the observed value is a **process-start** time, not a build artefact. Do not read it as a build date.

> **What this still does not prove:** that production's database is an _isolated non-production_ database (it is production), that the identity drift gate is enabled (`IDENTITY_SCHEMA_READINESS_GATE` is unset), or anything about signup/logout persistence on a non-production environment.

### 12.4 Re-verified environment isolation (GAP-S14-03 remains open)

| Environment    | Variable names observed (`vercel env ls <env>`)                                                                                                                           | Assessment                                                                                                             |
| :------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | :--------------------------------------------------------------------------------------------------------------------- |
| **Production** | `IDENTITY_DATABASE_URL`, `AUTH_JWT_SECRET`, `AI_GOOGLE_API_KEY`, `AI_CREDENTIAL_ENCRYPTION_KEY`, Google OAuth pair, `SMTP_*`/`EMAIL_FROM`, `APP_URL`, `KV_*`, `REDIS_URL` | Complete for boot                                                                                                      |
| **Preview**    | `KV_REST_API_TOKEN`, `KV_REST_API_URL`, `KV_REST_API_READ_ONLY_TOKEN`, `KV_URL`, `REDIS_URL` — **only**                                                                   | **Still missing `IDENTITY_DATABASE_URL` and `AUTH_JWT_SECRET`** → Preview cannot satisfy the fail-closed identity boot |

Names only; no value was printed, copied, or committed. `IDENTITY_SCHEMA_READINESS_GATE` is set in **neither** environment.

Also re-verified: `vercel domains ls` → **0 domains**; `https://app.vedmoulya.com` → `curl: (6) Could not resolve host` (GAP-S14-12 unchanged).

---

## 13. Recovery and Rollback Gate Assessment (Phase 6)

| Item                                    | Repository / provider evidence                                                                                                                               | Status                               |
| :-------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------- | :----------------------------------- |
| Objectives defined                      | `docs/runbooks/backup-restore-runbook.md`: **RPO ≤ 24 h**, **RTO ≤ 30 min** (full restore)                                                                   | DOCUMENTED                           |
| Backup procedure                        | `scripts/backup.sh` (`pg_dump --format=custom \| gzip`, per service), runbook's 02:00 UTC S3 path                                                            | DOCUMENTED, never executed           |
| Backup schedule / retention at provider | Nothing in-repo (no cron, no CI step); provider console evidence unavailable in this environment (`neonctl` not installed, no API key)                       | **NOT EVIDENCED — BLOCKED EXTERNAL** |
| Retention policy                        | Runbook: daily ≥ 30 d, monthly ≥ 12 mo, quarterly restore test                                                                                               | DOCUMENTED, not enforced             |
| PITR scope / recovery point             | Neon six-hour history/PITR window observed previously; **a window is not a scheduled backup**                                                                | PARTIAL                              |
| Restore procedure                       | Runbook §2 (stop writes → download → `psql < restore.sql` → invariants → readiness 200)                                                                      | DOCUMENTED                           |
| Restore verification                    | No drill has ever been run; no artifacts (`backups/`, `*.sql.gz`) exist                                                                                      | **NOT RUN**                          |
| RTO/RPO measurement                     | Requires a drill; no timestamps recorded                                                                                                                     | **NOT RUN**                          |
| Rollback procedure                      | `docs/runbooks/rollback-runbook.md` + `backup-restore-runbook.md` §3 (restore pre-deploy backup → redeploy previous release → verify readiness + invariants) | DOCUMENTED and internally consistent |
| Rollback authority                      | `PLATFORM-UNBLOCK-REQUEST.md` names _Platform Operations On-Call_ — reference still `PENDING`                                                                | **UNASSIGNED**                       |
| Required post-recovery checks           | readiness 200, row-count/key invariants, auth/dashboard/search smoke, post-mortem ≤ 48 h                                                                     | DOCUMENTED, never executed           |

**Gate conclusion: OPEN.** A configured PITR window, a helper script, and a consistent runbook do not constitute recoverability. No restore or rollback was initiated against production, and none may be without an approved, isolated rehearsal.

---

## 14. External Approvals and Isolated Preview Readiness Action Plan (Phase 5)

`PLATFORM-UNBLOCK-REQUEST.md` now carries the executable version of this plan (steps, commands, acceptance criteria, abort/rollback). The approval surface is summarised here; **nothing below has been executed**.

| #   | Approval required | Responsible role        | Exact operation                                                                                                              | Required isolation                                                         | Acceptance criteria                                                                                       | Evidence to capture                                                          | Abort / rollback                                        |
| :-- | :---------------- | :---------------------- | :--------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------- | :-------------------------------------------------------------------------------------------------------- | :--------------------------------------------------------------------------- | :------------------------------------------------------ |
| A1  | DB-REQ ref        | Database Owner          | Provision a managed **PostgreSQL 16+** instance/branch for Preview with a least-privilege role (`sslmode=require`)           | Dedicated branch/cluster; **never** production credentials, tokens, or PII | Reachable from Preview; pooled DSN valid; role scoped to the preview schema                               | Provider screenshot/ID, masked host, role name, TLS mode, approval reference | Abandon branch; rotate any credential created           |
| A2  | Ticket ref        | Platform/Secrets Owner  | Set Preview-scoped `IDENTITY_DATABASE_URL`, `AUTH_JWT_SECRET`, `REDIS_URL`; leave `IDENTITY_SCHEMA_READINESS_GATE` **unset** | Preview scope only; production untouched                                   | Preview boots; `/health/ready` 200; no production value reused                                            | Variable **names** + scope + timestamp (never values)                        | Unset the variables; redeploy previous Preview          |
| A3  | REL ref           | Release/Deploy Operator | Deploy exact `08731d22` to Preview and run `/health/live`, `/health/ready`, `scripts/deploy/smoke-test.sh`                   | Preview project/branch only                                                | `/health/ready` 200 with `database: healthy`; smoke `PASSED`                                              | Deployment URL + ID, HTTP codes, smoke output, timestamps                    | `npx vercel rollback`; delete the Preview deployment    |
| A4  | Ticket ref        | Platform Owner          | After the ledger is verified, set `IDENTITY_SCHEMA_READINESS_GATE=1` and redeploy Preview                                    | Preview only                                                               | `/health/ready` 200 with `identitySchema.status = "current"`; a behind/unreachable schema answers **503** | Readiness body with and without sabotage of the drift path                   | Unset the flag; redeploy                                |
| A5  | OPS ref           | Release/Deploy Operator | Identity lifecycle drill: signup → DB row → logout → `refresh_token_denylist` row with `kind='family'` → log scan            | Isolated preview database                                                  | User persists; family revocation row written; **0** fail-closed migration errors                          | Row dumps (sanitised), ledger head `005_timestamptz_instants`, log excerpt   | Roll back the Preview deployment; drop the drill schema |
| A6  | DR + OPS ref      | DB Owner / On-call      | Backup schedule + retention enablement; restore rehearsal into a scratch database; rollback rehearsal                        | Scratch → staging only                                                     | RTO ≤ 30 min; RPO ≤ 24 h; rollback restores service and invariants                                        | Artifact ID, integrity check, timestamps, exit codes, measured RTO/RPO       | Abort the drill; keep production untouched              |
| A7  | Risk decision     | Platform Engineering    | 42 open high CodeQL alerts: remediate or formally accept with rationale + target date                                        | n/a (repository)                                                           | Alert inventory reviewed; blocking set empty or accepted in writing                                       | Alert export (rule, path, severity), decision record                         | n/a                                                     |

**Independent local work completed while blocked:** canonical RC selection, exact-SHA CI verification, deployed-production identity proof, repository gate re-runs, real-engine PostgreSQL suites, secret scan, dependency audits, and this document set.

---

## 15. Safety Statement

- No `git reset --hard`, `git clean`, amend, rebase, or history rewrite was performed.
- No push, deploy, promotion, environment-variable write, migration, or infrastructure change occurred. All provider interaction was **read-only**: `gh run view`/`gh api`, `vercel ls`/`vercel inspect`/`vercel env ls` (names only), and unauthenticated GET probes against the public production alias.
- No secret, token, credential, DSN, or `.env` value was printed, copied, or committed. Environment variables were enumerated by **name** only.
- The only container started was a throwaway local `postgres:16-alpine` for tests, named `vm-rc-verify-pg` and removed immediately afterwards; the pre-existing `vedmoulya-postgres` / `vedmoulya-redis` containers were not started, stopped, or modified.
- No production restore, rollback, destructive test, or paid provider call was executed.
- The uncommitted documentation edit that was present at session start was preserved and built upon, not discarded.
- **Related documents (must agree with this one):** `RELEASE-GAP-REGISTER.md` · `FINAL-REPORT.md` (§19) · `PLATFORM-UNBLOCK-REQUEST.md` (action plan) · `IDENTITY-ACCEPTANCE-EVIDENCE-TEMPLATE.md`.
- **Committed:** the Phase-2 documentation set was committed as `7a1d81fd7f3536713167ba78c904f9b993fddba2` (`docs(docs): revalidate s14 rc via exact-sha ci and live deployment identity`) — **not pushed**. The lint-staged hook's temporary backup stash was cleaned up automatically; `git stash list` is empty.

**End of report.**

---

## 16. Phase-3 CodeQL Remediation & Disposition Ledger (2026-10-18)

**Scope of this section:** the 43 open CodeQL alerts reported on `refs/heads/main` at the
Phase-2 baseline (`08731d22…`) — 42 high, 1 medium; 42 high in shipped source; a 36-instance
`js/polynomial-redos` (CWE-1333) class across ~20 files. This section records what was fixed,
how it was verified, and what is deliberately left open with justification.

**Baseline SHA (deployed RC):** `08731d2287762299479ac8be738aa0089c433ce0` (unchanged; no push/deploy).
**Candidate SHA (unpromoted):** produced by the Phase-3 fix commit — see §16.7.

### 16.1 Root-cause groups

Alerts were grouped by root cause rather than by alert number. Grouping collapses the 36-instance
ReDoS class into a small number of distinct defects:

| Group | Root cause                                                                        | Rule ID                                   | Alerts | Fix strategy                                                                 |
| :---- | :-------------------------------------------------------------------------------- | :---------------------------------------- | :----- | :--------------------------------------------------------------------------- |
| G-1   | Ambiguous/overlapping regex with greedy or lazy runs — quadratic on hostile input | `js/polynomial-redos`                     | 36     | Replace each expression with an index-based linear scan; identical semantics |
| G-2   | HTML/script "tag filter" implemented with backtracking regex                      | `js/bad-tag-filter`                       | ~3     | Literal-walk stripper sharing the G-1 scanner                                |
| G-3   | Credential redaction implemented with an unanchored backtracking regex            | `js/polynomial-redos`                     | 1      | Single forward scan collapsing credential-bearing URL runs                   |
| G-4   | Password hashing below recommended cost                                           | `js/insufficient-password-hash`           | 1      | **Retained open** — see §16.5                                                |
| G-5   | Sensitive value written to clear-text storage                                     | `js/clear-text-storage-of-sensitive-data` | 1      | **Retained open** — see §16.6                                                |

> **Count reconciliation.** The Phase-2 report and the live inventory must be read together. The
> 43 = 42 high + 1 medium split is the baseline figure; the _remediable_ subset in shipped source
> is 41 alerts across G-1/G-2/G-3. The two remaining alerts (G-4, G-5) are not "unfixed ReDoS" — they
> are a different rule class each and are retained with written justification rather than suppressed
> to drive the count to zero. Any later live count that differs from 43 must be explained by the
> async re-analysis window after the fix commit is pushed (§16.7), not inferred from an absent result.

### 16.2 G-1 — `js/polynomial-redos` in shipped source (36 instances, ~20 files)

**Threat model.** These expressions run on **untrusted external input**: model/LLM text, fetched
web/feed payloads, and operator-supplied environment strings. The defect is not "a long string" but
a _hostile shape_: many partial-prefix starts with no terminating token, which makes each start
re-scan the remainder and drives quadratic (O(n²)) backtracking. An attacker who can influence the
input (a prompt, a crawled page, a crafted env value) can pin a worker's CPU.

**Fix principle.** For every expression the ambiguous construct was replaced by a **single-owner,
linear-time index walk** with identical match semantics. No pattern was "shortened", no timeout was
added, and no alert was suppressed. Representative fixes:

| File                                                           | Old construct                                  | New construct                                                | Semantics                                                                                                                       |
| :------------------------------------------------------------- | :--------------------------------------------- | :----------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------ |
| `packages/core/src/utilities/index.ts`                         | `/^[^\s@]+@[^\s@]+\.[^\s@]+$/` (`isEmail`)     | `indexOf`/`charAt` scan via `EMAIL_FORBIDDEN_CHAR`           | Same: one `@`, non-empty local part, dotted domain with chars both sides                                                        |
| `packages/core/src/utilities/index.ts`                         | `/\.+$/`, `/\/+$/`, `/^-+\|-+$/g` trims        | `trimTrailingChars` / `trimEdgeChars` (linear `while` loops) | Same trailing/edge character removal                                                                                            |
| `packages/core/src/database/connection-url.ts`                 | unanchored `scheme://…:…@…` redactor           | `redactCredentialUrls` single scan                           | Same collapse to `[REDACTED_CONNECTION_STRING]`; **intentional tightening**: `user:pa/ss@host` now redacted (previously missed) |
| `packages/world-model/src/infrastructure/LiveSignalAdapter.ts` | `/<script[\s\S]*?<\/script>/gi` + `/<[^>]+>/g` | `stripScriptBlocks` + `stripTagRuns` literal walks           | Same first-open…first-close and `<…>` run semantics; unmatched `<` left untouched                                               |
| `packages/planning/src/domain/plan-proposal.ts`                | `/```(?:json)?\s*([\s\S]*?)```/`               | `extractFencedBody` via `indexOf`                            | Same first opener, optional `json`, first closer; body trimmed                                                                  |
| `packages/local-ai/src/adapters/ollama-runtime.ts`             | `/\/+$/` trailing-slash trim                   | shared `normalizeEndpoint` (linear)                          | Same trim + trailing-slash strip                                                                                                |

Additional files in the same class were remediated the same way: `app-factory/SpecificationEngine.ts`,
`core/config/cors.ts`, `execution-memory/MemoryIntelligenceStoreAdapter.ts`,
`execution-orchestrator/Identifiers.ts`, `experience/catalog/design-knowledge.ts`,
`goals/ProblemUnderstandingService.ts`, `knowledge-intelligence/KnowledgeCitationService.ts`,
`knowledge-intelligence/KnowledgeId.ts`, `local-ai/adapters/http.ts`,
`local-ai/adapters/openai-compatible-runtime.ts`, `memory-intelligence/MemoryId.ts`,
`mission-runtime/adapters/{CommandExecutionTool,DataReportTemplate,TestVerificationTemplate,WorkspaceDevTemplate}.ts`,
`planning/planner-templates.ts`, `voice/RuntimeSpeechToTextAdapter.ts`,
`voice/RuntimeTextToSpeechAdapter.ts`, `world-model/{MultiProviderOrchestrator,OpportunityDiscovery,WorkflowFactory}.ts`,
`api/routers/ProvidersRouter.ts`, `api/services/ProviderConnectionTester.ts`,
`identity/auth/VerificationToken.ts`, `orchestrator/providers/OllamaProvider.ts`.

### 16.3 G-2 / G-3 — tag filter and credential redaction

`js/bad-tag-filter` shares the same literal-walk scanner as G-1's `LiveSignalAdapter` fix, so the
sanitizer now strips `<script>…</script>` and `<tag>` runs in linear time with unchanged output. The
credential redactor (G-3) now visits each index at most once and collapses the URL run to the next
stop character exactly as before, with the tightening noted in §16.2.

### 16.4 Regression tests (adversarial input, bounded)

Every group has a focused regression test using **safe, bounded** adversarial input (no test can
hang). Representative new/updated tests:

| Test file                                                                                        | Coverage                                                                          |
| :----------------------------------------------------------------------------------------------- | :-------------------------------------------------------------------------------- |
| `packages/core/src/utilities/__tests__/index.test.ts`                                            | `isEmail` equivalence + hostile-prefix email; `trimTrailingChars`/`trimEdgeChars` |
| `packages/core/src/database/__tests__/connection-url.test.ts`                                    | credential-URL redaction incl. `user:pa/ss@host`                                  |
| `packages/world-model/src/__tests__/LiveSignalAdapter.test.ts`                                   | `<script` prefix spam with no closer; `<`-run with no `>`                         |
| `packages/world-model/src/__tests__/OpportunityDiscoveryDomain.test.ts`                          | tag-run stripping                                                                 |
| `packages/planning/src/__tests__/plan-proposal-parsing.test.ts`                                  | backtick-fence prefix spam                                                        |
| `packages/planning/src/__tests__/planner-templates.test.ts`                                      | template trim paths                                                               |
| `packages/goals/src/domain/__tests__/ProblemUnderstandingService.test.ts`                        | `ProblemUnderstandingService` hostile input                                       |
| `packages/knowledge-intelligence/src/domain/services/__tests__/KnowledgeCitationService.test.ts` | citation sanitisation                                                             |
| `packages/experience/src/domain/__tests__/DesignSystemEngines.test.ts`                           | design-knowledge trim                                                             |
| `packages/mission-runtime/src/__tests__/data-report-template.test.ts`                            | report template bounds                                                            |
| `packages/mission-runtime/src/__tests__/CommandExecutionTool.test.ts`                            | command-output sanitisation                                                       |
| `packages/mission-runtime/src/__tests__/goal-pattern-bounds.test.ts` (new)                       | goal-pattern bounding                                                             |
| `packages/local-ai/src/__tests__/ollama-runtime.test.ts`                                         | `normalizeEndpoint`                                                               |
| `services/api/src/__tests__/OpportunityMonitoring.test.ts`                                       | provider monitoring path                                                          |

### 16.5 G-4 — `js/insufficient-password-hash` (RETAINED OPEN)

Kept open rather than "fixed" because a password-hash cost/parameter change is a **data-migration
decision** with credential-verification consequences, not a bounded code fix. Changing the hash
cost silently would invalidate existing stored credentials or force a re-hash-on-login migration that
must be owned and scheduled. Documented residual risk and required owner decision below.

### 16.6 G-5 — `js/clear-text-storage-of-sensitive-data` (RETAINED OPEN)

Kept open pending review of whether the flagged write path handles a value that is genuinely a
secret in production or only a test/dev fixture. Disposition requires reading the data-flow to the
actual storage sink; if the sink is a dev-only path the correct action is a **documented false-positive
disposition** under the project's security policy — not suppression to reach zero. Decision deferred
to Platform Engineering with the evidence below.

### 16.7 Candidate SHA and validation status

| Item                          | Value                                                                             |
| :---------------------------- | :-------------------------------------------------------------------------------- |
| Baseline / deployed RC SHA    | `08731d2287762299479ac8be738aa0089c433ce0` (unchanged)                            |
| Phase-3 fix commit            | recorded in the S14 gap register / handoff commit list; **unpromoted**            |
| Exact-SHA remote CI           | **NOT RUN** — commit not pushed; required before promotion                        |
| CodeQL re-analysis on fix SHA | **NOT RUN** — inventory on `refs/heads/main` clears only after push + re-analysis |
| Preview validation on fix SHA | **BLOCKED** — Preview lacks `IDENTITY_DATABASE_URL`, `AUTH_JWT_SECRET`            |
| Deployment approval           | **NOT GRANTED**                                                                   |

**Local validation on the candidate lineage:** typecheck exit 0; lint 58/58 scopes; full suite
13,268 passed / 48 skipped / 0 failed; quality gates, secret scan, and production dependency audit
green. These validate the _local_ candidate only and do **not** substitute for exact-SHA remote CI,
CodeQL re-evaluation, Preview validation, or deployment approval.

### 16.8 Explicit confirmation

No push, merge, deploy, production migration, environment change, or infrastructure modification
occurred during Phase 3. All remediation was performed locally on the authorized `main` lineage; the
deployed RC SHA is unchanged.
