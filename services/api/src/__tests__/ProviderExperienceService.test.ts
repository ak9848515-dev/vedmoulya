// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Provider Experience Service Capability-Label Tests (EPIC-012A)
//
// Proves the view-model pipes REAL per-model capability data from the registry
// (never hardcoded, never empty for models that declare capabilities):
//   - taxonomy capabilities map to premium display labels
//   - boolean feature flags contribute labels (reasoning/coding/vision/audio/
//     embeddings/tools)
//   - deduplication (image_understanding → Vision + vision flag → Vision once)
//   - bounded list (the dropdown shows a hint, not a spec sheet)
//   - honest empty list when the registry declares no capability data
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect, vi } from 'vitest';
import { modelCapabilityLabels } from '../services/ProviderExperienceService.js';
import type { ProviderModelDTO } from '@vedmoulya/providers';

function model(overrides: Partial<ProviderModelDTO>): ProviderModelDTO {
  return {
    id: 'm1',
    name: 'Model 1',
    contextLength: 128000,
    maxOutputTokens: 8192,
    streaming: false,
    vision: false,
    functionCalling: false,
    embeddings: false,
    reasoning: false,
    coding: false,
    creativeWriting: false,
    translation: false,
    image: false,
    audio: false,
    video: false,
    modalities: ['text-in', 'text-out'],
    capabilities: [],
    ...overrides,
  };
}

describe('modelCapabilityLabels', () => {
  it('maps declared taxonomy capabilities to premium display labels', () => {
    const labels = modelCapabilityLabels(
      model({ capabilities: ['reasoning', 'coding', 'vision'] }),
    );
    expect(labels).toEqual(['Reasoning', 'Coding', 'Vision']);
  });

  it('contributes labels from boolean feature flags (bounded to 4)', () => {
    const labels = modelCapabilityLabels(
      model({
        reasoning: true,
        coding: true,
        vision: true,
        audio: true,
        embeddings: true,
        functionCalling: true,
      }),
    );
    // The dropdown shows a hint, not a spec sheet: the first four flags win.
    expect(labels.length).toBeLessThanOrEqual(4);
    expect(labels[0]).toBe('Reasoning');
    expect(labels[1]).toBe('Coding');
    expect(labels[2]).toBe('Vision');
    expect(labels[3]).toBe('Audio');
  });

  it('deduplicates synonyms (image_understanding → Vision merged with vision flag)', () => {
    const labels = modelCapabilityLabels(
      model({ capabilities: ['image_understanding'], vision: true }),
    );
    expect(labels.filter((l) => l === 'Vision').length).toBe(1);
  });

  it('maps speech → Audio and general_conversation → Chat', () => {
    const labels = modelCapabilityLabels(
      model({ capabilities: ['speech', 'general_conversation', 'content_generation'] }),
    );
    expect(labels).toContain('Audio');
    expect(labels).toContain('Chat');
    expect(labels).toContain('Generation');
  });

  it('bounds the list to 4 labels (dropdown hint, not a spec sheet)', () => {
    const labels = modelCapabilityLabels(
      model({
        capabilities: [
          'reasoning',
          'coding',
          'vision',
          'embeddings',
          'summarization',
          'classification',
          'translation',
        ],
      }),
    );
    expect(labels.length).toBeLessThanOrEqual(4);
  });

  it('returns an honest empty list when the registry declares no capabilities', () => {
    expect(modelCapabilityLabels(model({ capabilities: [] }))).toEqual([]);
  });
});

// ── Service-level tests (view model composition) ────────────────────────────

import { ProviderExperienceService } from '../services/ProviderExperienceService.js';
import type { ProviderDTO } from '@vedmoulya/providers';
import type { ProviderPreferences } from '@vedmoulya/providers';
import type { CostLedgerSnapshot } from '../observability/CostLedger.js';

