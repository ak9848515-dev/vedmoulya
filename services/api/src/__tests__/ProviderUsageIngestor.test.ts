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

describe('openrouterAccountProbe (bounded quota honesty)', () => {
  it('writes a percentage only when the key has a real finite credit limit', async () => {
    const fetch = routeFetch({
      'https://openrouter.ai/api/v1/auth/key': {
        body: { data: { usage: 2.5, limit: 10, is_free_tier: false } },
      },
    });
    const result = await openrouterAccountProbe('openrouter', LONG_KEY, fetch);
    expect(result.ok).toBe(true);
    expect(result.quotaUsedPercent).toBe(25);
  });

  it('reports an OpenRouter endpoint failure without fabricating quota', async () => {
    const fetch = routeFetch({
      'https://openrouter.ai/api/v1/auth/key': { status: 401, body: {} },
    });
    const result = await openrouterAccountProbe('openrouter', LONG_KEY, fetch);
    expect(result.ok).toBe(false);
    expect(result.quotaUsedPercent).toBeUndefined();
    expect(result.error).toContain('401');
  });

  it('records CHECKED when OpenRouter reports usage without a numeric limit field', async () => {
    const fetch = routeFetch({
      'https://openrouter.ai/api/v1/auth/key': { body: { data: { usage: 1.2 } } },
    });
    const result = await openrouterAccountProbe('openrouter', LONG_KEY, fetch);
    expect(result.ok).toBe(true);
    expect(result.quotaUsedPercent).toBeUndefined();
    expect(result.detail).toContain('no percentage is recorded');
  });

  it('records CHECKED when OpenRouter reports a limit but no usage for the key', async () => {
    const fetch = routeFetch({
      'https://openrouter.ai/api/v1/auth/key': { body: { data: { limit: 10 } } },
    });
    const result = await openrouterAccountProbe('openrouter', LONG_KEY, fetch);
    expect(result.ok).toBe(true);
    expect(result.quotaUsedPercent).toBeUndefined();
    expect(result.detail).toContain('no credit usage');
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

  it('never derives a percentage from an unlimited (limit -1), free, or zero-limit key', async () => {
    for (const data of [
      { usage: 1.2, limit: -1, is_free_tier: false },
      { usage: 0.5, limit: -1, is_free_tier: true },
      { usage: 1.2, limit: 0, is_free_tier: false },
    ]) {
      const fetch = routeFetch({
        'https://openrouter.ai/api/v1/auth/key': { body: { data } },
      });
      const result = await openrouterAccountProbe('openrouter', LONG_KEY, fetch);
      expect(result.ok).toBe(true);
      expect(result.quotaUsedPercent).toBeUndefined();
      expect(result.detail).toContain('no percentage is recorded');
    }
  });
});
