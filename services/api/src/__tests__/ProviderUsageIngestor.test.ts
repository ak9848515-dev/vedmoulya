// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Provider Usage & Billing Ingestor Tests
//
// Proves the ingestion job's HONESTY CONTRACT with hermetic fixtures (no live
// calls, no secrets):
//   - a provider-reported bounded quota (OpenAI hard USD limit) is written
//     into the registry health snapshot,
//   - prepaid-balance-only providers (DeepSeek) are recorded as a plain
//     "checked" sample — their quotaUsedPercent is NEVER derived from a
//     balance,
//   - unlimited/free keys never produce a fabricated percentage,
//   - providers without a usage/billing endpoint (Gemini) are NO_PROBE,
//   - probe failures (401/403/network) are reported and NEVER degrade the
//     provider's health or fabricate a value,
//   - with no credentials nothing is called and nothing is written.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  InMemoryProviderRepository,
  createCatalogProviders,
  createProviderId,
  ProviderApplicationService,
} from '@vedmoulya/providers';
import type { ProviderRepository } from '@vedmoulya/providers';
import {
  ProviderUsageIngestor,
  deepseekAccountProbe,
  openrouterAccountProbe,
  openaiOrgWindow,
  openaiOrgUsageProbe,
  type OpenAIOrgUsageWindow,
} from '../services/ProviderUsageIngestor.js';

const FIXED_NOW = new Date('2026-08-15T12:00:00.000Z');
const LONG_KEY = 'sk-' + 'a'.repeat(48); // passes the runtime ≥32-char gate

type ResponseBuilder = (input: string, init?: RequestInit) => Promise<Response>;

/** JSON route helper: url → {status, body} (or throws for network errors). */
function routeFetch(
  routes: Record<string, { status?: number; body?: unknown; rawText?: string; throws?: boolean }>,
): ResponseBuilder & { mock: ReturnType<typeof vi.fn> } {
  const mock = vi.fn(async (input: string) => {
    const route = routes[input];
    if (route?.throws) throw new Error('network down');
    const text = route?.rawText ?? JSON.stringify(route?.body ?? { error: 'unexpected url' });
    return new Response(text, {
      status: route?.status ?? (route ? 200 : 404),
      headers: { 'Content-Type': 'application/json' },
    });
  });
  return mock as ResponseBuilder & { mock: ReturnType<typeof vi.fn> };
}

async function registry(): Promise<{
  repo: ProviderRepository;
  providers: ProviderApplicationService;
}> {
  const repo = new InMemoryProviderRepository(createCatalogProviders());
  return { repo, providers: new ProviderApplicationService(repo) };
}

async function healthQuota(repo: ProviderRepository, id: string): Promise<number> {
  const provider = await repo.findById(createProviderId(id));
  return provider?.health.quotaUsedPercent ?? -1;
}

async function lastCheckedAt(repo: ProviderRepository, id: string): Promise<string | null> {
  const provider = await repo.findById(createProviderId(id));
  return provider?.health.lastCheckedAt ?? null;
}

function baseEnv(
  overrides: Record<string, string | undefined> = {},
): Record<string, string | undefined> {
  return { NODE_ENV: 'test', AI_OPENAI_API_KEY: LONG_KEY, ...overrides };
}

