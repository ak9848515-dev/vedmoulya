# Provider Usage & Billing Ingestion

**Status:** implemented (job) · per-provider coverage partial (see matrix below)
**Owner:** Platform / Ops
**Run:** `npm run provider:usage:ingest` (operator CLI, designed for a cron schedule)

## Purpose

The AI Providers UI must never mistake a **platform/provider-health percentage** for a
user's **personal free-tier or account balance**. This job closes that gap where the
providers actually expose account data: it probes the real usage/billing endpoint of each
configured provider account and writes the honest result into the **same registry health
snapshot** the UI reads (`quotaUsedPercent` via `ProviderApplicationService.recordHealthSample`).

When a provider does not expose a real bounded quota, the job says so — it never
fabricates a number, and the UI keeps showing the honest "Provider usage / Usage
unavailable" states.

## Honesty contract (non-negotiable)

1. **A quota percentage is written ONLY when the provider reports a real bounded quota**
   (OpenAI hard USD limit, OpenRouter credit limit ≥ 0).
2. **Prepaid-balance-only providers** (DeepSeek) are recorded as a plain "checked"
   sample — `quotaUsedPercent` stays untouched. A balance is never converted into a
   percentage.
3. **Providers without a usage/billing endpoint** (Gemini API keys, Anthropic) are never
   probed — reported as `NO_PROBE`.
4. **Probe failures** (401/403/5xx/network) are reported and never written as health
   failures: a usage probe is not a model call and must not degrade provider health.
5. **Secrets never leave the server**: only `Authorization: Bearer` headers are sent;
   only non-secret summaries are logged/reported.

## What the backend can know today (per provider)

| Provider (family) | Usage                         | Quota                                                                      | Remaining quota | Rate limit    | Reset time  | Free tier                            |
| ----------------- | ----------------------------- | -------------------------------------------------------------------------- | --------------- | ------------- | ----------- | ------------------------------------ |
| OpenAI            | per-user measured executions¹ | **real — dashboard billing hard USD limit** (job)                          | real % (job)    | headers only² | not exposed | not exposed                          |
| Google (Gemini)   | per-user measured executions¹ | none (no API for API keys)                                                 | **unavailable** | headers only² | not exposed | not exposed                          |
| DeepSeek          | per-user measured executions¹ | none (prepaid balance)                                                     | **unavailable** | headers only² | not exposed | flag only (no API key balance tiers) |
| Anthropic         | per-user measured executions¹ | none                                                                       | **unavailable** | headers only² | not exposed | not exposed                          |
| OpenRouter        | per-user measured executions¹ | **real — credit limit when ≥ 0** (probe implemented, needs env key wiring) | real % (job)    | headers only² | not exposed | `is_free_tier` flag from `/auth/key` |
| Ollama (local)    | —                             | none (unmetered)                                                           | n/a             | n/a           | n/a         | n/a                                  |
| Mock (dev/test)   | —                             | none (unmetered)                                                           | n/a             | n/a           | n/a         | n/a                                  |

¹ The platform **measures its own per-user executions** through the CostLedger (ai trace
spans: tokens, calls, cost per provider per user) — surfaced in the AI Usage & Economics
detail view. This is platform-measured usage **for this user**, not the provider account's
total.

² Rate-limit _headers_ (`x-ratelimit-remaining-*` / `anthropic-ratelimit-*`) are returned
per generation request. They are **not** captured today; capturing them at execution time
(not from billing endpoints, which have their own limits) is the next increment — see
below.

## Endpoints probed by the job

| Family     | Endpoint                                                                                         | What it returns                                         | When a percentage is written                                              |
| ---------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------- | ------------------------------------------------------------------------- |
| OpenAI     | `GET /v1/dashboard/billing/subscription` + `GET /v1/dashboard/billing/usage?start_date&end_date` | `hard_limit_usd`, `access_until`, `total_usage` (cents) | `hard_limit_usd > 0` and subscription active → `usage/hard_limit` percent |
| DeepSeek   | `GET /user/balance`                                                                              | `is_available`, `balance_infos[]` (currency, totals)    | never (prepaid balance, no ceiling) — "checked" only                      |
| OpenRouter | `GET /api/v1/auth/key`                                                                           | `usage`, `limit` (-1 = unlimited), `is_free_tier`       | `limit >= 0` → `usage/limit` percent                                      |

Caveats worth knowing:

- OpenAI's `dashboard/billing` endpoints require a **user-scoped** key; org/admin keys
  return 401/403, which the job reports as `PROBE_FAILED` with that explanation. The
  official **organization usage API** (`/v1/organization/usage/completions`, admin scope,
  29/90-day retention) reports _token usage by model_, not quota — it is a candidate for a
  "your measured usage" surfacing, not for remaining quota.
- Gemini (Developer) API keys have **no public usage/billing endpoint** — usage lives in
  the AI Studio console. Real Gemini quota requires the **Vertex AI** stack (GCP billing +
  service-account scopes), which is a larger integration decision.
- Anthropic has **no official account usage API**; only per-response rate-limit headers.
- "Reset time" is never available from these endpoints — the UI keeps its honest
  "reset information unavailable" stance. (OpenAI's `access_until` marks the subscription
  renewal, not a token-quota reset, so it is not used as a reset time.)

## Writing samples

The job writes through `ProviderApplicationService.recordHealthSample`, which persists to
the same registry repository the gateway reads:

- dev/test (`NODE_ENV` unset or `development`/`test`): the registry factory returns its
  deterministic **in-memory** seed — a run in one process does not change what another
  process sees. Use for local exercise only.
- **production/staging**: Postgres-backed registry → samples persist and immediately feed
  the AI Providers UI's `quotaUsedPercent` (labelled "Provider usage · X% remaining").

## Scheduling

Run on a conservative schedule (e.g. hourly/daily) via cron or the CI scheduler. Do **not**
poll aggressively: billing endpoints have their own rate limits and are not latency
critical. A single provider's failure never aborts the run — the report lists per-provider
outcomes (`QUOTA_WRITTEN` / `CHECKED_WRITTEN` / `NO_PROBE` / `NOT_CONFIGURED` /
`PROBE_FAILED`).

## Future capability roadmap (what a real "account quota" needs)

1. **Rate-limit header capture at execution time** — wrap generation calls to parse
   `x-ratelimit-remaining-requests` / `x-ratelimit-reset-*` (OpenAI) and
   `anthropic-ratelimit-*` headers and write `rateLimitRemaining`/`rateLimitResetAt`
   health samples. Real per-key rate-limit data with no extra API calls.
2. **OpenAI organization usage endpoint** — surface measured token usage per model over
   Today/This-week/This-month (it genuinely supports those granularities) when the key has
   org-admin scope; keep the "View details" view as the home for per-user measured usage.
3. **Gemini via Vertex AI** — if the platform moves Gemini credentials to a GCP service
   account, wire Cloud Billing/usage APIs; otherwise Gemini quota remains "Usage
   unavailable" (honest default).
4. **Per-user entitlements (product-level)** — providers cannot meter sub-accounts of one
   API key. A "each user gets X free tokens" product quota is a **local** ledger feature
   built on the existing CostLedger + budget preferences, not a provider API call.
5. **UI surfacing** — the widget already labels all percentages as provider-level. When a
   source becomes _user-scoped_ (item 2/4), the label can switch to "Your usage" with a
   provenance field; the Today/Week/Month selector may appear only for providers whose
   data supports those periods.
