# Platform Authorization & Unblock Request (S14 Release Blocker Handoff)

**Document Reference:** `docs/audits/2026-10-16-s14-rc-closure/PLATFORM-UNBLOCK-REQUEST.md`  
**Date (initial):** 2026-10-17  
**Canonical Release Candidate SHA (Deployed):** `08731d2287762299479ac8be738aa0089c433ce0` (= `origin/main` = CI `headSha` = live production runtime `gitSha`)\
**Local Security Fix Commit SHA (Unpushed):** `347164edd2d76d87589db71bc3d1bec83a302cc8` (ahead of `origin/main` by 8 commits; fixes 41 of 43 CodeQL alerts)\
**Target Deployment Scope:** Vercel **Preview** Environment Only (Project: `vedmoulya-web`)\
**Revalidated:** 2026-10-19 (Phase 5: Certification Integrity & Release Approval Readiness) — external approvals still **PENDING**; see §6 for the consolidated action plan and §7 for the A–E approval mapping. No item in this document has been executed.

---

## 1. Executive Summary & Purpose

Local code gates (TypeScript, 58 ESLint scopes, 18/18 quality gates, Next.js 15.5 production build, secret scanning, dependency cycles, and identity schema gate contract tests) were executed **against the local HEAD lineage** and are green. They are **not** evidence about the unpushed candidate's remote CI or CodeQL status: HEAD `347164ed` has **no CI run**, and the deployed RC `08731d22` carries **43 open CodeQL alerts**. "Local gates green" and "release-ready" are different statements.

> **Verified 2026-10-18:** Exact-SHA CI run **`39039076592`** (`main`, push, `completed/success`, all 9 jobs including `G8: End-to-End Tests` and the fail-closed `CI Result`) ran on the exact release SHA `08731d2287762299479ac8be738aa0089c433ce0`. Run URL: `https://github.com/ak9848515-dev/vedmoulya/actions/runs/39039076592`. This confirms the CI claim above; the remaining blockers below are deployed-environment/DR only.

However, **Preview deployment and live identity verification are blocked** by external infrastructure prerequisites:

1. `GAP-S14-02`: No managed, non-localhost PostgreSQL identity database exists for the non-production candidate.
2. `GAP-S14-03`: The Vercel **Preview** environment holds only cache tokens (`KV_*`, `REDIS_URL`) and lacks `IDENTITY_DATABASE_URL` and `AUTH_JWT_SECRET`, causing candidate boots to fail closed.
3. `GAP-S14-08`: Staging/Preview readiness and smoke tests cannot be executed without deployed services.
4. `GAP-S14-05` **(added 2026-10-18; updated Phase 3)**: the release SHA carries **43 open CodeQL alerts** on `refs/heads/main` (42 `high`, 1 `medium`; 42 of 43 in shipped source). **Phase-3 status:** 41 shipped-source alerts were fixed locally (fix commit unpushed); 2 remain with written technical justification and need Platform Engineering sign-off or remediation. The repository-side action now is to **push the fix commit and have CodeQL re-analyse it** — see the handoff §16.

This document serves as the formal, actionable handoff to **Platform Engineering**, the **Database Owner**, and the **Release Owner** to obtain required written approvals and safely execute the unblock procedure.

---

## 2. Required Approvals & Accountable Roles

All actions in the target cloud environment require explicit written approval before execution.

