# Provider Usage & Billing Ingestion

**Status:** implemented (job) · provider-reported account metrics partial (see matrix below)
**Owner:** Platform / Ops
**Run:** `npm run provider:usage:ingest` (operator CLI, designed for a cron schedule)

## Purpose

The AI Providers UI must never mistake a **platform/provider-health percentage** for a
user's **personal free-tier or account balance**. This job probes the real usage/billing
endpoint of each configured provider account and writes the honest result into the
**same registry health snapshot** the UI reads. It writes two DISTINCT kinds of data:

1. **Bounded quota** (`quotaUsedPercent` via `recordHealthSample`) — only when the provider
   reports a real bounded quota (OpenRouter credit limit).
2. **Account metrics** (`health.accountUsage`, verbatim) — genuine provider-reported account
   tokens / cost / credits, each with provider, metric, source, retrieval timestamp and the
   applicable window. Kept separate from quota, from runtime tokens, and from VedMoulya's
   estimated cost.

When a provider does not expose a value, nothing is written and the UI keeps its honest
"Unavailable from provider" state — it never fabricates a number.

## Honesty contract (non-negotiable)

1. **A quota percentage is written ONLY when the provider reports a real bounded quota**
   (OpenRouter finite credit `limit` > 0; OpenAI/Anthropic expose usage/cost but no bounded quota).
2. **Prepaid-balance-only providers** (DeepSeek) are recorded as a plain "checked"
   sample — `quotaUsedPercent` stays untouched. A balance is never converted into a
   percentage.
3. **Providers without a usage/billing endpoint** (Gemini API keys) are never probed —
   reported as `NO_PROBE`. OpenAI/Anthropic expose admin usage/cost APIs (persisted as
   account metrics, not a quota).
4. **Probe failures** (401/403/5xx/network) are reported and never written as health
   failures: a usage probe is not a model call and must not degrade provider health.
5. **Secrets never leave the server**: only `Authorization: Bearer` headers are sent;
   only non-secret summaries are logged/reported.

## What the backend can know today (per provider)

| Provider (family) | Usage                                                                       | Quota                                                                         | Remaining quota | Rate limit    | Reset time          | Free tier                              |
| ----------------- | --------------------------------------------------------------------------- | ----------------------------------------------------------------------------- | --------------- | ------------- | ------------------- | -------------------------------------- |
| OpenAI            | **account tokens + cost** (admin org usage/costs APIs) + per-user measured¹ | none from this job (bounded quota via org admin APIs)                         | **unavailable** | headers only² | not exposed         | not exposed                            |
| Google (Gemini)   | per-user measured executions¹                                               | none (no API for API keys)                                                    | **unavailable** | headers only² | not exposed         | not exposed                            |
| DeepSeek          | per-user measured executions¹                                               | none (prepaid balance)                                                        | **unavailable** | headers only² | not exposed         | flag only (no API key balance tiers)   |
| Anthropic         | **account tokens + cost** (admin usage/cost reports) + per-user measured¹   | none (usage/cost only, no bounded quota)                                      | **unavailable** | headers only² | not exposed         | not exposed                            |
| OpenRouter        | per-user measured executions¹                                               | **real — credit limit when finite** (probe implemented, needs env key wiring) | real % (job)    | headers only² | `limit_reset` (key) | `is_free_tier` flag from `/api/v1/key` |
| Ollama (local)    | —                                                                           | none (unmetered)                                                              | n/a             | n/a           | n/a                 | n/a                                    |
| Mock (dev/test)   | —                                                                           | none (unmetered)                                                              | n/a             | n/a           | n/a                 | n/a                                    |

¹ The platform **measures its own per-user executions** through the CostLedger (ai trace
spans: tokens, calls, cost per provider per user) — surfaced in the AI Usage & Economics
detail view. This is platform-measured usage **for this user**, not the provider account's
total.

² Rate-limit _headers_ (`x-ratelimit-remaining-*` / `anthropic-ratelimit-*`) are returned
per generation request. They are **not** captured today; capturing them at execution time
(not from billing endpoints, which have their own limits) is the next increment — see
below.

## Endpoints probed by the job

| Family     | Endpoint                                                                                         | What it returns                                                                                                                                                                     | When a percentage is written                                                                      |
| ---------- | ------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| OpenAI     | `GET /v1/dashboard/billing/subscription` + `GET /v1/dashboard/billing/usage?start_date&end_date` | `hard_limit_usd`, `access_until`, `total_usage` (cents)                                                                                                                             | `hard_limit_usd > 0` and subscription active → `usage/hard_limit` percent                         |
| DeepSeek   | `GET /user/balance`                                                                              | `is_available`, `balance_infos[]` (currency, totals)                                                                                                                                | never (prepaid balance, no ceiling) — "checked" only                                              |
| OpenRouter | `GET /api/v1/key`                                                                                | `label`, `limit` (null = unlimited), `limit_remaining`, `limit_reset`, `usage` (cumulative, all-time), `usage_daily/weekly/monthly` (provider-computed UTC periods), `is_free_tier` | `limit` finite & > 0 → `usage/limit` percent; `limit == null` or absent ⇒ no ceiling (no percent) |

Caveats worth knowing:

