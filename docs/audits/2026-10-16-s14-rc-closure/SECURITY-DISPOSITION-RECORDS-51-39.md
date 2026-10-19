# S14 Security Disposition Records — CodeQL #51 and #39

**Phase:** 6.2 — Controlled Disposition
**Prepared:** 2026-10-19
**Repository baseline:** `main` at `347164edd2d76d87589db71bc3d1bec83a302cc8` (`origin/main` `08731d2287762299479ac8be738aa0089c433ce0`; 8 ahead, 0 behind)
**Overall status:** **AWAITING APPROVAL — NO DECISION RECORDED**
**Nature of this document:** unsigned decision-support record. It is **not** a security approval, risk acceptance, dismissal, or remediation authorization.

---

## 1. Scope and evidence basis

This document covers only:

| Alert   | Rule                                                        | Location                                      | GitHub severity | State on 2026-10-19 |
| :------ | :---------------------------------------------------------- | :-------------------------------------------- | :-------------- | :------------------ |
| **#51** | `js/insufficient-password-hash` (CWE-916)                   | `services/identity/src/auth/OAuthState.ts:47` | high            | `open`              |
| **#39** | `js/clear-text-storage-of-sensitive-data` (CWE-312/315/359) | `apps/web/src/auth/session-manager.ts:357`    | high            | `open`              |

Both alerts remain open on `refs/heads/main`. No alert was dismissed, suppressed, or marked as a false positive. No source code was changed during this pass.

**Document status:** this record and `SECURITY-APPROVAL-HANDOFF-51-39.md` are **untracked working-tree additions** (2026-10-19); neither is committed, and neither is an approval. They are listed in the inventories of `FINAL-REPORT.md` §21.9, `S14-RELEASE-CERTIFICATION-AND-HANDOFF.md` §18.6 / §18.9 (R-5), `RELEASE-GAP-REGISTER.md` (Phase-6 addendum) and `PLATFORM-UNBLOCK-REQUEST.md` §8. **No approver identity exists or is implied:** both decision blocks remain blank (`AWAITING APPROVAL`).

**Security-owner decision history:** none. Repository-wide search found only proposed disposition text and `SEC-SIGN-OFF` entries marked `PENDING`. No signed decision, authorized owner, date, or re-evaluation date exists.

---

## 2. Decision Record #51 — OAuth state hashing

### 2.1 Finding identity

- **Alert:** #51
- **Rule:** `js/insufficient-password-hash`
- **Severity:** high (rule level: warning)
- **Location:** `services/identity/src/auth/OAuthState.ts:47`
- **Function:** `hashOAuthState(state: string)`
- **State:** open on `refs/heads/main`

### 2.2 Verified implementation and data flow

1. `createOAuthState()` (`OAuthState.ts:36-43`) generates the raw state with `randomBytes(32).toString('base64url')` — 32 bytes / 256 bits of CSPRNG entropy.
2. `hashOAuthState()` (`OAuthState.ts:46-48`) computes `createHash('sha256').update(state).digest('hex')`.
3. `AuthService.beginGoogleAuth()` (`AuthService.ts:211-215`) persists only `stateHash` via `oauthStateStore.save(stateHash, expiresAt)` and returns the raw state inside the Google authorization URL.
4. The store (`OAuthStateStore.ts:57-83`) inserts `state_hash`, `expires_at`, `consumed_at = NULL`, `created_at`. The `oauth_states` table stores **only the SHA-256 digest**, never the raw state (`identitySchema.ts:123-135`; migration `003_oauth_states`).
5. `OAUTH_STATE_TTL_MS` is `10 * 60 * 1000` (ten minutes).
6. On callback, `AuthService.signInWithGoogle()` (`AuthService.ts:221-252`) rejects an empty state, computes the digest, and calls `OAuthStateStore.consume()`. The Postgres implementation performs one atomic `UPDATE … WHERE state_hash = … AND consumed_at IS NULL AND expires_at > now() RETURNING id`; a second callback with the same state cannot succeed. Store errors fail closed before any Google code exchange.
7. Tests: `services/identity/__tests__/OAuthState.test.ts` covers entropy, determinism, non-reuse, single-use replay, unissued state, expiry, and store selection. `AuthService.test.ts` covers missing state, unissued state, replayed state, and store-error fail-closed.