| Role                                     | Accountable Owner           | Action Authorized                                                                                                   | Status / Reference          |
| :--------------------------------------- | :-------------------------- | :------------------------------------------------------------------------------------------------------------------ | :-------------------------- |
| **Repository Owner / Release Authority** | Repository Owner            | Pushing security-fix commit `347164edd2d76d87589db71bc3d1bec83a302cc8` to `origin/main` to trigger remote CI/CodeQL | PENDING (`PUSH-AUTH-REF`)   |
| **Platform Engineering / Secrets Owner** | Platform Team Lead          | Configuration of Preview environment variables (`IDENTITY_DATABASE_URL`, `AUTH_JWT_SECRET`, `REDIS_URL`) in Vercel  | PENDING (`TICKET-REF-HERE`) |
| **Security Owner / AppSec**              | Platform Security Lead      | Review and formal sign-off on 2 retained CodeQL findings (`OAuthState.ts:47`, `session-manager.ts:357`)             | PENDING (`SEC-SIGN-OFF`)    |
| **Database Owner**                       | Data Infrastructure Owner   | Provisioning of an isolated, non-production managed PostgreSQL 16+ database with least-privilege role               | PENDING (`DB-REQ-REF-HERE`) |
| **Disaster Recovery / Staging DB Owner** | DR Lead / Platform Ops      | Execution of scheduled backup, scratch restore drill, and rollback rehearsal                                        | PENDING (`DR-DRILL-REF`)    |
| **Release / Deploy Operator**            | Release Manager             | Triggering deployment of exact SHA `08731d22` to Vercel Preview and executing post-deploy verification              | PENDING (`REL-REF-HERE`)    |
| **Rollback Authority**                   | Platform Operations On-Call | Authority to issue `npx vercel rollback` immediately if any abort condition is met                                  | PENDING (`OPS-ONCALL-REF`)  |

### Strict Non-Production Data Boundary

- The database provisioned for Preview **MUST BE COMPLETELY ISOLATED** from production data (e.g., dedicated Neon branch or separate test cluster).
- Under **no circumstances** may `IDENTITY_DATABASE_URL` in Preview point to, mirror, or restore production user credentials, tokens, or PII.

---

## 3. Explicit Execution Steps for Platform Operator

Follow this exact sequence. Never log, print, or commit credential values.

### Step 1: Provision Isolated PostgreSQL Database

1. Provision a PostgreSQL 16+ instance or serverless branch (e.g. via Neon console).
2. Configure a least-privilege user with full DDL/DML permissions scoped strictly to the preview database schema.
3. Ensure pooled connection string is formatted with SSL enabled (`sslmode=require`).

### Step 2: Configure Vercel Preview Environment Variables

In the Vercel Project Settings for `vedmoulya-web`, add/verify the following variables scoped **strictly to the Preview environment**:

| Variable Name                    | Environment Scope | Specification / Format                                            | Value Safety           |
| :------------------------------- | :---------------- | :---------------------------------------------------------------- | :--------------------- |
| `IDENTITY_DATABASE_URL`          | **Preview**       | Pooled PostgreSQL DSN (`postgres://...sslmode=require`)           | Secret (do not commit) |
| `AUTH_JWT_SECRET`                | **Preview**       | Cryptographically secure random string (≥ 32 characters)          | Secret (do not commit) |
| `REDIS_URL`                      | **Preview**       | Redis/KV connection URL                                           | Secret (do not commit) |
| `IDENTITY_SCHEMA_READINESS_GATE` | **Preview**       | **Leave UNSET initially** (opt-in gate; enable only after Step 5) | Configuration Flag     |

### Step 3: Trigger Preview Deployment

Deploy the approved commit SHA through the authorized platform workflow:

```bash
# Trigger deployment of SHA 08731d22 to Vercel Preview
npx vercel deploy --prebuilt --token="$VERCEL_TOKEN"
# Alternatively, deploy via GitHub Actions workflow_dispatch on branch main
```

### Step 4: Execute Initial Health & Smoke Verification

Once the Preview deployment URL is active (`$PREVIEW_URL`):

1. **Live Check:**
   ```bash
   curl -fsS "$PREVIEW_URL/health/live"
   # Pass condition: HTTP 200 {"status":"alive"}
   ```
2. **Ready Check (Database connectivity & gateway initialization):**
   ```bash
   curl -fsS "$PREVIEW_URL/health/ready"
   # Pass condition: HTTP 200 {"status":"ready","checks":{"gateway":{"status":"initialized"},"database":{"status":"healthy"}}}
   ```
3. **Automated Smoke Test:**
   ```bash
   bash scripts/deploy/smoke-test.sh "$PREVIEW_URL"
   # Pass condition: "==> Smoke test PASSED"
   ```

