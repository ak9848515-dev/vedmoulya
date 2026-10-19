# S14 Security Approval Handoff — CodeQL #51 and #39

**Request type:** security-owner decision request
**Prepared:** 2026-10-19
**Status:** **AWAITING APPROVAL — this document is a request, not an approval**
**Repository baseline:** `main` at `347164edd2d76d87589db71bc3d1bec83a302cc8` (`origin/main` `08731d2287762299479ac8be738aa0089c433ce0`; 8 ahead, 0 behind)

> This handoff has **not** been sent externally. It records no approval, signature, dismissal, or risk acceptance. Both findings remain open.

---

## 1. Recipients and decision ownership

| Finding                                           | Required decision owner         | Additional reviewer                   |
| :------------------------------------------------ | :------------------------------ | :------------------------------------ |
| **#51** `js/insufficient-password-hash`           | Platform Security Lead / AppSec | —                                     |
| **#39** `js/clear-text-storage-of-sensitive-data` | Platform Security Lead / AppSec | **Web Architecture Owner** (required) |

Each finding requires a **separate** decision. A decision on one does not apply to the other.

---

## 2. Decision requested

For each finding, select exactly one:

- **`ACCEPT WITH RATIONALE`** — approve the documented engineering assessment and record the residual risk.
- **`REMEDIATE`** — require a code/design change under a separately approved scope.

| Finding | Rule                                      | Location                                      | Current state | Decision                                    |
| :------ | :---------------------------------------- | :-------------------------------------------- | :------------ | :------------------------------------------ |
| **#51** | `js/insufficient-password-hash`           | `services/identity/src/auth/OAuthState.ts:47` | open / high   | `[ ] ACCEPT WITH RATIONALE` `[ ] REMEDIATE` |
| **#39** | `js/clear-text-storage-of-sensitive-data` | `apps/web/src/auth/session-manager.ts:357`    | open / high   | `[ ] ACCEPT WITH RATIONALE` `[ ] REMEDIATE` |

No decision is pre-selected.

---

## 3. Finding #51 — why SHA-256 is applied to a nonce, not a password

**What CodeQL sees:** `createHash('sha256')` is applied to a value produced by `createOAuthState`, so the rule treats the value as a password hashed with insufficient computational effort.

**What the code actually does:**

1. `createOAuthState()` generates `randomBytes(32).toString('base64url')` — 32 bytes / **256 bits of CSPRNG entropy**.
2. `hashOAuthState()` computes SHA-256 over that nonce. The nonce is **not user-supplied**, has no dictionary structure, and is not a credential.
3. Only the digest is persisted in `oauth_states`. The raw state exists in the redirect URL and is returned by the server.
4. On callback, `AuthService.signInWithGoogle()` recomputes the digest and consumes it with one atomic `UPDATE … WHERE consumed_at IS NULL AND expires_at > now()`. A second callback cannot reuse it; store errors fail closed.
5. The state expires after **ten minutes**.

**Why the password-hashing assumption does not apply:** offline recovery of the raw state from the digest requires a SHA-256 preimage over a 2^256 space. Fast hashing is required for deterministic indexed lookup; a password-grade KDF would add latency and break that lookup without addressing the actual nonce threat.

**Residual risks to be accepted if Option A is chosen:**

- The rationale depends on the nonce retaining full CSPRNG entropy; a future weak-randomness change would invalidate it.
- The digest is unkeyed. An attacker with database read access can test candidates offline, but the 2^256 space makes this infeasible.
- The state is a bearer correlation value; anyone who obtains both the raw state and the authorization code before consumption could attempt the callback. The TTL and single-use rule bound the window.
- SHA-256 is appropriate for a nonce lookup key and inappropriate for a password. The acceptance is of the **nonce-hash design**, not of SHA-256 for passwords.

**Options:**

- **A — Accept with rationale:** retain `randomBytes(32)`, SHA-256, ten-minute TTL, atomic single-use consumption, fail-closed handling, and the existing tests. No code change.
- **B — Remediate:** keyed HMAC-SHA-256 or another approved design. Requires a secret source/lifecycle, rotation, fail-closed behavior, and an in-flight-state decision. Not approved by this handoff. Password-grade KDFs are **not** recommended.

**Evidence already available:** `services/identity/__tests__/OAuthState.test.ts` (entropy, determinism, non-reuse, single-use replay, unissued state, expiry, store selection); `services/identity/__tests__/AuthService.test.ts` (missing state, unissued state, replayed state, store-error fail-closed).

**Approval evidence required:** written decision naming alert #51, the rule, the chosen option, rationale, authorized owner, date, and re-evaluation date where applicable. An authorized alert dismissal may follow only after that record exists.

---

## 4. Finding #39 — what is stored and why the two paths differ

**Exact payload:** `sessionStorage['vedmoulya-oauth-pending']` contains only:

```json
{ "state": "<server-minted base64url nonce>", "next": "<redirect path>" }
```

It does **not** contain access tokens, refresh tokens, passwords, authorization codes, or client secrets.

**Path 1 — client `beginGoogleSignIn()`:**

- Writes `{state, next}` at `session-manager.ts:355-357` before the full-page redirect.
- Reads it at `session-manager.ts:384`, deletes it at `session-manager.ts:390`, compares `pending.state !== state` at `session-manager.ts:395-397`.
- On success, sends code + state to the server; the server performs the authoritative check.

**Path 2 — server-rendered browser-navigation callback:**

