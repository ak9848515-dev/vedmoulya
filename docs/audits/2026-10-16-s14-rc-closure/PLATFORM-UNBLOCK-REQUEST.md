# Platform Authorization & Unblock Request (S14 Release Blocker Handoff)

**Document Reference:** `docs/audits/2026-10-16-s14-rc-closure/PLATFORM-UNBLOCK-REQUEST.md`  
**Date:** 2026-10-17  
**Target Release Candidate SHA:** `08731d2287762299479ac8be738aa0089c433ce0` (= `origin/main` = CI `headSha` = the SHA reported by the live production runtime)\
**Target Deployment Scope:** Vercel **Preview** Environment Only (Project: `vedmoulya-web`)\
**Revalidated:** 2026-10-18 (Phase 2) — approvals still **PENDING**; see §6 for the consolidated action plan

---

## 1. Executive Summary & Purpose

Local code gates (TypeScript, 58 ESLint scopes, 18/18 quality gates, Next.js 15.5 production build, secret scanning, dependency cycles, and identity schema gate contract tests) are 100% verified and green on `origin/main` at commit `08731d22`.

> **Verified 2026-10-18:** Exact-SHA CI run **`39039076592`** (`main`, push, `completed/success`, all 9 jobs including `G8: End-to-End Tests` and the fail-closed `CI Result`) ran on the exact release SHA `08731d2287762299479ac8be738aa0089c433ce0`. Run URL: `https://github.com/ak9848515-dev/vedmoulya/actions/runs/39039076592`. This confirms the CI claim above; the remaining blockers below are deployed-environment/DR only.

However, **Preview deployment and live identity verification are blocked** by external infrastructure prerequisites:

1. `GAP-S14-02`: No managed, non-localhost PostgreSQL identity database exists for the non-production candidate.
2. `GAP-S14-03`: The Vercel **Preview** environment holds only cache tokens (`KV_*`, `REDIS_URL`) and lacks `IDENTITY_DATABASE_URL` and `AUTH_JWT_SECRET`, causing candidate boots to fail closed.
3. `GAP-S14-08`: Staging/Preview readiness and smoke tests cannot be executed without deployed services.
4. `GAP-S14-05` **(added 2026-10-18)**: the release SHA carries **43 open CodeQL alerts** on `refs/heads/main` (42 `high`, 1 `medium`; 42 of 43 in shipped source). This is a repository-side blocker owned by Platform Engineering — it needs a remediation or a written risk acceptance, not a Preview deployment.

This document serves as the formal, actionable handoff to **Platform Engineering**, the **Database Owner**, and the **Release Owner** to obtain required written approvals and safely execute the unblock procedure.

---

## 2. Required Approvals & Accountable Roles

All actions in the target cloud environment require explicit written approval before execution.

| Role                                     | Accountable Owner           | Action Authorized                                                                                                  | Status / Reference          |
| :--------------------------------------- | :-------------------------- | :----------------------------------------------------------------------------------------------------------------- | :-------------------------- |
| **Platform Engineering / Secrets Owner** | Platform Team Lead          | Configuration of Preview environment variables (`IDENTITY_DATABASE_URL`, `AUTH_JWT_SECRET`, `REDIS_URL`) in Vercel | PENDING (`TICKET-REF-HERE`) |
| **Database Owner**                       | Data Infrastructure Owner   | Provisioning of an isolated, non-production managed PostgreSQL 16+ database with least-privilege role              | PENDING (`DB-REQ-REF-HERE`) |
| **Release / Deploy Operator**            | Release Manager             | Triggering deployment of exact SHA `08731d22` to Vercel Preview and executing post-deploy verification             | PENDING (`REL-REF-HERE`)    |
| **Rollback Authority**                   | Platform Operations On-Call | Authority to issue `npx vercel rollback` immediately if any abort condition is met                                 | PENDING (`OPS-ONCALL-REF`)  |

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

## 6. Consolidated Action Plan (Phase 5, revalidated 2026-10-18)

**Status of this request: PENDING — no item below has been executed.** It was revalidated read-only on
2026-10-18: exact-SHA CI `39039076592` is green on `08731d22`, production is proven to run that same
SHA, and `vercel env ls preview` still shows **only** `KV_*` + `REDIS_URL` (so the Preview blocker is
unchanged). One item was **added**: the release SHA carries **43 open CodeQL alerts (42 high)** on
`refs/heads/main`.