### Step 5: Verify Migration Ledger Head

Verify that the application's startup migration routine ran and populated the ledger:

```sql
SELECT id, name, applied_at FROM identity_schema_migrations ORDER BY id ASC;
```

- **Pass condition:** Exactly 5 migrations recorded in order, with head:
  `005_timestamptz_instants`.

### Step 6: Enable Identity Schema Drift Gate (`IDENTITY_SCHEMA_READINESS_GATE=1`)

Only after Step 5 confirms the ledger head is current:

1. In Vercel Preview environment variables, set `IDENTITY_SCHEMA_READINESS_GATE=1`.
2. Redeploy the Preview deployment to pick up the flag.
3. Query `/health/ready`:
   ```bash
   curl -fsS "$PREVIEW_URL/health/ready"
   ```
   - **Pass condition:** HTTP 200 with `checks.identitySchema.status = "current"`.
   - **Verification of fail-closed safety:** A database schema that is behind or unreachable must answer HTTP 503.

### Step 7: Perform Identity Lifecycle Persistence Verification

1. Execute sign-up with test credentials through the Preview UI or API.
2. Confirm the user row is persisted in the isolated `users` table.
3. Execute logout and verify that a token revocation row is written to `refresh_token_denylist` with `kind = 'family'`.
4. Check deployed server logs to ensure zero `Identity migrations table initialization failed` errors.

---

## 4. Evidence Capture Template

Upon completion of the steps above, record the results in `docs/audits/2026-10-16-s14-rc-closure/IDENTITY-ACCEPTANCE-EVIDENCE-TEMPLATE.md`:

```markdown
### Authorized Deployed Evidence (Preview)

- Deployment Date (UTC): [YYYY-MM-DD HH:MM UTC]
- Deployed SHA: 08731d2287762299479ac8be738aa0089c433ce0
- Environment Identifier: Vercel Preview (URL: https://vedmoulya-web-...vercel.app)
- Operator Name: [Operator Full Name]
- Written Approval Reference: [Ticket / Approval ID]
- Database Provider / Host: Managed PostgreSQL 16+ ([host masked])
- /health/live HTTP Code: 200
- /health/ready HTTP Code & Body: 200 (database: healthy, identitySchema: current)
- Smoke Test Result: PASSED (scripts/deploy/smoke-test.sh)
- Migration Ledger Head: 005_timestamptz_instants (5 rows)
- User Persistence & Revocation: VERIFIED (user created; token family revoked on logout)
- Fail-Closed Log Scan: 0 error lines
- Drift Gate Setting: IDENTITY_SCHEMA_READINESS_GATE=1 (verified)
- Sign-Off Signature / Timestamp: [Operator Signature, Timestamp]
```

---

## 5. Rollback and Abort Criteria

If any of the following failure conditions occur during Preview deployment, **immediately abort and execute rollback**:

| Trigger Condition                           | Severity  | Immediate Action                                        |
| :------------------------------------------ | :-------- | :------------------------------------------------------ |
| **HTTP 5xx on `/health/live`**              | Critical  | Abort deployment; check server boot logs                |
| **Database connection timeout / crash**     | Critical  | Revert environment variable changes                     |
| **Migration DDL failure / ledger mismatch** | Critical  | Revert schema; do not force down-migrations             |
| **Accidental connection to production DB**  | Emergency | Kill process immediately; rotate production credentials |
| **Log leaks credentials or DSN strings**    | Critical  | Purge log capture; rotate exposed secrets immediately   |

### Rollback Execution Command

```bash
# Instant rollback via Vercel CLI to previous stable deployment
npx vercel rollback --token="$VERCEL_TOKEN"
```

Ensure stakeholders and on-call operations are notified immediately upon rollback.

---

## 6. Consolidated Action Plan (Phase 4 Revalidation, 2026-10-18)

**Status of this request: PENDING — no item below has been executed.** Revalidated read-only on
2026-10-18:

