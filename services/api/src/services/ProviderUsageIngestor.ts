/* eslint-disable security/detect-object-injection -- Heuristic rule
   false-positive: every dynamic env/probe access uses key NAMES from the
   closed PROVIDER_RUNTIME_DESCRIPTORS table (packages/core) or the closed
   PROBES registry defined in this file — never attacker-controlled input. */

// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Provider Usage & Billing Ingestor
//
// PURPOSE
//   A periodic operator job that asks each CONFIGURED provider account what it
//   actually reports about usage/quota, and writes the answer into the SAME
//   registry health snapshot the AI Providers UI reads (quotaUsedPercent /
//   rateLimitRemaining / rateLimitResetAt via recordHealthSample).
//
// HONESTY CONTRACT (no fabrication — ever):
//   • A quota percentage is written ONLY when the provider itself reports a
//     real bounded quota (a hard USD limit, a credit allotment ceiling).
//   • Providers that only expose prepaid balances (no ceiling) are recorded as
//     a plain "checked" sample; quotaUsedPercent is left untouched so the UI
//     never shows an invented remaining-percent.
//   • Providers with no usage/billing endpoint reachable by a standard API key
//     are never probed — the entry reports NO_PROBE with the accurate reason
//     (e.g. Gemini API keys have no usage endpoint) and the UI stays truthful.
//   • Probe failures (401/403/5xx/network) are REPORTED but never written as
//     provider-health failures: a usage probe is not a model call, and it must
//     not degrade the provider's health score.
//   • Secrets never leave the server: only Authorization headers are sent;
//     only non-secret summaries are logged/reported.
//
// TODAY'S REAL COVERAGE (documented in docs/api/PROVIDER_USAGE_INGESTION.md)
//   openai     → NO bounded-quota probe here: the legacy dashboard/billing
//                endpoints are deprecated and require a user-scoped key; the
//                official account APIs are now the ADMIN-scoped organization
//                usage/costs endpoints (used by the org-usage panel + costs).
//   deepseek   → /user/balance (prepaid balance — no quota ceiling)
//   openrouter → /api/v1/key credits (bounded only when limit is finite > 0)
//   google     → NO probe (Gemini API keys expose no usage/billing endpoint)
//   anthropic  → NO bounded-quota probe here: Anthropic's official Usage & Cost
//                Admin API (/v1/organizations/usage_report/messages +
//                /v1/organizations/cost_report) reports usage/cost, not a
//                bounded remaining quota, and requires an ADMIN key.
// ─────────────────────────────────────────────────────────────────────────────

import type { ProviderApplicationService, ProviderAccountUsageMetric } from '@vedmoulya/providers';
import { isValueSet, readProviderRuntimeState, toRuntimeMode } from '@vedmoulya/core';

// ── Probe results ───────────────────────────────────────────────────────────

export type AccountProbeStatus = 'QUOTA' | 'CHECKED' | 'UNAVAILABLE';

export interface AccountProbeResult {
  providerId: string;
  family: string;
  probed: boolean;
  ok: boolean;
  /** Set ONLY when the provider reported a real bounded quota (0–100). */
  quotaUsedPercent?: number;
  /**
   * GENUINE provider-reported account metrics (tokens/cost/credits), verbatim
   * from the response. Persisted as-is; never derived from each other and never
   * conflated with VedMoulya's own runtime tokens or estimated cost.
   */
  accountUsage?: ProviderAccountUsageMetric[];
  detail: string;
  error?: string;
}

export interface HttpProbeResponse {
  ok: boolean;
  status: number;
  json: unknown;
  networkError?: string;
}

/** Minimal fetch surface the probes use (input URL + init). */
type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

