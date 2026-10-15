// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — providers.getUsageDetail: REAL usage, correct source
//
// The audit finding: the usage screen read ONLY the in-process execution trace
// store. Plain Ask executions carry no accounting attributes there, so the
// screen reported `aiCalls > 0` with **0 tokens and $0.00 cost** for usage that
// really happened — and its empty state claimed "no usage" while the durable
// ledger held 18,343 tokens. These tests pin the fix:
//
//   • with a durable ledger, the figures ARE the recorded executions
//   • they agree with the same aggregation the AI Control Center reads
//   • the payload says WHERE the numbers came from, and only claims
//     `durableChecked` when the durable store was actually queried
//   • a registry SEED quota never moves provider availability
// ─────────────────────────────────────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import { InMemoryTraceStore } from '@vedmoulya/core';
import { CostLedger } from '../observability/CostLedger.js';
import { ProviderExperienceService } from '../services/ProviderExperienceService.js';
import type { AiUsageEvent } from '../observability/AiUsageLedgerTypes.js';

function event(overrides: Partial<AiUsageEvent>): AiUsageEvent {
  return {
    eventId: 'e1',
    userId: 'u1',
    providerFamily: 'google',
    provider: 'google',
    model: 'gemini-2.5-flash',
    executionId: 'req-1',
    source: 'ASK',
    inputTokens: 100,
    outputTokens: 50,
    totalTokens: 150,
    costUsd: 0.001,
    costUnknown: false,
    currency: 'USD',
    timestamp: 1_760_000_000_000,
    status: 'success',
    cached: false,
    retry: false,
    local: false,
    ...overrides,
  };
}

const EVENTS: AiUsageEvent[] = [
  event({ eventId: 'e1', executionId: 'req-1' }),
  event({
    eventId: 'e2',
    executionId: 'req-2',
    inputTokens: 200,
    outputTokens: 100,
    totalTokens: 300,
    costUsd: 0.002,
  }),
  event({
    eventId: 'e3',
    executionId: 'req-3',
    provider: 'ollama',
    providerFamily: 'ollama',
    model: 'qwen2.5-coder:3b',
    local: true,
    costUsd: 0,
    totalTokens: 500,
    inputTokens: 400,
    outputTokens: 100,
    cached: true,
  }),
  event({
    eventId: 'e4',
    executionId: 'req-4',
    provider: 'anthropic',
    providerFamily: 'anthropic',
    totalTokens: 400,
    inputTokens: 300,
    outputTokens: 100,
    costUsd: 0,
    costUnknown: true,
  }),
];

const PREFERENCES = {
  disabledProviderIds: [],
  budgets: { monthlyTokenBudget: 1_000_000 },
  budgetPolicy: 'balanced',
} as never;

function usageStore(events: AiUsageEvent[]): never {
  return {
    record: async (): Promise<boolean> => true,
    list: async (): Promise<AiUsageEvent[]> => events,
    count: async (): Promise<number> => events.length,
  } as never;
}

function service(options: {
  events?: AiUsageEvent[];
  withRecorder?: boolean;
}): ProviderExperienceService {
  return new ProviderExperienceService(
    {} as never,
    { getPreferences: async () => ({ success: true, data: PREFERENCES }) } as never,
    {} as never,
    new CostLedger(),
    new InMemoryTraceStore(),
    {
      ...(options.withRecorder === false
        ? {}
        : { usageRecorder: { getStore: () => usageStore(options.events ?? EVENTS) } }),
    },
  );
}