| #   | Approval required    | Responsible role                | Exact operation                                                                                                                                             | Required isolation                                                                                    | Acceptance criteria                                                                                            | Evidence to capture                                                                     | Abort / rollback                                           |
| :-- | :------------------- | :------------------------------ | :---------------------------------------------------------------------------------------------------------------------------------------------------------- | :---------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------- | :-------------------------------------------------------------------------------------- | :--------------------------------------------------------- |
| 1   | `DB-REQ-REF`         | Database Owner                  | Provision managed **PostgreSQL 16+** (instance or serverless branch) + least-privilege role; pooled DSN with `sslmode=require`                              | Dedicated branch/cluster. **Never** production credentials, tokens, or PII                            | Reachable from Preview; DSN validates; role scoped to the preview schema                                       | Provider reference, masked host, role name, TLS mode, approval ID                       | Abandon the branch; rotate anything created during setup   |
| 2   | `TICKET-REF`         | Platform/Secrets Owner          | Set **Preview-scoped** `IDENTITY_DATABASE_URL`, `AUTH_JWT_SECRET`, `REDIS_URL`; leave `IDENTITY_SCHEMA_READINESS_GATE` **unset**                            | Preview scope only; production untouched; `IDENTITY_DATABASE_URL` must not equal the production value | Preview boots; `/health/ready` 200                                                                             | Variable **names**, scope, timestamp — never values                                     | Unset the variables; redeploy the previous Preview         |
| 3   | `REL-REF`            | Release/Deploy Operator         | Deploy exact `08731d2287762299479ac8be738aa0089c433ce0` to Preview; run `/health/live`, `/health/ready`, `bash scripts/deploy/smoke-test.sh "$PREVIEW_URL"` | Preview deployment only                                                                               | `/health/ready` 200 with `database: healthy`; smoke prints `PASSED`                                            | Deployment URL + ID, HTTP codes, smoke output, timestamps                               | `npx vercel rollback`; delete the Preview deployment       |
| 4   | `TICKET-REF`         | Platform Owner                  | After the ledger head is verified, set `IDENTITY_SCHEMA_READINESS_GATE=1` and redeploy Preview                                                              | Preview only                                                                                          | `/health/ready` 200 with `identitySchema.status = "current"`; a behind/unreachable schema answers **503**      | Readiness body before/after, plus the fail-closed check                                 | Unset the flag; redeploy                                   |
| 5   | `OPS-REF`            | Release/Deploy Operator         | Identity lifecycle drill: signup → `users` row → logout → `refresh_token_denylist` row with `kind='family'` → scan logs for fail-closed migration errors    | Isolated preview database                                                                             | User persists; family revocation row written; ledger head `005_timestamptz_instants`; **0** fail-closed errors | Sanitised row dumps, ledger query output, log excerpt                                   | Roll back the Preview deployment; drop the drill schema    |
| 6   | `DR-REF` + `OPS-REF` | DB Owner / Platform Ops On-Call | Enable backup schedule + retention (≥30 d daily, ≥12 mo monthly); run restore rehearsal into a scratch DB; run rollback rehearsal                           | Scratch → staging only. **Never** production                                                          | RTO ≤ 30 min, RPO ≤ 24 h measured; rollback restores readiness 200 and row-count invariants                    | Artifact ID + integrity result, timestamps, exit codes, measured RTO/RPO, rollback note | Abort the drill; production left untouched; notify on-call |
| 7   | Risk decision        | Platform Engineering            | Review the 43 open CodeQL alerts: remediate or formally risk-accept with rationale + target date                                                            | n/a (repository)                                                                                      | The blocking set is empty, or accepted in writing                                                              | Alert export (rule, severity, path), decision record                                    | n/a                                                        |

### Rollback authority (must be named before item 3)

`OPS-ONCALL-REF` — Platform Operations On-Call, currently **PENDING**. If any abort condition in §5
triggers, this role issues `npx vercel rollback` without further escalation and notifies stakeholders.

### Explicit non-authorisation

Nothing in this document authorises a production restore, production rollback, production migration,
identity-database provisioning, environment-variable change, drift-gate enablement, or deployment.
Each row needs its own written approval reference. Production is already running `08731d22`
(deployment `dpl_2Lqkq1PV6YqPtxQsLVbbV6St7VbF`); no change to it is requested here.
