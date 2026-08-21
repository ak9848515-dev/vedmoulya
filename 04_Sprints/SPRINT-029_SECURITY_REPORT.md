# SPRINT-029 — Security Report

> **Sprint:** SPRINT-029 — Proactive Intelligence & Automation Fabric
> **Date:** 2026-08-13/14
> **Status:** IMPLEMENTED + TESTED (fail-closed posture preserved)

---

## 1. Threat model

| Threat                                            | Mitigation                                                                                                                                                                                                                                                                                                             |
| ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Prompt injection / malicious external content** | External content = DATA, never AUTHORITY. The proactive layer composes the Brain's discovery surface (AI World → opportunities already security-scanned as untrusted input); recommendations are derived from structured records, not free-form prompt text.                                                           |
| **Unauthorized execution**                        | Nothing in this package executes. `accept` refuses class-C; execution requires the existing approval authority + execution bridge.                                                                                                                                                                                     |
| **Privilege escalation / IDOR**                   | Three layers: gateway `standardProcedure` auth + rate limit; central IDOR guard (`input.userId` must equal session user — foreign userId throws "not authorized" before handlers run); owner-scoped stores keyed by `(ownerId, recommendationId)` — Postgres store uses `PRIMARY KEY (owner, key)` at the query level. |
| **Provider compromise**                           | Provider identity is never baked into proactive logic; anything executing goes through the frozen routing with its quality/evidence/budget guards.                                                                                                                                                                     |
| **Cost explosion**                                | Recommendations never spend; budgets remain the frozen `LoopBudget`/`RunBudgetGuard` authorities (env-tunable hard limits, fail-closed).                                                                                                                                                                               |
| **Runaway automation / automation loops**         | Proposals are bounded (≥2 occurrence evidence floor, ≤8 shown, ≤100 stored per owner, stable-key idempotency, never resurrected dismissals); no background driver exists yet (SPRINT-030+ must add bounded cadence with the same discipline).                                                                          |
| **Excessive notifications**                       | Absolute no-spam rule: `hasContent: false` → caller must not notify; no notification engine in this sprint.                                                                                                                                                                                                            |
| **Malicious workflow definitions**                | Workflows are typed records with class A/B/C/D enforced; class D is never proposed; class C requires per-run approval.                                                                                                                                                                                                 |
| **Secrets**                                       | No client-side secrets; proactive stores hold interaction artifacts (recommendations), never credentials; gateway response mapping surfaces only sanitized messages + codes.                                                                                                                                           |

## 2. Fail-closed design points

- Sensitive recommendation → `authorizationRequired: true` → accept is refused with
  `APPROVAL_REQUIRED`; UI disables the accept button.
- Risk level is fail-closed: a sensitive-action recommendation is HIGH unless evidence
  says otherwise.
- Empty action → class D (never automated).
- UNKNOWN stays UNKNOWN: no fabricated evidence, value, cost, revenue or confidence.
- Cross-owner reads are structurally impossible (store keyed by owner; list(userId) only
  returns that owner's rows).

## 3. Owner isolation evidence

- `ProactiveRouter.test.ts`: `list` for a foreign owner returns `[]`; `dismiss` with a
  foreign `userId` **throws** "not authorized" (never a NOT_FOUND envelope that would
  leak existence).
- `InMemoryProactiveStore` + `PostgresProactiveStore` both keyed by owner; `ProactiveStore`
  / `PostgresProactiveStore` test suites verify isolation and idempotent upserts.

## 4. Audit

- All `proactive.*` requests flow through the SPRINT-027 durable owner-scoped
  `AuditLogStore` (set in `ApiApplicationService` via `setAuditStore(persistence.auditLogs)`).
- Recommendation lifecycle (refresh/dismiss/accept) is traceable through the store +
  the recommendation's own `status` transitions.

## 5. No duplicate security authority

- Sensitive-action vocabulary: the frozen Brain `SENSITIVE_ACTIONS` (one vocabulary,
  shared with `VoiceIntentGate` and `BrainPolicyEngine`).
- Irreversibility: the marketplace's `ApprovalEngine` / `AutomationBoundaryEngine`.
- Approval: the existing Brain approval authority.
- The package adds classification + composition only.

## 6. Verification

- Package: ActionClassPolicy 7/7, AutomationDiscovery 7/7, ProactiveIntelligenceService
  22/22 (incl. no-self-authorization), stores 5/5 + 5/5 (Postgres).
- Gateway: 9/9 through the real tRPC pipeline (auth, IDOR, zod, approval refusal).
- Full suite: **8 540 passed | 1 skipped (671 files)**; lint 0; no secrets in the tree
  (working-tree review).
