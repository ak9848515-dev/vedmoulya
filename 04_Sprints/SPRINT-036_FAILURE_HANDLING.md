# SPRINT-036 — FAILURE HANDLING & RETRY POLICY

## Deterministic bounded response table

`decideRetryPolicy` (`MultiProviderOrchestrator.ts`) decides, at plan time, the
bounded response to every failure mode. It is a **pure decision table** — no
engine, no I/O — enforced at execution time by the existing bridge's bounded
retry loop and the existing CostPolicyGuard.

| Failure mode              | Response                               | Why                                            |
| ------------------------- | -------------------------------------- | ---------------------------------------------- |
| POLICY_REJECTION          | STOP                                   | a policy denial is never retried               |
| COST_REJECTION            | STOP                                   | the existing authority said no                 |
| MALFORMED_RESPONSE        | STOP                                   | a malformed permanent request is never retried |
| INVALID_JSON              | STOP                                   | permanent request defect                       |
| VERIFICATION_DISAGREEMENT | NEEDS_REVIEW                           | never auto-resolved by price                   |
| QUOTA_EXHAUSTED           | FALLBACK (privacy-safe) or STOP        | a retry cannot restore quota                   |
| TIMEOUT                   | RETRY (≤ maxRetries) → FALLBACK → STOP | transient; bounded                             |
| RATE_LIMIT                | RETRY (≤ maxRetries) → FALLBACK → STOP | transient; bounded                             |
| PROVIDER_UNAVAILABLE      | RETRY (≤ maxRetries) → FALLBACK → STOP | transient; bounded                             |
| PROVIDER_ERROR            | RETRY (≤ maxRetries) → FALLBACK → STOP | transient; bounded                             |
| NETWORK_FAILURE           | RETRY (≤ maxRetries) → FALLBACK → STOP | transient; bounded                             |

## Retry rules (frozen discipline)

- bounded: `maxRetries` defaults 2, hard cap 3 per step — **no infinite retry**;
- idempotent: the plan is stable-keyed; re-planning upserts, never duplicates;
- observable: every decision carries its reason; the benchmark records retry /
  fallback / cost / latency per step.

## Fallback rules (privacy absolute)

- A PRIVATE/SENSITIVE step falls back ONLY to a privacy-safe candidate
  (PRIVATE class or local availability) — with no safe candidate the honest
  decision is **STOP** (`fallbackBlockedReason: 'privacy'`); never a silent
  drop to a public cloud provider.
- A fallback that would exceed the workflow cost bound is blocked
  (`cost bound`).
- The plan exposes the first privacy-safe fallback candidate
  (`fallbackProviderId`) so WHICH provider may replace a failed one is
  explicit and auditable.

## Scenario proof (deterministic)

`provider:benchmark` 11/11 — timeout → 2 bounded retries + 1 fallback; quota →
immediate fallback (0 retries); malformed → STOP after 1 attempt; verification
disagreement → NEEDS_REVIEW; PRIVATE + no local → honest NO_SELECTION.