**Result: the Phase 5 description of the data flow matches the code.**

### 2.3 Does the password-hashing assumption apply?

**No.** The rule assumes a human-chosen password is hashed with a fast function and can therefore be brute-forced offline. The actual input is a 256-bit CSPRNG nonce used for OAuth CSRF correlation. It is not a password, is never user-supplied, and has no dictionary structure. Recovering the raw state from the stored SHA-256 digest requires a preimage over a 2^256 space. A database disclosure therefore does not yield usable states.

### 2.4 Threat model and residual risk

- **Primary control:** OAuth CSRF / login-CSRF correlation. The server accepts a callback only for a state it minted, within ten minutes, exactly once.
- **Residual risks:**
  - Safety depends on the nonce retaining full CSPRNG entropy. A future change to weak randomness would invalidate the rationale.
  - The digest is unkeyed; an attacker with database read access can test candidate states offline. This is infeasible only because the state space is 2^256.
  - The state is a bearer correlation value: anyone who obtains the raw state and the authorization code before consumption could attempt the callback. The ten-minute TTL and single-use rule bound the window.
  - SHA-256 is fast by design. That is appropriate for a nonce lookup key and inappropriate for a password; the distinction is the basis of this assessment.

### 2.5 Options

#### Option A — `ACCEPT WITH RATIONALE`

Accept the SHA-256 digest of a 256-bit CSPRNG nonce as the OAuth state lookup key.

- **Rationale to be signed by the owner:** the flagged value is not a password; fast hashing is required for deterministic indexed single-use lookup; the nonce has full entropy; TTL and atomic consumption bound replay.
- **Conditions:** keep `randomBytes(32)`; keep the ten-minute TTL; keep atomic single-use consumption and fail-closed error handling; keep the tests listed in §2.2; re-review if state generation, TTL, or storage changes.
- **Consequences:** alert remains open until an authorized dismissal is recorded after sign-off; no code change; no new secret dependency.
- **Residual risk:** as in §2.4. The owner is accepting the nonce-hash design, not asserting that SHA-256 is suitable for passwords.

#### Option B — `REMEDIATE`

Replace the unkeyed digest with a keyed construction (for example HMAC-SHA-256 with a server-held secret) or another approved design.

- **What must be specified before implementation:** secret source and lifecycle, rotation, availability/fail-closed behavior, whether outstanding states are invalidated, and whether the lookup remains deterministic and indexed.
- **Consequences:** new secret-management dependency; deployment/configuration change; possible invalidation of in-flight states (bounded by the ten-minute TTL); schema may remain unchanged; tests must cover key absence/failure and rotation.
- **Not approved by this document.** Password-grade KDFs (Argon2/bcrypt/scrypt) are **not** recommended here because they break deterministic indexed lookup and add redirect latency without addressing the actual nonce threat.

### 2.6 Verification required after either decision

- Option A: signed record; no source change; re-run `OAuthState.test.ts` and `AuthService.test.ts` only if the code changes; otherwise retain the existing evidence. Remote CodeQL must still be re-run after publication to confirm the alert is dispositioned according to the approved record.
- Option B: targeted tests for minting, digest/keyed lookup, expiry, replay, and store failure; a migration/compatibility note; remote CodeQL on the authorized CI run.
- Any alert dismissal or false-positive marking must be performed only after the signed decision and through the authorized process — **not in this pass**.

### 2.7 Gate status re-confirmed 2026-10-19 (no decision)

