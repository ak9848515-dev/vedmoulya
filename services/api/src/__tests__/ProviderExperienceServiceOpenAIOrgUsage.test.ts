// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — ProviderExperienceService.getOpenAIOrgUsage tests
//
// Proves the usage-details OpenAI org panel contract:
//   - no key configured → available:false with an honest message (never a
//     fabricated number),
//   - an org admin-scope key + a real OpenAI response → per-model rows and
//     totals pass through exactly as OpenAI reported them,
//   - 401/403 (project/user key) → available:false with the scope reason.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect, vi } from 'vitest';
import { ProviderExperienceService } from '../services/ProviderExperienceService.js';
import type { OpenAIOrgPeriod } from '../services/ProviderUsageIngestor.js';

const FIXED_NOW = new Date('2026-08-15T12:00:00.000Z');
const LONG_KEY = 'sk-' + 'a'.repeat(48);
// This month window for FIXED_NOW (2026-08-15): start = 2026-08-01 00:00 UTC.
const AUG_START = Math.floor(Date.UTC(2026, 7, 1) / 1000);
const NOW_SEC = Math.floor(FIXED_NOW.getTime() / 1000);

function buildService(overrides: { apiKey?: string; status?: number; body?: unknown }): {
  service: ProviderExperienceService;
  fetchMock: ReturnType<typeof vi.fn>;
} {
  const fetchMock = vi.fn(async (input: string) => {
    const url = String(input);
    if (!url.startsWith('https://api.openai.com/v1/organization/usage/completions')) {
      return new Response('{"error":"unexpected url"}', { status: 404 });
    }
    return new Response(JSON.stringify(overrides.body ?? { object: 'page', data: [] }), {
      status: overrides.status ?? 200,
      headers: { 'Content-Type': 'application/json' },
    });
  });
  const env: Record<string, string | undefined> = {
    NODE_ENV: 'test',
  };
  if (overrides.apiKey) env.AI_OPENAI_API_KEY = overrides.apiKey;
  const service = new ProviderExperienceService(
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {
      openaiOrgEnv: env,
      openaiOrgFetch: fetchMock as never,
      openaiOrgNow: () => FIXED_NOW,
    },
  );
  return { service, fetchMock };
}

async function read(service: ProviderExperienceService, period: OpenAIOrgPeriod) {
  const result = await service.getOpenAIOrgUsage(period);
  if (!result.success) throw new Error(result.error ?? 'unexpected failure');
  return result.data;
}

describe('ProviderExperienceService.getOpenAIOrgUsage', () => {
  it('returns available:false with an honest message when no key is configured', async () => {
    const { service, fetchMock } = buildService({});
    const data = await read(service, 'month');

    expect(data.available).toBe(false);
    expect(data.message).toContain('No OpenAI API key');
    expect(data.rows).toEqual([]);
    expect(data.totals).toEqual({ inputTokens: 0, cachedInputTokens: 0, outputTokens: 0 });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('passes OpenAI-reported per-model usage through for the selected period', async () => {
    const { service, fetchMock } = buildService({
      apiKey: LONG_KEY,
      body: {
        object: 'page',
        data: [
          {
            object: 'bucket',
            start_time: AUG_START,
            end_time: AUG_START,
            results: [
              {
                input_tokens: 1000,
                input_cached_tokens: 50,
                output_tokens: 300,
                model: 'gpt-4o',
              },
              { input_tokens: 10, input_cached_tokens: 0, output_tokens: 5, model: 'gpt-4o-mini' },
            ],
          },
        ],
        has_more: false,
      },
    });

    const data = await read(service, 'month');

    expect(data.available).toBe(true);
    expect(data.period).toBe('month');
    expect(data.message).toContain('Reported by OpenAI');
    const gpt4o = data.rows.find((r) => r.model === 'gpt-4o');
    expect(gpt4o).toMatchObject({ inputTokens: 1000, cachedInputTokens: 50, outputTokens: 300 });
    expect(data.totals).toEqual({ inputTokens: 1010, cachedInputTokens: 50, outputTokens: 305 });
    expect(data.hasMore).toBe(false);
    // The request went to the org usage endpoint with the Bearer key and the
    // real UTC window for the selected period.
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [calledUrl, init] = fetchMock.mock.calls[0] as [string, RequestInit?];
    expect(calledUrl).toContain('organization/usage/completions');
    expect(calledUrl).toContain(`start_time=${AUG_START}`);
    expect(calledUrl).toContain(`end_time=${NOW_SEC}`);
    const headers = init?.headers as Record<string, string> | undefined;
    expect(headers?.Authorization).toBe(`Bearer ${LONG_KEY}`);
  });

  it('returns available:false with the org admin-scope reason on 401', async () => {
    const { service, fetchMock } = buildService({
      apiKey: LONG_KEY,
      status: 401,
      body: { error: { message: 'unauthorized' } },
    });

    const data = await read(service, 'today');

    expect(data.available).toBe(false);
    expect(data.message).toContain('Organization admin-scope');
    expect(data.rows).toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('supports the week and today periods with their real windows', async () => {
    const mondayStart = Math.floor(Date.UTC(2026, 7, 10) / 1000);
    const todayStart = Math.floor(Date.UTC(2026, 7, 15) / 1000);
    for (const [period, start] of [
      ['week', mondayStart],
      ['today', todayStart],
    ] as const) {
      const { service, fetchMock } = buildService({
        apiKey: LONG_KEY,
        body: { object: 'page', data: [], has_more: false },
      });
      const data = await read(service, period);
      expect(data.available).toBe(true);
      const [url] = fetchMock.mock.calls[0] as [string];
      expect(url).toContain(`start_time=${start}`);
    }
  });
});