- Deployed production release candidate: `08731d2287762299479ac8be738aa0089c433ce0` (verified live).
- Local security-remediation commit: `347164edd2d76d87589db71bc3d1bec83a302cc8` (ahead 8, unpushed). At Step 7 reconciliation the tree carries 4 modified governance documents, 1 modified candidate test file (`services/api/src/__tests__/router-registry.test.ts` with 30s timeout), and 2 untracked security documents (`SECURITY-DISPOSITION-RECORDS-51-39.md`, `SECURITY-APPROVAL-HANDOFF-51-39.md`). Value-object files (`KnowledgeId.ts`, `MemoryId.ts`) and `next.config.ts` are restored to exact HEAD.
- Remote CodeQL baseline: **43 open alerts** on `refs/heads/main` (42 high, 1 medium; 42 in shipped source).
- Local remediation: **41 alerts remediated locally** in `347164ed` with regression tests; **2 alerts retained open with technical review records**.
- Vercel Preview environment: holds only cache tokens (`KV_*`, `REDIS_URL`) and still lacks `IDENTITY_DATABASE_URL` and `AUTH_JWT_SECRET`.
- Vercel domains: 0 custom domains configured; `app.vedmoulya.com` returns NXDOMAIN. Public production alias `vedmoulya-web.vercel.app` is live with valid TLS.

| #   | Approval required    | Responsible role                | Exact operation                                                                                                                                                                               | Required isolation                                                                                    | Acceptance criteria                                                                                            | Evidence to capture                                                                     | Abort / rollback                                           |
| :-- | :------------------- | :------------------------------ | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :---------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------- | :-------------------------------------------------------------------------------------- | :--------------------------------------------------------- |
| 1   | `PUSH-AUTH-REF`      | Repository / Release Owner      | Authorize and execute push of commit `347164edd2d76d87589db71bc3d1bec83a302cc8` to `main` (or PR branch) to trigger remote CI and CodeQL scan                                                 | Repository remote tracking                                                                            | GitHub Actions CI run completed/success; CodeQL analysis completed on SHA `347164ed`                           | CI run ID, SARIF upload confirmation, alert delta                                       | Revert commit / reset branch pointer                       |
| 2   | `SEC-SIGN-OFF`       | Platform Security Lead (AppSec) | Formal review and risk sign-off on 2 retained CodeQL findings: `OAuthState.ts:47` (nonce hash) and `session-manager.ts:357` (sessionStorage OAuth state)                                      | Repository documentation                                                                              | Written technical disposition signed off by Security Owner in security ledger                                  | Signed review record, rationale, target re-evaluation date                              | Remediate if rejected by Security Owner                    |
| 3   | `DB-REQ-REF`         | Database Owner                  | Provision managed **PostgreSQL 16+** (instance or serverless branch) + least-privilege role; pooled DSN with `sslmode=require`                                                                | Dedicated branch/cluster. **Never** production credentials, tokens, or PII                            | Reachable from Preview; DSN validates; role scoped to the preview schema                                       | Provider reference, masked host, role name, TLS mode, approval ID                       | Abandon the branch; rotate anything created during setup   |
| 4   | `TICKET-REF`         | Platform/Secrets Owner          | Set **Preview-scoped** `IDENTITY_DATABASE_URL`, `AUTH_JWT_SECRET`, `REDIS_URL`; leave `IDENTITY_SCHEMA_READINESS_GATE` **unset**                                                              | Preview scope only; production untouched; `IDENTITY_DATABASE_URL` must not equal the production value | Preview boots; `/health/ready` 200                                                                             | Variable **names**, scope, timestamp — never values                                     | Unset the variables; redeploy the previous Preview         |
| 5   | `REL-REF`            | Release/Deploy Operator         | Deploy exact `08731d2287762299479ac8be738aa0089c433ce0` (or `347164ed` once pushed/green) to Preview; run `/health/live`, `/health/ready`, `bash scripts/deploy/smoke-test.sh "$PREVIEW_URL"` | Preview deployment only                                                                               | `/health/ready` 200 with `database: healthy`; smoke prints `PASSED`                                            | Deployment URL + ID, HTTP codes, smoke output, timestamps                               | `npx vercel rollback`; delete the Preview deployment       |
| 6   | `TICKET-REF`         | Platform Owner                  | After the ledger head is verified, set `IDENTITY_SCHEMA_READINESS_GATE=1` and redeploy Preview                                                                                                | Preview only                                                                                          | `/health/ready` 200 with `identitySchema.status = "current"`; a behind/unreachable schema answers **503**      | Readiness body before/after, plus the fail-closed check                                 | Unset the flag; redeploy                                   |
| 7   | `OPS-REF`            | Release/Deploy Operator         | Identity lifecycle drill: signup → `users` row → logout → `refresh_token_denylist` row with `kind='family'` → scan logs for fail-closed migration errors                                      | Isolated preview database                                                                             | User persists; family revocation row written; ledger head `005_timestamptz_instants`; **0** fail-closed errors | Sanitised row dumps, ledger query output, log excerpt                                   | Roll back the Preview deployment; drop the drill schema    |
| 8   | `DR-REF` + `OPS-REF` | DB Owner / Platform Ops On-Call | Enable backup schedule + retention (≥30 d daily, ≥12 mo monthly); run restore rehearsal into a scratch DB; run rollback rehearsal                                                             | Scratch → staging only. **Never** production                                                          | RTO ≤ 30 min, RPO ≤ 24 h measured; rollback restores readiness 200 and row-count invariants                    | Artifact ID + integrity result, timestamps, exit codes, measured RTO/RPO, rollback note | Abort the drill; production left untouched; notify on-call |