- `AuthRoutes.ts:303-314` returns inline HTML for `Accept: text/html`.
- It writes the **same key** at `AuthRoutes.ts:307-308` as `{state, next:'/'}`.
- It then calls the JSON callback directly, writes the returned session tokens to `localStorage` under `vedmoulya-auth` (`AuthRoutes.ts:315-325`), and redirects to `/`.
- It does **not** call `completeGoogleSignIn()`, does **not** perform the client-side comparison, and discards `next`.

**Callback-contract inconsistency:** the two paths share a storage key but behave differently. Path 1 uses `/oauth2redirect` + `completeGoogleSignIn()` and honors `next`; Path 2 bypasses that page and persists tokens directly. Any remediation must align both paths and preserve redirect behavior. This inconsistency is a design constraint, not something to patch silently.

**Server authority:** the server mints the state, stores only its SHA-256 digest, and verifies it by atomic single-use consumption with a ten-minute TTL. The client comparison is defence in depth; the server check is the control.

**XSS / same-origin exposure:** any script in the origin can read the tab's `sessionStorage`. The stored value is a CSRF nonce and a path, not a credential. The state alone cannot complete sign-in without the authorization code. `sessionStorage` is tab-scoped and is cleared on callback/logout. **PKCE is not implemented** in this flow; code interception is a separate residual risk.

**Options:**

- **A — Accept with rationale:** accept the non-credential, tab-scoped payload. Conditions: keep the schema limited to `{state,next}`, never add tokens, retain server-side single-use verification, keep removal on callback/logout, and keep both write paths consistent.
- **B — Remediate:** an approved design covering **both** write paths, callback compatibility, redirect handling, and regression tests. Candidate designs include removing client-side `state` storage and relying on server verification (keeping only `next`), an opaque pending handle resolved server-side, or an HttpOnly/SameSite cookie. None is approved by this handoff. Removing the client-side comparison or changing the callback contract without an approved design is out of scope.

**Evidence already available:** `apps/web/src/auth/__tests__/session-manager.test.ts` (begin/complete flow, state mismatch, removal, logout); `services/identity/__tests__/AuthRoutes.test.ts` and `AuthRoutesExtended.test.ts` (state forwarding, missing-state fail-closed, HTML callback behavior).

**Approval evidence required:** written decision naming alert #39, the rule, the chosen option, rationale or approved remediation scope, authorized owner(s), date, and re-evaluation date where applicable. Web Architecture review is required for either option.

---

## 5. Suggested reply format (for the authorized owners)

```text
Finding: #51 js/insufficient-password-hash
Decision: ACCEPT WITH RATIONALE | REMEDIATE
Owner: <name/role>
Date: <YYYY-MM-DD>
Rationale / approved remediation scope: <text>
Re-evaluation date: <YYYY-MM-DD or N/A>

Finding: #39 js/clear-text-storage-of-sensitive-data
Decision: ACCEPT WITH RATIONALE | REMEDIATE
Owner: <name/role>
Web Architecture reviewer: <name/role>
Date: <YYYY-MM-DD>
Rationale / approved remediation scope: <text>
Re-evaluation date: <YYYY-MM-DD or N/A>
```

A reply that does not identify the finding, the option, the authorized owner, and the date is not a valid decision.

---

## 6. What happens after a decision

| Decision                  | Next action                                                                                                                                                                                                         |
| :------------------------ | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **ACCEPT WITH RATIONALE** | Record the signed decision in `SECURITY-DISPOSITION-RECORDS-51-39.md`; then, and only then, process the authorized alert disposition. Publication still requires `PUSH-AUTH-REF` and remote CI/CodeQL verification. |
| **REMEDIATE**             | Treat the approved scope as a separate implementation task. No code change is authorized by this handoff; the scope, tests, and review must be agreed first.                                                        |

**No source-code remediation, alert dismissal, suppression, or publication occurs under the current status.**

---

## 7. Current evidence and boundaries

| Item                       | Value                                                                                |
| :------------------------- | :----------------------------------------------------------------------------------- |
| HEAD                       | `347164edd2d76d87589db71bc3d1bec83a302cc8`                                           |
| `origin/main`              | `08731d2287762299479ac8be738aa0089c433ce0`                                           |
| Open CodeQL alerts         | 43 total; #51 and #39 open                                                           |
| Targeted tests             | 39/39 passed at the current SHA (Phase 6.1; source unchanged)                        |
| Remote CI for HEAD         | **NOT RUN**                                                                          |
| Security decision recorded | **None**                                                                             |
| Approver identities        | **None documented** — roles only; no signature or name exists anywhere in the record |
| Document status            | **Untracked** working-tree addition (not committed); **not sent externally**         |
| `SEC-SIGN-OFF`             | **PENDING** for both findings                                                        |
| `PUSH-AUTH-REF`            | **PENDING**                                                                          |

**Boundaries:** this handoff is not an approval, not a dismissal, and not a remediation authorization. It has not been sent externally. No source, infrastructure, secret, database, deployment, or repository state was changed to produce it.

---

## 8. Attachments / references

- `docs/audits/2026-10-16-s14-rc-closure/SECURITY-DISPOSITION-RECORDS-51-39.md` — full unsigned decision records.
- `services/identity/src/auth/OAuthState.ts` — nonce minting and SHA-256 digest.
- `services/identity/src/auth/AuthService.ts` — begin/callback state verification.
- `services/identity/src/infrastructure/persistence/OAuthStateStore.ts` — persistence and atomic consumption.
- `apps/web/src/auth/session-manager.ts` — client pending-state write/read/remove/compare.
- `services/identity/src/auth/AuthRoutes.ts` — server-rendered browser callback (second write path).
