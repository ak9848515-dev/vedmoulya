# EPIC-017 — VedMoulya Live Intelligence Bridge: Security Model

**Status:** IMPLEMENTED (2026-08-11)

EPIC-017 adds **no new security engine**. It preserves every existing boundary
(auth, owner scoping, IDOR protection, rate limits, schema validation, token
isolation, fail-closed budgets, approval gates, untrusted-input handling, sandbox
and external-application boundaries, manual hand-off boundaries) and composes
them. Any failed security check blocks automatic execution.

---

## 1. Trust boundaries

```
┌──────────────────────────────────────────────────────────────────────┐
│ Browser (user)                                                       │
│   • sees only owner-scoped data                                      │
│   • never sees tokens / keys / secrets / raw auth codes              │
│   • never sees hidden chain-of-thought                               │
└───────────────┬──────────────────────────────────────────────────────┘
                │ tRPC (authenticated, rate-limited, zod-validated)
┌───────────────▼──────────────────────────────────────────────────────┐
│ Gateway  (liveIntelligence.*)                                        │
│   • central auth middleware + IDOR guard on every procedure          │
│   • standard/heavy rate-limit tiers                                  │
│   • fromServiceResult mapping (never leaks internals)                │
└───────────────┬──────────────────────────────────────────────────────┘
                │ BridgePorts (thin facades — no secrets cross)
┌───────────────▼──────────────────────────────────────────────────────┐
│ Existing services (Brain / Intelligence / Marketplace / Execution /  │
│ AI World)                                                            │
│   • owner-scoped stores (IDOR-safe by construction)                  │
│   • fail-closed budgets (frozen RunBudgetGuard / BrainBudgetGuard)   │
│   • approval gates before any activation/execution                   │
└──────────────────────────────────────────────────────────────────────┘
```

## 2. Authentication & authorization

- **Google auth unchanged.** GitHub remains a separate least-privilege flow —
  Google identity tokens are NEVER reused as GitHub credentials.
- Every `liveIntelligence.*` procedure is owner-scoped: the caller's `userId`
  comes from the session; foreign `loopId`s return `NOT_FOUND` (IDOR refused).
  Verified by `LiveIntelligenceBridgeRouter.test.ts` cross-user refusal and the
  benchmark's owner-scoping scenario.
- Rate limits: standard tier for read/decision procedures, heavy tier for
  hand-off/evaluation (bounded, never unlimited discovery-like work).

## 3. Secret isolation

- Credentials use the existing server-side credential pattern; they never appear
  in UI state, logs, error messages, or AI prompts.
- Bridge ports are typed facades — the request/response shapes contain no
  credential fields.
- GitHub tokens/codes stay in the server-side auth adapter (EPIC-015); provider
  keys never pass through the bridge.
- Logs redact secrets via the existing platform conventions; the benchmark and
  e2e journeys assert no console/page errors that would leak internals.

## 4. Untrusted input handling

### GitHub / open-source candidates (EPIC-015 policy preserved)

A discovered repository is UNTRUSTED INPUT:

- Never auto-clone / auto-install / auto-execute.
- Security + license + activity + relevance review before any recommendation.
- Classified `SECURITY_REVIEW_REQUIRED` until evidence clears it; `approvalRequired`
  is always true for GITHUB_PROJECT / OPEN_SOURCE acquisition classes.
- Repository lifecycle stays: DISCOVERED → SECURITY REVIEW → RELEVANCE → APPROVAL
  → ACQUIRE → SANDBOX → ANALYZE → STORE INTELLIGENCE → OPTIONAL CONFIGURATION.

### External applications

Never assumed API-automatable. Without API evidence + authentication + adapter,
they classify as MANUAL / CONFIGURATION_REQUIRED / UNKNOWN and render as honest
hand-off boundaries (deep-linked to existing configuration surfaces).

### AI World discovery content

Sanitized by the existing `SecurityScanner` (untrusted input); the bridge treats
discovery candidates as evidence candidates only — never as truth.

## 5. Approval gates (never bypassable)

The Bridge recommends; policy decides; the user approves; execution performs.

| Activation                                             | Approval required | Gate                                                    |
| ------------------------------------------------------ | ----------------- | ------------------------------------------------------- |
| Paid purchase / subscription                           | YES               | `BridgeApprovalPolicy` + existing Brain/EPIC-013 policy |
| GitHub / open-source adoption                          | YES               | security + license + user approval                      |
| External application action                            | YES               | never assumed executable                                |
| Write access / private repo access                     | YES               | EPIC-015 GitHub consent                                 |
| Deployment / publishing / sending / sharing / deletion | YES               | existing `SENSITIVE_ACTIONS` vocabulary                 |
| Download / local install                               | YES               | explicit user approval                                  |

- `requestApproval` surfaces the gate; `approve` / `reject` are the ONLY way
  through — the bridge never auto-approves.
- Declining is never task failure: the loop continues with the best available
  configured option (honest PARTIAL/COMPLETED), and the rejection is recorded as
  evidence — never inferred as a permanent preference.

## 6. Fail-closed execution

- Execution delegates to EPIC-014 `ExecutionRunService` with its frozen
  `RunBudgetGuard` (iterations/tokens/cost/latency). Budget exhaustion →
  `BLOCKED` with an explicit reason; no further provider calls.
- `StepVerifier` pre/post contracts make a provider response alone insufficient
  for success — validation failure blocks.
- Manual / configure / external / unavailable steps never execute: the run
  reports honest disposition and the bridge records a hand-off.

## 7. Notification gating

- `BridgeNotificationMapper` + the existing relevance gate decide whether an
  event surfaces in AI World. Low-relevance events are dropped with a reason.
- No notification spam: only materially relevant changes
  (BETTER_MODEL, FREE_QUOTA_CHANGED, PROVIDER_DEGRADED, NEW_GITHUB_PROJECT,
  SECURITY_CHANGE, NEW_LOCAL_MODEL, PRICE_CHANGE, MODEL_DEPRECATED, …) emit.

## 8. Verification evidence

- Benchmark scenario "owner scoping / IDOR": foreign `get` → `NOT_FOUND`,
  foreign `list` → empty, owner `list` → present.
- Benchmark scenario "execution failure is honest": simulated start failure →
  `handoff.success=false` with error — never a fabricated result.
- Benchmark scenario "GitHub candidate stays untrusted": discovery candidate →
  `costClass=GITHUB_PROJECT`, `securityStatus=SECURITY_REVIEW_REQUIRED`,
  `approvalRequired=true`.
- Benchmark scenario "paid capability gated behind approval": loop pauses at
  `AWAITING_APPROVAL` with `approvals=REQUIRED`.
- Gateway router tests assert cross-user IDOR refusal through the real tRPC
  pipeline.
- E2E journey asserts zero page-level JS errors (no leaked internals).