### Rollback authority and rehearsal status (must be resolved before deployment)

`OPS-ONCALL-REF` — Platform Operations On-Call, currently **PENDING**. If any abort condition in §5
triggers, this role issues `npx vercel rollback` without further escalation and notifies stakeholders.

> **Rehearsal status: NOT VERIFIED — REHEARSAL EVIDENCE MISSING.** The rollback command is
> documented, and row 8 requests a rehearsal, but **no rehearsal has been executed**, no target
> deployment has been chosen, and no elapsed-time or recovery evidence exists. Documentation is not
> a rehearsal, and this request does not claim one.

### Explicit non-authorisation

Nothing in this document authorises a production restore, production rollback, production migration,
unapproved git push, identity-database provisioning, environment-variable change, drift-gate enablement,
or unapproved deployment. Each row needs its own written approval reference. Production is already running
`08731d22` (deployment `dpl_2Lqkq1PV6YqPtxQsLVbbV6St7VbF`); no change to it is requested here.

---

## 7. Phase-5 Approval Mapping (2026-10-19)

This table maps the operational rows above to the five approvals required by the certification review.
**None is granted.** Required evidence is stated so an approver can accept or reject concretely.

**Current certification disposition:** `CONDITIONALLY CERTIFIED — EXTERNAL GATES OPEN`. Deployed RC
`08731d22` scores **88/100** repository/CI and **50/100** operational; local candidate `347164ed` has
**58/58 locally-verifiable points and 0/42 remote-only points** because its CI and CodeQL are `NOT RUN`.
Neither number is a release-readiness claim.

