# VedMoulya — S12 Production Blocker Report

**Date (UTC):** 2026-10-14  
**Branch:** `main` · **HEAD:** `a124274b0d1fa91f361e0a5775e144658405913a`  
**Status:** PRODUCTION RELEASE BLOCKED — All mandatory release gates require operator/platform intervention

This document provides a precise BLOCKED report naming every outstanding operator/platform dependency and the exact evidence required for production GO reconsideration, as mandated by the Sprint 026 final report and quality charter.

## Summary of Blocking Conditions

Per the Sprint 026 FINAL-REPORT.md, production release is NO-GO because the following **four conditions for reconsideration** remain unsatisfied and are **operator-gated**:

---

### 1. Infrastructure Configuration: Identity Database

**Blocker ID:** S012-A / 4E  
**Owner:** Deployment Operator (Platform/Identity)  
**Dependency:** A managed, non-localhost `IDENTITY_DATABASE_URL` must be configured in an authorized platform environment

**Exact Evidence Required:**

- Successful execution of `npm run preflight:prod` with exit code 0
- Successful execution of `npm run doctor:prod` with exit code 0
- Successful execution of `npm run test:a11y` with exit code 0
- HTTP 200 response from `/health/ready` endpoint
- Absence of identity-warning logs indicating fail-closed behavior

**Current Status:**

- Local `a11y` tests pass (6/6) in UI-only mode
- No platform value for `IDENTITY_DATABASE_URL` is set
- Production boot fails closed without external database

**Verification Command (when operator provides environment):**

````bash
npm run preflight:prod && npm run doctor:prod && npm run test:a11y
---

### 2. Provider Funding: Live Cloud AI Generation
**Blocker ID:** S012-B / 4E
**Owner:** Deployment Operator (AI Provider / Finance)
**Dependency:** A funded credential for the SUPPORTED provider. Per the 2026-10-16 owner decision the supported family is **Google Gemini** (`AI_GOOGLE_API_KEY`); OpenAI remains optional (`AI_OPENAI_API_KEY`).

**Exact Evidence Required:**
- Both verification scripts completing with exit code 0:
  - `scripts/ai-production-verify.ts`
  - `scripts/ai-critique-verify.ts`
- Confirmation of non-mocked cloud token generation (real provider completions)

**Current Status:**
- Scripts exit with code 3 due to absent provider billing credits
- Live completions unverified on cloud providers (hermetic mocks and local Ollama only)
- No provider credentials used in verification