function providerDTO(overrides: Partial<ProviderDTO> = {}): ProviderDTO {
  return {
    id: 'p1',
    family: 'openai',
    name: 'OpenAI',
    description: 'd',
    owner: 'platform',
    models: [
      {
        id: 'gpt-4',
        name: 'GPT-4',
        contextLength: 128000,
        maxOutputTokens: 8192,
        streaming: true,
        vision: false,
        functionCalling: false,
        embeddings: false,
        reasoning: true,
        coding: true,
        creativeWriting: false,
        translation: false,
        image: false,
        audio: false,
        video: false,
        modalities: ['text-in', 'text-out'],
        capabilities: ['reasoning'],
      },
    ],
    capabilities: ['reasoning'],
    supportedModalities: ['text-in', 'text-out'],
    inputPerMillionTokens: 10,
    outputPerMillionTokens: 30,
    currency: 'USD',
    costTier: 'medium',
    p50Ms: 100,
    p95Ms: 200,
    requestsPerMinute: 60,
    tokensPerMinute: 1000,
    requestsPerDay: 1000,
    maxConcurrentRequests: 10,
    availability: 0.99,
    health: {
      status: 'healthy',
      healthScore: 0.9,
      latencyMs: 20,
      successCount: 100,
      failureCount: 0,
      quotaUsedPercent: 10,
      rateLimitRemaining: 50,
      lastSuccessAt: 'now',
      lastFailureAt: null,
      lastCheckedAt: 'now',
    },
    lifecycleStatus: 'active',
    version: '1.0',
    tags: ['cloud'],
    matrix: [],
    bestQuality: 0.9,
    bestCostUsd: 0.01,
    maxContextLength: 128000,
    hasStreaming: true,
    hasVision: false,
    hasFunctionCalling: false,
    hasEmbeddings: false,
    createdAt: 'now',
    updatedAt: 'now',
    ...overrides,
  };
}

function prefs(overrides: Partial<ProviderPreferences> = {}): ProviderPreferences {
  return {
    userId: 'u1',
    disabledProviderIds: [],
    budgetPolicy: 'ask_before_paid',
    budgets: { monthlyTokenBudget: 1_000_000 },
    updatedAt: 'now',
    ...overrides,
  };
}

function emptySnapshot(): CostLedgerSnapshot {
  return {
    totals: { tokensTotal: 0, costUsd: 0, aiCalls: 0, cacheHits: 0 },
    byProvider: [],
    byApplication: [],
    executions: [],
  };
}

function createService(overrides: {
  marketplace?: { success: boolean; data?: { providers: ProviderDTO[] }; error?: string };
  getPreferences?: { success: boolean; data?: ProviderPreferences; error?: string };
  snapshot?: CostLedgerSnapshot;
  traces?: Array<{ spans: Array<Record<string, unknown>> }>;
  decide?: unknown;
}) {
  const providers = {
    getMarketplace: vi.fn(
      async () => overrides.marketplace ?? { success: true, data: { providers: [providerDTO()] } },
    ),
  };
  const preferences = {
    getPreferences: vi.fn(async () => overrides.getPreferences ?? { success: true, data: prefs() }),
    updatePreferences: vi.fn(async (userId: string, patch: unknown) => ({
      success: true,
      data: prefs({ ...(patch as object) }),
    })),
    setProviderEnabled: vi.fn(async (userId: string, providerId: string, enabled: boolean) => ({
      success: true,
      data: prefs({ disabledProviderIds: enabled ? [] : [providerId] }),
    })),
  };
  const modelSelection = {
    decide: vi.fn(async () => {
      if (overrides.decide instanceof Error) throw overrides.decide;
      return overrides.decide ?? { selected: { providerId: 'p1' } };
    }),
  };
  const ledger = {
    compute: vi.fn(() => overrides.snapshot ?? emptySnapshot()),
  };
  const traceStore = {
    list: vi.fn(() => overrides.traces ?? []),
  };
  const service = new ProviderExperienceService(
    providers as never,
    preferences as never,
    modelSelection as never,
    ledger as never,
    traceStore as never,
  );
  return { service, providers, preferences, modelSelection, ledger, traceStore };
}