/** GET a JSON endpoint with a Bearer key. Never logs the key or the body. */
async function getJson(
  fetchImpl: FetchLike,
  url: string,
  apiKey: string,
): Promise<HttpProbeResponse> {
  let response: Response;
  try {
    response = await fetchImpl(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    return {
      ok: false,
      status: 0,
      json: null,
      networkError: error instanceof Error ? error.message : 'network error',
    };
  }
  let text: string;
  try {
    text = await response.text();
  } catch {
    return { ok: false, status: response.status, json: null };
  }
  let parsed: unknown = null;
  try {
    parsed = text.length > 0 ? (JSON.parse(text) as unknown) : null;
  } catch {
    parsed = null;
  }
  return { ok: response.ok, status: response.status, json: parsed };
}

function clampPercent(value: number): number {
  return Math.min(100, Math.max(0, Math.round(value)));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asFiniteNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

/**
 * A finite, non-negative number — the only shape a provider-reported CREDIT
 * figure (usage / remaining / period usage) may take. OpenRouter never reports
 * a negative credit amount, so a negative value is malformed input: it is
 * treated as ABSENT (never coerced to zero, which would fabricate "no usage").
 */
function asNonNegativeNumber(value: unknown): number | undefined {
  const n = asFiniteNumber(value);
  return n !== undefined && n >= 0 ? n : undefined;
}

// ── OpenAI — dashboard billing (real monthly hard USD limit) ────────────────

/**
 * OpenAI exposes no official per-key token-quota API. The dashboard/billing
 * endpoints DO report the account's hard USD subscription limit and the usage
 * consumed against it this month — that is a real bounded quota. Org/admin
 * keys return 401/403 here (the endpoints require a user-scoped key), which we
 * report honestly instead of guessing.
 */
export async function openaiAccountProbe(
  providerId: string,
  apiKey: string,
  fetchImpl: FetchLike,
  now: Date,
): Promise<AccountProbeResult> {
  const subscription = await getJson(
    fetchImpl,
    'https://api.openai.com/v1/dashboard/billing/subscription',
    apiKey,
  );
  if (!subscription.ok) {
    const unauthorized = subscription.status === 401 || subscription.status === 403;
    return {
      providerId,
      family: 'openai',
      probed: true,
      ok: false,
      error: unauthorized
        ? 'OpenAI dashboard/billing endpoints require a user-scoped API key — this key type exposes no account quota here.'
        : `OpenAI billing subscription endpoint failed (HTTP ${subscription.status})${
            subscription.networkError ? `: ${subscription.networkError}` : ''
          }`,
      detail: 'no sample written — nothing fabricated',
    };
  }
  if (!isRecord(subscription.json)) {
    return {
      providerId,
      family: 'openai',
      probed: true,
      ok: false,
      error:
        'OpenAI billing subscription endpoint returned an unreadable response (expected JSON).',
      detail: 'no sample written — nothing fabricated',
    };
  }
  const data = subscription.json;
  const hardLimitUsd = asFiniteNumber(data.hard_limit_usd);
  const accessUntil = asFiniteNumber(data.access_until);
  const nowSeconds = Math.floor(now.getTime() / 1000);

  if (!hardLimitUsd || hardLimitUsd <= 0) {
    return {
      providerId,
      family: 'openai',
      probed: true,
      ok: true,
      detail:
        'No hard USD limit exposed for this account (org/credit type) — no bounded quota exists, so no percentage is recorded.',
    };
  }
  if (accessUntil !== undefined && accessUntil < nowSeconds) {
    return {
      providerId,
      family: 'openai',
      probed: true,
      ok: true,
      detail: 'Subscription access period has ended — quota not computed.',
    };
  }

  // Usage is reported in cents ($1 = 100) for the given UTC date window.
  const end = now.toISOString().slice(0, 10);
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
    .toISOString()
    .slice(0, 10);
  const usage = await getJson(
    fetchImpl,
    `https://api.openai.com/v1/dashboard/billing/usage?start_date=${start}&end_date=${end}`,
    apiKey,
  );
  if (!usage.ok) {
    return {
      providerId,
      family: 'openai',
      probed: true,
      ok: false,
      error: `OpenAI billing usage endpoint failed (HTTP ${usage.status}) — quota not updated.`,
      detail: 'no sample written — nothing fabricated',
    };
  }
  if (!isRecord(usage.json)) {
    return {
      providerId,
      family: 'openai',
      probed: true,
      ok: false,
      error: 'OpenAI billing usage endpoint returned an unreadable response (expected JSON).',
      detail: 'no sample written — nothing fabricated',
    };
  }
  const totalUsageCents = asFiniteNumber(usage.json.total_usage);
  if (totalUsageCents === undefined || totalUsageCents < 0) {
    return {
      providerId,
      family: 'openai',
      probed: true,
      ok: true,
      detail: 'Usage endpoint returned no usable total — quota not computed.',
    };
  }
  const usageUsd = totalUsageCents / 100;
  const percent = clampPercent((usageUsd / hardLimitUsd) * 100);
  return {
    providerId,
    family: 'openai',
    probed: true,
    ok: true,
    quotaUsedPercent: percent,
    detail: `OpenAI hard USD limit $${hardLimitUsd} with $${usageUsd.toFixed(2)} used this month (${percent}%).`,
  };
}

// ── DeepSeek — /user/balance (prepaid balance; NO ceiling) ─────────────────

/**
 * DeepSeek exposes the account prepaid balance (no fixed quota ceiling and no
 * periodized usage API). The probe records a truthful "checked" sample and
 * NEVER derives a percentage from a balance — that would be fabrication.
 */
export async function deepseekAccountProbe(
  providerId: string,
  apiKey: string,
  fetchImpl: FetchLike,
): Promise<AccountProbeResult> {
  const response = await getJson(fetchImpl, 'https://api.deepseek.com/user/balance', apiKey);
  if (!response.ok) {
    return {
      providerId,
      family: 'deepseek',
      probed: true,
      ok: false,
      error: `DeepSeek balance endpoint failed (HTTP ${response.status})${
        response.networkError ? `: ${response.networkError}` : ''
      }`,
      detail: 'no sample written — nothing fabricated',
    };
  }
  const data = isRecord(response.json) ? response.json : {};
  if (data.is_available !== true || !Array.isArray(data.balance_infos)) {
    return {
      providerId,
      family: 'deepseek',
      probed: true,
      ok: true,
      detail: 'Balance endpoint returned no usable balance info.',
    };
  }
  const first: unknown = (data.balance_infos as unknown[])[0];
  if (!isRecord(first)) {
    return {
      providerId,
      family: 'deepseek',
      probed: true,
      ok: true,
      detail: 'Balance endpoint returned an empty balance list.',
    };
  }
  const totalBalance = asFiniteNumber(first.total_balance);
  const currency = typeof first.currency === 'string' ? first.currency : 'unknown';
  return {
    providerId,
    family: 'deepseek',
    probed: true,
    ok: true,
    detail:
      totalBalance === undefined
        ? 'Balance reported without a numeric total.'
        : `Prepaid balance ${currency} ${totalBalance} — no fixed quota ceiling exists, so no percentage is recorded (nothing fabricated).`,
  };
}

// ── OpenRouter — /api/v1/key credits (bounded only when limit is finite > 0) ──

/**
 * OpenRouter account/key probe — official `GET /api/v1/key` schema.
 *
 * The response `data` object reports KEY-level credit figures:
 *   • `label`            — the key's label (never logged).
 *   • `limit`            — the key's credit cap, or `null` when unlimited.
 *   • `limit_remaining`  — credits remaining FOR THIS KEY (null when unlimited).
 *   • `limit_reset`      — when the key limit resets (e.g. 'monthly'), or null.
 *   • `usage`            — credits used all-time (1 credit = $1).
 *   • `usage_daily/weekly/monthly` — credits used in the current UTC period.
 *   • `is_free_tier`     — whether the key is on the free tier.
 *
 * HONESTY:
 *   • A bounded quota percentage is derived ONLY from a finite `limit` > 0 and a
 *     finite `usage`. `limit === null` (or absent) is UNLIMITED — never a
 *     percentage.
 *   • `limit_remaining` is the KEY's remaining credit cap — it is NOT the
 *     account's total balance, and is labelled as key-level wherever surfaced.
 *   • Missing / malformed / non-finite values are never trusted and never
 *     become zero.
 */
export async function openrouterAccountProbe(
  providerId: string,
  apiKey: string,
  fetchImpl: FetchLike,
  now: Date = new Date(),
): Promise<AccountProbeResult> {
  const response = await getJson(fetchImpl, 'https://openrouter.ai/api/v1/key', apiKey);
  if (!response.ok || !isRecord(response.json)) {
    return {
      providerId,
      family: 'openrouter',
      probed: true,
      ok: false,
      error: `OpenRouter key endpoint failed (HTTP ${response.status})${
        response.networkError ? `: ${response.networkError}` : ''
      }`,
      detail: 'no sample written — nothing fabricated',
    };
  }
  // The documented envelope is `{ data: { … } }`; a bare `{ … }` is not the
  // documented schema, so it is rejected rather than guessed at.
  if (!isRecord(response.json.data)) {
    return {
      providerId,
      family: 'openrouter',
      probed: true,
      ok: false,
      error: 'OpenRouter key endpoint returned an unexpected shape (missing `data` object).',
      detail: 'no sample written — nothing fabricated',
    };
  }
  const data = response.json.data;
  const retrievedAt = now.toISOString();
  const source = 'GET https://openrouter.ai/api/v1/key';

  // `usage` is CUMULATIVE (all-time credits used) per the official schema — it is
  // NOT a period figure and must never be relabelled as daily/weekly/monthly.
  // The period figures are the provider's OWN UTC-window computations
  // (usage_daily = current UTC day; usage_weekly = current UTC week, Monday
  // start; usage_monthly = current UTC month) and are preserved verbatim as a
  // breakdown so the cumulative/period distinction is never collapsed.
  const usage = asNonNegativeNumber(data.usage);
  // `limit` is documented as number|null; null (or an absent field) means the key
  // has NO credit ceiling. Only an explicit finite number is a bounded limit.
  const limit = asNonNegativeNumber(data.limit);
  const unlimited = data.limit === null || data.limit === undefined;
  const limitRemaining = asNonNegativeNumber(data.limit_remaining);
  const usageDaily = asNonNegativeNumber(data.usage_daily);
  const usageWeekly = asNonNegativeNumber(data.usage_weekly);
  const usageMonthly = asNonNegativeNumber(data.usage_monthly);
  const freeTier = data.is_free_tier === true;

  // Genuine KEY-level credit metrics, persisted verbatim (units: credits = USD).
  const metrics: ProviderAccountUsageMetric[] = [];
  if (usage !== undefined) {
    metrics.push({
      provider: providerId,
      metric: 'ACCOUNT_COST',
      source,
      retrievedAt,
      value: usage,
      unit: 'usd',
      ...(usageDaily !== undefined || usageWeekly !== undefined || usageMonthly !== undefined
        ? {
            breakdown: [
              ...(usageDaily !== undefined
                ? [{ key: 'usage_daily', value: usageDaily, unit: 'usd' as const }]
                : []),
              ...(usageWeekly !== undefined
                ? [{ key: 'usage_weekly', value: usageWeekly, unit: 'usd' as const }]
                : []),
              ...(usageMonthly !== undefined
                ? [{ key: 'usage_monthly', value: usageMonthly, unit: 'usd' as const }]
                : []),
            ],
          }
        : {}),
    });
  }
  if (limitRemaining !== undefined) {
    // KEY-level remaining credit cap — NOT the account balance.
    metrics.push({
      provider: providerId,
      metric: 'ACCOUNT_CREDITS',
      source,
      retrievedAt,
      value: limitRemaining,
      unit: 'usd',
    });
  }

  const accountUsage = metrics.length > 0 ? metrics : undefined;

  // A percentage is ONLY derivable from a real finite ceiling and a real usage.
  if (limit === undefined || limit <= 0) {
    // `is_free_tier` describes whether the account has ever paid for credits —
    // it is NEVER a usage figure and never implies zero or unlimited usage. The
    // message states only what is actually known (no ceiling ⇒ no percentage).
    const freeTierNote = freeTier ? ' (account reports is_free_tier=true)' : '';
    return {
      providerId,
      family: 'openrouter',
      probed: true,
      ok: true,
      ...(accountUsage !== undefined ? { accountUsage } : {}),
      detail: unlimited
        ? `OpenRouter key reports no credit ceiling (limit is null)${freeTierNote} — no percentage is recorded (nothing fabricated).`
        : `OpenRouter credit limit is zero or missing${freeTierNote} — no percentage is recorded (nothing fabricated).`,
    };
  }
  if (usage === undefined) {
    return {
      providerId,
      family: 'openrouter',
      probed: true,
      ok: true,
      ...(accountUsage !== undefined ? { accountUsage } : {}),
      detail:
        'OpenRouter reported a credit limit but no usable usage figure — no percentage is recorded (nothing fabricated).',
    };
  }
  const percent = clampPercent((usage / limit) * 100);
  const limitReset = typeof data.limit_reset === 'string' ? data.limit_reset : undefined;
  return {
    providerId,
    family: 'openrouter',
    probed: true,
    ok: true,
    quotaUsedPercent: percent,
    ...(accountUsage !== undefined ? { accountUsage } : {}),
    detail: `OpenRouter key credits $${usage.toFixed(4)} / limit $${limit.toFixed(4)} (${percent}%)${
      limitReset !== undefined ? `; limit reset: ${limitReset}` : ''
    }.`,
  };
}

// ── Probe registry ──────────────────────────────────────────────────────────
// Families absent from this table have no BOUNDED-QUOTA probe here. Gemini API
// keys expose no usage endpoint; Anthropic exposes an official Usage & Cost
// Admin API (admin-key scoped) that reports usage/cost but no bounded quota.
// Both are reported as NO_PROBE with their accurate reason (see noProbeReason).

interface ProbeDefinition {
  probe: (
    providerId: string,
    apiKey: string,
    fetchImpl: FetchLike,
    now: Date,
  ) => Promise<AccountProbeResult>;
}

const PROBES: Record<string, ProbeDefinition> = {
  openai: { probe: openaiAccountProbe },
  deepseek: { probe: deepseekAccountProbe },
  openrouter: { probe: openrouterAccountProbe },
};

/**
 * Families whose provider-reported ACCOUNT usage/cost is retrieved from the
 * official admin-scoped APIs. These return genuine account metrics (tokens /
 * cost) that are persisted verbatim and kept distinct from the bounded-quota
 * probes above and from VedMoulya's own runtime tokens and estimated cost.
 *
 * A family may appear in BOTH registries (e.g. openai: legacy bounded quota probe
 * + organization cost). Each probe writes only what its endpoint really reports.
 */
type AccountMetricProbe = (
  providerId: string,
  apiKey: string,
  fetchImpl: FetchLike,
  now: Date,
) => Promise<AccountProbeResult>;

const ACCOUNT_METRIC_PROBES: Record<string, AccountMetricProbe[]> = {
  openai: [openaiOrgAccountMetrics],
  anthropic: [anthropicAccountMetrics],
};

/**
 * The accurate, per-family reason a bounded-quota probe is not run. Kept
 * verbatim-accurate (verified against each provider's official API docs) so the
 * UI's "Unavailable from provider" / "No usage endpoint" states are not just
 * honest about the ABSENCE but correct about WHY — a provider that DOES expose
 * an official API (Anthropic) must not be described as having none.
 */
export function noProbeReason(family: string): string {
  switch (family) {
    case 'google':
      return 'Gemini API keys expose no usage/billing endpoint — quota stays unavailable.';
    case 'openai':
      return 'OpenAI bounded quota is read from the admin-scoped organization APIs, not this ingestor — the legacy dashboard/billing endpoints are deprecated.';
    default:
      return 'This provider exposes no usage/billing endpoint in the ingestor registry.';
  }
}

// ── Ingest report ───────────────────────────────────────────────────────────

export interface ProviderUsageIngestEntry {
  providerId: string;
  family: string;
  outcome:
    | 'QUOTA_WRITTEN' // real bounded quota recorded into the health sample
    | 'METRICS_WRITTEN' // genuine provider-reported account usage/cost persisted
    | 'CHECKED_WRITTEN' // probe succeeded; no quota ceiling → plain sample
    | 'NO_PROBE' // family exposes no usage/billing endpoint
    | 'NOT_CONFIGURED' // no credential for this family
    | 'PROBE_FAILED'; // endpoint error — reported, nothing written
  detail: string;
}

export interface ProviderUsageIngestReport {
  at: string;
  entries: ProviderUsageIngestEntry[];
  quotaSamplesWritten: number;
  checkedSamplesWritten: number;
  /** Genuine provider-reported account metrics persisted by this pass. */
  accountMetricsWritten: number;
}

export interface ProviderUsageIngestorOptions {
  /** The gateway registry service (its repository is the persistence target). */
  providers: ProviderApplicationService;
  /** Injectable HTTP client (tests); defaults to the global fetch. */
  fetchImpl?: FetchLike;
  /** Injectable clock (tests). */
  now?: () => Date;
}

/**
 * What the product can honestly say about provider-usage ingestion: the last
 * pass's real outcomes (per family) plus whether the ingest is scheduled at all.
 *
 * Deployment-scoped — never user data, and never fabricated: with no scheduled
 * pass and no pass in this process the entries are empty and `lastRunAt` is
 * absent, and the UI must say "never checked" instead of inventing a result.
 */
export interface ProviderUsageIngestStatus {
  /** True when a scheduled pass is actually wired to the gateway heartbeat. */
  scheduleEnabled: boolean;
  /** The cadence in ms when scheduled (absent otherwise). */
  scheduleIntervalMs?: number;
  /** When the most recent pass finished in THIS process (absent ⇒ never). */
  lastRunAt?: string;
  /** Per-family outcomes of the most recent pass (empty ⇒ never ran). */
  entries: ProviderUsageIngestEntry[];
  /** Provider-reported quotas written by the most recent pass. */
  quotaSamplesWritten: number;
  /** Plain "checked" samples written by the most recent pass. */
  checkedSamplesWritten: number;
}

/**
 * Runs one ingestion pass: for every runtime family with a real credential it
 * probes the provider's usage/billing endpoint and writes the honest result
 * into the registry health snapshot consumed by the AI Providers UI.
 */
export class ProviderUsageIngestor {
  private readonly providers: ProviderApplicationService;
  private readonly fetchImpl: FetchLike;
  private readonly now: () => Date;

  /**
   * The most recent pass in THIS process. Kept so the in-product status read can
   * report what actually happened (which families answered, which have no usage
   * endpoint, which failed) instead of leaving "why is quota unavailable?" to
   * guesswork.
   */
  private lastReport: ProviderUsageIngestReport | undefined;

  constructor(options: ProviderUsageIngestorOptions) {
    this.providers = options.providers;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.now = options.now ?? ((): Date => new Date());
  }

  /** Outcome of the most recent `run()` (undefined ⇒ never ran here). */
  getLastReport(): ProviderUsageIngestReport | undefined {
    return this.lastReport;
  }

  async run(
    env: Record<string, string | undefined> = process.env,
  ): Promise<ProviderUsageIngestReport> {
    const mode = toRuntimeMode(env.NODE_ENV ?? 'development');
    const states = readProviderRuntimeState(env, mode);
    const at = this.now().toISOString();
    const entries: ProviderUsageIngestEntry[] = [];
    let quotaSamplesWritten = 0;
    let checkedSamplesWritten = 0;
    let accountMetricsWritten = 0;

    for (const state of states) {
      const key = state.envKeys.find((name) => isValueSet(env[name]));
      if (key === undefined) {
        entries.push({
          providerId: state.family,
          family: state.family,
          outcome: 'NOT_CONFIGURED',
          detail: 'No credential configured for this family.',
        });
        continue;
      }
      const apiKey = (env[key] ?? '').trim();
      const definition = PROBES[state.family];
      const metricProbes = ACCOUNT_METRIC_PROBES[state.family] ?? [];
      if (!definition && metricProbes.length === 0) {
        entries.push({
          providerId: state.family,
          family: state.family,
          outcome: 'NO_PROBE',
          detail: noProbeReason(state.family),
        });
        continue;
      }
      try {
        // 1. Bounded-quota probe (when this family has one).
        if (definition) {
          const result = await definition.probe(state.family, apiKey, this.fetchImpl, this.now());
          if (!result.ok) {
            entries.push({
              providerId: result.providerId,
              family: result.family,
              outcome: 'PROBE_FAILED',
              detail: result.error ?? 'Probe failed.',
            });
          } else {
            const sample: {
              ok: boolean;
              checkedAt?: string;
              quotaUsedPercent?: number;
              accountUsage?: ProviderAccountUsageMetric[];
            } = { ok: true, checkedAt: at };
            let outcome: ProviderUsageIngestEntry['outcome'] = 'CHECKED_WRITTEN';
            if (result.quotaUsedPercent !== undefined) {
              sample.quotaUsedPercent = result.quotaUsedPercent;
              outcome = 'QUOTA_WRITTEN';
            }
            if (result.accountUsage !== undefined && result.accountUsage.length > 0) {
              sample.accountUsage = result.accountUsage;
              // Genuine provider-reported account metrics were retrieved (even
              // when no bounded quota exists) — reported distinctly.
              if (outcome !== 'QUOTA_WRITTEN') outcome = 'METRICS_WRITTEN';
            }
            const write = await this.providers.recordHealthSample(result.providerId, sample);
            if (!write.success) {
              entries.push({
                providerId: result.providerId,
                family: result.family,
                outcome: 'PROBE_FAILED',
                detail: write.error ?? 'Unable to write the health sample.',
              });
            } else {
              if (outcome === 'QUOTA_WRITTEN') quotaSamplesWritten += 1;
              else if (outcome === 'METRICS_WRITTEN') {
                accountMetricsWritten += sample.accountUsage?.length ?? 0;
              } else checkedSamplesWritten += 1;
              entries.push({
                providerId: result.providerId,
                family: result.family,
                outcome,
                detail: result.detail,
              });
            }
          }
        }

        // 2. Account-metric probes (official admin APIs) — genuine usage/cost,
        //    persisted verbatim and kept distinct from the bounded quota above.
        for (const metricProbe of metricProbes) {
          const result = await metricProbe(state.family, apiKey, this.fetchImpl, this.now());
          if (!result.ok || result.accountUsage === undefined) {
            entries.push({
              providerId: result.providerId,
              family: result.family,
              outcome: 'PROBE_FAILED',
              detail: result.error ?? 'Account-usage probe failed.',
            });
            continue;
          }
          const write = await this.providers.recordHealthSample(result.providerId, {
            ok: true,
            checkedAt: at,
            accountUsage: result.accountUsage,
          });
          if (!write.success) {
            entries.push({
              providerId: result.providerId,
              family: result.family,
              outcome: 'PROBE_FAILED',
              detail: write.error ?? 'Unable to write the account-usage metrics.',
            });
            continue;
          }
          accountMetricsWritten += result.accountUsage.length;
          entries.push({
            providerId: result.providerId,
            family: result.family,
            outcome: 'METRICS_WRITTEN',
            detail: result.detail,
          });
        }
      } catch (error) {
        entries.push({
          providerId: state.family,
          family: state.family,
          outcome: 'PROBE_FAILED',
          detail: error instanceof Error ? error.message : 'Probe threw unexpectedly.',
        });
      }
    }

    const report: ProviderUsageIngestReport = {
      at,
      entries,
      quotaSamplesWritten,
      checkedSamplesWritten,
      accountMetricsWritten,
    };
    this.lastReport = report;
    return report;
  }
}

// ── OpenAI organization usage (per model, real periods) ─────────────────────
// The official `/v1/organization/usage/completions` endpoint reports the
// OpenAI organization's OWN token usage per model with real time granularity
// (bucket_width=1d). It requires an Organization ADMIN-scope key — project or
// user keys return 401/403, reported honestly below. Retention may not cover
// the full trailing month for early-month starts; only what OpenAI reports is
// ever summed (nothing is extrapolated).

export type OpenAIOrgPeriod = 'today' | 'week' | 'month';

export interface OpenAIOrgUsageWindow {
  period: OpenAIOrgPeriod;
  /** UTC unix seconds at the start of the window (inclusive). */
  startEpochSec: number;
  /** UTC unix seconds at the end of the window (now, exclusive). */
  endEpochSec: number;
  label: 'Today' | 'This week' | 'This month';
}

const ORG_PERIOD_LABELS: Record<OpenAIOrgPeriod, OpenAIOrgUsageWindow['label']> = {
  today: 'Today',
  week: 'This week',
  month: 'This month',
};

/** Real UTC windows the OpenAI usage endpoint supports. */
export function openaiOrgWindow(period: OpenAIOrgPeriod, now: Date): OpenAIOrgUsageWindow {
  const utcDayStart = (year: number, monthIndex: number, day: number): number =>
    Math.floor(Date.UTC(year, monthIndex, day) / 1000);
  const year = now.getUTCFullYear();
  const monthIndex = now.getUTCMonth();
  let startEpochSec: number;
  if (period === 'today') {
    startEpochSec = utcDayStart(year, monthIndex, now.getUTCDate());
  } else if (period === 'month') {
    startEpochSec = utcDayStart(year, monthIndex, 1);
  } else {
    // "This week": most recent Monday 00:00 UTC.
    const daysSinceMonday = (now.getUTCDay() + 6) % 7;
    startEpochSec = utcDayStart(year, monthIndex, now.getUTCDate() - daysSinceMonday);
  }
  return {
    period,
    startEpochSec,
    endEpochSec: Math.floor(now.getTime() / 1000),
    label: ORG_PERIOD_LABELS[period],
  };
}

export interface OpenAIOrgModelUsage {
  model: string;
  /** Non-cached input tokens reported by OpenAI. */
  inputTokens: number;
  /** Cached input tokens reported by OpenAI. */
  cachedInputTokens: number;
  outputTokens: number;
}

export interface OpenAIOrgUsageResult {
  ok: boolean;
  providerId: string;
  family: 'openai';
  /** Per-model totals aggregated from every daily bucket returned. */
  rows: OpenAIOrgModelUsage[];
  totals: { inputTokens: number; cachedInputTokens: number; outputTokens: number };
  window: OpenAIOrgUsageWindow;
  /** True when the endpoint signalled more pages than this single request read. */
  hasMore: boolean;
  error?: string;
}

/**
 * One page of the OpenAI organization completions usage. Only the numbers
 * OpenAI reports are summed — no extrapolation, no invented requests.
 */
export async function openaiOrgUsageProbe(
  apiKey: string,
  fetchImpl: FetchLike,
  window: OpenAIOrgUsageWindow,
): Promise<OpenAIOrgUsageResult> {
  const base: OpenAIOrgUsageResult = {
    ok: true,
    providerId: 'openai',
    family: 'openai',
    rows: [],
    totals: { inputTokens: 0, cachedInputTokens: 0, outputTokens: 0 },
    window,
    hasMore: false,
  };
  if (window.endEpochSec <= window.startEpochSec) {
    return { ...base, ok: true }; // empty window → honest zero rows
  }
  const url =
    `https://api.openai.com/v1/organization/usage/completions` +
    `?start_time=${window.startEpochSec}` +
    `&end_time=${window.endEpochSec}` +
    `&bucket_width=1d` +
    `&group_by%5B%5D=model` +
    `&limit=1000`;
  const response = await getJson(fetchImpl, url, apiKey);
  if (!response.ok) {
    const unauthorized = response.status === 401 || response.status === 403;
    return {
      ...base,
      ok: false,
      error: unauthorized
        ? 'The OpenAI organization usage endpoint requires an Organization admin-scope API key (project/user keys are refused).'
        : `OpenAI organization usage endpoint failed (HTTP ${response.status})${
            response.networkError ? `: ${response.networkError}` : ''
          }`,
    };
  }
  if (!isRecord(response.json)) {
    return {
      ...base,
      ok: false,
      error: 'OpenAI organization usage endpoint returned an unreadable response (expected JSON).',
    };
  }
  const payload = response.json;
  const buckets = Array.isArray(payload.data) ? payload.data : [];
  const byModel = new Map<string, OpenAIOrgModelUsage>();
  for (const bucket of buckets) {
    if (!isRecord(bucket) || !Array.isArray(bucket.results)) continue;
    for (const entry of bucket.results) {
      if (!isRecord(entry)) continue;
      const model = typeof entry.model === 'string' ? entry.model : '';
      if (!model) continue;
      const current = byModel.get(model) ?? {
        model,
        inputTokens: 0,
        cachedInputTokens: 0,
        outputTokens: 0,
      };
      current.inputTokens += asFiniteNumber(entry.input_tokens) ?? 0;
      current.cachedInputTokens += asFiniteNumber(entry.input_cached_tokens) ?? 0;
      current.outputTokens += asFiniteNumber(entry.output_tokens) ?? 0;
      byModel.set(model, current);
    }
  }
  const totalize = (pick: (row: OpenAIOrgModelUsage) => number): number =>
    Array.from(byModel.values()).reduce((sum, row) => sum + pick(row), 0);
  const rows = Array.from(byModel.values()).sort(
    (a, b) =>
      b.inputTokens +
      b.cachedInputTokens +
      b.outputTokens -
      (a.inputTokens + a.cachedInputTokens + a.outputTokens),
  );
  return {
    ...base,
    rows,
    totals: {
      inputTokens: totalize((r) => r.inputTokens),
      cachedInputTokens: totalize((r) => r.cachedInputTokens),
      outputTokens: totalize((r) => r.outputTokens),
    },
    hasMore: payload.has_more === true,
  };
}

// ── OpenAI organization COSTS (provider-reported spend) ──────────────────────
// GET /v1/organization/costs reports the organization's OWN spend in USD per
// time bucket — a real provider-reported cost, distinct from VedMoulya's
// estimated cost. Requires an Organization admin-scope key; project/user keys
// return 401/403, reported honestly. Only what OpenAI reports is summed.

export interface OpenAIOrgCostResult {
  ok: boolean;
  providerId: string;
  family: 'openai';
  /** Total USD reported across every bucket in the window. */
  totalUsd: number;
  currency: string;
  /** Per line-item totals (e.g. model / service) as OpenAI groups them. */
  breakdown: Array<{ key: string; usd: number }>;
  window: OpenAIOrgUsageWindow;
  hasMore: boolean;
  error?: string;
}

export async function openaiOrgCostProbe(
  apiKey: string,
  fetchImpl: FetchLike,
  window: OpenAIOrgUsageWindow,
): Promise<OpenAIOrgCostResult> {
  const base: OpenAIOrgCostResult = {
    ok: true,
    providerId: 'openai',
    family: 'openai',
    totalUsd: 0,
    currency: 'usd',
    breakdown: [],
    window,
    hasMore: false,
  };
  if (window.endEpochSec <= window.startEpochSec) return base;
  const url =
    `https://api.openai.com/v1/organization/costs` +
    `?start_time=${window.startEpochSec}` +
    `&end_time=${window.endEpochSec}` +
    `&bucket_width=1d` +
    `&group_by%5B%5D=line_item` +
    `&limit=1000`;
  const response = await getJson(fetchImpl, url, apiKey);
  if (!response.ok) {
    const unauthorized = response.status === 401 || response.status === 403;
    return {
      ...base,
      ok: false,
      error: unauthorized
        ? 'The OpenAI organization costs endpoint requires an Organization admin-scope API key (project/user keys are refused).'
        : `OpenAI organization costs endpoint failed (HTTP ${response.status})${
            response.networkError ? `: ${response.networkError}` : ''
          }`,
    };
  }
  if (!isRecord(response.json)) {
    return {
      ...base,
      ok: false,
      error: 'OpenAI organization costs endpoint returned an unreadable response (expected JSON).',
    };
  }
  const buckets = Array.isArray(response.json.data) ? response.json.data : [];
  const byLine = new Map<string, number>();
  let total = 0;
  let currency = 'usd';
  for (const bucket of buckets) {
    if (!isRecord(bucket) || !Array.isArray(bucket.results)) continue;
    for (const entry of bucket.results) {
      if (!isRecord(entry)) continue;
      const amount = isRecord(entry.amount) ? entry.amount : {};
      const value = asFiniteNumber(amount.value);
      if (value === undefined) continue;
      if (typeof amount.currency === 'string') currency = amount.currency;
      const line =
        typeof entry.line_item === 'string' && entry.line_item.length > 0
          ? entry.line_item
          : 'unattributed';
      total += value;
      byLine.set(line, (byLine.get(line) ?? 0) + value);
    }
  }
  return {
    ...base,
    totalUsd: total,
    currency,
    breakdown: Array.from(byLine.entries())
      .map(([key, usd]) => ({ key, usd }))
      .sort((a, b) => b.usd - a.usd),
    hasMore: response.json.has_more === true,
  };
}

// ── Anthropic Admin API — usage report + cost report ─────────────────────────
// Anthropic exposes an official admin-scoped Usage & Cost Admin API:
//   GET /v1/organizations/usage_report/messages   (token usage by model/window)
//   GET /v1/organizations/cost_report             (USD cost by window)
// Both require an ADMIN key via `x-api-key` (standard `sk-ant-…` keys are
// refused). This reports account usage/cost — there is NO bounded remaining
// quota, so no percentage is ever derived. Windows use RFC3339 timestamps.

export interface AnthropicUsageResult {
  ok: boolean;
  providerId: string;
  family: 'anthropic';
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
  breakdown: Array<{ model: string; inputTokens: number; outputTokens: number }>;
  window: { startIso: string; endIso: string };
  hasMore: boolean;
  error?: string;
}

/** RFC3339 UTC timestamp for an epoch second (Anthropic's expected format). */
function rfc3339(epochSec: number): string {
  return new Date(epochSec * 1000).toISOString();
}

export async function anthropicUsageProbe(
  apiKey: string,
  fetchImpl: FetchLike,
  window: OpenAIOrgUsageWindow,
): Promise<AnthropicUsageResult> {
  const startIso = rfc3339(window.startEpochSec);
  const endIso = rfc3339(window.endEpochSec);
  const base: AnthropicUsageResult = {
    ok: true,
    providerId: 'anthropic',
    family: 'anthropic',
    inputTokens: 0,
    outputTokens: 0,
    cacheReadTokens: 0,
    cacheCreationTokens: 0,
    breakdown: [],
    window: { startIso, endIso },
    hasMore: false,
  };
  // NOTE: Anthropic requires the admin key in the `x-api-key` header, not Bearer.
  let response: Response;
  try {
    response = await fetchImpl(
      `https://api.anthropic.com/v1/organizations/usage_report/messages?starting_at=${encodeURIComponent(
        startIso,
      )}&ending_at=${encodeURIComponent(endIso)}&bucket_width=1d&limit=31`,
      { method: 'GET', headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' } },
    );
  } catch (error) {
    return {
      ...base,
      ok: false,
      error: error instanceof Error ? error.message : 'network error',
    };
  }
  if (!response.ok) {
    const unauthorized = response.status === 401 || response.status === 403;
    return {
      ...base,
      ok: false,
      error: unauthorized
        ? 'The Anthropic usage report requires an Admin API key (standard API keys are refused).'
        : `Anthropic usage report failed (HTTP ${response.status}).`,
    };
  }
  let json: unknown;
  try {
    json = await response.json();
  } catch {
    return { ...base, ok: false, error: 'Anthropic usage report returned unreadable JSON.' };
  }
  if (!isRecord(json)) {
    return { ...base, ok: false, error: 'Anthropic usage report returned an unexpected shape.' };
  }
  const buckets = Array.isArray(json.data) ? json.data : [];
  const byModel = new Map<string, { inputTokens: number; outputTokens: number }>();
  let input = 0;
  let output = 0;
  let cacheRead = 0;
  let cacheCreate = 0;
  for (const bucket of buckets) {
    if (!isRecord(bucket) || !Array.isArray(bucket.results)) continue;
    for (const entry of bucket.results) {
      if (!isRecord(entry)) continue;
      const model = typeof entry.model === 'string' && entry.model ? entry.model : 'unknown';
      const uncached = asFiniteNumber(entry.uncached_input_tokens) ?? 0;
      const cacheReadTokens =
        asFiniteNumber(entry.cache_read_input_tokens) ??
        asFiniteNumber(entry.cache_read_tokens) ??
        0;
      const cacheCreation =
        asFiniteNumber(entry.cache_creation_input_tokens) ??
        asFiniteNumber(
          isRecord(entry.cache_creation)
            ? entry.cache_creation.ephemeral_5m_input_tokens
            : undefined,
        ) ??
        0;
      const out = asFiniteNumber(entry.output_tokens) ?? 0;
      input += uncached;
      output += out;
      cacheRead += cacheReadTokens;
      cacheCreate += cacheCreation;
      const current = byModel.get(model) ?? { inputTokens: 0, outputTokens: 0 };
      current.inputTokens += uncached + cacheReadTokens;
      current.outputTokens += out;
      byModel.set(model, current);
    }
  }
  return {
    ...base,
    inputTokens: input,
    outputTokens: output,
    cacheReadTokens: cacheRead,
    cacheCreationTokens: cacheCreate,
    breakdown: Array.from(byModel.entries())
      .map(([model, v]) => ({ model, inputTokens: v.inputTokens, outputTokens: v.outputTokens }))
      .sort((a, b) => b.inputTokens + b.outputTokens - (a.inputTokens + a.outputTokens)),
    hasMore: json.has_more === true,
  };
}

export interface AnthropicCostResult {
  ok: boolean;
  providerId: string;
  family: 'anthropic';
  totalUsd: number;
  currency: string;
  breakdown: Array<{ key: string; usd: number }>;
  window: { startIso: string; endIso: string };
  hasMore: boolean;
  error?: string;
}

export async function anthropicCostProbe(
  apiKey: string,
  fetchImpl: FetchLike,
  window: OpenAIOrgUsageWindow,
): Promise<AnthropicCostResult> {
  const startIso = rfc3339(window.startEpochSec);
  const endIso = rfc3339(window.endEpochSec);
  const base: AnthropicCostResult = {
    ok: true,
    providerId: 'anthropic',
    family: 'anthropic',
    totalUsd: 0,
    currency: 'USD',
    breakdown: [],
    window: { startIso, endIso },
    hasMore: false,
  };
  let response: Response;
  try {
    response = await fetchImpl(
      `https://api.anthropic.com/v1/organizations/cost_report?starting_at=${encodeURIComponent(
        startIso,
      )}&ending_at=${encodeURIComponent(endIso)}&limit=31`,
      { method: 'GET', headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' } },
    );
  } catch (error) {
    return { ...base, ok: false, error: error instanceof Error ? error.message : 'network error' };
  }
  if (!response.ok) {
    const unauthorized = response.status === 401 || response.status === 403;
    return {
      ...base,
      ok: false,
      error: unauthorized
        ? 'The Anthropic cost report requires an Admin API key (standard API keys are refused).'
        : `Anthropic cost report failed (HTTP ${response.status}).`,
    };
  }
  let json: unknown;
  try {
    json = await response.json();
  } catch {
    return { ...base, ok: false, error: 'Anthropic cost report returned unreadable JSON.' };
  }
  if (!isRecord(json)) {
    return { ...base, ok: false, error: 'Anthropic cost report returned an unexpected shape.' };
  }
  const buckets = Array.isArray(json.data) ? json.data : [];
  const byKey = new Map<string, number>();
  let total = 0;
  let currency = 'USD';
  for (const bucket of buckets) {
    if (!isRecord(bucket) || !Array.isArray(bucket.results)) continue;
    for (const entry of bucket.results) {
      if (!isRecord(entry)) continue;
      // Anthropic reports the amount as a decimal string in the lowest currency
      // unit (cents). Only a numeric/parseable value is used; nothing invented.
      const rawAmount = entry.amount;
      const value =
        typeof rawAmount === 'string'
          ? Number.parseFloat(rawAmount)
          : typeof rawAmount === 'number'
            ? rawAmount
            : undefined;
      if (value === undefined || !Number.isFinite(value)) continue;
      const usd = value / 100; // cents → USD
      if (typeof entry.currency === 'string') currency = entry.currency;
      const key =
        typeof entry.description === 'string' && entry.description
          ? entry.description
          : typeof entry.cost_type === 'string' && entry.cost_type
            ? entry.cost_type
            : 'unattributed';
      total += usd;
      byKey.set(key, (byKey.get(key) ?? 0) + usd);
    }
  }
  return {
    ...base,
    totalUsd: total,
    currency,
    breakdown: Array.from(byKey.entries())
      .map(([key, usd]) => ({ key, usd }))
      .sort((a, b) => b.usd - a.usd),
    hasMore: json.has_more === true,
  };
}

// ── Account-metric adapters (probe → persisted ProviderAccountUsageMetric) ───
// Each adapter calls the official admin endpoint(s) and maps the GENUINE
// response into the verbatim metric records the registry persists. Nothing is
// derived: a missing value stays missing, and account usage/cost is never
// converted into a quota percentage or a remaining-token figure.

/** The current UTC calendar month window — the account-usage granularity. */
function currentMonthWindow(now: Date): OpenAIOrgUsageWindow {
  return openaiOrgWindow('month', now);
}

export async function openaiOrgAccountMetrics(
  providerId: string,
  apiKey: string,
  fetchImpl: FetchLike,
  now: Date,
): Promise<AccountProbeResult> {
  const window = currentMonthWindow(now);
  const retrievedAt = now.toISOString();
  const metrics: ProviderAccountUsageMetric[] = [];
  const notes: string[] = [];
  let ok = true;

  const usage = await openaiOrgUsageProbe(apiKey, fetchImpl, window);
  if (usage.ok) {
    const total = usage.totals.inputTokens + usage.totals.outputTokens;
    if (total > 0 || usage.rows.length > 0) {
      metrics.push({
        provider: providerId,
        metric: 'ACCOUNT_TOKENS',
        source: 'GET https://api.openai.com/v1/organization/usage/completions',
        retrievedAt,
        window: { startEpochSec: window.startEpochSec, endEpochSec: window.endEpochSec },
        value: total,
        unit: 'tokens',
        breakdown: usage.rows.map((r) => ({
          key: r.model,
          value: r.inputTokens + r.cachedInputTokens + r.outputTokens,
          unit: 'tokens' as const,
        })),
      });
      notes.push(`tokens reported for ${window.label}`);
    } else {
      notes.push('usage endpoint reported no tokens for this window');
    }
  } else {
    ok = false;
    notes.push(usage.error ?? 'organization usage probe failed');
  }

  const cost = await openaiOrgCostProbe(apiKey, fetchImpl, window);
  if (cost.ok) {
    metrics.push({
      provider: providerId,
      metric: 'ACCOUNT_COST',
      source: 'GET https://api.openai.com/v1/organization/costs',
      retrievedAt,
      window: { startEpochSec: window.startEpochSec, endEpochSec: window.endEpochSec },
      value: cost.totalUsd,
      unit: 'usd',
      ...(cost.breakdown.length > 0
        ? {
            breakdown: cost.breakdown.map((b) => ({
              key: b.key,
              value: b.usd,
              unit: 'usd' as const,
            })),
          }
        : {}),
    });
    notes.push(`cost reported for ${window.label}`);
  } else {
    ok = false;
    notes.push(cost.error ?? 'organization cost probe failed');
  }

  if (metrics.length === 0) {
    return {
      providerId,
      family: 'openai',
      probed: true,
      ok: false,
      detail: 'no sample written — nothing fabricated',
      error: notes.join('; ') || 'OpenAI organization endpoints returned nothing usable.',
    };
  }
  return {
    providerId,
    family: 'openai',
    probed: true,
    ok,
    accountUsage: metrics,
    detail: notes.join('; ') || 'organization usage/cost recorded',
  };
}

export async function anthropicAccountMetrics(
  providerId: string,
  apiKey: string,
  fetchImpl: FetchLike,
  now: Date,
): Promise<AccountProbeResult> {
  const window = currentMonthWindow(now);
  const retrievedAt = now.toISOString();
  const metrics: ProviderAccountUsageMetric[] = [];
  const notes: string[] = [];
  let ok = true;

  const usage = await anthropicUsageProbe(apiKey, fetchImpl, window);
  if (usage.ok) {
    const total = usage.inputTokens + usage.outputTokens;
    metrics.push({
      provider: providerId,
      metric: 'ACCOUNT_TOKENS',
      source: 'GET https://api.anthropic.com/v1/organizations/usage_report/messages',
      retrievedAt,
      window: { startEpochSec: window.startEpochSec, endEpochSec: window.endEpochSec },
      value: total,
      unit: 'tokens',
      ...(usage.breakdown.length > 0
        ? {
            breakdown: usage.breakdown.map((b) => ({
              key: b.model,
              value: b.inputTokens + b.outputTokens,
              unit: 'tokens' as const,
            })),
          }
        : {}),
    });
    notes.push(`tokens reported for ${window.label}`);
  } else {
    ok = false;
    notes.push(usage.error ?? 'usage report probe failed');
  }

  const cost = await anthropicCostProbe(apiKey, fetchImpl, window);
  if (cost.ok) {
    metrics.push({
      provider: providerId,
      metric: 'ACCOUNT_COST',
      source: 'GET https://api.anthropic.com/v1/organizations/cost_report',
      retrievedAt,
      window: { startEpochSec: window.startEpochSec, endEpochSec: window.endEpochSec },
      value: cost.totalUsd,
      unit: 'usd',
      ...(cost.breakdown.length > 0
        ? {
            breakdown: cost.breakdown.map((b) => ({
              key: b.key,
              value: b.usd,
              unit: 'usd' as const,
            })),
          }
        : {}),
    });
    notes.push(`cost reported for ${window.label}`);
  } else {
    ok = false;
    notes.push(cost.error ?? 'cost report probe failed');
  }

  if (metrics.length === 0) {
    return {
      providerId,
      family: 'anthropic',
      probed: true,
      ok: false,
      detail: 'no sample written — nothing fabricated',
      error: notes.join('; ') || 'Anthropic admin endpoints returned nothing usable.',
    };
  }
  return {
    providerId,
    family: 'anthropic',
    probed: true,
    ok,
    accountUsage: metrics,
    detail: notes.join('; ') || 'admin usage/cost recorded',
  };
}
