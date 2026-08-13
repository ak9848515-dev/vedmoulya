# EPIC-018 — AI World Scheduler: Scheduler Policy

**Status:** IMPLEMENTED (2026-08-11)

This document defines every default policy the scheduler enforces. All values are
**defaults, not immutable hardcodes** — frequencies are per-user settings editable
from the `/ai-world` Discovery Activity section, and run limits/budgets live on the
per-job policy so they can later be configured by policy/user settings.

## 1. Default job categories & cadence (Phase 2)

| Category                   | Default frequency | Item categories       |
| -------------------------- | ----------------- | --------------------- |
| CRITICAL_PROVIDER_CHANGE   | **Every 6 hours** | provider, model       |
| PROVIDER_MODEL_DISCOVERY   | Daily             | provider, model       |
| GITHUB_DISCOVERY           | Daily             | github                |
| FREE_AI_RESOURCE_DISCOVERY | Daily             | provider, application |
| LOCAL_MODEL_DISCOVERY      | Daily             | model, application    |
| AI_NEWS_DISCOVERY          | Daily             | news                  |
| ECOSYSTEM_DEEP_SCAN        | **Weekly**        | all                   |

## 2. Bounded run limits (Phase 3) — mapped 1:1 onto LoopBudget

Every scheduled run is bounded BEFORE the next call (fail-closed):

| Limit                       | LoopBudget slot    | Baseline               |
| --------------------------- | ------------------ | ---------------------- |
| Max runtime                 | `maxLatencyMs`     | 60 s (deep scan 120 s) |
| Max discovery calls per run | `maxIterations`    | 2 (deep scan 3)        |
| Max source calls per run    | `maxProviderCalls` | 8 (deep scan 12)       |
| Max tokens                  | `maxTokens`        | 20 000                 |
| Max cost USD                | `maxCostUsd`       | $0.05                  |

Discovery budgets reuse the frozen `DiscoveryBudget` shape (maxItemsPerSource /
maxItemsPerRun / maxSourcesPerRun / maxStoredItems).

## 3. Retry & failure backoff (Phase 3/4)

- `maxRetries`: 1 (deep scan 2) — retries stay within the run's discovery-call
  budget, so retries can never become infinite.
- Failure backoff: `nextEligible = now + min(baseBackoffMs · 2^(failures-1), maxBackoffMs)`
  with base 60 s, cap 15 min — applied **between runs**; a successful run clears it.
- `consecutiveFailures` is tracked per source and per job.

## 4. Source policy gate (Phase 4)

```
Source → Enabled? → Cooldown expired? → Backoff expired? →
Rate limit available? (1 h window, max 20 calls/source) →
Budget available? (cumulative $0.10 cap/source) →
Security policy satisfied? (EPIC-012C SecurityScanner inside discovery) → Run
```

**Failure isolation:** a gated or failed source NEVER prevents other sources from
running — eligibility is evaluated per source and the run continues with whatever
is eligible.

## 5. Concurrency, duplication, cancellation (Phase 3)

- **Concurrent-run prevention:** `job.inFlight` — a second run is skipped
  `CONCURRENT_RUN_IN_PROGRESS`.
- **Duplicate-run prevention:** a non-manual run whose `nextRunAt` is in the future
  is skipped `NOT_DUE`.
- **Cancellation:** `cancelRun` sets `cancelRequested`; the run loop observes it
  through the store at every discovery boundary and finishes `CANCELLED`. A queued
  cancelled job runs as `CANCELLED`. `cancelRun` on a non-running job returns
  `NOT_RUNNING` honestly.
- **Bounded ledger:** run history is append-only, FIFO-capped at 50 runs per user.

## 6. Notification policy (Phase 8)

- Notify ONLY meaningful changes (`NEW`/`UPDATED`/`REMOVED`/`CRITICAL_CHANGE`)
  that the intelligence layer marks relevant.
- Item-level cooldown: a new item notifies once; an update re-notifies only after
  the window (default 24 h; 6 h for critical; 7 d for deep scan).
- `NO_CHANGE` runs never notify. Dropped notifications are counted, never retried.

## 7. Manual vs scheduled parity (Phase 12)

`Run now` is a manual flag on the SAME `runJob` path. It bypasses only the "not
due" guard; budgets, source policies, rate limits, cooldowns, security, dedup and
store are identical. There is no privileged manual shortcut.
