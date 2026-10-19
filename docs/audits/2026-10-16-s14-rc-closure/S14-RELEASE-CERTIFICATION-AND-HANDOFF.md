# S14 Release Certification & Handoff Report

**Document Reference:** `docs/audits/2026-10-16-s14-rc-closure/S14-RELEASE-CERTIFICATION-AND-HANDOFF.md`
**Certification Date (UTC):** 2026-10-18 (Phase 4: Release Acceptance & External Gate Closure)
**Prepared By:** Release Certification Engineer / QA / Repository Auditor
**Scope:** `docs/audits/2026-10-16-s14-rc-closure`
**Canonical Release Candidate SHA:** `08731d2287762299479ac8be738aa0089c433ce0` (see §2)
**Latest local security-fix commit:** `347164edd2d76d87589db71bc3d1bec83a302cc8` (ahead of `origin/main` by 8 commits, unpushed; see §17)
**Decision:** **CONDITIONALLY CERTIFIED — EXTERNAL GATES OPEN** (see §11 and §18)
**Scores (scope-corrected 2026-10-19):** Deployed RC `08731d22` repository/CI readiness **88/100** · Local security-fix HEAD `347164ed` **58/58 locally-verifiable points, 0/42 remote-only points — no full score claimed while remote CI and CodeQL are NOT RUN** · Full operational release readiness (deployed RC) **50/100** (see §10 and §18)