| Approval                          | Scope                                                                                                                                                | Owners (roles only)                                                                                | Required evidence                                                                                                                                                                                                 | Status                                  |
| :-------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :-------------------------------------- |
| **A — Security-fix publication**  | Push `347164ed`; trigger remote CI + CodeQL; confirm the 41 remediated alerts clear                                                                  | Repository / Release Owner (`PUSH-AUTH-REF`)                                                       | CI run ID on the pushed SHA, CodeQL analysis/SARIF confirmation, alert delta, decision on whether to commit or exclude the 4 governance documents and the isolated candidate test fix (`router-registry.test.ts`) | **NOT AUTHORIZED**                      |
| **B — Security dispositions**     | Alerts **#51** `js/insufficient-password-hash` (`OAuthState.ts:47`) and **#39** `js/clear-text-storage-of-sensitive-data` (`session-manager.ts:357`) | Platform Security Lead (`SEC-SIGN-OFF`)                                                            | Written accept-or-remediate per alert, rationale, owner, re-evaluation date; code-change option preserved                                                                                                         | **PENDING**                             |
| **C — Isolated Preview identity** | Rows 3–7: isolated DB, Preview variables, deployment, ledger, lifecycle drill                                                                        | Database Owner (`DB-REQ-REF`), Platform/Secrets Owner (`TICKET-REF`), Release Operator (`REL-REF`) | Deployment ID/URL, readiness 200, smoke `PASSED`, ledger head `005_timestamptz_instants`, signup/logout revocation rows, zero fail-closed log errors                                                              | **NOT GRANTED**                         |
| **D — Recovery readiness**        | Row 8: provider backup schedule/retention, restore drill, rollback rehearsal                                                                         | DR Lead / DB Owner (`DR-DRILL-REF`), Platform Ops On-Call (`OPS-ONCALL-REF`)                       | Schedule + retention evidence, artifact/integrity record, measured RTO ≤ 30 min / RPO ≤ 24 h, rehearsal log with readiness and invariants                                                                         | **NOT GRANTED**                         |
| **E — Domain configuration**      | Attach `app.vedmoulya.com`; create DNS records in Vercel                                                                                             | DNS / Platform Owner                                                                               | DNS lookup, Vercel domain attachment, TLS and readiness verification                                                                                                                                              | **NOT GRANTED** (hygiene, non-blocking) |

**Variable names only for Approval C:** `IDENTITY_DATABASE_URL`, `AUTH_JWT_SECRET`, `REDIS_URL`;
`IDENTITY_SCHEMA_READINESS_GATE` stays unset until the ledger is verified. No values are requested,
recorded, or exposed in this document.

---

## 8. Not covered by approvals A–E (governance items, 2026-10-19)

Verified read-only. Nothing in this section requests an approval, grants one, or authorises any change.

- **Branch protection / repository rulesets.** `GET …/branches/main/protection` → `404 Branch not protected`;
  `GET …/rulesets` → empty; the repository is **public**. The fail-closed `CI Result` job is therefore
  **advisory** and does not block pushes to `main`. Recorded as a **governance risk** in
  `S14-RELEASE-CERTIFICATION-AND-HANDOFF.md` §18.9 (R-1, R-2) and in `RELEASE-GAP-REGISTER.md`
  (GAP-S14-13, Phase-6 addendum). **No protection or ruleset change is requested here and none was made**;
  the decision is **pending** with the Repository Owner.
- **Dependabot update and failing-run evidence.** `FINAL-REPORT.md` §21.11 records the three `dynamic`
  security-update runs on `08731d22` (2026-10-19, all `success`), the **failed** Dependabot PR run
  `39199309469` (PR **#42**, `dependabot/npm_and_yarn/typescript-a585801199`, 04:24:30Z), the succeeding
  PR runs `39199188596` / `39199181912`, and **16 open Dependabot PRs**. These are release-hygiene inputs
  to Approval A, not approvals.
- **Untracked security documents and candidate test fix.** The working tree carries four modified governance
  documents, one modified candidate test file (`services/api/src/__tests__/router-registry.test.ts` with 30s timeout
  adjustment), and two untracked security documents (`SECURITY-DISPOSITION-RECORDS-51-39.md`,
  `SECURITY-APPROVAL-HANDOFF-51-39.md`). Value-object files (`KnowledgeId.ts`, `MemoryId.ts`) and `next.config.ts`
  are verified restored to exact HEAD. They record no approval; alerts **#51** and **#39** remain `open` on
  `refs/heads/main` and `AWAITING APPROVAL`, and release approval remains **NO-GO**.
- **Still unassigned/pending:** approver identities (roles only), DR/staging owner assignments,
  `PUSH-AUTH-REF`, and the branch-protection decision.