**Verification Command (when operator provides credits):**
```bash
npx tsx scripts/ai-production-verify.ts && npx tsx scripts/ai-critique-verify.ts
````

> **Update — 2026-10-15 (live journey executed; base HEAD `f1dbce7f`).** The line
> above reading _"Live completions unverified on cloud providers"_ is no longer
> true and is corrected here. Both verifier scripts were run live against the
> real provider: each still exits **3** because the OpenAI account has no
> billing credits (_"You have no credits remaining"_ — authentication and model
> negotiation both succeeded, so this is a funding state and not an integration
> defect). Separately, **real, non-mocked cloud completions are now verified**
> through the repository's own provider path on Google Gemini: 3/3 consecutive
> HTTP 200 completions on `gemini-3.5-flash-lite`, plus successful completions
> on `gemini-3.5-flash`, `gemini-flash-lite-latest` and `gemini-flash-latest`.
> **S012-B is NOT closed**: its evidence requirement names the two scripts above
> and both still fail, so the remaining gap is _an OpenAI account with funds_,
> not the ability to generate. The run also found that OpenRouter's model-list
> probe reports "connected" with a credential that the very next real request
> rejects, and that this checkout's `.env.local` holds a credential in the wrong
> slot. Evidence: `docs/audits/2026-10-15-s12-b-live-provider/FINAL-REPORT.md`.

> **Update — 2026-10-16 (owner decision · S012-B CLOSED).** The owner accepted
> **Google Gemini as the supported provider for this acceptance journey.** The
> two verifier scripts no longer hardcode OpenAI: they select the family from
> `AI_PRODUCTION_VERIFY_PROVIDER` (default `google`) and resolve the key through
> the deployment's own resolvers. Run live against the funded Google family both
> now **exit 0** — `ai-production-verify.ts` 15/15 checks (5 real Gemini
> completions) and `ai-critique-verify.ts` 7/7 checks with an executed live
> critique. Two latent script defects that made the success path unreachable (an
> unwired routing advisor in §C, and a `groundingRequired` request with no
> `ragQuery` in §E) were corrected; no check was weakened and no mock substitutes
> for the live leg. The `.env.local` credential-slot mismatch was neutralized
> (the misplaced OpenAI key was removed from the OpenRouter slot, fail-closed).
> Evidence: `docs/audits/2026-10-15-s12-b-live-provider/FINAL-REPORT.md` §8.

---

### 3. Authorized Staging: Disaster Recovery Drills

**Blocker ID:** S012-C / 4E  
**Owner:** Deployment Operator (Platform / Infrastructure)  
**Dependency:** An authorized staging environment must exist for recovery validation

**Exact Evidence Required:**

- Completion of automated backup and PITR restore drill following `docs/runbooks/backup-restore-runbook.md`
- Signed recovery logs confirming:
  - Restore invariants pass
  - Readiness endpoint returns HTTP 200
  - Rollback succeeds
  - Recovery Time Objective (RTO) ≤ 30 minutes

**Current Status:**

- No authorized staging environment exists in repository or locally
- Local Docker provides only development `postgres` and `redis`
- `release` workflow deploys to GitHub Environments without required secrets

**Verification Procedure (when operator provisions staging):**

1. Execute restore procedure from `docs/runbooks/backup-restore-runbook.md` Section 2
2. Validate with:
   ```bash
   curl -fsS "$STAGING_URL/api/trpc/health.check"
   ```
3. Confirm RTO ≤ 30 minutes in recovery logs

---

### 4. Token Security: Refresh Token Revocation/Rotation

**Blocker ID:** S024-4A  
**Owner:** Platform Engineer (Identity / Auth)  
**Dependency:** Implementation of durable JWT denylist table migration

**Exact Evidence Required:**

- Approved migration merging that creates a durable token denylist store
- Migration must enable refresh token revocation upon logout

**Current Status:**

- Stateless JWT refresh tokens are neither rotated nor revocable upon logout
- Requires shared durable denylist table prior to internet-facing deployment

**Verification Command (when migration is merged):**

```bash
# After migration deployment:
npm run test:auth:logout:revoke  # Should pass when denylist is active
```

> **Update — 2026-10-15 (working tree, uncommitted, HEAD `81dd5f88`).** The
> statement above ("neither rotated nor revocable upon logout") no longer
> describes the working tree. Rotation is now single-use via an atomic claim,
> logout durably revokes the refresh family, and both paths are verified
> against a **real PostgreSQL engine** — see
> `docs/audits/2026-10-15-s12-4a-durable-revocation/FINAL-REPORT.md`. That
> report also records two production-breaking defects the in-memory-only
> evidence could not have caught: every identity store write threw when bound
> through drizzle's `sql.param(Date)`, and a time-zone skew on the read path
> widened the post-logout gap by the Node/DB zone difference (330 minutes on a
> non-UTC process). **Blocker 4A is therefore NOT closed by this update**: its
> own evidence requirement is an _approved, merged_ migration, which requires a
> review and a commit, and its migration cannot be deployed ahead of condition 1
> below. The verification command above remains un-runnable until then.

---

## Conclusion

**PRODUCTION RELEASE REMAINS BLOCKED** pending operator/platform action on all four infrastructure conditions. No code changes in this repository can resolve these blockers, as they require:

1. External platform resource provisioning (Identity Database)
2. Commercial provider account funding (Live Cloud AI)
3. Authorized environment allocation (Staging for DR)
4. Internal platform migration implementation (Token Security)

Until these conditions are formally closed by their respective designated owners with the exact evidence specified above, the system must remain gated from public internet production deployment.

**Recommendation:** Maintain PRODUCTION RELEASE FROZEN state. Continue internal/local testing only. Re-evaluate for S12 GO only when all four conditions are satisfied with verifiable evidence.

```

```