describe('providers.getUsageDetail — durable ledger', () => {
  it('reports the RECORDED executions (not the empty trace store)', async () => {
    const result = await service({ events: EVENTS }).getUsageDetail('u1');
    expect(result.success).toBe(true);
    const detail = result.data;

    // 2 cloud + 1 local + 1 unpriced cloud execution.
    expect(detail?.totals.aiCalls).toBe(4);
    expect(detail?.totals.tokensInput).toBe(1000);
    expect(detail?.totals.tokensOutput).toBe(350);
    expect(detail?.totals.tokensTotal).toBe(1350);
    expect(detail?.totals.costUsd).toBeCloseTo(0.003, 6);
    expect(detail?.totals.cacheHits).toBe(1);
    expect(detail?.usageSource).toBe('DURABLE_USAGE_LEDGER');
    expect(detail?.durableChecked).toBe(true);
    // One execution had no provider-reported price.
    expect(detail?.costUnknown).toBe(true);
  });

  it('groups by provider and model exactly like the control center does', async () => {
    const result = await service({ events: EVENTS }).getUsageDetail('u1');
    const detail = result.data;

    const google = detail?.byProvider.find((p) => p.provider === 'google');
    expect(google?.calls).toBe(2);
    expect(google?.tokensTotal).toBe(450);
    expect(google?.costUsd).toBeCloseTo(0.003, 6);

    const ollama = detail?.byProvider.find((p) => p.provider === 'ollama');
    expect(ollama?.tokensTotal).toBe(500);

    const gemini = detail?.byModel.find((m) => m.modelId === 'gemini-2.5-flash');
    expect(gemini?.calls).toBe(2);
    expect(gemini?.tokensTotal).toBe(450);
  });

  it('lists recent executions with the ledger execution id and no invented status', async () => {
    const result = await service({ events: EVENTS }).getUsageDetail('u1');
    const rows = result.data?.executions ?? [];
    expect(rows.length).toBe(4);
    for (const row of rows) {
      expect(row.traceId).toMatch(/^req-/);
      expect(row.status).toBe('OK');
      expect(row.aiCalls).toBe(1);
    }
  });

  it('claims "no recorded usage" only when the durable store WAS read', async () => {
    const empty = await service({ events: [] }).getUsageDetail('u1');
    expect(empty.data?.totals.aiCalls).toBe(0);
    expect(empty.data?.usageSource).toBe('DURABLE_USAGE_LEDGER');
    expect(empty.data?.durableChecked).toBe(true);

    // Without a durable ledger the payload must NOT look like a measured zero:
    // it says the weaker source was used and that nothing durable was checked.
    const noLedger = await service({ withRecorder: false }).getUsageDetail('u1');
    expect(noLedger.data?.usageSource).toBe('TRACE_LEDGER');
    expect(noLedger.data?.durableChecked).toBe(false);
  });

  it('rejects a missing userId instead of returning a fabricated empty detail', async () => {
    const result = await service({ events: EVENTS }).getUsageDetail('');
    expect(result.success).toBe(false);
    expect(result.data).toBeUndefined();
  });
});

describe('providers.getOverview — availability is never moved by a SEED quota', () => {
  async function availabilityWith(quotaSource: 'SEED' | 'PROVIDER_REPORTED'): Promise<string> {
    const providers = {
      getMarketplace: async () => ({
        success: true,
        data: {
          providers: [
            {
              id: 'openai',
              family: 'openai',
              name: 'OpenAI',
              models: [],
              tags: [],
              costTier: 'standard',
              inputPerMillionTokens: 1,
              outputPerMillionTokens: 1,
              // Above the 80% LIMITED threshold — only account usage may act
              // on it, so a seed must leave availability alone.
              health: {
                status: 'healthy',
                healthScore: 0.9,
                latencyMs: 100,
                quotaUsedPercent: 95,
                quotaSource,
                lastCheckedAt: '2026-08-03T00:00:00.000Z',
              },
              lifecycleStatus: 'active',
            },
          ],
        },
      }),
    };
    const svc = new ProviderExperienceService(
      providers as never,
      {
        getPreferences: async () => ({
          success: true,
          data: PREFERENCES as never,
        }),
      } as never,
      {} as never,
      new CostLedger(),
      new InMemoryTraceStore(),
      {},
    );
    const overview = await svc.getOverview('u1');
    return overview.data?.providers[0]?.availability ?? 'MISSING';
  }

  it('keeps AVAILABLE for a 95% SEED quota', async () => {
    expect(await availabilityWith('SEED')).toBe('AVAILABLE');
  });

  it('reports LIMITED for a 95% PROVIDER_REPORTED quota', async () => {
    expect(await availabilityWith('PROVIDER_REPORTED')).toBe('LIMITED');
  });
});