| Check                                                  | Result                                                                                                                         |
| :----------------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------- |
| Source state under review                              | Unchanged since Phase 6.1 — `OAuthState.ts` still uses `randomBytes(32)` + SHA-256 + 10-minute TTL; no edit made in this pass. |
| Targeted tests (`OAuthState`, `session-manager`)       | **Re-run 2026-10-19:** 2 files, **39/39 passed**, exit 0.                                                                      |
| Route-level tests (`AuthRoutes`, `AuthRoutesExtended`) | **Re-run 2026-10-19:** 2 files, **63/63 passed**, exit 0 (covers the server-rendered callback path relevant to #39).           |
| CodeQL alert #51 on `refs/heads/main`                  | **Still `open`.** No dismissal, suppression, or false-positive marking performed.                                              |
| Decision block                                         | **Still blank.** `SEC-SIGN-OFF` remains `PENDING`; this pass records evidence only and grants nothing.                         |

### 2.8 Decision block

| Field                                  | Value                                       |
| :------------------------------------- | :------------------------------------------ |
| Required owner                         | Platform Security Lead / AppSec             |
| Approval status                        | **AWAITING APPROVAL**                       |
| Decision                               | `[ ] ACCEPT WITH RATIONALE` `[ ] REMEDIATE` |
| Owner (name/role)                      | _to be completed by the authorized owner_   |
| Decision date                          | _not set_                                   |
| Review date                            | _not set — pending owner decision_          |
| Re-evaluation date                     | _to be set by the owner if applicable_      |
| Rationale / approved remediation scope | _to be completed by the authorized owner_   |

---

## 3. Decision Record #39 — Browser session storage

### 3.1 Finding identity

- **Alert:** #39
- **Rule:** `js/clear-text-storage-of-sensitive-data`
- **Severity:** high (rule level: error)
- **Location:** `apps/web/src/auth/session-manager.ts:357`
- **State:** open on `refs/heads/main`

### 3.2 Exact stored values and all write/read paths

The key is `vedmoulya-oauth-pending`. The stored payload is exactly:

```json
{ "state": "<server-minted base64url nonce>", "next": "<redirect path>" }
```

**Path 1 — client `beginGoogleSignIn()`:**

- Writes at `session-manager.ts:355-357` before the full-page redirect to Google.
- Reads at `session-manager.ts:384`.
- Deletes at `session-manager.ts:390` before comparison.
- Compares `pending.state !== state` at `session-manager.ts:395-397`; mismatch aborts.
- On success, calls `exchangeGoogleCode(code, state)`; the server performs the authoritative check.

**Path 2 — server-rendered browser-navigation callback:**

- `AuthRoutes.ts:303-314` returns inline HTML for `Accept: text/html`.
- The inline script writes the **same key** at `AuthRoutes.ts:307-308` as `{state, next:'/'}`.
- It then calls the JSON callback directly, writes the returned session to `localStorage` under `vedmoulya-auth` (`AuthRoutes.ts:315-325`), and redirects to `/`.
- It does **not** call `completeGoogleSignIn()` and does **not** perform the client-side state comparison. The server still verifies and consumes the state.

**Callback behavior discrepancy:** the two paths share a storage key but not a callback contract. Path 1 uses `/oauth2redirect` + `completeGoogleSignIn()` and honors `next`; Path 2 bypasses that page, discards `next`, and persists tokens directly to `localStorage`. This discrepancy is a constraint on any remediation and should be resolved as part of the approved design, not silently.

### 3.3 Are credentials stored there?

**No.** The `vedmoulya-oauth-pending` payload contains only the CSRF state and a redirect path. It does **not** contain access tokens, refresh tokens, passwords, authorization codes, or client secrets. (Separate observation, outside this alert: Path 2 writes the session tokens to `localStorage` under `vedmoulya-auth`; that is a different key and data flow and is not asserted here to be safe.)

### 3.4 Validation and server authority

- The server mints the state and stores only its SHA-256 digest.
- On callback, `AuthService.signInWithGoogle()` verifies the state by atomic single-use consumption, with a ten-minute TTL, and fails closed on store errors.
- The client-side comparison is defence in depth; the server check is the control.
- The client also sends the raw state back to the server, so removing the client comparison would not remove the authoritative check — but it would remove a defence-in-depth layer and change the callback contract.

### 3.5 XSS / same-origin exposure

Any script executing in the origin can read `sessionStorage` for that tab, including the pending state and redirect path. If an attacker has arbitrary script execution, they can also act in the authenticated origin; the stored value is not a credential. The state alone cannot complete sign-in without the authorization code. `sessionStorage` is tab-scoped and is cleared when the tab closes; the code deletes the entry on callback and logout.

**OAuth controls present/absent:** state is present on both the client and server; the server performs single-use verification; **PKCE is not implemented** in this flow. Without PKCE, interception of an authorization code is a separate residual risk. This record does not assert that PKCE exists.

### 3.6 Options

#### Option A — `ACCEPT WITH RATIONALE`

Accept the tab-scoped storage of the OAuth CSRF state plus redirect path.

- **Rationale to be signed by the owner:** the payload is a non-credential CSRF nonce and a path; no tokens or secrets are stored; the server verifies and consumes the state; storage is tab-scoped and removed after use; the exposure requires origin script execution, which already implies a broader compromise.
- **Conditions:** keep the payload schema limited to `{state, next}`; never add tokens or credentials; keep server-side single-use verification; keep the removal on callback/logout; re-review if either write path or the payload changes.
- **Consequences:** alert remains open until an authorized dismissal is recorded; no code change; the client-side comparison remains.
- **Residual risk:** XSS/local tab access can disclose the state and target path; without PKCE, code interception remains a separate concern; the second write path must remain consistent with the first.

#### Option B — `REMEDIATE`

Redesign the browser-storage handoff. Any approved design must cover **both** write paths, callback compatibility, redirect handling, and regression tests.

Candidate designs (none approved):

1. **Stop storing `state` client-side; rely on server verification.** Keep only the non-sensitive `next` path (or move `next` to a server-side pending record). Update Path 1 and Path 2 so both use the same callback contract; preserve the client's redirect target. Consequence: removes the client-side comparison (defence in depth) but not the server control.
2. **Store an opaque, non-sensitive pending-handle** and resolve the state server-side. Requires a server-side mapping/lifecycle design and both write paths to use it.
3. **Use an HttpOnly, SameSite cookie for the pending state**, with the server comparing it. Requires cookie/CSRF design, callback plumbing, and compatibility work; not a drop-in change.

- **Consequences:** possible callback-contract change; must update `AuthRoutes.ts` and `session-manager.ts` together; tests for both paths; no token should move into the pending payload.
- **Not approved by this document.** Removing the client-side comparison or changing the callback contract without an approved design is explicitly out of scope.

### 3.7 Verification required after either decision

- Option A: signed record; no source change; retain the existing tests (`session-manager.test.ts`, `AuthRoutes.test.ts`, `AuthRoutesExtended.test.ts`); add a regression assertion that the pending payload contains only `state` and `next` if the owner requires it. Remote CodeQL re-run after publication.
- Option B: targeted tests for both write paths, state comparison/removal, callback compatibility, redirect handling, and payload contents; a design note covering the second path; remote CodeQL on the authorized CI run.
- Any dismissal or false-positive marking only after the signed decision.

### 3.8 Gate status re-confirmed 2026-10-19 (no decision)

| Check                                                  | Result                                                                                                                                                                 |
| :----------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Source state under review                              | Unchanged — `session-manager.ts:355-357` still stores exactly `{state, next}`; the second write path at `AuthRoutes.ts:307-308` stores the same payload. No edit made. |
| Payload schema                                         | Still limited to `{state, next}`; no token, authorization code, or client secret is written to `vedmoulya-oauth-pending`.                                              |
| Targeted tests (`OAuthState`, `session-manager`)       | **Re-run 2026-10-19:** 2 files, **39/39 passed**, exit 0 (includes state-mismatch rejection and success paths).                                                        |
| Route-level tests (`AuthRoutes`, `AuthRoutesExtended`) | **Re-run 2026-10-19:** 2 files, **63/63 passed**, exit 0 (covers the server-rendered callback path).                                                                   |
| CodeQL alert #39 on `refs/heads/main`                  | **Still `open`.** No dismissal, suppression, or false-positive marking performed.                                                                                      |
| Decision block                                         | **Still blank.** Both `SEC-SIGN-OFF` entries remain `PENDING`; this pass records evidence only and grants nothing.                                                     |

### 3.9 Decision block

| Field                               | Value                                                          |
| :---------------------------------- | :------------------------------------------------------------- |
| Required owners                     | Platform Security Lead / AppSec **and** Web Architecture Owner |
| Approval status                     | **AWAITING APPROVAL**                                          |
| Decision                            | `[ ] ACCEPT WITH RATIONALE` `[ ] REMEDIATE`                    |
| Owner (name/role)                   | _to be completed by the authorized owners_                     |
| Decision date                       | _not set_                                                      |
| Review date                         | _not set — pending owner decision_                             |
| Re-evaluation date                  | _to be set by the owner if applicable_                         |
| Approved remediation scope (if any) | _to be completed by the authorized owners_                     |

---

## 4. Approval gate and required artifacts

A valid decision must identify the finding, the rationale or approved remediation scope, the authorized owner, the decision date, and a re-evaluation date where applicable. Until both records contain that information:

- Both findings remain **AWAITING APPROVAL**.
- No alert is dismissed, suppressed, or marked false positive.
- No source-code remediation is started.
- No publication occurs.

**Missing approvals:**

| Approval                                        | Owner role                                               | Status      |
| :---------------------------------------------- | :------------------------------------------------------- | :---------- |
| `SEC-SIGN-OFF` — #51                            | Platform Security Lead / AppSec                          | **PENDING** |
| `SEC-SIGN-OFF` — #39                            | Platform Security Lead / AppSec + Web Architecture Owner | **PENDING** |
| `PUSH-AUTH-REF` — publication of the fix commit | Repository / Release Owner                               | **PENDING** |

---

## 5. Governance consistency review

Review performed; the only change to the four documents is the wording-only clarification recorded in §5.1, applied on 2026-10-19:

| Check                                                    | Result                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| :------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Blended `100/100` readiness score presented as current   | **No.** Historical 100/100 tables are explicitly marked `[SUPERSEDED]`; current scores are 88/100 for the deployed RC and 58/58 local + 0/42 remote for the candidate.                                                                                                                                                                                                                                                                                                                                                    |
| Rollback described as rehearsed without evidence         | **No current claim.** Rollback is `NOT VERIFIED — REHEARSAL EVIDENCE MISSING`; the prior phrase is retained only in the correction notes.                                                                                                                                                                                                                                                                                                                                                                                 |
| Either finding called a confirmed false positive         | **No.** Both are described as open engineering proposals awaiting `SEC-SIGN-OFF`.                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| Security sign-off or release approval claimed as granted | **No.** `SEC-SIGN-OFF` is `PENDING`; release approval is `NO-GO`.                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| Ambiguity requiring a minimal correction                 | **Yes — corrected.** Two disposition lines read “Proposed Disposition: Accepted Architecture Pattern / Documented Risk Acceptance” and “Proposed Disposition: Accepted Client-Side Architecture Pattern / Documented Risk Acceptance”. The word “Proposed” was present, but “Accepted … Risk Acceptance” could be misread as a granted decision. A minimal wording clarification was applied on 2026-10-19 to all four occurrences; no score, evidence, release, or rollback status was changed. Exact locations in §5.1. |

### 5.1 Minimal governance clarification applied 2026-10-19 (wording only)

**Patch applied — two distinct dispositions, four occurrences:**

```diff
- **Proposed Disposition:** Accepted Architecture Pattern / Documented Risk Acceptance with technical cryptographic justification.
+ **Proposed Disposition (UNSIGNED — AWAITING OWNER APPROVAL):** Engineering assessment only; **no risk acceptance, dismissal, or approval has been recorded.**

- **Proposed Disposition:** Accepted Client-Side Architecture Pattern / Documented Risk Acceptance.
+ **Proposed Disposition (UNSIGNED — AWAITING OWNER APPROVAL):** Engineering assessment only; **no risk acceptance, dismissal, or approval has been recorded.**
```

**Exact applied locations (re-verified 2026-10-19):**

| Document                                   | Section                     | Line | Finding |
| :----------------------------------------- | :-------------------------- | :--- | :------ |
| `S14-RELEASE-CERTIFICATION-AND-HANDOFF.md` | §17.2 Owner-Review Record 1 | 734  | #51     |
| `S14-RELEASE-CERTIFICATION-AND-HANDOFF.md` | §17.2 Owner-Review Record 2 | 751  | #39     |
| `FINAL-REPORT.md`                          | §20.5 item 1                | 643  | #51     |
| `FINAL-REPORT.md`                          | §20.5 item 2                | 654  | #39     |

§16.5/§16.6 of the certification document carry the “RETAINED OPEN” narratives for the same two findings and contain no disposition wording. The prior wording shown above is quoted from the Phase-6.3 task statement; it is not independently re-derivable from the working tree, because the affected blocks are uncommitted additions relative to `HEAD`. Historical intent is preserved; only the misleading “Accepted” wording changed. No other content in those documents was modified by this clarification, and no score, evidence, release, or rollback status was altered.

---

## 6. Test and scan evidence

| Item                        | Evidence                                                                                                                                                      |
| :-------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Tested SHA                  | `347164edd2d76d87589db71bc3d1bec83a302cc8`                                                                                                                    |
| Targeted command            | `npx vitest run services/identity/__tests__/OAuthState.test.ts apps/web/src/auth/__tests__/session-manager.test.ts`                                           |
| Result                      | 2 files, **39/39 tests passed**, exit 0 — re-confirmed 2026-10-19 on this tree (original Phase 6.1 run; no source change since)                               |
| Route-level command         | `npx vitest run services/identity/__tests__/AuthRoutes.test.ts services/identity/__tests__/AuthRoutesExtended.test.ts`                                        |
| Route-level result          | 2 files, **63/63 tests passed**, exit 0 — run 2026-10-19 on this tree                                                                                         |
| Broader security-fix tests  | Not re-run in this pass; the two targeted suites above are the evidence for these alerts                                                                      |
| Remote CI on tested SHA     | **NOT RUN** — no workflow run exists for `347164ed`                                                                                                           |
| Remote CodeQL on tested SHA | **NOT RUN** — `refs/heads/main` still reports #51 and #39 open (43 open alerts total)                                                                         |
| Publication candidate       | `347164ed` code diff is reviewable, but the commit also contains stale governance documents; the four Phase-5 corrections are uncommitted in the working tree |

**Limitation:** no remote analysis has evaluated the local security-fix commit. Historical local results validate only the unchanged local tree; they are not remote verification.

---

## 7. Actions not taken

No source edit, commit, push, pull request, merge, deployment, environment change, secret change, OAuth credential change, database change, alert dismissal, or suppression was performed in this pass.

---

## 8. Disposition

**Both findings: `AWAITING APPROVAL`.**

This document is ready for the Platform Security Lead (and, for #39, the Web Architecture Owner) to complete the decision blocks. No remediation, dismissal, or publication may proceed until those decisions are recorded.
