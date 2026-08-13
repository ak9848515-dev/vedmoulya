import { describe, expect, it } from 'vitest';
import { Provider } from '../../entities/Provider.js';
import { createProviderId } from '../../value-objects/ProviderId.js';
import { ProviderLifecycleStatus } from '../../value-objects/ProviderLifecycleStatus.js';
import { ProviderCapabilityMatrixService } from '../ProviderCapabilityMatrixService.js';

interface MakeProviderOverrides {
  quality?: number;
  confidence?: number;
  cost?: number;
  capabilities?: Provider['capabilities'][number][];
}

function makeProvider(id: string, overrides: MakeProviderOverrides = {}): Provider {
  const quality = overrides.quality ?? 0.9;
  return Provider.create({
    id: createProviderId(id),
    family: 'mock',
    name: id,
    description: `${id} provider`,
    owner: 'test',
    lifecycleStatus: ProviderLifecycleStatus.fromStatus('active'),
    capabilities: overrides.capabilities ?? ['content_generation'],
    models: [
      {
        id: `${id}-1`,
        name: `${id} model`,
        contextLength: 128000,
        maxOutputTokens: 8192,
        streaming: true,
        vision: false,
        functionCalling: true,
        embeddings: false,
        reasoning: true,
        coding: false,
        creativeWriting: true,
        translation: false,
        image: false,
        audio: false,
        video: false,
        modalities: ['text-in', 'text-out'],
        capabilities: ['content_generation'],
      },
    ],
    matrix: [
      {
        capability: 'content_generation',
        quality,
        expectedCostUsd: overrides.cost ?? 0.01,
        expectedLatencyMs: 1000,
        expectedInputTokens: 6000,
        expectedOutputTokens: 4000,
        confidence: overrides.confidence ?? 0.9,
        historicalSuccess: 0.95,
        qualityTier: 'standard',
      },
    ],
  });
}

describe('ProviderCapabilityMatrixService', () => {
  it('builds one row per capability with providers ranked by quality', () => {
    const svc = new ProviderCapabilityMatrixService();
    const providers = [
      makeProvider('low', { quality: 0.8 }),
      makeProvider('high', { quality: 0.95 }),
      makeProvider('mid', { quality: 0.9 }),
    ];
    const view = svc.buildMatrixView(providers);
    const row = view.rows.find((r) => r.capability === 'content_generation');
    expect(row).toBeDefined();
    expect(row?.providerCount).toBe(3);
    expect(row?.rankings.map((r) => r.providerId)).toEqual(['high', 'mid', 'low']);
    expect(row?.bestProviderId).toBe('high');
  });

  it('breaks quality ties by confidence then lower cost', () => {
    const svc = new ProviderCapabilityMatrixService();
    const providers = [
      makeProvider('a', { quality: 0.9, confidence: 0.8 }),
      makeProvider('b', { quality: 0.9, confidence: 0.95 }),
      makeProvider('c', { quality: 0.9, confidence: 0.95, cost: 0.001 }),
    ];
    const view = svc.buildMatrixView(providers);
    const row = view.rows.find((r) => r.capability === 'content_generation');
    expect(row?.rankings.map((r) => r.providerId)).toEqual(['c', 'b', 'a']);
  });

  it('sorts rows alphabetically by capability', () => {
    const svc = new ProviderCapabilityMatrixService();
    const a = makeProvider('a');
    a.upsertMatrixEntry({
      capability: 'reasoning',
      quality: 0.9,
      expectedCostUsd: 0.01,
      expectedLatencyMs: 1000,
      expectedInputTokens: 3000,
      expectedOutputTokens: 1500,
      confidence: 0.9,
      historicalSuccess: 0.95,
      qualityTier: 'standard',
    });
    const view = svc.buildMatrixView([a]);
    expect(view.rows.map((r) => r.capability)).toEqual(['content_generation', 'reasoning']);
  });

  it('summarizes a provider matrix with averages', () => {
    const svc = new ProviderCapabilityMatrixService();
    const provider = makeProvider('a', { quality: 0.9, cost: 0.02 });
    provider.upsertMatrixEntry({
      capability: 'reasoning',
      quality: 0.7,
      expectedCostUsd: 0.04,
      expectedLatencyMs: 2000,
      expectedInputTokens: 3000,
      expectedOutputTokens: 1500,
      confidence: 0.8,
      historicalSuccess: 0.9,
      qualityTier: 'standard',
    });
    const summary = svc.summarize(provider);
    expect(summary.capabilityCount).toBe(2);
    expect(summary.averageQuality).toBeCloseTo(0.8, 5);
    expect(summary.averageCostUsd).toBeCloseTo(0.03, 5);
  });

  it('finds providers for a capability (discovery, no selection)', () => {
    const svc = new ProviderCapabilityMatrixService();
    const providers = [makeProvider('a', { quality: 0.9 }), makeProvider('b', { quality: 0.95 })];
    const rankings = svc.findProvidersForCapability(providers, 'content_generation');
    expect(rankings).toHaveLength(2);
    expect(rankings[0]?.providerId).toBe('b');
    expect(svc.findProvidersForCapability(providers, 'vision')).toHaveLength(0);
  });

  it('handles providers without a matrix', () => {
    const svc = new ProviderCapabilityMatrixService();
    const empty = makeProvider('empty');
    const view = svc.buildMatrixView([empty]);
    expect(view.rows).toHaveLength(1); // from makeProvider's default matrix
    const summary = svc.summarize(
      Provider.create({
        id: createProviderId('bare'),
        family: 'mock',
        name: 'bare',
        description: 'bare',
        owner: 'test',
        lifecycleStatus: ProviderLifecycleStatus.fromStatus('draft'),
        capabilities: [],
        models: [
          {
            id: 'bare-1',
            name: 'bare model',
            contextLength: 8192,
            maxOutputTokens: 1024,
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
          },
        ],
      }),
    );
    expect(summary.capabilityCount).toBe(0);
    expect(summary.averageQuality).toBe(0);
  });
});
