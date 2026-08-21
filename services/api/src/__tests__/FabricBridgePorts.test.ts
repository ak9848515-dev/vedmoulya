// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Gateway: FabricBridgePorts unit tests
// SPRINT-030 — the REAL seams between the Intelligence Fabric and the frozen
// estate (CostLedger + trace spine + provider registry + health ledger):
//   createFabricCostPort    — honest spend snapshot (absent when zero, never
//                              fabricated; provider-filtered view)
//   createFabricProviderPort — registry evidence → StrategyCandidate mapping
//                              (capability match, quality, latency, cost tier,
//                              local availability, OBSERVED health state)
// ─────────────────────────────────────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import { InMemoryTraceStore, ExecutionTraceProvider } from '@vedmoulya/core';
import { CostLedger } from '../observability/CostLedger.js';
import { ProviderHealthLedger } from '@vedmoulya/intelligence-fabric';
import {
  createFabricCostPort,
  createFabricProviderPort,
} from '../infrastructure/FabricBridgePorts.js';
import type { ProviderApplicationService } from '@vedmoulya/providers';
import type { StrategyCandidate } from '@vedmoulya/intelligence-fabric';

/** A provider registry that answers listByCapability with fixed DTO evidence. */
function createFakeProviders(dtos: Record<string, unknown>[]): ProviderApplicationService {
  return {
    listByCapability: async (capability: never) => ({
      success: true,
      data: dtos.map((dto, i) => ({
        id: `provider-${i}`,
        name: `Provider ${i}`,
        capabilities: [capability],
        bestQuality: 0.9,
        p50Ms: 150,
        bestCostUsd: 0.01,
        costTier: 'paid',
        family: 'openai',
        availability: 0.99,
        ...dto,
      })),
    }),
  } as unknown as ProviderApplicationService;
}

describe('createFabricCostPort (SPRINT-030)', () => {
  it('reports the owner spend recorded in the trace spine (never fabricated)', async () => {
    const store = new InMemoryTraceStore();
    const provider = new ExecutionTraceProvider({ store });
    const ledger = new CostLedger();
    await provider.withSpan({ name: 'ai.stream', userId: 'c-1' }, async (root) => {
      root.addEvent('loop.step', { provider: 'openai', cost_usd: 2.5, tokens_total: 1000 });
    });
    await provider.withSpan({ name: 'ai.stream', userId: 'c-1' }, async (root) => {
      root.addEvent('loop.step', { provider: 'anthropic', cost_usd: 0.5, tokens_total: 100 });
    });
    await provider.withSpan({ name: 'ai.stream', userId: 'other' }, async (root) => {
      root.addEvent('loop.step', { provider: 'openai', cost_usd: 99, tokens_total: 1000 });
    });

    const port = createFabricCostPort(ledger, store);
    const snapshot = port.snapshot({ ownerId: 'c-1' });
    expect(snapshot.dailyUsd).toBeCloseTo(3.0, 5);
    // Provider-filtered view reflects only that provider's spend.
    const providerView = port.snapshot({ ownerId: 'c-1', providerId: 'anthropic' });
    expect(providerView.providerUsd).toBeCloseTo(0.5, 5);
  });

  it('returns undefined (absent) when no spend was recorded — no zero fabrication', async () => {
    const store = new InMemoryTraceStore();
    const ledger = new CostLedger();
    const port = createFabricCostPort(ledger, store);
    const snapshot = port.snapshot({ ownerId: 'nobody' });
    expect(snapshot.dailyUsd).toBeUndefined();
    expect(snapshot.providerUsd).toBeUndefined();
  });
});

describe('createFabricProviderPort (SPRINT-030)', () => {
  it('maps registry DTO evidence into StrategyCandidates with observed health', async () => {
    const healthLedger = new ProviderHealthLedger();
    healthLedger.observe({ providerId: 'provider-0', kind: 'success', latencyMs: 200 });
    const port = createFabricProviderPort(createFakeProviders([{}]), healthLedger);

    const candidates = await port.candidates('TEXT_GENERATION' as never);
    expect(candidates.length).toBeGreaterThan(0);
    const first: StrategyCandidate = candidates[0]!;
    expect(first.providerId).toBe('provider-0');
    expect(first.capabilityMatched).toBe(true);
    expect(first.quality).toBe(0.9);
    expect(first.latencyMs).toBe(150);
    expect(first.estimatedCostUsd).toBe(0.01);
    expect(first.freeAvailability).toBe('PAID');
    expect(first.localAvailability).toBe('no');
    // Health comes from the fabric's OWN ledger — the observed state, not the
    // registry's declared one.
    expect(first.healthState).toBe('HEALTHY');
  });

  it('marks free and local providers honestly', async () => {
    const healthLedger = new ProviderHealthLedger();
    const port = createFabricProviderPort(
      createFakeProviders([
        { costTier: 'free', family: 'ollama', bestQuality: 0, p50Ms: 0, bestCostUsd: 0 },
      ]),
      healthLedger,
    );
    const candidates = await port.candidates('TEXT_GENERATION' as never);
    const first = candidates[0]!;
    expect(first.freeAvailability).toBe('FREE');
    expect(first.localAvailability).toBe('yes');
    // Zero/unknown metrics map to undefined — honest absence, not fabricated values.
    expect(first.quality).toBeUndefined();
    expect(first.latencyMs).toBeUndefined();
    expect(first.estimatedCostUsd).toBeUndefined();
    // No observations yet → UNKNOWN, never a fake healthy.
    expect(first.healthState).toBe('UNKNOWN');
  });

  it('returns an empty list when the registry fails or has no data', async () => {
    const healthLedger = new ProviderHealthLedger();
    const failing: ProviderApplicationService = {
      listByCapability: async () => ({ success: false, data: undefined }),
    } as unknown as ProviderApplicationService;
    const port = createFabricProviderPort(failing, healthLedger);
    expect(await port.candidates('TEXT_GENERATION' as never)).toEqual([]);
  });
});
