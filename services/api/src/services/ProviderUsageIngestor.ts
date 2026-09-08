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
//   • Providers with no usage/billing API (Gemini API keys, Anthropic) are
//     never probed — the entry reports NO_PROBE and the UI stays truthful.
//   • Probe failures (401/403/5xx/network) are REPORTED but never written as
//     provider-health failures: a usage probe is not a model call, and it must
//     not degrade the provider's health score.
//   • Secrets never leave the server: only Authorization headers are sent;
//     only non-secret summaries are logged/reported.
//
// TODAY'S REAL COVERAGE (documented in docs/api/PROVIDER_USAGE_INGESTION.md)
//   openai     → dashboard billing subscription + usage (real hard USD limit)
//   deepseek   → /user/balance (prepaid balance — no quota ceiling)
//   openrouter → /api/v1/auth/key credits (bounded only when limit >= 0)
//   google     → NO probe (Gemini API keys expose no usage/billing endpoint)
//   anthropic  → NO probe (no official account usage API; headers only)
// ─────────────────────────────────────────────────────────────────────────────

import type { ProviderApplicationService } from '@vedmoulya/providers';
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

// ── OpenRouter — /api/v1/auth/key credits (bounded only when limit >= 0) ────

/**
 * OpenRouter reports per-key credit usage and limit. A finite limit (>= 0)
 * gives a REAL bounded quota; limit === -1 means unlimited credits, for which
 * no percentage is ever derived.
 */
export async function openrouterAccountProbe(
  providerId: string,
  apiKey: string,
  fetchImpl: FetchLike,
): Promise<AccountProbeResult> {
  const response = await getJson(fetchImpl, 'https://openrouter.ai/api/v1/auth/key', apiKey);
  if (!response.ok || !isRecord(response.json)) {
    return {
      providerId,
      family: 'openrouter',
      probed: true,
      ok: false,
      error: `OpenRouter auth/key endpoint failed (HTTP ${response.status})${
        response.networkError ? `: ${response.networkError}` : ''
      }`,
      detail: 'no sample written — nothing fabricated',
    };
  }
  const data = isRecord(response.json.data) ? response.json.data : {};
  const usage = asFiniteNumber(data.usage);
  const limit = asFiniteNumber(data.limit);
  const freeTier = data.is_free_tier === true;
  if (usage === undefined) {
    return {
      providerId,
      family: 'openrouter',
      probed: true,
      ok: true,
      detail: 'OpenRouter reported no credit usage for this key.',
    };
  }
  if (limit === undefined || limit === -1) {
    return {
      providerId,
      family: 'openrouter',
      probed: true,
      ok: true,
      detail: `OpenRouter key is ${freeTier ? 'free tier' : 'unlimited credits'} — no quota ceiling exists, so no percentage is recorded (nothing fabricated).`,
    };
  }
  if (limit <= 0) {
    return {
      providerId,
      family: 'openrouter',
      probed: true,
      ok: true,
      detail: 'OpenRouter credit limit is zero — no percentage is recorded (nothing fabricated).',
    };
  }
  const percent = clampPercent((usage / limit) * 100);
  return {
    providerId,
    family: 'openrouter',
    probed: true,
    ok: true,
    quotaUsedPercent: percent,
    detail: `OpenRouter credits $${usage.toFixed(4)} / limit $${limit.toFixed(4)} (${percent}%).`,
  };
}

// ── Probe registry ──────────────────────────────────────────────────────────
// Families absent from this table have NO real usage/billing endpoint today
// (google Gemini API keys, anthropic) — they are reported as NO_PROBE.

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

// ── Ingest report ───────────────────────────────────────────────────────────

export interface ProviderUsageIngestEntry {
  providerId: string;
  family: string;
  outcome:
    | 'QUOTA_WRITTEN' // real bounded quota recorded into the health sample
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
 * Runs one ingestion pass: for every runtime family with a real credential it
 * probes the provider's usage/billing endpoint and writes the honest result
 * into the registry health snapshot consumed by the AI Providers UI.
 */
export class ProviderUsageIngestor {
  private readonly providers: ProviderApplicationService;
  private readonly fetchImpl: FetchLike;
  private readonly now: () => Date;

  constructor(options: ProviderUsageIngestorOptions) {
    this.providers = options.providers;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.now = options.now ?? ((): Date => new Date());
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
      if (!definition) {
        entries.push({
          providerId: state.family,
          family: state.family,
          outcome: 'NO_PROBE',
          detail:
            state.family === 'google'
              ? 'Gemini API keys expose no usage/billing endpoint — quota stays unavailable.'
              : 'This provider exposes no usage/billing endpoint in the ingestor registry.',
        });
        continue;
      }
      try {
        const result = await definition.probe(state.family, apiKey, this.fetchImpl, this.now());
        if (!result.ok) {
          entries.push({
            providerId: result.providerId,
            family: result.family,
            outcome: 'PROBE_FAILED',
            detail: result.error ?? 'Probe failed.',
          });
          continue;
        }
        // A successful probe always refreshes lastCheckedAt. When the provider
        // reported a REAL bounded quota the percentage is recorded too — never
        // otherwise.
        const sample: {
          ok: boolean;
          checkedAt?: string;
          quotaUsedPercent?: number;
        } = { ok: true, checkedAt: at };
        let outcome: ProviderUsageIngestEntry['outcome'] = 'CHECKED_WRITTEN';
        if (result.quotaUsedPercent !== undefined) {
          sample.quotaUsedPercent = result.quotaUsedPercent;
          outcome = 'QUOTA_WRITTEN';
        }
        const write = await this.providers.recordHealthSample(result.providerId, sample);
        if (!write.success) {
          entries.push({
            providerId: result.providerId,
            family: result.family,
            outcome: 'PROBE_FAILED',
            detail: write.error ?? 'Unable to write the health sample.',
          });
          continue;
        }
        if (outcome === 'QUOTA_WRITTEN') {
          quotaSamplesWritten += 1;
        } else {
          checkedSamplesWritten += 1;
        }
        entries.push({
          providerId: result.providerId,
          family: result.family,
          outcome,
          detail: result.detail,
        });
      } catch (error) {
        entries.push({
          providerId: state.family,
          family: state.family,
          outcome: 'PROBE_FAILED',
          detail: error instanceof Error ? error.message : 'Probe threw unexpectedly.',
        });
      }
    }

    return { at, entries, quotaSamplesWritten, checkedSamplesWritten };
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
