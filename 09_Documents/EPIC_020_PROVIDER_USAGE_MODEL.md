# EPIC-020 — Provider Usage & Token/Cost/Quota Model

**Mission §3 — never fabricate provider limits · 2026-08-12**

## 1. Evidence vocabulary

Every provider limit is one of:

| Status      | Meaning                                                  |
| ----------- | -------------------------------------------------------- |
| `KNOWN`     | Evidence-backed fact (adapter/registry/health telemetry) |
| `UNKNOWN`   | No evidence — absent, never guessed                      |
| `ESTIMATED` | Evidence-derived estimate, flagged as such               |

**Provider adapters supply evidence; the Brain never hardcodes provider facts.**

## 2. `ProviderUsageFact` (per provider)

- `contextWindow` (tokens) · `inputTokenUsage` · `outputTokenUsage`
- `remainingQuota` (0 = exhausted, only when the provider exposes it)
- `rateLimit` ({limit, period}) · `estimatedCostUsd` · `freeTierStatus` (free / free_with_quota / paid / local / unknown)
- `dailyUsage` · `monthlyUsage` · `availability` (0..1) · `latencyMs` · `failureRate` (0..1)
- Every field is `UsageDatum<T> = { value, status: KNOWN|UNKNOWN|ESTIMATED }`.

## 3. Ports & derivation

- **`BrainUsagePort.usageFacts(userId, providerIds)`** — the gateway adapter derives REAL facts from the frozen `ProviderExperienceService` view model: availability + latency (KNOWN), free-tier status (KNOWN). Quota/rate-limit/context-window stay UNKNOWN unless a provider adapter supplies them.
- **`UsageIntelligence.deriveFactsFromCandidates`** — registry-backed facts from `ProviderCandidateFact`: `estimatedCostUsd` → ESTIMATED (only when the registry declares it), `costTier` → freeTierStatus KNOWN, `availability` → KNOWN. Never invents quota/rate limits.

## 4. Budget estimation (evidence-gated)

- `estimateTotalCost(facts)` — sums KNOWN/ESTIMATED per-provider cost; returns **undefined when no evidence exists** (UNKNOWN stays UNKNOWN — the budget gate then passes and the Brain records the estimate as absent rather than fabricating one).
- `BrainApplicationService.selectResources` now sets `task.budget.estimatedCostUsd/estimatedTokens` from this evidence instead of hardcoded values.
- `BrainBudgetGuard.estimate`/`checkBefore`/`checkDuring` remain the fail-closed execution gate.

## 5. Quota intelligence

- `quotaExhausted(facts)` — true **only** when `remainingQuota` is KNOWN and ≤ 0.
- Failure classification uses this: a KNOWN-exhausted quota classifies the failure `QUOTA_EXHAUSTED` → the Brain fails over to another free provider.

## 6. Adaptive provider performance evidence (mission §4)

`AdaptiveScoreLedger` (implements `BrainExperiencePort`):

- TASK TYPE (capability) × PROVIDER → recency-weighted quality 0..1.
- Exponential decay (30-day half-life) — **recent evidence matters**.
- `EXPLICIT` user feedback (0.98) outranks `INFERRED` observation — inference is never silently promoted to a permanent preference.
- Failure is a zero sample; success carries measured/provider quality.
- Scores are advisory selection input only — quality-first selection keeps authority.

Verified in the benchmark: scenario 15 (outcome evaluation → recency-weighted score recorded), gateway `providerScores` test (learning → scores surfaced), scenario 11 (ESTIMATED/KNOWN usage evidence attached to assignments).

## 7. Honesty rule

Provider limits are NEVER fabricated. `KNOWN` requires evidence; `UNKNOWN` stays `UNKNOWN`; `ESTIMATED` is always flagged. The Brain records "cost UNKNOWN" rather than inventing a number.