describe('ProviderExperienceService — view model', () => {
  it('requires a userId', async () => {
    const { service } = createService({});
    await expect(service.getOverview('')).resolves.toEqual({
      success: false,
      error: 'userId is required',
    });
    await expect(service.getUsage('')).resolves.toEqual({
      success: false,
      error: 'userId is required',
    });
  });

  it('fails honestly when the registry or preferences read fails', async () => {
    const { service } = createService({
      marketplace: { success: false, error: 'registry down' },
    });
    await expect(service.getOverview('u1')).resolves.toEqual({
      success: false,
      error: 'registry down',
    });
  });

  it('composes providers, preferences and usage into the overview', async () => {
    const snapshot: CostLedgerSnapshot = {
      totals: { tokensTotal: 500, costUsd: 0.05, aiCalls: 6, cacheHits: 2 },
      byProvider: [{ provider: 'p1', tokensTotal: 500, costUsd: 0.05 }],
      byApplication: [],
      executions: [],
    };
    const { service } = createService({ snapshot });
    const result = await service.getOverview('u1');
    expect(result.success).toBe(true);
    const view = result.data;
    expect(view?.providers[0]?.providerId).toBe('p1');
    expect(view?.providers[0]?.availability).toBe('AVAILABLE');
    expect(view?.providers[0]?.enabled).toBe(true);
    expect(view?.providers[0]?.selectedModel?.id).toBe('gpt-4');
    expect(view?.providers[0]?.models[0]?.capabilities).toEqual(['Reasoning', 'Coding']);
    expect(view?.usage).toMatchObject({ tokensUsed: 500, aiCalls: 6, cacheHits: 2 });
    expect(view?.usage.freePercent).toBe(0); // no free providers
  });

  it('derives availability honestly across lifecycle/health/disabled states', async () => {
    const providers = [
      providerDTO({ id: 'local', family: 'ollama', name: 'Local', models: [] }),
      providerDTO({ id: 'deprecated', lifecycleStatus: 'deprecated', models: [] }),
      providerDTO({ id: 'down', health: { ...providerDTO().health, status: 'down' }, models: [] }),
      providerDTO({
        id: 'degraded',
        health: { ...providerDTO().health, status: 'degraded' },
        models: [],
      }),
      providerDTO({
        id: 'quota',
        health: { ...providerDTO().health, quotaUsedPercent: 95 },
        models: [],
      }),
      providerDTO({ id: 'disabled-provider', models: [] }),
      providerDTO({
        id: 'unknown',
        health: { ...providerDTO().health, healthScore: 0, lastCheckedAt: '' },
        models: [],
      }),
    ];
    const { service } = createService({
      marketplace: { success: true, data: { providers } },
      getPreferences: {
        success: true,
        data: prefs({ disabledProviderIds: ['disabled-provider'] }),
      },
    });
    const result = await service.getOverview('u1');
    const byId = new Map(result.data?.providers.map((p) => [p.providerId, p.availability]));
    expect(byId.get('local')).toBe('LOCAL');
    expect(byId.get('deprecated')).toBe('UNAVAILABLE');
    expect(byId.get('down')).toBe('UNAVAILABLE');
    expect(byId.get('degraded')).toBe('LIMITED');
    expect(byId.get('quota')).toBe('LIMITED');
    expect(byId.get('disabled-provider')).toBe('UNAVAILABLE');
    expect(byId.get('unknown')).toBe('UNKNOWN');
  });

  it('honors the preferred model when it belongs to the preferred provider', async () => {
    const { service } = createService({
      getPreferences: {
        success: true,
        data: prefs({ preferredProviderId: 'p1', preferredModelId: 'gpt-4' }),
      },
    });
    const result = await service.getOverview('u1');
    expect(result.data?.providers[0]?.selectedModel?.id).toBe('gpt-4');
  });

  it('falls back to the first registry model when the preferred model is unknown', async () => {
    const { service } = createService({
      getPreferences: {
        success: true,
        data: prefs({ preferredProviderId: 'p1', preferredModelId: 'missing-model' }),
      },
    });
    const result = await service.getOverview('u1');
    expect(result.data?.providers[0]?.selectedModel?.id).toBe('gpt-4');
  });

  it('computes free usage percentage from tokens attributed to free providers', async () => {
    const providers = [
      providerDTO({ id: 'free', costTier: 'free', models: [] }),
      providerDTO({ id: 'paid', costTier: 'high', models: [] }),
    ];
    const snapshot: CostLedgerSnapshot = {
      totals: { tokensTotal: 1000, costUsd: 0.1, aiCalls: 2, cacheHits: 0 },
      byProvider: [
        { provider: 'free', tokensTotal: 250, costUsd: 0 },
        { provider: 'paid', tokensTotal: 750, costUsd: 0.1 },
      ],
      byApplication: [],
      executions: [],
    };
    const { service } = createService({
      marketplace: { success: true, data: { providers } },
      snapshot,
    });
    const result = await service.getOverview('u1');
    expect(result.data?.usage.freePercent).toBe(25);
  });
});