describe('providers.getOverview — usage summary reads the DURABLE ledger and a REAL budget', () => {
  const MARKETPLACE = {
    getMarketplace: async () => ({
      success: true,
      data: {
        providers: [
          {
            id: 'google',
            family: 'google',
            name: 'Google',
            models: [],
            tags: [],
            costTier: 'standard',
            inputPerMillionTokens: 1,
            outputPerMillionTokens: 1,
            health: {
              status: 'healthy',
              healthScore: 0.9,
              latencyMs: 100,
              quotaUsedPercent: 30,
              quotaSource: 'SEED',
              healthSource: 'SEED',
              lastCheckedAt: '2026-08-03T00:00:00.000Z',
            },
            lifecycleStatus: 'active',
          },
        ],
      },
    }),
  };

  function overview(options: {
    budgets: Record<string, unknown>;
    events?: AiUsageEvent[];
    withRecorder?: boolean;
  }): Promise<Awaited<ReturnType<ProviderExperienceService['getOverview']>>> {
    const prefs = {
      disabledProviderIds: [],
      budgets: options.budgets,
      budgetPolicy: 'balanced',
    };
    const svc = new ProviderExperienceService(
      MARKETPLACE as never,
      { getPreferences: async () => ({ success: true, data: prefs as never }) } as never,
      {} as never,
      new CostLedger(),
      new InMemoryTraceStore(),
      {
        ...(options.withRecorder === false
          ? {}
          : { usageRecorder: { getStore: () => usageStore(options.events ?? EVENTS) } }),
      },
    );
    return svc.getOverview('u1');
  }

  it('reports the RECORDED usage and says the durable ledger answered', async () => {
    const result = await overview({ budgets: {} });
    const usage = result.data?.usage;
    // 1350 tokens across the recorded executions (not the empty trace store).
    expect(usage?.tokensUsed).toBe(1350);
    expect(usage?.aiCalls).toBe(4);
    expect(usage?.costUsd).toBeCloseTo(0.003, 6);
    expect(usage?.usageSource).toBe('DURABLE_USAGE_LEDGER');
    expect(usage?.durableChecked).toBe(true);
    expect(usage?.costUnknown).toBe(true);
  });

  it('reports NO budget as not configured — never a default 1M allowance', async () => {
    const result = await overview({ budgets: {} });
    const usage = result.data?.usage;
    expect(usage?.budgetSource).toBe('NONE');
    expect(usage?.tokenBudget).toBeUndefined();
    expect(usage?.remainingTokens).toBeUndefined();
    expect(usage?.budgetBasis).toBe('UNKNOWN');
  });

  it('reports a USER-CONFIGURED budget with its provenance and remaining tokens', async () => {
    const result = await overview({
      budgets: {
        monthlyTokenBudget: 2000,
        monthlyTokenBudgetSource: 'USER',
        monthlyTokenBudgetConfiguredAt: '2026-10-01T00:00:00.000Z',
      },
    });
    const usage = result.data?.usage;
    expect(usage?.tokenBudget).toBe(2000);
    expect(usage?.budgetSource).toBe('USER_CONFIGURED');
    expect(usage?.budgetConfiguredAt).toBe('2026-10-01T00:00:00.000Z');
    expect(usage?.remainingTokens).toBe(650);
    expect(usage?.budgetBasis).toBe('USER_BUDGET');
  });

  it('labels a legacy default figure as a PLATFORM allowance, never as the user budget', async () => {
    const result = await overview({ budgets: { monthlyTokenBudget: 1_000_000 } });
    const usage = result.data?.usage;
    expect(usage?.budgetSource).toBe('PLATFORM_ALLOWANCE');
    expect(usage?.budgetBasis).toBe('PLATFORM_ALLOWANCE');
  });

  it('falls back to the trace ledger ONLY when no durable store exists, and says so', async () => {
    const result = await overview({ budgets: {}, withRecorder: false });
    const usage = result.data?.usage;
    expect(usage?.usageSource).toBe('TRACE_LEDGER');
    expect(usage?.durableChecked).toBe(false);
  });
});