describe('ProviderUsageIngestor', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('writes a REAL bounded quota from the OpenAI dashboard/billing endpoints', async () => {
    const { repo, providers } = await registry();
    const fetch = routeFetch({
      'https://api.openai.com/v1/dashboard/billing/subscription': {
        body: { hard_limit_usd: 120, access_until: 4_000_000_000 },
      },
      // total_usage is in cents → $60 of a $120 hard limit = 50%.
      'https://api.openai.com/v1/dashboard/billing/usage?start_date=2026-08-01&end_date=2026-08-15':
        {
          body: { total_usage: 6000 },
        },
    });
    const ingestor = new ProviderUsageIngestor({
      providers,
      fetchImpl: fetch,
      now: () => FIXED_NOW,
    });

    const report = await ingestor.run(baseEnv());

    expect(report.quotaSamplesWritten).toBe(1);
    const entry = report.entries.find((e) => e.family === 'openai');
    expect(entry?.outcome).toBe('QUOTA_WRITTEN');
    expect(await healthQuota(repo, 'openai')).toBe(50);
    // The Bearer key is sent with the request (and never logged by the job).
    const firstCall = fetch.mock.calls[0] as [string, RequestInit?] | undefined;
    expect(firstCall?.[0]).toContain('dashboard/billing/subscription');
    const headers = firstCall?.[1]?.headers as Record<string, string> | undefined;
    expect(headers?.Authorization).toBe(`Bearer ${LONG_KEY}`);
  });

  it('does NOT fabricate quota when OpenAI reports no hard limit (org/credit accounts)', async () => {
    const { repo, providers } = await registry();
    const fetch = routeFetch({
      'https://api.openai.com/v1/dashboard/billing/subscription': {
        body: { hard_limit_usd: null, access_until: 4_000_000_000 },
      },
    });
    const ingestor = new ProviderUsageIngestor({
      providers,
      fetchImpl: fetch,
      now: () => FIXED_NOW,
    });

    const report = await ingestor.run(baseEnv());

    const entry = report.entries.find((e) => e.family === 'openai');
    expect(entry?.outcome).toBe('CHECKED_WRITTEN');
    // Seed stays untouched — no invented percentage.
    expect(await healthQuota(repo, 'openai')).toBe(45);
    expect(await lastCheckedAt(repo, 'openai')).toBe(report.at);
  });

  it('reports OpenAI 403s honestly and writes NOTHING (no health damage, no fake value)', async () => {
    const { repo, providers } = await registry();
    const fetch = routeFetch({
      'https://api.openai.com/v1/dashboard/billing/subscription': {
        status: 403,
        body: { error: { message: 'forbidden' } },
      },
    });
    const before = await lastCheckedAt(repo, 'openai');
    const ingestor = new ProviderUsageIngestor({
      providers,
      fetchImpl: fetch,
      now: () => FIXED_NOW,
    });

    const report = await ingestor.run(baseEnv());

    const entry = report.entries.find((e) => e.family === 'openai');
    expect(entry?.outcome).toBe('PROBE_FAILED');
    expect(entry?.detail).toContain('user-scoped');
    expect(report.quotaSamplesWritten).toBe(0);
    expect(report.checkedSamplesWritten).toBe(0);
    expect(await healthQuota(repo, 'openai')).toBe(45);
    // Nothing was written — the health snapshot is untouched.
    expect(await lastCheckedAt(repo, 'openai')).toBe(before);
  });

  it('records DeepSeek as CHECKED — a prepaid balance is never turned into a percentage', async () => {
    const { repo, providers } = await registry();
    const fetch = routeFetch({
      'https://api.deepseek.com/user/balance': {
        body: {
          is_available: true,
          balance_infos: [
            { currency: 'CNY', total_balance: 12.34, granted_balance: 0, topped_up_balance: 12.34 },
          ],
        },
      },
    });
    const ingestor = new ProviderUsageIngestor({
      providers,
      fetchImpl: fetch,
      now: () => FIXED_NOW,
    });

    const report = await ingestor.run(
      baseEnv({ AI_OPENAI_API_KEY: undefined, AI_DEEPSEEK_API_KEY: LONG_KEY }),
    );

    const entry = report.entries.find((e) => e.family === 'deepseek');
    expect(entry?.outcome).toBe('CHECKED_WRITTEN');
    expect(entry?.detail).toContain('no percentage is recorded');
    expect(await healthQuota(repo, 'deepseek')).toBe(55); // seed untouched
  });

  it('never probes Gemini — no usage/billing endpoint exists for API keys', async () => {
    const { repo, providers } = await registry();
    const fetch = routeFetch({});
    const ingestor = new ProviderUsageIngestor({
      providers,
      fetchImpl: fetch,
      now: () => FIXED_NOW,
    });

    const report = await ingestor.run(
      baseEnv({ AI_OPENAI_API_KEY: undefined, AI_GOOGLE_API_KEY: LONG_KEY }),
    );

    const entry = report.entries.find((e) => e.family === 'google');
    expect(entry?.outcome).toBe('NO_PROBE');
    expect(entry?.detail).toContain('no usage/billing endpoint');
    expect(fetch.mock.calls.length).toBe(0);
    expect(await healthQuota(repo, 'google')).toBe(30); // seed untouched
  });

  it('ingests Anthropic admin usage + cost reports as genuine account metrics (never a quota %)', async () => {
    const { repo, providers } = await registry();
    const fetch = routeFetch({
      'https://api.anthropic.com/v1/organizations/usage_report/messages?starting_at=2026-08-01T00%3A00%3A00.000Z&ending_at=2026-08-15T12%3A00%3A00.000Z&bucket_width=1d&limit=31':
        {
          body: {
            data: [
              {
                starting_at: '2026-08-01T00:00:00Z',
                ending_at: '2026-08-02T00:00:00Z',
                results: [
                  {
                    model: 'claude-sonnet-4',
                    uncached_input_tokens: 1000,
                    cache_read_input_tokens: 200,
                    output_tokens: 300,
                  },
                ],
              },
            ],
            has_more: false,
          },
        },
      'https://api.anthropic.com/v1/organizations/cost_report?starting_at=2026-08-01T00%3A00%3A00.000Z&ending_at=2026-08-15T12%3A00%3A00.000Z&limit=31':
        {
          body: {
            data: [
              {
                starting_at: '2026-08-01T00:00:00Z',
                ending_at: '2026-08-02T00:00:00Z',
                results: [{ amount: '1500.0', currency: 'USD', description: 'Claude Sonnet' }],
              },
            ],
            has_more: false,
          },
        },
    });
    const ingestor = new ProviderUsageIngestor({
      providers,
      fetchImpl: fetch,
      now: () => FIXED_NOW,
    });

    const report = await ingestor.run(
      baseEnv({ AI_OPENAI_API_KEY: undefined, AI_ANTHROPIC_API_KEY: LONG_KEY }),
    );

    const entry = report.entries.find((e) => e.family === 'anthropic');
    expect(entry?.outcome).toBe('METRICS_WRITTEN');
    expect(report.accountMetricsWritten).toBe(2);

    const provider = await repo.findById(createProviderId('anthropic'));
    const metrics = provider?.health.accountUsage;
    expect(metrics?.ACCOUNT_TOKENS?.value).toBe(1300); // 1000 uncached + 300 output
    expect(metrics?.ACCOUNT_TOKENS?.unit).toBe('tokens');
    expect(metrics?.ACCOUNT_COST?.value).toBeCloseTo(15, 6); // 1500 cents → $15
    expect(metrics?.ACCOUNT_COST?.unit).toBe('usd');
    expect(metrics?.ACCOUNT_COST?.source).toContain('cost_report');
    // A NO quota percentage is ever derived from these account metrics.
    expect(provider?.health.quotaSource).not.toBe('PROVIDER_REPORTED');
    // The admin key is sent via x-api-key, NOT as a Bearer token.
    const firstCall = fetch.mock.calls[0] as [string, RequestInit?] | undefined;
    const headers = firstCall?.[1]?.headers as Record<string, string> | undefined;
    expect(headers?.['x-api-key']).toBe(LONG_KEY);
    expect(headers?.Authorization).toBeUndefined();
  });

  it('rejects Anthropic account-metric ingestion when the key lacks admin scope (401/403)', async () => {
    const { repo, providers } = await registry();
    const fetch = routeFetch({
      'https://api.anthropic.com/v1/organizations/usage_report/messages?starting_at=2026-08-01T00%3A00%3A00.000Z&ending_at=2026-08-15T12%3A00%3A00.000Z&bucket_width=1d&limit=31':
        { status: 403, body: { error: 'forbidden' } },
      'https://api.anthropic.com/v1/organizations/cost_report?starting_at=2026-08-01T00%3A00%3A00.000Z&ending_at=2026-08-15T12%3A00%3A00.000Z&limit=31':
        { status: 403, body: { error: 'forbidden' } },
    });
    const ingestor = new ProviderUsageIngestor({
      providers,
      fetchImpl: fetch,
      now: () => FIXED_NOW,
    });
    const report = await ingestor.run(
      baseEnv({ AI_OPENAI_API_KEY: undefined, AI_ANTHROPIC_API_KEY: LONG_KEY }),
    );
    const entry = report.entries.find((e) => e.family === 'anthropic');
    expect(entry?.outcome).toBe('PROBE_FAILED');
    expect(report.accountMetricsWritten).toBe(0);
    // Nothing fabricated: no metric was written.
    const provider = await repo.findById(createProviderId('anthropic'));
    expect(provider?.health.accountUsage).toBeUndefined();
  });

  it('does nothing when no provider credentials are configured', async () => {
    const { repo, providers } = await registry();
    const fetch = routeFetch({});
    const ingestor = new ProviderUsageIngestor({
      providers,
      fetchImpl: fetch,
      now: () => FIXED_NOW,
    });

    const report = await ingestor.run({ NODE_ENV: 'test' });

    expect(report.entries.every((e) => e.outcome === 'NOT_CONFIGURED')).toBe(true);
    expect(fetch.mock.calls.length).toBe(0);
    expect(report.quotaSamplesWritten).toBe(0);
    expect(report.checkedSamplesWritten).toBe(0);
  });

  it('surfaces network failures without writing samples or degrading health', async () => {
    const { repo, providers } = await registry();
    const fetch = routeFetch({
      'https://api.openai.com/v1/dashboard/billing/subscription': { throws: true },
    });
    const before = await lastCheckedAt(repo, 'openai');
    const ingestor = new ProviderUsageIngestor({
      providers,
      fetchImpl: fetch,
      now: () => FIXED_NOW,
    });

    const report = await ingestor.run(baseEnv());

    const entry = report.entries.find((e) => e.family === 'openai');
    expect(entry?.outcome).toBe('PROBE_FAILED');
    expect(entry?.detail).toContain('network');
    expect(report.quotaSamplesWritten).toBe(0);
    expect(await healthQuota(repo, 'openai')).toBe(45);
    // Nothing was written — the health snapshot is untouched.
    expect(await lastCheckedAt(repo, 'openai')).toBe(before);
  });

  it('reports an unreadable OpenAI subscription response without writing anything', async () => {
    const { repo, providers } = await registry();
    const fetch = routeFetch({
      'https://api.openai.com/v1/dashboard/billing/subscription': {
        rawText: 'not-json-at-all',
      },
    });
    const before = await lastCheckedAt(repo, 'openai');
    const ingestor = new ProviderUsageIngestor({
      providers,
      fetchImpl: fetch,
      now: () => FIXED_NOW,
    });

    const report = await ingestor.run(baseEnv());

    const entry = report.entries.find((e) => e.family === 'openai');
    expect(entry?.outcome).toBe('PROBE_FAILED');
    expect(entry?.detail).toContain('unreadable response');
    expect(await healthQuota(repo, 'openai')).toBe(45);
    expect(await lastCheckedAt(repo, 'openai')).toBe(before);
  });

  it('reports a generic OpenAI billing failure (HTTP 500) without writing anything', async () => {
    const { repo, providers } = await registry();
    const fetch = routeFetch({
      'https://api.openai.com/v1/dashboard/billing/subscription': {
        status: 500,
        body: { error: 'boom' },
      },
    });
    const before = await lastCheckedAt(repo, 'openai');
    const ingestor = new ProviderUsageIngestor({
      providers,
      fetchImpl: fetch,
      now: () => FIXED_NOW,
    });

    const report = await ingestor.run(baseEnv());

    const entry = report.entries.find((e) => e.family === 'openai');
    expect(entry?.outcome).toBe('PROBE_FAILED');
    expect(entry?.detail).toContain('HTTP 500');
    expect(await healthQuota(repo, 'openai')).toBe(45);
    expect(await lastCheckedAt(repo, 'openai')).toBe(before);
  });

  it('reports a failing OpenAI usage endpoint without writing anything', async () => {
    const { repo, providers } = await registry();
    const fetch = routeFetch({
      'https://api.openai.com/v1/dashboard/billing/subscription': {
        body: { hard_limit_usd: 120, access_until: 4_000_000_000 },
      },
      'https://api.openai.com/v1/dashboard/billing/usage?start_date=2026-08-01&end_date=2026-08-15':
        {
          status: 500,
          body: { error: 'boom' },
        },
    });
    const before = await lastCheckedAt(repo, 'openai');
    const ingestor = new ProviderUsageIngestor({
      providers,
      fetchImpl: fetch,
      now: () => FIXED_NOW,
    });

    const report = await ingestor.run(baseEnv());

    const entry = report.entries.find((e) => e.family === 'openai');
    expect(entry?.outcome).toBe('PROBE_FAILED');
    expect(entry?.detail).toContain('quota not updated');
    expect(await healthQuota(repo, 'openai')).toBe(45);
    expect(await lastCheckedAt(repo, 'openai')).toBe(before);
  });

  it('reports an unreadable OpenAI usage response without writing anything', async () => {
    const { repo, providers } = await registry();
    const fetch = routeFetch({
      'https://api.openai.com/v1/dashboard/billing/subscription': {
        body: { hard_limit_usd: 120, access_until: 4_000_000_000 },
      },
      'https://api.openai.com/v1/dashboard/billing/usage?start_date=2026-08-01&end_date=2026-08-15':
        {
          rawText: 'oops',
        },
    });
    const before = await lastCheckedAt(repo, 'openai');
    const ingestor = new ProviderUsageIngestor({
      providers,
      fetchImpl: fetch,
      now: () => FIXED_NOW,
    });

    const report = await ingestor.run(baseEnv());

    const entry = report.entries.find((e) => e.family === 'openai');
    expect(entry?.outcome).toBe('PROBE_FAILED');
    expect(entry?.detail).toContain('unreadable response');
    expect(await healthQuota(repo, 'openai')).toBe(45);
    expect(await lastCheckedAt(repo, 'openai')).toBe(before);
  });

  it('surfaces a DeepSeek endpoint failure without writing anything', async () => {
    const { repo, providers } = await registry();
    const fetch = routeFetch({
      'https://api.deepseek.com/user/balance': { status: 401, body: {} },
    });
    const before = await lastCheckedAt(repo, 'deepseek');
    const ingestor = new ProviderUsageIngestor({
      providers,
      fetchImpl: fetch,
      now: () => FIXED_NOW,
    });

    const report = await ingestor.run(
      baseEnv({ AI_OPENAI_API_KEY: undefined, AI_DEEPSEEK_API_KEY: LONG_KEY }),
    );

    const entry = report.entries.find((e) => e.family === 'deepseek');
    expect(entry?.outcome).toBe('PROBE_FAILED');
    expect(await healthQuota(repo, 'deepseek')).toBe(55);
    expect(await lastCheckedAt(repo, 'deepseek')).toBe(before);
  });

  it('catches a throwing registry write and reports PROBE_FAILED (no crash)', async () => {
    const { providers } = await registry();
    const fetch = routeFetch({
      'https://api.openai.com/v1/dashboard/billing/subscription': {
        body: { hard_limit_usd: 120, access_until: 4_000_000_000 },
      },
      'https://api.openai.com/v1/dashboard/billing/usage?start_date=2026-08-01&end_date=2026-08-15':
        {
          body: { total_usage: 6000 },
        },
    });
    vi.spyOn(providers, 'recordHealthSample').mockRejectedValue(new Error('db down'));
    const ingestor = new ProviderUsageIngestor({
      providers,
      fetchImpl: fetch,
      now: () => FIXED_NOW,
    });

    const report = await ingestor.run(baseEnv());

    const entry = report.entries.find((e) => e.family === 'openai');
    expect(entry?.outcome).toBe('PROBE_FAILED');
    expect(entry?.detail).toContain('db down');
  });

  it('records CHECKED (no percentage) when the usage window returns no total', async () => {
    const { repo, providers } = await registry();
    const fetch = routeFetch({
      'https://api.openai.com/v1/dashboard/billing/subscription': {
        body: { hard_limit_usd: 120, access_until: 4_000_000_000 },
      },
      'https://api.openai.com/v1/dashboard/billing/usage?start_date=2026-08-01&end_date=2026-08-15':
        {
          body: {},
        },
    });
    const ingestor = new ProviderUsageIngestor({
      providers,
      fetchImpl: fetch,
      now: () => FIXED_NOW,
    });

    const report = await ingestor.run(baseEnv());

    const entry = report.entries.find((e) => e.family === 'openai');
    expect(entry?.outcome).toBe('CHECKED_WRITTEN');
    expect(await healthQuota(repo, 'openai')).toBe(45);
  });

  it('records CHECKED (no percentage) when the OpenAI subscription period has ended', async () => {
    const { repo, providers } = await registry();
    const fetch = routeFetch({
      'https://api.openai.com/v1/dashboard/billing/subscription': {
        body: { hard_limit_usd: 120, access_until: 1 },
      },
    });
    const ingestor = new ProviderUsageIngestor({
      providers,
      fetchImpl: fetch,
      now: () => FIXED_NOW,
    });

    const report = await ingestor.run(baseEnv());

    const entry = report.entries.find((e) => e.family === 'openai');
    expect(entry?.outcome).toBe('CHECKED_WRITTEN');
    expect(entry?.detail).toContain('access period has ended');
    expect(await healthQuota(repo, 'openai')).toBe(45);
  });

  it('records DeepSeek CHECKED when the balance endpoint reports no usable balance', async () => {
    const { repo, providers } = await registry();
    for (const body of [
      { is_available: false },
      { is_available: true, balance_infos: [] },
      { is_available: true, balance_infos: [7] },
    ]) {
      const fetch = routeFetch({
        'https://api.deepseek.com/user/balance': { body },
      });
      const ingestor = new ProviderUsageIngestor({
        providers,
        fetchImpl: fetch,
        now: () => FIXED_NOW,
      });
      const report = await ingestor.run(
        baseEnv({ AI_OPENAI_API_KEY: undefined, AI_DEEPSEEK_API_KEY: LONG_KEY }),
      );
      const entry = report.entries.find((e) => e.family === 'deepseek');
      expect(entry?.outcome).toBe('CHECKED_WRITTEN');
      expect(await healthQuota(repo, 'deepseek')).toBe(55);
    }
  });

  it('surfaces a missing registry provider as PROBE_FAILED (no crash)', async () => {
    const repo = new InMemoryProviderRepository([]);
    const providers = new ProviderApplicationService(repo);
    const fetch = routeFetch({
      'https://api.openai.com/v1/dashboard/billing/subscription': {
        body: { hard_limit_usd: 120, access_until: 4_000_000_000 },
      },
      'https://api.openai.com/v1/dashboard/billing/usage?start_date=2026-08-01&end_date=2026-08-15':
        {
          body: { total_usage: 6000 },
        },
    });
    const ingestor = new ProviderUsageIngestor({
      providers,
      fetchImpl: fetch,
      now: () => FIXED_NOW,
    });

    const report = await ingestor.run(baseEnv());

    const entry = report.entries.find((e) => e.family === 'openai');
    expect(entry?.outcome).toBe('PROBE_FAILED');
    expect(entry?.detail).toContain('not found');
  });
});

