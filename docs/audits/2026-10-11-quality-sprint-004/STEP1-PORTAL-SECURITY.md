# Step 1 — Portal Security Audit (S-1)

Scope: the client portal exposed by `services/api`. The previous sprint flagged
it as "unrated". This step traces the real call path, classifies every procedure,
and fixes the one confirmed control gap (rate limiting).

## Actual inventory

The mounted portal router (`services/api/src/services/RouterRegistry.ts:5902`)
exposes **10 procedures** — not 14. Each maps 1:1 to a method on
`PortalRouter` (`services/api/src/routers/PortalRouter.ts`) backed by
`ClientOperationsApplicationService` (`packages/services/src/content-agency/…`).

Credential model (verified in source, not inferred): the portal is **not**
JWT-authenticated. The credential is a per-client access token; `resolvePortalSession`
(`ClientOperationsApplicationService.ts:2103`) requires `token.trim().length >= 16`,
looks it up by **SHA-256 hash** (`findPortalAccessByTokenHash`), rejects missing or
**revoked** (`enabled === false`) access, resolves the linked client, and stamps
`lastLoginAt`. Every handler then scopes all reads/writes to the session's
`agencyUserId` + `clientId`.

## Procedure-by-procedure matrix

|   # | Procedure                    | Op       | Auth         | Authorization / ownership check                               | Sensitive?            | Classification | Negative tests                  |
| --: | ---------------------------- | -------- | ------------ | ------------------------------------------------------------- | --------------------- | -------------- | ------------------------------- |
|   1 | `portal.login`               | mutation | portal token | resolves token→session; no resource read                      | session metadata only | **Safe**       | invalid token, revoked token ✅ |
|   2 | `portal.getDashboard`        | query    | portal token | filters projects/content/invoices/notifications by `clientId` | client data           | **Safe**       | (covered by scoping tests)      |
|   3 | `portal.listContent`         | query    | portal token | `content.filter(c => c.clientId === session.clientId)`        | client data           | **Safe**       | scoping ✅                      |
|   4 | `portal.getContent`          | query    | portal token | `item.clientId !== session.clientId → "not found"`            | client data           | **Safe**       | cross-client ✅                 |
|   5 | `portal.approveContent`      | mutation | portal token | ownership check **before** review/transition + agency notify  | state change          | **Safe**       | cross-client ✅ **(new)**       |
|   6 | `portal.rejectContent`       | mutation | portal token | ownership check before mutation                               | state change          | **Safe**       | cross-client ✅ **(new)**       |
|   7 | `portal.commentContent`      | mutation | portal token | ownership check before mutation                               | state change          | **Safe**       | cross-client ✅ **(new)**       |
|   8 | `portal.downloadDeliverable` | query    | portal token | ownership check before export                                 | deliverable data      | **Safe**       | cross-client ✅ **(new)**       |
|   9 | `portal.listInvoices`        | query    | portal token | `invoices.filter(i => i.clientId === session.clientId)`       | financial             | **Safe**       | (scoping)                       |
|  10 | `portal.getInvoice`          | query    | portal token | `invoice.clientId !== session.clientId → "not found"`         | financial             | **Safe**       | cross-client ✅ **(new)**       |

**Authz/ownership result:** every procedure is correctly scoped; no cross-client
(IDOR) defect was found. The missing resource case returns a generic "not found"
(no existence oracle).

## Confirmed defect and fix — S-1 (rate limiting)

**Finding:** all 10 procedures previously used `publicProcedure`, which applies
**only** the request-metrics middleware — i.e. **no rate limiting** in any
environment. (The shared limiter also skips non-production by design.) So
`portal.login` (a token-verification endpoint) and all portal reads/writes were
unbounded. Practical severity is bounded by token entropy (raw tokens are ≥24
random chars, stored SHA-256) but defense-in-depth was absent.

**Root cause of the "unrateable" note in sprint 003:** the shared rate-limit
middleware keys on `ctx.userId`, which is `'anonymous'` for every portal caller —
so applying it would collapse all clients into one bucket. A correct fix needs a
per-client key.

**Fix (narrow, behavior-preserving):**

- Added optional `clientIp?: string` to `TRPCContext` (both definitions) — set in
  `createAuthContext`/`authenticateRequest` from `x-forwarded-for` / `x-real-ip`.
  It is **never** used for auth or ownership.
- Added `createPortalRateLimitMiddleware` + `portalRateLimitKey(clientIp)` in
  `RouterRegistry` and a new `portalProcedure` variant, keyed `portal:<ip>` (or
  `portal:anonymous` when no IP), reusing the existing **standard** tier
  (100/min) — no new threshold invented.
- Switched all 10 portal procedures to `portalProcedure`.
- Same production-only convention as the shared limiter (dev/test unaffected, so
  E2E is not throttled).

**Evidence / tests (new):**

- `router-registry.test.ts` → 5 tests: key derivation; skipped in non-production;
  allow path in production; `TOO_MANY_REQUESTS` in production; key is the client
  IP, not `userId` and not the token.
- `ClientOperationsApplicationService.test.ts` → cross-client denial for
  `getInvoice`, `downloadDeliverable`, `approveContent`, `rejectContent`,
  `commentContent` + no mutation side effects + malformed-token mutation denial.

## Residual items (documented, not invented)

| ID   | Severity | Finding                                                                                                                                   | Disposition                                                                 |
| ---- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| S-1a | P3       | Portal tokens have **no expiry** (`resolvePortalSession` checks only existence + `enabled`)                                               | **Policy question** — needs product decision on token TTL. Not changed.     |
| S-1b | P3       | `downloadDeliverable`/query procedures pass the token in input; with tRPC batch handlers these can appear in the request URL (proxy logs) | Documented; changing query→mutation is an API-contract change. Not changed. |
| S-1  | P2       | Unbounded portal requests                                                                                                                 | **FIXED** (IP-keyed production rate limiting).                              |

## Acceptance

- All 10 portal procedures have an explicit risk classification, evidence and
  disposition. ✅
- Confirmed defect (S-1 rate limiting) fixed with regression tests. ✅
- Unverified/policy items (S-1a expiry, S-1b token-in-URL) remain **open** and
  listed, not claimed as resolved. ✅