describe('ProviderExperienceService — usage detail + model usage', () => {
  it('returns the usage detail with preferences and per-model rows', async () => {
    const snapshot: CostLedgerSnapshot = {
      totals: { tokensTotal: 100, costUsd: 0.01, aiCalls: 2, cacheHits: 0 },
      byProvider: [{ provider: 'p1', tokensTotal: 100, costUsd: 0.01 }],
      byApplication: [],
      executions: [{ executionId: 'e1' }],
    };
    const traces = [
      {
        spans: [
          {
            kind: 'ai',
            attributes: { provider: 'p1', model: 'gpt-4', cost_usd: 0.01 },
            durationMs: 30,
          },
          { kind: 'ai', attributes: { provider: 'p1', model: 42 }, durationMs: 10 },
          {
            kind: 'ai',
            attributes: { provider: 'p1', model: 'm2', cost_usd: 'nope' },
            durationMs: 5,
          },
          { kind: 'http', attributes: {} },
        ],
      },
    ];
    const { service } = createService({ snapshot, traces });
    const result = await service.getUsageDetail('u1');
    expect(result.success).toBe(true);
    expect(result.data?.totals.tokensTotal).toBe(100);
    expect(result.data?.executions).toHaveLength(1);
    // Three ai spans with string providers: gpt-4 (numeric cost), a non-string
    // model → 'unknown', and m2 (non-numeric cost → honest 0).
    const rows = result.data?.byModel ?? [];
    expect(rows.map((r) => r.modelId)).toEqual(['gpt-4', 'unknown', 'm2']);
    expect(rows[0]?.calls).toBe(1);
    expect(rows[0]?.costUsd).toBe(0.01);
    expect(rows[2]?.costUsd).toBe(0);
  });

  it('defaults preferences when the preferences read fails', async () => {
    const { service } = createService({ getPreferences: { success: false, error: 'x' } });
    const result = await service.getUsageDetail('u1');
    expect(result.data?.preferences.budgetPolicy).toBe('ask_before_paid');
  });

  it('sorts model usage rows by call count descending', async () => {
    const traces = [
      {
        spans: [
          { kind: 'ai', attributes: { provider: 'p1', model: 'a' } },
          { kind: 'ai', attributes: { provider: 'p1', model: 'a' } },
          { kind: 'ai', attributes: { provider: 'p1', model: 'b' } },
          { kind: 'ai', attributes: { provider: 'p1', model: 'a' } },
        ],
      },
    ];
    const { service } = createService({ traces });
    const result = await service.getUsageDetail('u1');
    expect(result.data?.byModel[0]?.modelId).toBe('a');
    expect(result.data?.byModel[0]?.calls).toBe(3);
  });
});

describe('ProviderExperienceService — preferences + explanation', () => {
  it('delegates preference reads and writes owner-scoped', async () => {
    const { service, preferences } = createService({});
    await service.getPreferences('u1');
    expect(preferences.getPreferences).toHaveBeenCalledWith('u1');

    const updated = await service.setPreferences('u1', { budgetPolicy: 'never_paid' });
    expect(updated.success).toBe(true);
    expect(preferences.updatePreferences).toHaveBeenCalledWith('u1', {
      budgetPolicy: 'never_paid',
    });

    const disabled = await service.setProviderEnabled('u1', 'p1', false);
    expect(disabled.data?.disabledProviderIds).toContain('p1');
  });

  it('explains model selection scoped to this user, requiring a userId', async () => {
    const { service } = createService({});
    await expect(service.explainModelSelection('', { capability: 'reasoning' })).resolves.toEqual({
      success: false,
      error: 'userId is required',
    });
    const result = await service.explainModelSelection('u1', { capability: 'reasoning' });
    expect(result.success).toBe(true);
    expect(result.data?.selected.providerId).toBe('p1');
  });

  it('surfaces model-selection failures honestly (Error and non-Error)', async () => {
    const { service } = createService({ decide: new Error('advisor down') });
    const result = await service.explainModelSelection('u1', { capability: 'reasoning' });
    expect(result).toEqual({ success: false, error: 'advisor down' });

    const throwing = createService({});
    throwing.modelSelection.decide.mockImplementation(async () => {
      throw 'raw string failure'; // non-Error
    });
    const failed = await throwing.service.explainModelSelection('u1', {
      capability: 'reasoning',
    });
    expect(failed).toEqual({ success: false, error: 'Model selection failed' });
  });
});