describe('openaiOrgWindow (real UTC periods)', () => {
  // 2026-08-15 is a Saturday, 12:00 UTC.
  const NOW = new Date('2026-08-15T12:00:00.000Z');

  it('builds the Today window from 00:00 UTC', () => {
    const w = openaiOrgWindow('today', NOW);
    expect(w.startEpochSec).toBe(Math.floor(Date.UTC(2026, 7, 15) / 1000));
    expect(w.endEpochSec).toBe(Math.floor(NOW.getTime() / 1000));
    expect(w.label).toBe('Today');
  });

  it('builds the This week window from the most recent Monday 00:00 UTC', () => {
    const w = openaiOrgWindow('week', NOW);
    // Saturday 2026-08-15 → Monday 2026-08-10.
    expect(w.startEpochSec).toBe(Math.floor(Date.UTC(2026, 7, 10) / 1000));
    expect(w.label).toBe('This week');
  });

  it('builds the This month window from the 1st 00:00 UTC', () => {
    const w = openaiOrgWindow('month', NOW);
    expect(w.startEpochSec).toBe(Math.floor(Date.UTC(2026, 7, 1) / 1000));
    expect(w.label).toBe('This month');
  });
});

describe('openaiOrgUsageProbe (per-model aggregation)', () => {
  const window: OpenAIOrgUsageWindow = {
    period: 'month',
    startEpochSec: 1_752_508_800,
    endEpochSec: 1_755_158_400,
    label: 'This month',
  };

  it('aggregates real per-model token totals across daily buckets', async () => {
    const fetch = routeFetch({
      [`https://api.openai.com/v1/organization/usage/completions?start_time=${window.startEpochSec}&end_time=${window.endEpochSec}&bucket_width=1d&group_by%5B%5D=model&limit=1000`]:
        {
          body: {
            object: 'page',
            data: [
              {
                object: 'bucket',
                start_time: window.startEpochSec,
                end_time: window.startEpochSec,
                results: [
                  {
                    input_tokens: 1000,
                    input_cached_tokens: 0,
                    output_tokens: 500,
                    model: 'gpt-4o',
                  },
                  {
                    input_tokens: 200,
                    input_cached_tokens: 800,
                    output_tokens: 50,
                    model: 'gpt-4o-mini',
                  },
                ],
              },
              {
                object: 'bucket',
                start_time: window.startEpochSec + 86_400,
                end_time: window.startEpochSec + 86_400,
                results: [
                  {
                    input_tokens: 400,
                    input_cached_tokens: 100,
                    output_tokens: 300,
                    model: 'gpt-4o',
                  },
                ],
              },
            ],
            has_more: false,
          },
        },
    });

    const result = await openaiOrgUsageProbe(LONG_KEY, fetch, window);

    expect(result.ok).toBe(true);
    expect(result.hasMore).toBe(false);
    const gpt4o = result.rows.find((r) => r.model === 'gpt-4o');
    const mini = result.rows.find((r) => r.model === 'gpt-4o-mini');
    expect(gpt4o).toMatchObject({ inputTokens: 1400, cachedInputTokens: 100, outputTokens: 800 });
    expect(mini).toMatchObject({ inputTokens: 200, cachedInputTokens: 800, outputTokens: 50 });
    expect(result.totals).toEqual({ inputTokens: 1600, cachedInputTokens: 900, outputTokens: 850 });
  });

  it('reports an empty org account as honest zero totals', async () => {
    const fetch = routeFetch({
      [`https://api.openai.com/v1/organization/usage/completions?start_time=${window.startEpochSec}&end_time=${window.endEpochSec}&bucket_width=1d&group_by%5B%5D=model&limit=1000`]:
        {
          body: { object: 'page', data: [], has_more: false },
        },
    });
    const result = await openaiOrgUsageProbe(LONG_KEY, fetch, window);
    expect(result.ok).toBe(true);
    expect(result.rows).toEqual([]);
    expect(result.totals).toEqual({ inputTokens: 0, cachedInputTokens: 0, outputTokens: 0 });
  });

  it('surfaces the org admin-scope requirement without fabricating data', async () => {
    const fetch = routeFetch({
      [`https://api.openai.com/v1/organization/usage/completions?start_time=${window.startEpochSec}&end_time=${window.endEpochSec}&bucket_width=1d&group_by%5B%5D=model&limit=1000`]:
        {
          status: 401,
          body: { error: { message: 'unauthorized' } },
        },
    });
    const result = await openaiOrgUsageProbe(LONG_KEY, fetch, window);
    expect(result.ok).toBe(false);
    expect(result.error).toContain('Organization admin-scope');
    expect(result.rows).toEqual([]);
  });
});