- OpenAI's legacy `dashboard/billing` endpoints require a **user-scoped** key and are
  **deprecated**; org/admin keys return 401/403 there. The official replacements are the
  admin-scoped **organization usage** (`/v1/organization/usage/completions`) and **costs**
  (`/v1/organization/costs`) APIs, which the OpenAI Organization Usage panel reads. Those
  report token usage and spend by model, not a bounded remaining quota.
- Gemini (Developer) API keys have **no public usage/billing endpoint** — usage lives in
  the AI Studio console. Real Gemini quota requires the **Vertex AI** stack (GCP billing +
  service-account scopes), which is a larger integration decision.
- Anthropic **does** expose an official **Usage & Cost Admin API**
  (`/v1/organizations/usage_report/messages` and `/v1/organizations/cost_report`) — an
  admin-scoped key reports historical token usage and USD cost. It reports usage/cost, not a
  bounded remaining quota, and is not readable by a standard `sk-ant-…` API key, so this
  ingestor reports Anthropic as `NO_PROBE` with that exact reason rather than claiming the
  provider exposes nothing.
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

## Account metrics (SPRINT 013) — provider-reported usage/cost

The job additionally retrieves **genuine account usage/cost** from the official admin-scoped
APIs and persists each response verbatim into `provider_registry.health.accountUsage`,
keyed by metric. These are **distinct** from the bounded quota, from VedMoulya's runtime
tokens, and from VedMoulya's estimated cost — they are never converted into each other.

| Metric               | Meaning                                                                         | Source (family)                                                                                          | Unit    | Window                      |
| -------------------- | ------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | ------- | --------------------------- |
| `ACCOUNT_TOKENS`     | Tokens the provider reports the account consumed                                | OpenAI `GET /v1/organization/usage/completions`; Anthropic `GET /v1/organizations/usage_report/messages` | tokens  | UTC month (bucketed by day) |
| `ACCOUNT_COST`       | USD the provider reports the account spent                                      | OpenAI `GET /v1/organization/costs`; Anthropic `GET /v1/organizations/cost_report`                       | usd     | UTC month (bucketed by day) |
| `ACCOUNT_CREDITS`    | **KEY-level** remaining credit cap (`limit_remaining`), NOT the account balance | OpenRouter `GET /api/v1/key` (`limit_remaining`)                                                         | usd     | point-in-time               |
| `BOUNDED_QUOTA_USED` | Bounded quota consumed 0–100%                                                   | OpenRouter `GET /api/v1/key` (finite `limit` > 0)                                                        | percent | point-in-time               |

Each persisted metric records: `provider`, `metric`, `source`, `retrievedAt` (ISO),
`window` (`startEpochSec`/`endEpochSec`, absent for point-in-time), `value`, `unit`, an
optional provider-reported `breakdown` (e.g. OpenRouter `usage_daily/weekly/monthly`), and
`unlimited` (when the provider explicitly reports no ceiling, e.g. OpenRouter `limit === null`).
Absence of a metric means "never retrieved" and renders as **"Unavailable from provider"** —
never zero. `ACCOUNT_CREDITS` from OpenRouter is the **key's** remaining credit cap
(`limit_remaining`), explicitly **not** the account's total balance.

`usage` is the **cumulative all-time** credit figure and is stored as the `ACCOUNT_COST` metric
value; `usage_daily` / `usage_weekly` / `usage_monthly` are the provider's own UTC-window
computations and are preserved **only** in the metric `breakdown` (keyed by their official field
names), so cumulative and period usage are never conflated or relabelled. `is_free_tier`
reports whether the account has ever paid for credits — it is **never** read as zero usage,
unlimited usage, or a guaranteed zero-cost account. A malformed or **negative** credit figure is
treated as **absent** (never coerced to `0`); `limit`/`limit_remaining` that are `null` or absent
are **UNKNOWN**, and no remaining credit, available quota, or percentage is ever inferred from
them.

### Idempotency

Ingestion is idempotent at the registry: `recordHealthSample` keeps **one slot per metric**
and refuses to overwrite a stored metric with an **older** `retrievedAt`. A replayed or
out-of-order pass therefore cannot inflate a value, duplicate it, or corrupt a newer
reading. `event_id` idempotency in the runtime usage ledger (`ai_usage_events`, `ON CONFLICT
DO NOTHING`) is the separate, already-existing guarantee for runtime tokens.

### Authorization & scopes required (operator)

- **OpenAI** organization usage/costs: an **Organization admin-scope** API key. Project/user
  keys return 401/403 and are reported honestly (`PROBE_FAILED`); nothing is written.
- **Anthropic** usage/cost reports: an **Admin API key**, sent as `x-api-key` (a standard
  `sk-ant-…` key is refused). Header `anthropic-version` is required.
- **OpenRouter** `GET /api/v1/key`: the connector key itself (read-only key/credits read;
  `limit === null` ⇒ unlimited, so no percentage is derived).
- **Gemini**: no API-key usage endpoint exists — quota stays "Unavailable from provider".

### What is NOT done here

- No model-generation requests are ever made by this job; it only reads usage/billing/limits
  endpoints.
- No quota or remaining-token figure is ever derived from account spending.
- No secret is logged; only boolean scope/status outcomes are reported.