> **2026-10-18 Phase-2 update:** Exact-SHA CI is verified for the canonical RC. Production was additionally proven (via the running app's own `/api/trpc/health.version`) to serve **exactly** `08731d2287762299479ac8be738aa0089c433ce0`. Two material corrections were made this session: the historical "local PostgreSQL migration tests 9/9" claim was **misattributed**, and the release SHA carries **43 open CodeQL alerts (42 high, 1 medium)** on `refs/heads/main`, which re-opens the SAST gate. Remaining blockers are identity acceptance on an authorized isolated environment, backup/DR/rollback, and unresolved SAST findings.

> **2026-10-18 Phase-3 update (remediation):** The 41 shipped-source alerts that were genuinely remediable have been fixed in a single, bounded change set (all 36 ReDoS instances, 2 insecure-randomness sites, `js/bad-tag-filter`, `js/shell-command-constructed-from-input`, `js/incomplete-url-substring-sanitization` in the one test file). Two alerts remain **open with engineering review records only** — `js/insufficient-password-hash` (`services/identity/src/auth/OAuthState.ts`, a CSPRNG nonce digest) and `js/clear-text-storage-of-sensitive-data` (`apps/web/src/auth/session-manager.ts`, a tab-scoped OAuth `state` handoff). These are **proposals**, not recorded dispositions, and require Platform Security Lead sign-off (§16, §18.4). Neither is dismissed as a false positive or accepted as a risk. **No alert was suppressed or dismissed to lower the count.** The fix set is verified locally (13,268 tests, lint 58/58, quality gates 18/18, secret scan, dependency audits) but is **not yet pushed and not CI-verified** — so the SAST gate remains open on `refs/heads/main` until the fix commit is pushed and CodeQL re-analyses it.

> **2026-10-18 Phase-4 update (release acceptance & external gate closure):** Validated exact repository baseline (HEAD `347164ed`, ahead 8, clean tree). Prepared concise owner-review records for both retained CodeQL findings. Verified read-only that Vercel Preview lacks `IDENTITY_DATABASE_URL` and `AUTH_JWT_SECRET`, that `app.vedmoulya.com` returns NXDOMAIN, that public production alias `vedmoulya-web.vercel.app` serves valid TLS and reports `08731d22`, and drafted an executable restore-drill and rollback-rehearsal plan. Documented exact push approval required (`PUSH-AUTH-REF`). All external gates remain open pending authorized execution. See §17.

> **2026-10-19 Phase-5 update (certification integrity review):** The Phase-4 record contained material internal contradictions, corrected in **§18** without rewriting the historical text: (1) the **100/100 repository score conflated** the CI-verified baseline `08731d22` with the unpushed security-fix HEAD `347164ed`, whose remote CI and CodeQL are **NOT RUN**; (2) rollback was described as **rehearsed** in one document and **NOT RUN/NOT EVIDENCED** elsewhere — the supported state is **NOT VERIFIED — REHEARSAL EVIDENCE MISSING**; (3) the existence of `scripts/backup.sh` and runbooks was not separated from provider schedule evidence or an executed restore drill; (4) two CodeQL findings had **proposed** dispositions written in a way that could read as recorded risk acceptance. No push, deploy, infrastructure change, migration, restore, or rollback was performed.

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

| Commit     | Subject                                                                                        | CI-verified?                                             |
| :--------- | :--------------------------------------------------------------------------------------------- | :------------------------------------------------------- |
| `afef0cb6` | Merge PR #44 (`fix/s14-rc-closure`)                                                            | Yes — run `39030531474` (parent)                         |
| `08731d22` | chore(meta): complete repository audit, apply stashed TLS fix, audit evidence, clean workspace | **Yes — run `39039076592` (exact release target)**       |
| `d1f8eeea` | docs: finalize s14 rc certification evidence                                                   | **No** — documentation + one regression test only        |
| `27dc57e3` | docs: close s14 exact-sha ci gaps via verified run                                             | **No** — documentation only                              |
| `7a1d81fd` | docs: revalidate s14 rc via exact-sha ci and live deployment identity (Phase 2)                | **No** — documentation only                              |
| `07ca1056` | docs: record the s14 phase-2 commit hash and clean tree                                        | **No** — documentation only                              |
| `082d6284` | docs: repair s14 audit table rows and escape a cell pipe                                       | **No** — documentation only                              |
| `cc5e63c9` | docs: state the s14 local commit set without a brittle count                                   | **No** — documentation only                              |
| `1ae96566` | docs: split the merged phase-9 row in the s14 baseline table                                   | **No** — documentation only                              |
| `347164ed` | fix(core): remediate verified s14 codeql findings (**HEAD**)                                   | **No** — 50 files, +1,213/−223; remote CI/CodeQL NOT RUN |

> The release target `08731d22` is CI-verified. **No commit above it is CI-verified.** The documentation commits add evidence and table repairs; `347164ed` is the security-fix candidate, changes 50 files including production source, and has **no remote CI or CodeQL run** (see §18).

---

## 2. Evidence-Based Reconciliation (Phase 1)

### 2.1 CI and code quality

| Claim                                                    | Status                  | Basis                                                                                               |
| :------------------------------------------------------- | :---------------------- | :-------------------------------------------------------------------------------------------------- |
| CI run `39030531474` reports success                     | **Verified**            | `gh run list` / register; covers parent `afef0cb6…`                                                 |
| CI run `39039076592` reports success                     | **Verified 2026-10-18** | `gh run view 39039076592` → `completed/success`, headSha `08731d22…`                                |
| That run covers the **exact** release target `08731d22…` | **VERIFIED — YES**      | `gh run view` returned `"headSha":"08731d2287762299479ac8be738aa0089c433ce0"`; all 9 jobs `success` |

> **Reconciliation (2026-10-18):** A CI run **on the exact release SHA** `08731d22` exists: run `39039076592` (push, `main`, `completed/success`, 15m32s, created `2026-10-17T14:02:46Z`). All mandatory jobs passed: G1-G2 Architecture & Code Quality, G3 Testing & Coverage, G4 Accessibility, G5 Performance, G6 Security Scan, G7 Quality Benchmarks, G8 End-to-End Tests, Build, and the fail-closed `CI Result`. Run URL: `https://github.com/ak9848515-dev/vedmoulya/actions/runs/39039076592`. This **closes GAP-S14-04** for the release SHA. It does **not** close GAP-S14-05: the `G6` job concluded `success` because it uploads SARIF, but the live alert inventory for this same SHA was **43 open alerts** (42 high, 1 medium). The prior statement that only the parent SHA was covered is now superseded.

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

The earlier table in this section used a **local 9-row numbering** that conflicted with `RELEASE-GAP-REGISTER.md`. The register's numbering is canonical: the original 13 gaps plus **GAP-S14-14** (remote CI for the unpushed security-fix candidate), added 2026-10-19.

| Gap ID     | Description                                                     | Severity | Status 2026-10-19     | Blocker / Owner                                                                                                     |
| :--------- | :-------------------------------------------------------------- | :------- | :-------------------- | :------------------------------------------------------------------------------------------------------------------ |
| GAP-S14-01 | OpenRouter probe false positive                                 | Medium   | **CLOSED**            | Fix merged and CI-green on the exact RC SHA                                                                         |
| GAP-S14-02 | No _isolated non-production_ managed identity DB for acceptance | Critical | **BLOCKED**           | Database Owner (provision + written approval)                                                                       |
| GAP-S14-03 | Preview env lacks `IDENTITY_DATABASE_URL` / `AUTH_JWT_SECRET`   | High     | **BLOCKED**           | Platform/Secrets Owner                                                                                              |
| GAP-S14-04 | CI G8 production-mode E2E for the exact release SHA             | High     | **CLOSED**            | Run `39039076592` on `08731d22`                                                                                     |
| GAP-S14-05 | SAST / CodeQL alert inventory (remote)                          | High     | **OPEN**              | 43 open on `refs/heads/main`; 41 fixed only in unpushed `347164ed`; 2 retained findings lack authorized disposition |
| GAP-S14-06 | Secret-scan gate script defect                                  | Low      | **CLOSED (local)**    | `s56-secret-scan.ps1` exit 0, 20 fixture hits                                                                       |
| GAP-S14-07 | Twelve dev-only high advisories                                 | Low      | **OPEN**              | No signed risk-acceptance record (owner + date) exists; decision pending Platform Engineering                       |
| GAP-S14-08 | Staging/Preview readiness + smoke                               | High     | **BLOCKED**           | Platform Engineering + Deploy Operator                                                                              |
| GAP-S14-09 | S012-C staging DR drill                                         | Critical | **BLOCKED**           | Staging/DB Owner                                                                                                    |
| GAP-S14-10 | Backup schedule / retention at provider                         | High     | **BLOCKED**           | Platform/DevOps + DB Owner                                                                                          |
| GAP-S14-11 | Live observability + rollback rehearsal                         | Medium   | **NOT RUN**           | Rollback Authority + Platform Engineering                                                                           |
| GAP-S14-12 | Canonical production origin `app.vedmoulya.com` mismatch        | Low      | **OPEN** (hygiene)    | DNS/Platform owner (safe to defer)                                                                                  |
| GAP-S14-13 | Release hygiene / traceability                                  | Medium   | **AWAITING APPROVAL** | 8 local commits unpushed pending `PUSH-AUTH-REF`; governance edits uncommitted (see §18.1)                          |
| GAP-S14-14 | Remote CI for security-fix candidate `347164ed`                 | High     | **NOT RUN**           | No CI run exists for this SHA (`gh run list --commit 347164ed` returned none); push unauthorized                    |

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

**Rationale:** The canonical RC `08731d22` is CI-green and deployed to production with matching runtime identity. During Phase 3 the SAST findings were **remediated locally**: all 36 `js/polynomial-redos` instances, both `js/insecure-randomness` sites, the `js/bad-tag-filter`, the `js/shell-command-constructed-from-input` (medium), and the `js/incomplete-url-substring-sanitization` test-file alert were fixed with bounded, semantically-equivalent linear-time replacements, each with a focused adversarial-input regression test. Two alerts are retained **open with engineering review records, not authorized dispositions** (see §16 and §18.4): a CSPRNG nonce digest and a tab-scoped OAuth `state` handoff. Calling either a "false positive" or an "accepted risk" is **not supported**, because no security-owner decision with owner and date is recorded. The remaining mandatory classes are **external** and cannot be closed from the repository: **(a)** identity acceptance on an authorized isolated non-production environment; **(b)** backup schedule/retention evidence, a restore drill with measured RTO/RPO, and a rollback rehearsal; **(c)** the fix commit being pushed and CodeQL re-analysing `refs/heads/main` so the 43-alert inventory clears.

> **Why "conditional" and not "certified":** the repository/CI readiness of the deployed RC is **88/100**, not 100, and the local security-fix candidate has **no remote verification at all**. Certification cannot close until the external identity/recovery gates run and the SAST fix commit is pushed and re-analysed. Until then, public production release approval remains **NO-GO**.

### Scores (rubric defined in §10; scope-corrected 2026-10-19)

| Score                                                  | Value                                               | Scope                                                          |
| :----------------------------------------------------- | :-------------------------------------------------- | :------------------------------------------------------------- |
| Repository & CI readiness — deployed RC `08731d22`     | **88 / 100**                                        | Remote CI exact-SHA verified; SAST criterion not met (43 open) |
| Repository & CI readiness — local candidate `347164ed` | **58 / 58 local points; 0 / 42 remote-only points** | Remote CI and CodeQL **NOT RUN** — no full score               |
| Full operational release readiness — deployed RC       | **50 / 100**                                        | External identity/recovery gates open                          |

> **Score correction 2026-10-19 (Phase 5):** The Phase-3 movement to 100/100 was **not earned**. It awarded the full 12-point SAST criterion on the strength of a **local, unpushed** fix while the remote inventory on `refs/heads/main` still showed 43 open alerts and the fix SHA had no CI run. The criteria that require remote evidence are now scored zero for `347164ed`, and the deployed RC keeps the score its own evidence supports (88). The operational score returns to **50** because its carried repository component is 25 × 88% = 22, not 25.

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

### 10.1 Repository & CI readiness — deployed RC `08731d22`: 88 / 100

This table scores **`08731d22` only** — the SHA that is `origin/main`, the exact-SHA CI run `39039076592`, and the production runtime. It does not score the unpushed fix commit.

| #   | Criterion                                        | Weight  | Evidence                                                                                        | Status      | Earned |
| :-- | :----------------------------------------------- | :------ | :---------------------------------------------------------------------------------------------- | :---------- | :----- |
| 1   | Typecheck + format                               | 10      | `npm run typecheck` exit 0; CI `G1-G2`                                                          | PASS        | 10     |
| 2   | Lint                                             | 8       | 58 scopes, 0 failed; CI `G1-G2`                                                                 | PASS        | 8      |
| 3   | Full test suite                                  | 12      | 13,268 passed / 48 skipped / 0 failed (§5)                                                      | PASS        | 12     |
| 4   | Real-engine database suites                      | 8       | 62 tests on PostgreSQL 16.15 (§9.5)                                                             | PASS        | 8      |
| 5   | Config contract, dep cycles, quality gates       | 10      | 3 commands, exit 0 each; 18/18                                                                  | PASS        | 10     |
| 6   | Secret scan                                      | 5       | exit 0, 20 fixture-only hits                                                                    | PASS        | 5      |
| 7   | Dependency security (production)                 | 5       | `npm audit --omit=dev --audit-level=high` → 0                                                   | PASS        | 5      |
| 8   | Accessibility gate                               | 5       | CI `G4` success on the RC                                                                       | PASS        | 5      |
| 9   | Performance/bundle budgets                       | 5       | CI `G5` success on the RC                                                                       | PASS        | 5      |
| 10  | CI green on the exact canonical SHA incl. G8 E2E | 20      | run `39039076592`, 9/9 jobs                                                                     | PASS        | 20     |
| 11  | SAST with no unresolved blocking alert           | 12      | 43 open alerts on `refs/heads/main` at this SHA; remediation exists only in unpushed `347164ed` | **NOT MET** | 0      |
|     | **Total**                                        | **100** |                                                                                                 |             | **88** |

**Local security-fix candidate `347164ed` — evidence-scoped, not a readiness score:**

| Scope                                             | Points | Verified | Basis                                                                                    |
| :------------------------------------------------ | :----- | :------- | :--------------------------------------------------------------------------------------- |
| Criteria 1–7 (locally executable)                 | 58     | **58**   | Typecheck, lint, tests, PG suites, config/quality gates, secret scan, prod audit on HEAD |
| Criteria 8–11 (require remote CI/CodeQL evidence) | 42     | **0**    | No CI run exists for `347164ed`; CodeQL has not analysed it                              |

> A 58/42 split is reported instead of a single number because blending the two evidence classes is exactly the defect this review corrects. The candidate cannot earn remote points until it is pushed and analysed.

### 10.2 Full operational release readiness — deployed RC `08731d22`: 50 / 100

| #   | Criterion                                                                                                         | Weight  | Evidence                                                                                                             | Status        | Earned |
| :-- | :---------------------------------------------------------------------------------------------------------------- | :------ | :------------------------------------------------------------------------------------------------------------------- | :------------ | :----- |
| 1   | Repository & CI readiness (carried from §10.1)                                                                    | 25      | §10.1 = 88/100 for `08731d22`                                                                                        | 88%           | 22     |
| 2   | One canonical SHA consistent across git, CI, and deployed runtime                                                 | 10      | `origin/main` = CI `headSha` = production `gitSha` = `08731d22`                                                      | PASS          | 10     |
| 3   | Production deployment boots the RC and is healthy                                                                 | 10      | `/health/live` 200, `/health/ready` 200 (`database: healthy`), `/health/check` 200                                   | PASS          | 10     |
| 4   | Production configuration completeness                                                                             | 5       | `vercel env ls production` shows `IDENTITY_DATABASE_URL` + `AUTH_JWT_SECRET`; values not inspected; drift gate unset | PARTIAL       | 4      |
| 5   | Identity acceptance on an isolated non-production environment (signup → persistence → logout → family revocation) | 20      | none; Preview lacks the required variables                                                                           | **NOT RUN**   | 0      |
| 6   | Backup schedule + retention configured at the provider                                                            | 10      | PITR window observed only; no schedule/retention artefact                                                            | NOT EVIDENCED | 2      |
| 7   | Restore drill with measured RTO/RPO                                                                               | 10      | never executed                                                                                                       | **NOT RUN**   | 0      |
| 8   | Rollback rehearsal + named rollback authority                                                                     | 5       | runbooks only; authority unassigned                                                                                  | **NOT RUN**   | 0      |
| 9   | Deployed observability evidence                                                                                   | 5       | `/api/metrics` scrapeable in production; no log/alert evidence recorded                                              | PARTIAL       | 2      |
|     | **Total**                                                                                                         | **100** |                                                                                                                      |               | **50** |

> **Phase-5 recalculation:** the carried repository component is **25 × 88% = 22** (not 25), so the operational total is **50**, not 53. No external gate moved: identity acceptance (0), restore drill (0), rollback rehearsal (0) remain unexecuted and unscored. The Phase-3 +3 was attributable solely to the unearned local SAST credit and is withdrawn.

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

| Scope                                   | Decision                                                                                                                                                                                                                                                                  |
| :-------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Repository / local candidate `347164ed` | **LOCAL GATES GO / PUBLICATION AWAITING APPROVAL** — all local gates green; remote CI and CodeQL **NOT RUN**; SAST remediated locally but unverified remotely                                                                                                             |
| Preview / staging as configured         | **NO-GO** — Preview lacks `IDENTITY_DATABASE_URL` and `AUTH_JWT_SECRET`                                                                                                                                                                                                   |
| Public production **release approval**  | **NO-GO** — mandatory acceptance and recovery gates open; fix commit unpushed                                                                                                                                                                                             |
| Public production **observed state**    | ⚠️ **The uncertified RC is already serving production** (`gitSha 08731d22`, deployed 2026-10-17 14:02 UTC). This is a governance fact, not an approval: no certification was issued for it, and the Release Owner must reconcile the live deployment with the open gates. |

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

| Item                                    | Repository / provider evidence                                                                                                                               | Status                                   |
| :-------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------- | :--------------------------------------- |
| Objectives defined                      | `docs/runbooks/backup-restore-runbook.md`: **RPO ≤ 24 h**, **RTO ≤ 30 min** (full restore)                                                                   | DOCUMENTED                               |
| Backup procedure                        | `scripts/backup.sh` (`pg_dump --format=custom \| gzip`, per service), runbook's 02:00 UTC S3 path                                                            | DOCUMENTED, never executed               |
| Backup schedule / retention at provider | Nothing in-repo (no cron, no CI step); provider console evidence unavailable in this environment (`neonctl` not installed, no API key)                       | **BLOCKED — NOT VERIFIED**               |
| Retention policy                        | Runbook: daily ≥ 30 d, monthly ≥ 12 mo, quarterly restore test                                                                                               | DOCUMENTED, not enforced                 |
| PITR scope / recovery point             | Neon six-hour history/PITR window observed previously; **a window is not a scheduled backup**                                                                | PARTIAL                                  |
| Restore procedure                       | Runbook §2 (stop writes → download → `psql < restore.sql` → invariants → readiness 200)                                                                      | DOCUMENTED                               |
| Restore verification                    | No drill has ever been run; no artifacts (`backups/`, `*.sql.gz`) exist                                                                                      | **NOT RUN — REHEARSAL EVIDENCE MISSING** |
| RTO/RPO measurement                     | Requires a drill; no timestamps recorded                                                                                                                     | **NOT RUN**                              |
| Rollback procedure                      | `docs/runbooks/rollback-runbook.md` + `backup-restore-runbook.md` §3 (restore pre-deploy backup → redeploy previous release → verify readiness + invariants) | **DOCUMENTED ONLY — NOT VERIFIED**       |
| Rollback authority                      | `PLATFORM-UNBLOCK-REQUEST.md` names _Platform Operations On-Call_ — reference still `PENDING`                                                                | **UNASSIGNED**                           |
| Required post-recovery checks           | readiness 200, row-count/key invariants, auth/dashboard/search smoke, post-mortem ≤ 48 h                                                                     | DOCUMENTED, never executed               |

**Gate conclusion: OPEN.** A configured PITR window, a helper script, and a consistent runbook do not constitute recoverability. No restore or rollback was initiated against production, and none may be without an approved, isolated rehearsal.

**Four distinct recovery levels — do not collapse them:**

| Level                                                     | State on 2026-10-19                                       | Evidence required to advance                                                                       |
| :-------------------------------------------------------- | :-------------------------------------------------------- | :------------------------------------------------------------------------------------------------- |
| 1. Scripts and runbooks present                           | **YES** (`scripts/backup.sh`, two runbooks)               | n/a — this is not a gate                                                                           |
| 2. Provider backup schedule/retention verified            | **NOT VERIFIED**                                          | Provider console/API evidence: schedule, retention window, PITR scope, artifact IDs                |
| 3. Restore drill planned                                  | **YES** (§17.5 plan, `PLATFORM-UNBLOCK-REQUEST.md` row 8) | n/a — a plan earns no gate credit                                                                  |
| 4. Restore drill executed with recorded recovery evidence | **NOT RUN — REHEARSAL EVIDENCE MISSING**                  | Drill log, artifact integrity check, measured RTO ≤ 30 min / RPO ≤ 24 h, invariants, readiness 200 |

**Rollback:** documented only. **NOT VERIFIED — REHEARSAL EVIDENCE MISSING.** The word "rehearsed" must not be used for this gate until a rehearsal log exists.

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

> **[FRAMING CORRECTED 2026-10-19 — the historical text below is preserved unchanged.]** This passage
> was drafted on a password-hash assumption that the verified data flow does not support. The flagged
> statement is the SHA-256 digest of a 256-bit CSPRNG OAuth nonce
> (`services/identity/src/auth/OAuthState.ts:47`), not a hash of a stored password or of any user-chosen
> credential, so there is no password cost/parameter migration to schedule. The governing description and
> the still-pending decision are in §17.2 (Owner-Review Record 1) and §18.4, and in
> `SECURITY-DISPOSITION-RECORDS-51-39.md` §2. **No decision has been recorded; alert #51 remains open.**

Kept open rather than "fixed" because a password-hash cost/parameter change is a **data-migration
decision** with credential-verification consequences, not a bounded code fix. Changing the hash
cost silently would invalidate existing stored credentials or force a re-hash-on-login migration that
must be owned and scheduled. Documented residual risk and required owner decision below.

### 16.6 G-5 — `js/clear-text-storage-of-sensitive-data` (RETAINED OPEN)

> **[FRAMING CORRECTED 2026-10-19 — the historical text below is preserved unchanged.]** The sink has
> since been traced to the actual storage path. The flagged write stores `{state, next}` — a server-minted
> OAuth CSRF nonce and a redirect path — in `sessionStorage['vedmoulya-oauth-pending']`
> (`apps/web/src/auth/session-manager.ts:355-357`, plus the server-rendered callback write at
> `services/identity/src/auth/AuthRoutes.ts:307-308`). **No access token, refresh token, password,
> authorization code, or client secret is stored there**, and the path is not a dev/test fixture, so a
> false-positive disposition is not the applicable route. The governing description and the still-pending
> decisions are in §17.2 (Owner-Review Record 2) and §18.4, and in
> `SECURITY-DISPOSITION-RECORDS-51-39.md` §3. **Alert #39 remains open.**

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

---

## 17. Phase-4 Release Acceptance & External Gate Closure Review (2026-10-18) — **historical; §18 governs**

**Scope:** Evidence-based external gate closure review, security-owner review records for retained findings, recovery rehearsal planning, and external acceptance gap assessment. Read-only provider inspection and local checks only. No push, deploy, rollback, migration, environment variable write, or infrastructure change was performed.

### 17.1 Exact repository state and commit graph

The repository state was inspected and verified live:

- **Current branch:** `main`
- **HEAD SHA:** `347164edd2d76d87589db71bc3d1bec83a302cc8` (`fix(core): remediate verified s14 codeql findings`)
- **Canonical Release Candidate (Deployed):** `08731d2287762299479ac8be738aa0089c433ce0`
- **Upstream divergence:** `main` is ahead 8, behind 0 of `origin/main` (`08731d2287762299479ac8be738aa0089c433ce0`). All 8 commits are local and unpushed.
- **Working tree:** Clean at the time of this review. **[CORRECTED 2026-10-19]** At Phase-5 capture `git status --short` shows 4 modified governance documents (documentation only).
- **Stashes:** Zero stashes (`git stash list` empty; `refs/stash` unresolvable).

#### Verified commit sequence above `origin/main`:

```
347164ed fix(core): remediate verified s14 codeql findings (HEAD)
1ae96566 docs(docs): split the merged phase-9 row in the s14 baseline table
cc5e63c9 docs(docs): state the s14 local commit set without a brittle count
082d6284 docs(docs): repair s14 audit table rows and escape a cell pipe
07ca1056 docs(docs): record the s14 phase-2 commit hash and clean tree
7a1d81fd docs(docs): revalidate s14 rc via exact-sha ci and live deployment identity
27dc57e3 docs(docs): close s14 exact-sha ci gaps via verified run
d1f8eeea docs(docs): finalize s14 rc certification evidence
08731d22 chore(meta): complete repository audit, apply stashed tls fix and audit evidence (origin/main)
```

#### Diff inspection of security remediation commit `347164edd2d76d87589db71bc3d1bec83a302cc8`:

- 50 files changed, 1,213 insertions, 223 deletions.
- Replaced ambiguous, backtracking regular expressions with single-pass, bounded linear scans across 20+ shipped source files.
- Remediated 41 of 43 CodeQL alerts: 36× `js/polynomial-redos`, 2× `js/insecure-randomness`, 1× `js/bad-tag-filter`, 1× `js/shell-command-constructed-from-input`, and 1× `js/incomplete-url-substring-sanitization` in a test fixture.
- Added comprehensive adversarial-input regression tests verifying linear behavior and absence of ReDoS vulnerabilities.

### 17.2 Retained security finding owner-review records

Two findings from the 43-alert baseline are retained open with technical justifications. As mandated by policy, neither finding is unilaterally dismissed or labeled as a confirmed false positive. Both require formal sign-off from Platform Security Lead (`SEC-SIGN-OFF`).

#### Owner-Review Record 1: Nonce SHA-256 Digest (`js/insufficient-password-hash`)

- **Alert Number & Rule:** Alert #51 — `js/insufficient-password-hash` (Severity: High)
- **Source Location:** `services/identity/src/auth/OAuthState.ts:47` (`hashOAuthState`)
- **Actual Data Flow:**
  1. `createOAuthState()` generates 32 cryptographically secure random bytes via `randomBytes(32).toString('base64url')` (256 bits of entropy).
  2. The raw token is returned to the user as the URL `state` query parameter for the Google OAuth 2.0 authorization request.
  3. The server computes `createHash('sha256').update(state).digest('hex')` via `hashOAuthState(state)` and persists only this SHA-256 hex digest (`stateHash`) in the `oauth_states` table along with a 10-minute expiry timestamp (`expiresAt`).
  4. On callback from Google, the presented raw state is hashed via SHA-256 and matched against the unconsumed store entry.
- **Threat Model:** Cross-Site Request Forgery (CSRF) in OAuth 2.0 authentication flows. The purpose is state correlation across an external redirect to ensure the response originates from an authorization transaction initiated by the same client.
- **Affected Code Paths:** `services/identity/src/auth/OAuthState.ts`, `services/identity/src/infrastructure/persistence/OAuthStateStore.ts`, and Google OAuth router endpoints (`/auth/google/url`, `/auth/google/callback`).
- **Compatibility Implications:** Applying a slow password-hashing function (such as bcrypt, scrypt, or Argon2id) to OAuth state nonces would impose significant CPU overhead and response latency on high-frequency login redirects, require salting and schema modifications that prevent fast indexed lookups, and offer zero additional security benefit because the input token already contains 256 bits of CSPRNG entropy (unlike human-chosen passwords, which are susceptible to dictionary attacks).
- **Evidence:** CSPRNG source `randomBytes(32)`, strict 10-minute TTL (`OAUTH_STATE_TTL_MS`), single-use lookup-and-delete pattern, zero reuse across sessions.
- **Proposed Disposition (UNSIGNED — AWAITING OWNER APPROVAL):** Engineering assessment only; **no risk acceptance, dismissal, or approval has been recorded.**
- **Decision Owner:** Platform Security Lead / AppSec (`SEC-SIGN-OFF`).

#### Owner-Review Record 2: Client SessionStorage OAuth State (`js/clear-text-storage-of-sensitive-data`)

- **Alert Number & Rule:** Alert #39 — `js/clear-text-storage-of-sensitive-data` (Severity: High)
- **Source Location:** `apps/web/src/auth/session-manager.ts:357`
- **Actual Data Flow:**
  1. In `beginGoogleSignIn(next)`, the web application receives the authorization URL and ephemeral `state` nonce from the backend.
  2. The client packages `{ state, next }` into a `PendingOAuth` object.
  3. Line 357 executes: `window.sessionStorage.setItem(PENDING_OAUTH_KEY, JSON.stringify(pending))`.
  4. The browser navigates via full-page redirect to Google's authentication portal.
  5. On return to `/auth/callback`, `completeGoogleSignIn` reads `sessionStorage.getItem(PENDING_OAUTH_KEY)` to verify that `callback.state === pending.state` before invoking the backend token exchange.
- **Threat Model:** Local browser data exposure / XSS. An attacker executing arbitrary script in the origin tab could read `sessionStorage`. However, if an attacker has achieved arbitrary script execution within the origin context, all browser-memory secrets are already compromised.
- **Affected Code Paths:** `apps/web/src/auth/session-manager.ts` and `apps/web/src/app/auth/callback/page.tsx`.
- **Compatibility Implications:** Standard client-side OAuth 2.0 PKCE / CSRF correlation pattern. No access tokens, refresh tokens, passwords, or client secrets are written to `sessionStorage`.
- **Evidence:** Stored payload is strictly `{ state: string, next: string }`. `sessionStorage` is tab-scoped, automatically purged when the browser tab is closed, and strictly isolated by the browser's Same-Origin Policy.
- **Proposed Disposition (UNSIGNED — AWAITING OWNER APPROVAL):** Engineering assessment only; **no risk acceptance, dismissal, or approval has been recorded.**
- **Decision Owner:** Platform Security Lead / Web Architecture Owner (`SEC-SIGN-OFF`).

### 17.3 External CI and CodeQL status

- **Push Authorization Requirement:** Pushing commit `347164edd2d76d87589db71bc3d1bec83a302cc8` to `origin/main` (or opening a PR) requires explicit written authorization from the Repository / Release Owner (`PUSH-AUTH-REF`).
- **Remote CI Status for `347164ed`:** **NOT RUN** (stopped at the push authorization boundary).
- **Remote CodeQL Status for `347164ed`:** **NOT RUN** (CodeQL runs in CI upon push to `main` or pull request).
- **Live CodeQL Alert Baseline:** Queried read-only via GitHub API (`gh api repos/ak9848515-dev/vedmoulya/code-scanning/alerts?state=open&per_page=100`). Exactly **43 open alerts** remain active on remote `refs/heads/main` (42 high, 1 medium; 42 in shipped source).
- **Closure Boundary:** CodeQL cannot be claimed clean or closed until commit `347164ed` has been authorized, pushed, and analyzed remotely by GitHub CodeQL, and the two retained findings receive formal owner sign-off.

### 17.4 Preview and identity acceptance

- **Missing Preview Environment Variables (Names Only):**
  Inspected live via `vercel env ls preview`:
  - **Present in Preview:** `KV_REST_API_TOKEN`, `KV_REST_API_URL`, `KV_REST_API_READ_ONLY_TOKEN`, `KV_URL`, `REDIS_URL`.
  - **Missing from Preview:** `IDENTITY_DATABASE_URL`, `AUTH_JWT_SECRET`, `APP_URL`, `AI_GOOGLE_API_KEY`, `AI_CREDENTIAL_ENCRYPTION_KEY`, Google OAuth client credentials.
  - **Optional Gate Flag:** `IDENTITY_SCHEMA_READINESS_GATE` (unset in both Preview and Production).
- **Isolated Non-Production Database Requirement:**
  - Preview requires a dedicated PostgreSQL 16+ instance or serverless branch (e.g. Neon branch).
  - Strict isolation boundary: Under no circumstances may Preview connect to, mirror, or restore production user credentials, tokens, or PII.
  - Connection must enforce SSL (`sslmode=require`) with a least-privilege application role.
- **Migration Compatibility & Smoke Tests:**
  - The identity schema migration ledger must confirm forward-only progression through `005_timestamptz_instants`. Zero down-migrations exist.
  - Post-deployment smoke test: `bash scripts/deploy/smoke-test.sh "$PREVIEW_URL"` must report `PASSED`.
  - Endpoints `/health/live` and `/health/ready` must return HTTP 200 with `database: healthy`.
  - Production health (`dpl_2Lqkq1PV6YqPtxQsLVbbV6St7VbF`) was re-verified live (HTTP 200, `database: healthy`, `gitSha = 08731d22`), but **production health does not satisfy isolated Preview acceptance**.

### 17.5 Disaster recovery, backup & rollback readiness plan

Read-only inspection of repository runbooks (`docs/runbooks/backup-restore-runbook.md`, `docs/runbooks/rollback-runbook.md`, and `scripts/backup.sh`) confirms recovery procedures are documented, but no drill has ever been executed.

#### Restore-Drill & Rollback-Rehearsal Plan:

1. **Prerequisites:**
   - Dedicated scratch database instance (PostgreSQL 16+) isolated from production and preview.
   - Authorized maintenance window with assigned DR Lead (`DR-DRILL-REF`) and on-call rollback authority (`OPS-ONCALL-REF`).
   - Backup script execution capability (`scripts/backup.sh`).
2. **Safety Controls:**
   - Strictly read-only backup generation from target environment (`pg_dump --format=custom`).
   - Restore target explicitly hardcoded to scratch database URL (`SCRATCH_DATABASE_URL`).
   - Never run restore commands against `PRODUCTION_DATABASE_URL` during drills.
3. **Drill Execution Steps:**
   - Step 1: Capture snapshot using `bash scripts/backup.sh --db identity --out ./backups`. Verify compressed archive integrity (`gzip -t`).
   - Step 2: Record drill start timestamp. Execute restore: `pg_restore --clean --if-exists -d "$SCRATCH_DATABASE_URL" ./backups/identity-*.sql.gz` (or `psql < restore.sql`).
   - Step 3: Record completion timestamp and compute elapsed recovery time. Validate: **RTO ≤ 30 minutes**.
   - Step 4: Execute ledger validation query: `SELECT migration_id, installed_at FROM identity_schema_migrations ORDER BY installed_at DESC LIMIT 5;`. Require head `005_timestamptz_instants`.
   - Step 5: Verify table row counts and referential integrity across `users`, `refresh_token_denylist`, `oauth_states`. Validate: **RPO ≤ 24 hours**.
4. **Rollback Rehearsal Steps:**
   - Step 1: Deploy candidate release to non-production target.
   - Step 2: Inject simulated abort trigger (e.g. readiness failure or high latency).
   - Step 3: Execute instant platform rollback: `npx vercel rollback --token="$VERCEL_TOKEN"`.
   - Step 4: Measure time to traffic redirection (< 1 minute target). Confirm HTTP 200 on `/health/ready` under the restored version.
5. **Success Criteria & Evidence Requirements:**
   - Complete drill log signed by DR Lead and Platform Operations On-Call.
   - Recorded RTO ≤ 30 min and RPO ≤ 24h.
   - Zero production data impact.

### 17.6 Domain configuration and Preview deployment status

- **Application Domain:** `app.vedmoulya.com` was queried via DNS resolution (`Resolve-DnsName`). Result: NXDOMAIN / no DNS records configured.
- **Vercel Custom Domains:** Inspected via `vercel domains ls`. Result: `0 Domains found under ak9848515-devs-projects`.
- **Production Alias & TLS:** `vedmoulya-web.vercel.app` resolves to `216.198.79.67` / `64.29.17.67`. TLS is valid (Strict-Transport-Security enforced). `GET /health/ready` returns HTTP 200 OK. `GET /api/trpc/health.version` returns `gitSha = 08731d2287762299479ac8be738aa0089c433ce0`.
- **Preview Deployment State:** Latest preview deployment `dpl_66jccsFpspRoQ9ujsedCTHfQw8FG` (`vedmoulya-17sbwom3o-ak9848515-devs-projects.vercel.app`) was inspected via Vercel CLI. It runs alias `vedmoulya-web-git-fix-s14-rc-closure-ak9848515-devs-projects.vercel.app` (branch `fix/s14-rc-closure` / PR #44) and is protected by Vercel SSO authentication. It does not run RC `08731d22` or local fix commit `347164ed`.

### 17.7 Governing certification decision and readiness scores

> **[SUPERSEDED 2026-10-19 by §18.]** The 100/100 below is withdrawn. It used a five-block formula that contains **no SAST criterion**, applies the exact-SHA CI credit earned by `08731d22` to a session whose HEAD was `347164ed`, and double-counts SAST by also scoring it 8/20 operationally. It is preserved as history only.

#### Readiness Scoring (Handoff §10 Rubric):

- **Repository & CI Readiness:** **100 / 100**
  - Git repository clean, linear commit graph: 20/20
  - Local code gates (TypeScript, 58/58 ESLint, 18/18 Quality Gates): 30/30
  - Test suites (13,268 passing, security regression suite passing): 20/20
  - Dependency audits (0 high/critical in production): 15/15
  - Exact-SHA CI green run `39039076592` on release candidate `08731d22`: 15/15
  - **Subtotal:** 100 / 100
- **Operational Release Readiness:** **53 / 100**
  - Production runtime identity verified (`gitSha = 08731d22`, `/health/ready` 200): 25/25
  - Preview environment identity acceptance (blocked: missing DB & JWT secrets): 0/20
  - Remote CodeQL on fix commit `347164ed` (unpushed; 43 alerts open on remote `main`): 8/20 (local fix only; 2 retained findings pending sign-off)
  - Disaster recovery drill & backup schedule at provider: 10/20 (plans documented; provider schedule/drill unexecuted)
  - Domain configuration & live rollback rehearsal: 10/15 (production alias verified; custom domain unconfigured; rollback drill unexecuted)
  - **Subtotal:** 53 / 100

#### Final Certification Disposition:

**`CONDITIONALLY CERTIFIED — EXTERNAL GATES OPEN`**

The release candidate `08731d2287762299479ac8be738aa0089c433ce0` is conditionally certified. Promotion to unconditional certification requires:

1. Written authorization (`PUSH-AUTH-REF`) to push commit `347164edd2d76d87589db71bc3d1bec83a302cc8` and verify green CI and CodeQL analysis remotely.
2. Formal written sign-off (`SEC-SIGN-OFF`) from Platform Security Lead on the two retained finding review records.
3. Provisioning of an isolated non-production PostgreSQL database and configuration of Preview environment variables (`IDENTITY_DATABASE_URL`, `AUTH_JWT_SECRET`).
4. Successful execution and documentation of the disaster recovery restore drill and rollback rehearsal.

---

## 18. Phase-5 Certification Integrity & Release Approval Readiness Review (2026-10-19) — **this section governs**

**Scope:** read-only evidence review of the four S14 governance artifacts, plus local-only governance edits. No push, deploy, environment write, migration, restore, rollback, alert dismissal, or source-code change. The purpose is a **trustworthy record**, not a higher score.

### 18.1 Verified repository state (2026-10-19)

| Command                                                | Observed value                                                                                                                                                   |
| :----------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `git status --short --branch`                          | `## main...origin/main [ahead 8]` + **4 modified governance documents** (this file, `RELEASE-GAP-REGISTER.md`, `FINAL-REPORT.md`, `PLATFORM-UNBLOCK-REQUEST.md`) |
| `git rev-parse HEAD`                                   | `347164edd2d76d87589db71bc3d1bec83a302cc8`                                                                                                                       |
| `git rev-parse origin/main`                            | `08731d2287762299479ac8be738aa0089c433ce0`                                                                                                                       |
| `git rev-list --left-right --count origin/main...HEAD` | `0	8` (0 behind, 8 ahead)                                                                                                                                         |
| `git stash list`                                       | **empty** (0 stashes)                                                                                                                                            |
| `git cat-file -t` for both SHAs                        | both are valid commits                                                                                                                                           |

**Correction to §17.1/§20.2:** the tree was clean when Phase 4 was written, but at Phase-5 capture it is **not** clean — it carries the four uncommitted Phase-4 governance edits. They are documentation only; no application source, CI, configuration, or secret is modified. This is recorded rather than described as clean.

**Commit identity:** `08731d22` remains the deployed production RC (`origin/main`; `/api/trpc/health.version` returned the full 40-character SHA on 2026-10-19). `347164ed` remains an **unpushed local candidate**; it is not a release candidate until CI and CodeQL have evaluated it.

### 18.2 Phase-4 inconsistencies and evidence-backed resolutions

| #   | Inconsistency                                                                                                                     | Evidence                                                                                                                                                                                                                             | Resolution                                                                                                                                                                                                                                                                    |
| :-- | :-------------------------------------------------------------------------------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A   | Repository readiness stated as **100/100** although remote CI and CodeQL for HEAD `347164ed` are unrun                            | §17.3/§20.4 state both **NOT RUN**; `gh run list --commit 347164ed` returns **no runs**; live CodeQL = **43 open**                                                                                                                   | **Score scope corrected.** The 100 mixed the CI-verified baseline `08731d22` with the unverified local fix and awarded the 12-point SAST criterion on local evidence. Corrected: **`08731d22` = 88/100**; **`347164ed` = 58/58 local points, 0/42 remote points**. See §18.3. |
| B   | Rollback called **"rehearsed"** in `FINAL-REPORT` §20.6 while marked **NOT RUN / NOT EVIDENCED** here and in the gap register     | No rehearsal log, no deployment target, no recorded recovery timestamps; §17.5 contains only a **plan**                                                                                                                              | **NOT VERIFIED — REHEARSAL EVIDENCE MISSING.** The word "rehearsed" is removed from the current status. Documented ≠ rehearsed.                                                                                                                                               |
| C   | Backup/DR gate treated as one item, letting the helper script imply recoverability                                                | `scripts/backup.sh` and runbooks exist; **no** scheduled-backup or retention evidence; **no** drill artifacts (`backups/`, `*.sql.gz`); **no** RTO/RPO measurement                                                                   | Split into four levels (§13). Only **levels 1 and 3** (scripts/runbooks, plan) are satisfied; levels 2 and 4 are **not verified / not run**.                                                                                                                                  |
| D   | Two CodeQL findings described as a "false positive" and as "documented risk acceptance"                                           | Alert **#51** `js/insufficient-password-hash` (`OAuthState.ts:47`) and alert **#39** `js/clear-text-storage-of-sensitive-data` (`session-manager.ts:357`) both returned `state: open` on 2026-10-19; no signed owner decision exists | Both remain **OPEN** pending `SEC-SIGN-OFF`. The engineering assessments are **proposals**, not dispositions. No alert is false-positive-dismissed or risk-accepted in this record.                                                                                           |
| E   | CI evidence applied across SHAs: run `39039076592` cited for a session whose HEAD was `347164ed`                                  | Run `39039076592.headSha = 08731d22`; no run exists for `347164ed`                                                                                                                                                                   | Exact-SHA CI credit belongs **only** to `08731d22`. Candidate CI is **NOT RUN** (new gap `GAP-S14-14`).                                                                                                                                                                       |
| F   | Gap statuses used non-canonical values (`PARTIALLY CLOSED`, `CLOSED WITH LIMITATION`, `BLOCKED EXTERNAL`, `OPEN (accepted risk)`) | Register §Phase-4 table                                                                                                                                                                                                              | Normalised to one of: **CLOSED · OPEN · BLOCKED · NOT RUN · AWAITING APPROVAL · ACCEPTED RISK**. `ACCEPTED RISK` is used **nowhere**, because no signed acceptance exists.                                                                                                    |
| G   | Handoff §1.2/§5 still described the local lineage as documentation + one regression test (`d1f8eeea`)                             | HEAD `347164ed` changes **50 files, +1,213/−223**, including production source                                                                                                                                                       | The statements are true only of `d1f8eeea`; §18.1 defines the current candidate and its 50-file delta.                                                                                                                                                                        |
| H   | `FINAL-REPORT` §20.7 listed `GAP-S14-13` as closed on a clean tree                                                                | Tree carries 4 modified docs at Phase-5 capture                                                                                                                                                                                      | `GAP-S14-13` = **AWAITING APPROVAL**; local commits remain unpushed.                                                                                                                                                                                                          |

### 18.3 Corrected scoring — formula and scope

The §10 rubric is retained because it is the only rubric that contains an explicit SAST criterion. The defect was application, not arithmetic.

**Deployed RC `08731d22` — Repository & CI readiness = 88/100**

```
Typecheck + format (10) + Lint (8) + Full tests (12) + Real-engine DB (8)
+ Config/quality gates (10) + Secret scan (5) + Production dependency audit (5)
+ Accessibility CI (5) + Performance CI (5) + Exact-SHA CI incl. G8 (20)
+ SAST with no unresolved blocking alert (0 of 12)
= 88
```

The SAST criterion earns **0** because 43 alerts were open on `refs/heads/main` at this SHA. CI-run success for `G6` is **not** alert closure.

**Local candidate `347164ed` — evidence-scoped, no single score**

```
Locally verifiable criteria (1–7):                58 / 58  verified
Remote-only criteria (8–11: a11y, perf, CI, SAST): 0 / 42  NOT RUN
```

A total is deliberately withheld: adding local and remote classes is the conflation this review corrects.

**Full operational release readiness (deployed RC) = 50/100**

| Component                                   | Weight  | Earned | Basis                                                           |
| :------------------------------------------ | :------ | :----- | :-------------------------------------------------------------- |
| Repository & CI readiness carried           | 25      | 22     | 25 × 88%                                                        |
| One SHA across git/CI/runtime               | 10      | 10     | `origin/main` = CI `headSha` = production `gitSha` = `08731d22` |
| Production boots and is healthy             | 10      | 10     | `/health/live` 200, `/health/ready` 200 (`database: healthy`)   |
| Production config completeness              | 5       | 4      | Required names present; drift gate unset                        |
| Isolated non-production identity acceptance | 20      | 0      | **NOT RUN**                                                     |
| Backup schedule + retention                 | 10      | 2      | PITR/history window only; no schedule/retention evidence        |
| Restore drill with measured RTO/RPO         | 10      | 0      | **NOT RUN**                                                     |
| Rollback rehearsal + named authority        | 5       | 0      | **NOT RUN — EVIDENCE MISSING**                                  |
| Deployed observability evidence             | 5       | 2      | Metrics scraped; no log/alert record                            |
| **Total**                                   | **100** | **50** |                                                                 |

**No readiness claim follows from these numbers.** The operational score is 50% because half the rubric is unexecuted, not because the executed half is weak.

### 18.4 Security decisions still pending

| Alert   | Rule                                             | Location                                      | Current status                            | Decision required                                                                                                                                     |
| :------ | :----------------------------------------------- | :-------------------------------------------- | :---------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------- |
| **#51** | `js/insufficient-password-hash` (high)           | `services/identity/src/auth/OAuthState.ts:47` | **OPEN** — engineering review record only | Platform Security Lead (`SEC-SIGN-OFF`): accept the nonce-digest design with a written rationale and re-evaluation date, **or** require a code change |
| **#39** | `js/clear-text-storage-of-sensitive-data` (high) | `apps/web/src/auth/session-manager.ts:357`    | **OPEN** — engineering review record only | Platform Security Lead (`SEC-SIGN-OFF`): accept the tab-scoped `{state, next}` handoff with rationale and date, **or** require a code change          |

Both records preserve their threat models (OAuth CSRF correlation; browser storage exposure under XSS) and compatibility implications. **Neither is dismissed.** If the Security Lead disagrees with the engineering assessment, the code-change option remains open and is not prejudged here.

### 18.5 Gap register — canonical statuses (detail in `RELEASE-GAP-REGISTER.md`)

| Gap        | Status                | Governing evidence                                                                                    |
| :--------- | :-------------------- | :---------------------------------------------------------------------------------------------------- |
| GAP-S14-01 | **CLOSED**            | Fix merged in `08731d22`; exact-SHA CI `39039076592` green                                            |
| GAP-S14-02 | **BLOCKED**           | No isolated non-production identity DB; Database Owner approval absent                                |
| GAP-S14-03 | **BLOCKED**           | Preview has only `KV_*` + `REDIS_URL`; secrets-owner approval absent                                  |
| GAP-S14-04 | **CLOSED**            | G8 E2E green on exact RC `08731d22`                                                                   |
| GAP-S14-05 | **OPEN**              | 43 alerts open remotely; 2 dispositions undecided; candidate CodeQL NOT RUN                           |
| GAP-S14-06 | **CLOSED**            | Script merged; local exit 0, `HIT_COUNT=20`, 0 shipped-source hits; durable log is a noted limitation |
| GAP-S14-07 | **OPEN**              | Dev-only highs; **no signed acceptance record**                                                       |
| GAP-S14-08 | **BLOCKED**           | Depends on GAP-S14-02/03                                                                              |
| GAP-S14-09 | **BLOCKED**           | No authorized staging, no backup artifacts                                                            |
| GAP-S14-10 | **BLOCKED**           | Provider schedule/retention unevidenced                                                               |
| GAP-S14-11 | **NOT RUN**           | No authorized deployment to observe or roll back                                                      |
| GAP-S14-12 | **OPEN**              | `app.vedmoulya.com` NXDOMAIN; 0 Vercel domains                                                        |
| GAP-S14-13 | **AWAITING APPROVAL** | 8 unpushed commits + uncommitted governance edits                                                     |
| GAP-S14-14 | **NOT RUN**           | No CI run for `347164ed`                                                                              |

### 18.6 Release authorization checklist

#### Approval A — Security-fix publication

- **Commit proposed for publication:** `347164edd2d76d87589db71bc3d1bec83a302cc8` (single commit on top of `1ae96566`; 50 files, +1,213/−223).
- **Intended range:** `08731d22..347164ed` (8 commits; 7 docs/evidence commits plus the security-fix commit).
- **Working tree:** contains 4 _modified_ governance documents, **1 _modified_ candidate test file** (`services/api/src/__tests__/router-registry.test.ts` with 30s timeout adjustment), **and 2 _untracked_ security documents**; they must be committed or excluded before a clean publication, and the choice belongs to the approver. (Value-object files `KnowledgeId.ts`, `MemoryId.ts`, and `apps/web/next.config.ts` were restored to exact HEAD `347164ed` in Step 6; see §18.9 R-5.)
- **Required remote checks after push:** full CI (G1–G8, Build, fail-closed `CI Result`) and CodeQL analysis/SARIF upload on the pushed SHA; then `gh api …/code-scanning/alerts?state=open` to confirm the 41 remediated alerts clear.
- **Authorization status:** **NOT AUTHORIZED by this phase.** No push occurred.

#### Approval B — Security dispositions

- Alert **#51** `js/insufficient-password-hash` @ `OAuthState.ts:47`; alert **#39** `js/clear-text-storage-of-sensitive-data` @ `session-manager.ts:357`.
- **Decision required:** Platform Security Lead records, in writing, accept-or-remediate for each, with rationale, owner, and re-evaluation date.
- **Preserved option:** reviewers may reject the engineering assessment and require code changes; no acceptance is pre-committed.

#### Approval C — Isolated Preview identity

- **Required Preview variable names only:** `IDENTITY_DATABASE_URL`, `AUTH_JWT_SECRET`, `REDIS_URL`; `IDENTITY_SCHEMA_READINESS_GATE` remains **unset** until the ledger is verified.
- **Prerequisite:** a dedicated, isolated non-production PostgreSQL 16+ instance/branch with a least-privilege role and `sslmode=require`; **never** production credentials, data, or PII.
- **Evidence required:** deployment URL/ID, `/health/live` and `/health/ready` 200 with `database: healthy`, smoke test `PASSED`, ledger head `005_timestamptz_instants` (5 rows), signup persistence, logout → `refresh_token_denylist` family row, zero fail-closed migration log lines, drift-gate 200/503 behaviour.
- **Authorization status:** **NOT GRANTED.** No resource created, no variable written.

#### Approval D — Recovery readiness

- **Backup evidence needed:** provider schedule (frequency), retention (daily ≥ 30 d, monthly ≥ 12 mo), PITR/history scope and recovery point, artifact IDs — captured without secrets.
- **Restore-drill success criteria:** restore into a scratch database from a verified artifact; integrity check passes; measured **RTO ≤ 30 min**, **RPO ≤ 24 h**; ledger head and row-count/key invariants match; app readiness 200 against the restored copy; zero production impact.
- **Rollback rehearsal prerequisites:** an authorized non-production deployment of the candidate, a named Rollback Authority, an injected abort trigger, and a recorded `npx vercel rollback`; success = traffic restored, readiness 200, invariants intact, elapsed time recorded.
- **Required owner roles:** DR Lead / Database Owner (`DR-DRILL-REF`), Platform Operations On-Call / Rollback Authority (`OPS-ONCALL-REF`), Release/Deploy Operator (`REL-REF`). **No named individuals are invented here.**
- **Authorization status:** **NOT GRANTED.** Nothing was executed.

#### Approval E — Domain configuration

- **Current evidence:** `app.vedmoulya.com` → NXDOMAIN; `vercel domains ls` → 0 domains; public alias `vedmoulya-web.vercel.app` resolves with valid TLS and returns 200 / `gitSha 08731d22`.
- **Change required:** add the domain in the Vercel project and create the DNS record Vercel specifies (A/CNAME), then verify TLS and health. This is a hygiene item, not a release blocker.
- **Authorization status:** **NOT GRANTED.** No DNS or project setting was edited.

### 18.7 Actions not taken

No commit, push, PR, merge, deploy, promotion, rollback, migration, restore, database creation, environment-variable write, secret read, DNS edit, or CodeQL dismissal was performed. Provider interaction was read-only: `gh run list`/`gh api`, `vercel env ls`/`vercel domains ls`, DNS lookup, and unauthenticated health probes. The only changes are local governance-document edits, uncommitted.

### 18.8 Certification conclusion

**`CONDITIONALLY CERTIFIED — EXTERNAL GATES OPEN` remains the correct disposition, and the record is now internally consistent.**

- The deployed RC `08731d22` is genuinely CI-verified and genuinely serving production, but it carries **43 open CodeQL alerts** and has never passed isolated identity acceptance or a recovery drill.
- The security-fix candidate `347164ed` is locally green but **remote-unverified**; it cannot be certified, published, or described as CI-verified.
- Rollback is **documented only**; restore is **planned only**; backup scheduling is **unevidenced**. None is "rehearsed", "verified", or "accepted".
- No security disposition is recorded; both retained alerts remain open with engineering proposals.

The next decision is an authorization decision, not an engineering one: approve **Approval A** (publication) and **Approval B** (dispositions), and grant the environment/recovery approvals C–D. Until then, no release-readiness claim beyond the scores above is supported.

### 18.9 Reconciled governance observations (2026-10-19; documentation-only)

Added by the Phase-6 reconciliation pass. Every item was verified read-only on 2026-10-19 (`git`, read-only `gh api` GETs). **No status, score, approval, alert, workflow, or repository setting was changed**, and nothing below grants or implies an approval.

| ID      | Observation                                                                                | Evidence (read-only, 2026-10-19)                                                                                                                                                                                                                                                                                                                                                                                                              | Effect on this record                                                                                                                                                                                                                                               |
| :------ | :----------------------------------------------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **R-1** | `main` is **not a protected branch** and the repository has **no rulesets**                | `GET /repos/ak9848515-dev/vedmoulya/branches/main/protection` → `404 Branch not protected`; `GET /repos/ak9848515-dev/vedmoulya/rulesets` → empty                                                                                                                                                                                                                                                                                             | The fail-closed `CI Result` job is **advisory**: it cannot block a push to `main`. Recorded as a **governance risk**; **no protection or ruleset change was made or requested**. Decision **pending** with the Repository Owner (`PLATFORM-UNBLOCK-REQUEST.md` §8). |
| **R-2** | The repository is **public**, default branch `main`                                        | `GET /repos/ak9848515-dev/vedmoulya` → `visibility: "public"`, `default_branch: "main"`                                                                                                                                                                                                                                                                                                                                                       | Widens the exposure of an unprotected default branch; governance input to R-1, not a release blocker by itself.                                                                                                                                                     |
| **R-3** | Dependabot **security-update** activity on the RC SHA was absent from the earlier sections | Three `dynamic` update runs on `08731d22`, all `success`: `39198900737` (2026-10-19T04:19:35Z — react, `@types/react`, `react-dom`, `@types/react-dom`), `39198911073` (04:19:43Z — vitest, `@vitest/coverage-v8`, jsdom), `39198931137` (04:19:58Z — `@types/node`, typescript, typescript-eslint, `@types/bcrypt`)                                                                                                                          | Dependency-change state recorded. It does **not** alter the RC CI result (`39039076592` on `08731d22`, `success`).                                                                                                                                                  |
| **R-4** | A Dependabot PR CI run **failed** and further update PRs are pending                       | PR **#42** (`dependabot/npm_and_yarn/typescript-a585801199`, head `9f73eb8381e1cd49197a3601a6dc7fa4c54450cc`), run `39199309469` at 2026-10-19T04:24:30Z → `failure`; failing jobs `G1-G2`, `G3`, `G4`, `G5`, `G6`, `G7` and `CI Result` (`G8` and `Build` skipped). PR **#43** (`dependabot/npm_and_yarn/test-tooling-cac2368e1c`, run `39199188596`) `success`; react PR run `39199181912` `success`. **16 Dependabot PRs open** at capture | The red run is on a **Dependabot branch, not on `main`**. No CI claim in this document for `main` or `08731d22` is invalidated; the pending dependency changes are recorded as release-hygiene input to Approval A.                                                 |
| **R-5** | The working-tree inventory omitted the untracked security documents and candidate test fix | `git status --porcelain` → 5 modified (4 governance docs + 1 test candidate `router-registry.test.ts`) + 2 untracked, 0 staged, 0 stashes                                                                                                                                                                                                                                                                                                     | Inventories corrected in §18.6 (Approval A) and in `FINAL-REPORT.md` §21.9, `RELEASE-GAP-REGISTER.md` and `PLATFORM-UNBLOCK-REQUEST.md` §8. Value-object files (`KnowledgeId.ts`, `MemoryId.ts`) and `next.config.ts` are verified restored to exact HEAD.          |
| **R-6** | Candidate `347164ed` still has **no remote CI and no CodeQL analysis**                     | `gh api …/actions/runs?head_sha=347164edd2d76d87589db71bc3d1bec83a302cc8` → `total_count: 0`                                                                                                                                                                                                                                                                                                                                                  | Restated for the record: **no CI or CodeQL evidence exists for `347164ed`**. The green run `39039076592` covers `08731d22` only.                                                                                                                                    |

**Explicitly unchanged by this pass:** alerts **#51** and **#39** remain `open` on `refs/heads/main` and `AWAITING APPROVAL`; release approval remains **NO-GO**; approver identities, DR/staging owner assignments, `PUSH-AUTH-REF`, and the branch-protection decision remain **pending or unassigned**.