describe('openrouterAccountProbe (official /api/v1/key schema)', () => {
  const NOW = new Date('2026-10-12T09:00:00.000Z');

  it('calls ONLY the official /api/v1/key endpoint (no generation, no legacy path)', async () => {
    const fetch = routeFetch({
      'https://openrouter.ai/api/v1/key': { body: { data: { label: 'k', usage: 2.5, limit: 10 } } },
    });
    await openrouterAccountProbe('openrouter', LONG_KEY, fetch, NOW);
    const urls = fetch.mock.calls.map((c) => (c as [string])[0]);
    expect(urls).toEqual(['https://openrouter.ai/api/v1/key']);
    expect(urls.some((u) => u.includes('auth/key'))).toBe(false);
  });

  it('writes a percentage from a FINITE limit and a real usage', async () => {
    const fetch = routeFetch({
      'https://openrouter.ai/api/v1/key': {
        body: {
          data: {
            label: 'k',
            usage: 2.5,
            limit: 10,
            limit_remaining: 7.5,
            limit_reset: 'monthly',
            is_free_tier: false,
          },
        },
      },
    });
    const result = await openrouterAccountProbe('openrouter', LONG_KEY, fetch, NOW);
    expect(result.ok).toBe(true);
    expect(result.quotaUsedPercent).toBe(25);
    // Genuine metric: usage all-time as ACCOUNT_COST and key remaining as ACCOUNT_CREDITS.
    const cost = result.accountUsage?.find((m) => m.metric === 'ACCOUNT_COST');
    const credits = result.accountUsage?.find((m) => m.metric === 'ACCOUNT_CREDITS');
    expect(cost?.value).toBe(2.5);
    expect(cost?.unit).toBe('usd');
    expect(cost?.source).toBe('GET https://openrouter.ai/api/v1/key');
    expect(cost?.retrievedAt).toBe(NOW.toISOString());
    // limit_remaining is KEY-level — distinct metric/value, correctly labelled by name.
    expect(credits?.value).toBe(7.5);
    expect(credits?.unit).toBe('usd');
    expect(result.detail).toContain('limit reset: monthly');
  });

  it('includes the reported daily/weekly/monthly usage as a verbatim breakdown', async () => {
    const fetch = routeFetch({
      'https://openrouter.ai/api/v1/key': {
        body: {
          data: { usage: 100, limit: 200, usage_daily: 1, usage_weekly: 5, usage_monthly: 20 },
        },
      },
    });
    const result = await openrouterAccountProbe('openrouter', LONG_KEY, fetch, NOW);
    const cost = result.accountUsage?.find((m) => m.metric === 'ACCOUNT_COST');
    expect(cost?.breakdown).toEqual([
      { key: 'usage_daily', value: 1, unit: 'usd' },
      { key: 'usage_weekly', value: 5, unit: 'usd' },
      { key: 'usage_monthly', value: 20, unit: 'usd' },
    ]);
  });

  it('reports an OpenRouter endpoint failure without fabricating quota', async () => {
    const fetch = routeFetch({
      'https://openrouter.ai/api/v1/key': { status: 401, body: {} },
    });
    const result = await openrouterAccountProbe('openrouter', LONG_KEY, fetch, NOW);
    expect(result.ok).toBe(false);
    expect(result.quotaUsedPercent).toBeUndefined();
    expect(result.accountUsage).toBeUndefined();
    expect(result.error).toContain('401');
  });

  it('reports a 403 without writing any metric', async () => {
    const fetch = routeFetch({
      'https://openrouter.ai/api/v1/key': { status: 403, body: { error: 'forbidden' } },
    });
    const result = await openrouterAccountProbe('openrouter', LONG_KEY, fetch, NOW);
    expect(result.ok).toBe(false);
    expect(result.accountUsage).toBeUndefined();
    expect(result.quotaUsedPercent).toBeUndefined();
  });

  it('rejects a malformed response (missing `data` envelope) without writing', async () => {
    const fetch = routeFetch({
      'https://openrouter.ai/api/v1/key': { body: { usage: 5, limit: 10 } },
    });
    const result = await openrouterAccountProbe('openrouter', LONG_KEY, fetch, NOW);
    expect(result.ok).toBe(false);
    expect(result.accountUsage).toBeUndefined();
    expect(result.error).toContain('unexpected shape');
  });

  it('treats limit:null as UNLIMITED — never a percentage', async () => {
    for (const isFree of [true, false]) {
      const fetch = routeFetch({
        'https://openrouter.ai/api/v1/key': {
          body: { data: { usage: 1.2, limit: null, limit_remaining: null, is_free_tier: isFree } },
        },
      });
      const result = await openrouterAccountProbe('openrouter', LONG_KEY, fetch, NOW);
      expect(result.ok).toBe(true);
      expect(result.quotaUsedPercent).toBeUndefined();
      expect(result.detail).toContain('no percentage is recorded');
      // Usage is still a genuine reported value even when unlimited.
      expect(result.accountUsage?.find((m) => m.metric === 'ACCOUNT_COST')?.value).toBe(1.2);
    }
  });

  it('records no percentage for a zero limit', async () => {
    const fetch = routeFetch({
      'https://openrouter.ai/api/v1/key': { body: { data: { usage: 1.2, limit: 0 } } },
    });
    const result = await openrouterAccountProbe('openrouter', LONG_KEY, fetch, NOW);
    expect(result.ok).toBe(true);
    expect(result.quotaUsedPercent).toBeUndefined();
    expect(result.detail).toContain('no percentage is recorded');
  });

  it('never trusts non-finite usage/limit (no NaN/Infinity percentage)', async () => {
    const fetch = routeFetch({
      'https://openrouter.ai/api/v1/key': {
        rawText: '{"data":{"usage":"NaN","limit":"Infinity"}}',
      },
    });
    const result = await openrouterAccountProbe('openrouter', LONG_KEY, fetch, NOW);
    expect(result.ok).toBe(true);
    expect(result.quotaUsedPercent).toBeUndefined();
    expect(result.accountUsage).toBeUndefined();
  });

  it('records no percentage when a finite limit has no usable usage figure', async () => {
    const fetch = routeFetch({
      'https://openrouter.ai/api/v1/key': { body: { data: { limit: 10 } } },
    });
    const result = await openrouterAccountProbe('openrouter', LONG_KEY, fetch, NOW);
    expect(result.ok).toBe(true);
    expect(result.quotaUsedPercent).toBeUndefined();
    expect(result.detail).toContain('no usable usage figure');
  });

  it('records CHECKED when DeepSeek reports a balance without a numeric total', async () => {
    const fetch = routeFetch({
      'https://api.deepseek.com/user/balance': {
        body: { is_available: true, balance_infos: [{ currency: 'CNY' }] },
      },
    });
    const result = await deepseekAccountProbe('deepseek', LONG_KEY, fetch);
    expect(result.ok).toBe(true);
    expect(result.quotaUsedPercent).toBeUndefined();
    expect(result.detail).toContain('numeric total');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// IN-PRODUCT ACTIVATION — the ingest's report and the provenance it writes.
//
// The ingest used to be reachable only from the operator CLI script, so no
// runtime path ever refreshed a provider quota. These tests pin the two pieces
// that make it usable in product:
//   • the last pass is retained so the gateway can report what really happened
//     (which family reported a quota, which has no usage endpoint, which failed)
//   • an ingested quota lands in the registry as PROVIDER_REPORTED, i.e. the AI
//     Providers screen may present it as account usage
// ─────────────────────────────────────────────────────────────────────────────

describe('ProviderUsageIngestor — in-product status + written provenance', () => {
  it('retains the last pass (undefined before any run, replaced after each run)', async () => {
    const { providers } = await registry();
    const fetch = routeFetch({
      'https://api.openai.com/v1/dashboard/billing/subscription': {
        body: { hard_limit_usd: 120, access_until: 4_000_000_000 },
      },
      'https://api.openai.com/v1/dashboard/billing/usage?start_date=2026-08-01&end_date=2026-08-15':
        {
          body: { total_usage: 3000 }, // $30 of $120 = 25%
        },
    });
    const ingestor = new ProviderUsageIngestor({
      providers,
      fetchImpl: fetch,
      now: () => FIXED_NOW,
    });

    expect(ingestor.getLastReport()).toBeUndefined();

    const first = await ingestor.run(baseEnv());
    expect(ingestor.getLastReport()).toBe(first);
    expect(ingestor.getLastReport()?.quotaSamplesWritten).toBe(1);

    // A second pass with no credential reports NOT_CONFIGURED and REPLACES it.
    const second = await ingestor.run({ NODE_ENV: 'test' });
    expect(ingestor.getLastReport()).toBe(second);
    expect(ingestor.getLastReport()?.quotaSamplesWritten).toBe(0);
    expect(
      ingestor.getLastReport()?.entries.every((entry) => entry.outcome === 'NOT_CONFIGURED'),
    ).toBe(true);
  });

  it('marks the written quota PROVIDER_REPORTED so the UI may show account usage', async () => {
    const { repo, providers } = await registry();
    const fetch = routeFetch({
      'https://api.openai.com/v1/dashboard/billing/subscription': {
        body: { hard_limit_usd: 100, access_until: 4_000_000_000 },
      },
      'https://api.openai.com/v1/dashboard/billing/usage?start_date=2026-08-01&end_date=2026-08-15':
        {
          body: { total_usage: 8000 }, // $80 of $100 = 80%
        },
    });
    const ingestor = new ProviderUsageIngestor({
      providers,
      fetchImpl: fetch,
      now: () => FIXED_NOW,
    });

    const report = await ingestor.run(baseEnv());
    expect(report.quotaSamplesWritten).toBe(1);

    const provider = await repo.findById(createProviderId('openai'));
    expect(provider?.health.quotaUsedPercent).toBe(80);
    expect(provider?.health.quotaSource).toBe('PROVIDER_REPORTED');
    // The pass only writes quota + lastCheckedAt/failure bookkeeping — the
    // latency/score/latency-probe fields are NOT measured by a billing probe,
    // but the record IS a runtime write, so it is no longer catalog seed data.
    expect(provider?.health.healthSource).toBe('MEASURED');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SPRINT 013 — provider-reported ACCOUNT usage/cost ingestion.
//
// Proves genuine provider responses are persisted verbatim with provider,
// metric, source, retrieval timestamp and window, and that ingestion is
// idempotent and never fabricates a value. Kept DISTINCT from runtime tokens
// and estimated cost (never converted into a quota percentage).
// ─────────────────────────────────────────────────────────────────────────────

const OPENAI_ORG_USAGE_URL = (w: OpenAIOrgUsageWindow): string =>
  `https://api.openai.com/v1/organization/usage/completions?start_time=${w.startEpochSec}&end_time=${w.endEpochSec}&bucket_width=1d&group_by%5B%5D=model&limit=1000`;
const OPENAI_ORG_COST_URL = (w: OpenAIOrgUsageWindow): string =>
  `https://api.openai.com/v1/organization/costs?start_time=${w.startEpochSec}&end_time=${w.endEpochSec}&bucket_width=1d&group_by%5B%5D=line_item&limit=1000`;

const MONTH_WINDOW = openaiOrgWindow('month', FIXED_NOW);

function openaiOrgRoutes(
  usageBody: unknown,
  costBody: unknown,
  statuses: { usage?: number; cost?: number } = {},
): ReturnType<typeof routeFetch> {
  return routeFetch({
    [OPENAI_ORG_USAGE_URL(MONTH_WINDOW)]: { body: usageBody, status: statuses.usage },
    [OPENAI_ORG_COST_URL(MONTH_WINDOW)]: { body: costBody, status: statuses.cost },
  });
}

const EMPTY_USAGE = { object: 'page', data: [], has_more: false };
const EMPTY_COST = { object: 'page', data: [], has_more: false };

describe('ProviderUsageIngestor — OpenAI organization usage/cost metrics', () => {
  it('persists account tokens AND account cost verbatim with source, time and window', async () => {
    const { repo, providers } = await registry();
    const fetch = openaiOrgRoutes(
      {
        object: 'page',
        data: [
          {
            object: 'bucket',
            start_time: MONTH_WINDOW.startEpochSec,
            end_time: MONTH_WINDOW.endEpochSec,
            results: [
              { model: 'gpt-4o', input_tokens: 1000, input_cached_tokens: 0, output_tokens: 500 },
            ],
          },
        ],
        has_more: false,
      },
      {
        object: 'page',
        data: [
          {
            object: 'bucket',
            start_time: MONTH_WINDOW.startEpochSec,
            end_time: MONTH_WINDOW.endEpochSec,
            results: [{ amount: { value: 12.34, currency: 'usd' }, line_item: 'gpt-4o' }],
          },
        ],
        has_more: false,
      },
    );
    const ingestor = new ProviderUsageIngestor({
      providers,
      fetchImpl: fetch,
      now: () => FIXED_NOW,
    });

    const report = await ingestor.run(baseEnv());
    expect(
      report.entries.some((e) => e.family === 'openai' && e.outcome === 'METRICS_WRITTEN'),
    ).toBe(true);
    expect(report.accountMetricsWritten).toBe(2);

    const provider = await repo.findById(createProviderId('openai'));
    const tokens = provider?.health.accountUsage?.ACCOUNT_TOKENS;
    const cost = provider?.health.accountUsage?.ACCOUNT_COST;
    expect(tokens?.value).toBe(1500);
    expect(tokens?.unit).toBe('tokens');
    expect(tokens?.source).toContain('/v1/organization/usage/completions');
    expect(tokens?.retrievedAt).toBe(FIXED_NOW.toISOString());
    expect(tokens?.window).toEqual({
      startEpochSec: MONTH_WINDOW.startEpochSec,
      endEpochSec: MONTH_WINDOW.endEpochSec,
    });
    expect(cost?.value).toBeCloseTo(12.34, 6);
    expect(cost?.unit).toBe('usd');
    expect(cost?.source).toContain('/v1/organization/costs');
  });

  it('never converts account cost/tokens into a quota percentage', async () => {
    const { repo, providers } = await registry();
    const fetch = openaiOrgRoutes(
      {
        object: 'page',
        data: [
          {
            object: 'bucket',
            results: [
              { model: 'gpt-4o', input_tokens: 100, input_cached_tokens: 0, output_tokens: 10 },
            ],
          },
        ],
        has_more: false,
      },
      {
        object: 'page',
        data: [{ results: [{ amount: { value: 5, currency: 'usd' } }] }],
        has_more: false,
      },
    );
    const ingestor = new ProviderUsageIngestor({
      providers,
      fetchImpl: fetch,
      now: () => FIXED_NOW,
    });
    await ingestor.run(baseEnv());

    const provider = await repo.findById(createProviderId('openai'));
    // The seed quota (45) is untouched and NOT promoted to provider-reported.
    expect(provider?.health.quotaUsedPercent).toBe(45);
    expect(provider?.health.quotaSource).not.toBe('PROVIDER_REPORTED');
  });

  it('records honest zero account tokens for an empty org window (never "unknown")', async () => {
    const { repo, providers } = await registry();
    const fetch = openaiOrgRoutes(EMPTY_USAGE, EMPTY_COST);
    const ingestor = new ProviderUsageIngestor({
      providers,
      fetchImpl: fetch,
      now: () => FIXED_NOW,
    });
    await ingestor.run(baseEnv());

    const provider = await repo.findById(createProviderId('openai'));
    // An explicit empty window is a real reported zero for cost; tokens for an
    // empty window carry no rows, so the metric is written as a true 0.
    expect(provider?.health.accountUsage?.ACCOUNT_COST?.value).toBe(0);
  });

  it('reports a missing admin scope (401) without writing any account metric', async () => {
    const { repo, providers } = await registry();
    const fetch = openaiOrgRoutes(
      { error: 'unauthorized' },
      { error: 'unauthorized' },
      {
        usage: 401,
        cost: 401,
      },
    );
    const ingestor = new ProviderUsageIngestor({
      providers,
      fetchImpl: fetch,
      now: () => FIXED_NOW,
    });

    const report = await ingestor.run(baseEnv());
    expect(report.accountMetricsWritten).toBe(0);
    const metricFailure = report.entries.find(
      (e) =>
        e.family === 'openai' && e.outcome === 'PROBE_FAILED' && e.detail.includes('admin-scope'),
    );
    expect(metricFailure).toBeDefined();
    const provider = await repo.findById(createProviderId('openai'));
    expect(provider?.health.accountUsage).toBeUndefined();
  });

  it('reports a provider OUTAGE (5xx) without writing or fabricating account metrics', async () => {
    const { repo, providers } = await registry();
    const fetch = openaiOrgRoutes({ error: 'boom' }, { error: 'boom' }, { usage: 500, cost: 500 });
    const ingestor = new ProviderUsageIngestor({
      providers,
      fetchImpl: fetch,
      now: () => FIXED_NOW,
    });

    const report = await ingestor.run(baseEnv());
    expect(report.accountMetricsWritten).toBe(0);
    const provider = await repo.findById(createProviderId('openai'));
    expect(provider?.health.accountUsage).toBeUndefined();
  });

  it('is IDEMPOTENT: a second pass for the same window does not duplicate or corrupt meters', async () => {
    const { repo, providers } = await registry();
    const fetch = openaiOrgRoutes(
      {
        object: 'page',
        data: [
          {
            object: 'bucket',
            results: [
              { model: 'gpt-4o', input_tokens: 1000, input_cached_tokens: 0, output_tokens: 500 },
            ],
          },
        ],
        has_more: false,
      },
      {
        object: 'page',
        data: [{ results: [{ amount: { value: 7, currency: 'usd' } }] }],
        has_more: false,
      },
    );
    const ingestor = new ProviderUsageIngestor({
      providers,
      fetchImpl: fetch,
      now: () => FIXED_NOW,
    });

    await ingestor.run(baseEnv());
    await ingestor.run(baseEnv());

    const provider = await repo.findById(createProviderId('openai'));
    // One slot per metric — a replay cannot inflate the value or duplicate it.
    expect(Object.keys(provider?.health.accountUsage ?? {})).toEqual([
      'ACCOUNT_TOKENS',
      'ACCOUNT_COST',
    ]);
    expect(provider?.health.accountUsage?.ACCOUNT_TOKENS?.value).toBe(1500);
  });

  it('does NOT overwrite a fresher stored metric with a stale re-ingest', async () => {
    const { repo, providers } = await registry();
    // First pass: a fresh value.
    const freshFetch = openaiOrgRoutes(
      {
        object: 'page',
        data: [
          {
            results: [
              { model: 'gpt-4o', input_tokens: 1000, input_cached_tokens: 0, output_tokens: 0 },
            ],
          },
        ],
        has_more: false,
      },
      EMPTY_COST,
    );
    const first = new ProviderUsageIngestor({
      providers,
      fetchImpl: freshFetch,
      now: () => new Date('2026-08-15T12:00:00.000Z'),
    });
    await first.run(baseEnv());

    // Second pass: an OLDER retrievedAt reporting a different value.
    const staleFetch = openaiOrgRoutes(
      {
        object: 'page',
        data: [
          {
            results: [
              { model: 'gpt-4o', input_tokens: 9, input_cached_tokens: 0, output_tokens: 0 },
            ],
          },
        ],
        has_more: false,
      },
      EMPTY_COST,
    );
    const stale = new ProviderUsageIngestor({
      providers,
      fetchImpl: staleFetch,
      now: () => new Date('2026-08-01T00:00:00.000Z'),
    });
    await stale.run(baseEnv());

    const provider = await repo.findById(createProviderId('openai'));
    // The newer reading survives; the stale one was refused.
    expect(provider?.health.accountUsage?.ACCOUNT_TOKENS?.value).toBe(1000);
    expect(provider?.health.accountUsage?.ACCOUNT_TOKENS?.retrievedAt).toBe(
      '2026-08-15T12:00:00.000Z',
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SPRINT 014B — OpenRouter end-to-end ingestion via the official /api/v1/key
// schema: persistence, read-back, idempotency, stale protection, and the
// guarantee that a 401/malformed response cannot overwrite verified data.
// ─────────────────────────────────────────────────────────────────────────────

const OPENROUTER_KEY_URL = 'https://openrouter.ai/api/v1/key';

function openrouterEnv(): Record<string, string | undefined> {
  return baseEnv({ AI_OPENAI_API_KEY: undefined, AI_OPENROUTER_API_KEY: LONG_KEY });
}

describe('ProviderUsageIngestor — OpenRouter /api/v1/key end-to-end', () => {
  it('persists the key-level credit metrics and writes the bounded quota', async () => {
    const { repo, providers } = await registry();
    const fetch = routeFetch({
      [OPENROUTER_KEY_URL]: {
        body: {
          data: {
            label: 'prod-key',
            usage: 2.5,
            limit: 10,
            limit_remaining: 7.5,
            limit_reset: 'monthly',
            usage_daily: 0.1,
            usage_weekly: 0.5,
            usage_monthly: 2.5,
            is_free_tier: false,
          },
        },
      },
    });
    const ingestor = new ProviderUsageIngestor({
      providers,
      fetchImpl: fetch,
      now: () => FIXED_NOW,
    });

    const report = await ingestor.run(openrouterEnv());

    const entry = report.entries.find((e) => e.family === 'openrouter');
    expect(entry?.outcome).toBe('QUOTA_WRITTEN');
    expect(report.quotaSamplesWritten).toBe(1);
    expect(fetch.mock.calls.map((c) => (c as [string])[0])).toEqual([OPENROUTER_KEY_URL]);

    // Read back what was persisted (no secrets involved).
    const provider = await repo.findById(createProviderId('openrouter'));
    expect(provider?.health.quotaUsedPercent).toBe(25);
    expect(provider?.health.quotaSource).toBe('PROVIDER_REPORTED');
    expect(provider?.health.accountUsage?.ACCOUNT_COST?.value).toBe(2.5);
    expect(provider?.health.accountUsage?.ACCOUNT_COST?.unit).toBe('usd');
    expect(provider?.health.accountUsage?.ACCOUNT_CREDITS?.value).toBe(7.5);
    expect(provider?.health.accountUsage?.ACCOUNT_COST?.retrievedAt).toBe(FIXED_NOW.toISOString());
  });

  it('persists UNLIMITED (limit null) as metrics with NO quota percentage', async () => {
    const { repo, providers } = await registry();
    const fetch = routeFetch({
      [OPENROUTER_KEY_URL]: {
        body: { data: { usage: 3.5, limit: null, limit_remaining: null, is_free_tier: false } },
      },
    });
    const ingestor = new ProviderUsageIngestor({
      providers,
      fetchImpl: fetch,
      now: () => FIXED_NOW,
    });

    const report = await ingestor.run(openrouterEnv());
    const entry = report.entries.find((e) => e.family === 'openrouter');
    expect(entry?.outcome).toBe('METRICS_WRITTEN');
    expect(report.quotaSamplesWritten).toBe(0);

    const provider = await repo.findById(createProviderId('openrouter'));
    // The seed quota stays untouched and unproven; only genuine metrics landed.
    expect(provider?.health.quotaUsedPercent).toBe(40);
    expect(provider?.health.quotaSource).not.toBe('PROVIDER_REPORTED');
    expect(provider?.health.accountUsage?.ACCOUNT_COST?.value).toBe(3.5);
    // limit_remaining is null (unlimited) → no credits metric is written.
    expect(provider?.health.accountUsage?.ACCOUNT_CREDITS).toBeUndefined();
  });

  it('a 401 does NOT overwrite previously verified metrics or promote a quota', async () => {
    const { repo, providers } = await registry();
    // First: a successful pass persists verified values.
    const good = routeFetch({
      [OPENROUTER_KEY_URL]: { body: { data: { usage: 2, limit: 8, limit_remaining: 6 } } },
    });
    const first = new ProviderUsageIngestor({ providers, fetchImpl: good, now: () => FIXED_NOW });
    await first.run(openrouterEnv());
    const before = await repo.findById(createProviderId('openrouter'));
    expect(before?.health.accountUsage?.ACCOUNT_COST?.value).toBe(2);

    // Then: a 401. Nothing may be overwritten or fabricated as zero/success.
    const bad = routeFetch({
      [OPENROUTER_KEY_URL]: { status: 401, body: { error: 'unauthorized' } },
    });
    const second = new ProviderUsageIngestor({ providers, fetchImpl: bad, now: () => FIXED_NOW });
    const report = await second.run(openrouterEnv());

    const entry = report.entries.find((e) => e.family === 'openrouter');
    expect(entry?.outcome).toBe('PROBE_FAILED');
    expect(entry?.detail).toContain('401');
    const after = await repo.findById(createProviderId('openrouter'));
    // The previously verified metrics survive untouched.
    expect(after?.health.accountUsage?.ACCOUNT_COST?.value).toBe(2);
    expect(after?.health.accountUsage?.ACCOUNT_CREDITS?.value).toBe(6);
  });

  it('is IDEMPOTENT across two identical passes (one slot per metric)', async () => {
    const { repo, providers } = await registry();
    const fetch = routeFetch({
      [OPENROUTER_KEY_URL]: {
        body: { data: { usage: 2.5, limit: 10, limit_remaining: 7.5 } },
      },
    });
    const ingestor = new ProviderUsageIngestor({
      providers,
      fetchImpl: fetch,
      now: () => FIXED_NOW,
    });
    await ingestor.run(openrouterEnv());
    await ingestor.run(openrouterEnv());

    const provider = await repo.findById(createProviderId('openrouter'));
    expect(Object.keys(provider?.health.accountUsage ?? {}).sort()).toEqual([
      'ACCOUNT_COST',
      'ACCOUNT_CREDITS',
    ]);
    expect(provider?.health.accountUsage?.ACCOUNT_COST?.value).toBe(2.5);
  });

  it('rejects a malformed JSON body without writing anything', async () => {
    const { repo, providers } = await registry();
    const before = await repo.findById(createProviderId('openrouter'));
    const fetch = routeFetch({ [OPENROUTER_KEY_URL]: { rawText: '{not json' } });
    const ingestor = new ProviderUsageIngestor({
      providers,
      fetchImpl: fetch,
      now: () => FIXED_NOW,
    });

    const report = await ingestor.run(openrouterEnv());
    const entry = report.entries.find((e) => e.family === 'openrouter');
    expect(entry?.outcome).toBe('PROBE_FAILED');
    const after = await repo.findById(createProviderId('openrouter'));
    expect(after?.health.accountUsage).toBeUndefined();
    expect(after?.health.lastCheckedAt).toBe(before?.health.lastCheckedAt);
  });

  it('reports a network timeout/throw without writing or fabricating', async () => {
    const { repo, providers } = await registry();
    const fetch = routeFetch({ [OPENROUTER_KEY_URL]: { throws: true } });
    const ingestor = new ProviderUsageIngestor({
      providers,
      fetchImpl: fetch,
      now: () => FIXED_NOW,
    });

    const report = await ingestor.run(openrouterEnv());
    const entry = report.entries.find((e) => e.family === 'openrouter');
    expect(entry?.outcome).toBe('PROBE_FAILED');
    const provider = await repo.findById(createProviderId('openrouter'));
    expect(provider?.health.accountUsage).toBeUndefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SPRINT 014D — OpenRouter account-usage persistence & reconciliation.
// Closes the remaining honesty gaps: malformed/negative credit figures, the
// free-tier flag (never zero/unlimited), cumulative-vs-period semantics, and
// OpenRouter-only isolation at the run() level (no other provider contacted).
// ─────────────────────────────────────────────────────────────────────────────

describe('ProviderUsageIngestor — OpenRouter 014D reconciliation', () => {
  it('run() contacts ONLY the OpenRouter endpoint when only its key is configured', async () => {
    const { repo, providers } = await registry();
    const fetch = routeFetch({
      [OPENROUTER_KEY_URL]: { body: { data: { usage: 0.5, limit: 10, limit_remaining: 9.5 } } },
    });
    const ingestor = new ProviderUsageIngestor({
      providers,
      fetchImpl: fetch,
      now: () => FIXED_NOW,
    });

    const report = await ingestor.run(openrouterEnv());

    // Exactly one HTTP call, to the OpenRouter key endpoint — no OpenAI /
    // DeepSeek / Anthropic / Gemini host is ever touched.
    const urls = fetch.mock.calls.map((c) => (c as [string])[0]);
    expect(urls).toEqual([OPENROUTER_KEY_URL]);
    // Families without a configured key are NOT_CONFIGURED and make no call.
    const openaiEntry = report.entries.find((e) => e.family === 'openai');
    expect(openaiEntry?.outcome).toBe('NOT_CONFIGURED');
    // Only OpenRouter's own record was written.
    const openrouter = await repo.findById(createProviderId('openrouter'));
    expect(openrouter?.health.accountUsage?.ACCOUNT_COST?.value).toBe(0.5);
  });

  it('keeps cumulative usage distinct from the daily/weekly/monthly breakdown', async () => {
    const { repo, providers } = await registry();
    const fetch = routeFetch({
      [OPENROUTER_KEY_URL]: {
        body: {
          data: {
            usage: 100, // cumulative (all-time)
            limit: 200,
            usage_daily: 1,
            usage_weekly: 5,
            usage_monthly: 20,
          },
        },
      },
    });
    const ingestor = new ProviderUsageIngestor({
      providers,
      fetchImpl: fetch,
      now: () => FIXED_NOW,
    });
    await ingestor.run(openrouterEnv());

    const provider = await repo.findById(createProviderId('openrouter'));
    const cost = provider?.health.accountUsage?.ACCOUNT_COST;
    // The cumulative figure is the metric value; the period figures live ONLY in
    // the breakdown, each labelled by its own field name — never relabelled.
    expect(cost?.value).toBe(100);
    expect(cost?.breakdown).toEqual([
      { key: 'usage_daily', value: 1, unit: 'usd' },
      { key: 'usage_weekly', value: 5, unit: 'usd' },
      { key: 'usage_monthly', value: 20, unit: 'usd' },
    ]);
  });

  it('treats NEGATIVE credit figures as malformed (absent), never as zero or a value', async () => {
    const { repo, providers } = await registry();
    const fetch = routeFetch({
      [OPENROUTER_KEY_URL]: {
        body: {
          data: {
            usage: -1,
            limit: -5,
            limit_remaining: -2,
            usage_daily: -0.5,
            is_free_tier: false,
          },
        },
      },
    });
    const ingestor = new ProviderUsageIngestor({
      providers,
      fetchImpl: fetch,
      now: () => FIXED_NOW,
    });

    const report = await ingestor.run(openrouterEnv());
    const entry = report.entries.find((e) => e.family === 'openrouter');
    // No quota percentage (the limit is not a valid finite ceiling).
    expect(entry?.outcome).not.toBe('QUOTA_WRITTEN');
    expect(report.quotaSamplesWritten).toBe(0);

    const provider = await repo.findById(createProviderId('openrouter'));
    // Nothing fabricated: negative values never land as metrics.
    expect(provider?.health.accountUsage).toBeUndefined();
    expect(provider?.health.quotaSource).not.toBe('PROVIDER_REPORTED');
  });

  it('does NOT equate is_free_tier=true with zero or unlimited usage', async () => {
    const { repo, providers } = await registry();
    // Free tier with a REAL finite limit and real usage: the percentage must
    // still be computed honestly (free tier is not "unlimited").
    const fetch = routeFetch({
      [OPENROUTER_KEY_URL]: {
        body: { data: { usage: 0.5, limit: 1, limit_remaining: 0.5, is_free_tier: true } },
      },
    });
    const ingestor = new ProviderUsageIngestor({
      providers,
      fetchImpl: fetch,
      now: () => FIXED_NOW,
    });

    const report = await ingestor.run(openrouterEnv());
    const entry = report.entries.find((e) => e.family === 'openrouter');
    expect(entry?.outcome).toBe('QUOTA_WRITTEN');
    const provider = await repo.findById(createProviderId('openrouter'));
    expect(provider?.health.quotaUsedPercent).toBe(50);
    expect(provider?.health.quotaSource).toBe('PROVIDER_REPORTED');
  });

  it('treats a free-tier flag with NO limit as UNKNOWN — no percentage, no zero', async () => {
    const fetch = routeFetch({
      [OPENROUTER_KEY_URL]: {
        body: { data: { usage: 0.178, limit: null, is_free_tier: true } },
      },
    });
    const result = await openrouterAccountProbe('openrouter', LONG_KEY, fetch, FIXED_NOW);
    expect(result.ok).toBe(true);
    // No ceiling ⇒ no percentage (never infer remaining credit or a % ).
    expect(result.quotaUsedPercent).toBeUndefined();
    // The genuine cumulative usage is still recorded verbatim (0.178 ≠ 0).
    expect(result.accountUsage?.find((m) => m.metric === 'ACCOUNT_COST')?.value).toBe(0.178);
  });

  it('does not fabricate ACCOUNT_CREDITS when limit_remaining is absent', async () => {
    const fetch = routeFetch({
      [OPENROUTER_KEY_URL]: { body: { data: { usage: 1.2, limit: 10 } } },
    });
    const result = await openrouterAccountProbe('openrouter', LONG_KEY, fetch, FIXED_NOW);
    expect(result.ok).toBe(true);
    // limit_remaining absent ⇒ no credits metric; the ceiling is UNKNOWN.
    expect(result.accountUsage?.find((m) => m.metric === 'ACCOUNT_CREDITS')).toBeUndefined();
    // usage is present, so the cumulative cost metric still lands.
    expect(result.accountUsage?.find((m) => m.metric === 'ACCOUNT_COST')?.value).toBe(1.2);
  });

  it('records provenance (source + retrievedAt) on every OpenRouter metric', async () => {
    const { repo, providers } = await registry();
    const fetch = routeFetch({
      [OPENROUTER_KEY_URL]: {
        body: { data: { usage: 2.5, limit: 10, limit_remaining: 7.5 } },
      },
    });
    const ingestor = new ProviderUsageIngestor({
      providers,
      fetchImpl: fetch,
      now: () => FIXED_NOW,
    });
    await ingestor.run(openrouterEnv());

    const provider = await repo.findById(createProviderId('openrouter'));
    const cost = provider?.health.accountUsage?.ACCOUNT_COST;
    const credits = provider?.health.accountUsage?.ACCOUNT_CREDITS;
    expect(cost?.source).toBe('GET https://openrouter.ai/api/v1/key');
    expect(cost?.retrievedAt).toBe(FIXED_NOW.toISOString());
    expect(cost?.unit).toBe('usd');
    expect(credits?.source).toBe('GET https://openrouter.ai/api/v1/key');
    expect(credits?.retrievedAt).toBe(FIXED_NOW.toISOString());
    // Provider-reported metrics are NOT seed data.
    expect(provider?.health.healthSource).toBe('MEASURED');
  });

  it('a persistence failure is reported and creates no fabricated success record', async () => {
    const { providers } = await registry();
    vi.spyOn(providers, 'recordHealthSample').mockRejectedValue(new Error('db down'));
    const fetch = routeFetch({
      [OPENROUTER_KEY_URL]: { body: { data: { usage: 2.5, limit: 10, limit_remaining: 7.5 } } },
    });
    const ingestor = new ProviderUsageIngestor({
      providers,
      fetchImpl: fetch,
      now: () => FIXED_NOW,
    });

    const report = await ingestor.run(openrouterEnv());
    const entry = report.entries.find((e) => e.family === 'openrouter');
    expect(entry?.outcome).toBe('PROBE_FAILED');
    expect(report.accountMetricsWritten).toBe(0);
    expect(report.quotaSamplesWritten).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Provider ACCOUNT CREDITS / bounded quota / unlimited — OpenRouter.
// ─────────────────────────────────────────────────────────────────────────────

describe('openrouterAccountProbe — unlimited vs bounded vs unknown', () => {
  it('records an UNLIMITED key (limit null) as no quota and no fabricated percentage', async () => {
    const fetch = routeFetch({
      'https://openrouter.ai/api/v1/key': {
        body: { data: { usage: 3.5, limit: null, is_free_tier: false } },
      },
    });
    const result = await openrouterAccountProbe('openrouter', LONG_KEY, fetch);
    expect(result.ok).toBe(true);
    expect(result.quotaUsedPercent).toBeUndefined();
    expect(result.detail).toContain('no percentage is recorded');
  });

  it('leaves the quota UNKNOWN (no zero) when the endpoint omits usage', async () => {
    const fetch = routeFetch({
      'https://openrouter.ai/api/v1/key': { body: { data: { limit: 10 } } },
    });
    const result = await openrouterAccountProbe('openrouter', LONG_KEY, fetch);
    expect(result.ok).toBe(true);
    expect(result.quotaUsedPercent).toBeUndefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Direct probe-level coverage for the new admin endpoints.
// ─────────────────────────────────────────────────────────────────────────────

describe('openaiOrgCostProbe / anthropic probes — direct', () => {
  it('sums OpenAI cost buckets and keeps a per-line-item breakdown', async () => {
    const fetch = routeFetch({
      [OPENAI_ORG_COST_URL(MONTH_WINDOW)]: {
        body: {
          object: 'page',
          data: [
            {
              object: 'bucket',
              results: [
                { amount: { value: 10, currency: 'usd' }, line_item: 'gpt-4o' },
                { amount: { value: 2.5, currency: 'usd' }, line_item: 'gpt-4o-mini' },
              ],
            },
          ],
          has_more: false,
        },
      },
    });
    const { openaiOrgCostProbe } = await import('../services/ProviderUsageIngestor.js');
    const result = await openaiOrgCostProbe(LONG_KEY, fetch, MONTH_WINDOW);
    expect(result.ok).toBe(true);
    expect(result.totalUsd).toBeCloseTo(12.5, 6);
    expect(result.breakdown[0]).toEqual({ key: 'gpt-4o', usd: 10 });
  });

  it('reports OpenAI cost endpoint outage without inventing a total', async () => {
    const fetch = routeFetch({
      [OPENAI_ORG_COST_URL(MONTH_WINDOW)]: { status: 503, body: { error: 'unavailable' } },
    });
    const { openaiOrgCostProbe } = await import('../services/ProviderUsageIngestor.js');
    const result = await openaiOrgCostProbe(LONG_KEY, fetch, MONTH_WINDOW);
    expect(result.ok).toBe(false);
    expect(result.totalUsd).toBe(0);
    expect(result.error).toContain('503');
  });
});
