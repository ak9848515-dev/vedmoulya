# EPIC-012 — Security Audit of Observability & Control Plane

> **Date:** 2026-08-10
> **Status:** IMPLEMENTATION VERIFIED — redaction, owner-scoped telemetry,
> operator authorization, audit trail and failure-safe behavior are
> implemented and test-verified (IDOR refused by construction).

## 1. Audit Scope

Every Phase 14 requirement was verified against the EPIC-012 implementation:

| Requirement                                                  | Status      | Evidence                                                                                                                                                                        |
| ------------------------------------------------------------ | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| No API keys in logs                                          | ✅          | `redactSecrets` on every trace attribute (bridge) + pre-existing runtime redaction; no key material ever becomes an attribute                                                   |
| No secrets in traces                                         | ✅          | string attributes pass `redactSecrets` in `TraceProviderOtelBridge`; span errors carry only `{ code, message }`, never stack traces                                             |
| No cross-user telemetry access                               | ✅          | `TraceStore.list({ userId })` filters by owner; `OpsApplicationService` passes the session userId for non-operators — IDOR refused at the store boundary                        |
| Owner-scoped application telemetry                           | ✅          | application health derives from `factory.list(userId)` (owner-scoped at the engine)                                                                                             |
| Owner-scoped RAG telemetry                                   | ✅          | rag spans carry `userId`; RAG procedures are user-scoped (pre-existing)                                                                                                         |
| Authorization on control-plane actions                       | ✅          | `OperatorGate.requireOperator` — explicit allowlist from `OPS_OPERATOR_IDS`, **empty = deny-all (fail closed)**                                                                 |
| Audit trail for operator actions                             | ✅          | `AuditTrail` records actor/action/target/detail/ok for every control action; `ops.auditLog` requires operator                                                                   |
| Platform reads: ledger/anomalies/traces/failures/diagnostics | ✅          | owner-scoped for non-operators (IDOR at the store boundary); operators see the platform view                                                                                    |
| Platform read: `providerHealth`                              | ✅ (parity) | mirrors the pre-existing authenticated `ai.getAllProviderHealth` — no new exposure beyond what already exists; provider **control** (disable/enable) is strictly operator-gated |
| Sensitive prompt/data redaction                              | ✅          | attributes are engine-authored structured keys; goal truncated to 160 chars on spans; no raw prompts captured                                                                   |
| Retention controls                                           | ✅          | `TraceStore` FIFO 5000 + optional TTL; `AuditTrail` ring 500; `AlertEngine` history ring 200                                                                                    |
| Safe error messages                                          | ✅          | `NotFoundError` for cross-user trace reads (does not reveal existence); incident diagnostics are redacted                                                                       |
| IDOR against telemetry/control APIs                          | ✅          | test-verified: non-operator `getTrace`/`getDiagnostics` on another user's trace → NotFound; non-operator `auditLog`/`evaluateAlerts`/`configureAlertThresholds` → OPS_FORBIDDEN |

## 2. Threat Model

| Attack                                   | Mitigation                                                                     |
| ---------------------------------------- | ------------------------------------------------------------------------------ |
| Cross-user trace read                    | trace store + ops service enforce `userId` scope for non-operators             |
| Cross-user diagnostics                   | same owner gate; NotFound (no existence oracle)                                |
| Control-plane hijack                     | `OperatorGate` deny-by-default; every control action audited                   |
| Provider disable abuse                   | `transitionLifecycle` is operator-gated AND audited                            |
| Secret leakage into traces               | `redactSecrets` on all string attributes; structured errors only               |
| Telemetry as DoS                         | bounded stores, capped queries, `maxOpenSpans` guard, never-throwing telemetry |
| Information disclosure via errors        | span errors carry stable codes + redacted summaries, never stack traces        |
| Alert-spam suppression of real incidents | severity escalation (cost > 2× threshold → critical); alerts are additive      |

## 3. Control-Action Security Properties

Every control action is:

- **Authenticated** — routed through the authenticated tRPC procedure
  (`ctx.userId` from the session).
- **Authorized** — operator-only actions call `operatorGate.requireOperator`
  before any side effect.
- **Audited** — a bounded `AuditRecord` is written on success AND failure.
- **Idempotent where the engine supports it** — factory `resume`, loop
  `cancel`, `transitionLifecycle` are all idempotent at the engine boundary;
  the ops service surfaces their existing guards.
- **Bounded** — control spans carry redacted attributes; failure messages are
  truncated to 300 chars.

## 4. Operator Identification

`OPS_OPERATOR_IDS` (comma-separated user ids). Absent or empty → deny-all.
There is deliberately **no** "any authenticated user is an operator" fallback —
platform-wide reads and all provider/audit controls fail closed.

## 5. Test Coverage

`OpsControlPlane.test.ts` (21 tests) covers: operator vs non-operator read
scoping, cross-user trace NotFound, audit trail ordering, provider disable/
enable authorization, alert evaluation authorization, control-action spans and
audit records. `AlertEngine.test.ts` covers the pure rule logic (threshold
crossing, clamps, no-alert-on-normal, severity escalation). The full gateway
suite (595/595) and the observability wiring E2E remain green.
