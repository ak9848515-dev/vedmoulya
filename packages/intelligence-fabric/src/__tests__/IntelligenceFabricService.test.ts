import { describe, expect, it } from 'vitest';
import { IntelligenceFabricService } from '../application/IntelligenceFabricService.js';
import type { FabricCostPort, FabricProviderPort } from '../contracts/fabric-ports.js';
import type { CostSpendSnapshot, StrategyCandidate } from '../types/fabric-types.js';

const candidates: StrategyCandidate[] = [
  {
    providerId: 'ollama',
    name: 'Ollama',
    capabilityMatched: true,
    quality: 0.7,
    latencyMs: 80,
    estimatedCostUsd: 0,
    localAvailability: 'yes',
    privacyClass: 'PRIVATE',
    healthState: 'HEALTHY',
    evidence: ['registry evidence'],
  },
  {
    providerId: 'openai',
    name: 'OpenAI',
    capabilityMatched: true,
    quality: 0.95,
    latencyMs: 300,
    estimatedCostUsd: 0.01,
    privacyClass: 'PUBLIC',
    healthState: 'HEALTHY',
    evidence: ['registry evidence'],
  },
];

const costPort: FabricCostPort = {
  snapshot: (): CostSpendSnapshot => ({ dailyUsd: 1.2, taskUsd: 0.3 }),
};

const providerPort: FabricProviderPort = {
  candidates: async (): Promise<StrategyCandidate[]> => candidates,
};

describe('IntelligenceFabricService', () => {
  it('observes and reports provider health through the composition seam', () => {
    const fabric = new IntelligenceFabricService();
    const health = fabric.observeHealth({
      providerId: 'openai',
      kind: 'success',
      latencyMs: 120,
      at: '2026-08-14T00:00:00.000Z',
    });
    expect(health.state).toBe('HEALTHY');
    expect(fabric.providerHealth('openai').observedCalls).toBe(1);
    expect(fabric.allProviderHealth().length).toBe(1);
  });

  it('checks cost policy using the real cost port snapshot', () => {
    const fabric = new IntelligenceFabricService({
      costPort,
      costLimits: { maxDailyCostUsd: 10, maxTaskCostUsd: 1 },
    });
    const decision = fabric.checkCost({ additionalUsd: 0.5, providerId: 'openai' });
    expect(decision.allowed).toBe(true);
    expect(decision.current.dailyUsd).toBe(1.2);
  });

  it('gates autonomy through the composition seam', () => {
    const fabric = new IntelligenceFabricService();
    const decision = fabric.gateAutonomy({ currentLevel: 3, action: 'Publish the report' });
    expect(decision.allowed).toBe(true);
    expect(decision.actionClass).toBe('C');
    expect(fabric.nextAutonomyLevel(0, 5)).toBe(1);
  });

  it('selects providers using the real provider port (advisory)', async () => {
    const fabric = new IntelligenceFabricService({ providerPort });
    const selection = await fabric.select({
      strategy: 'PRIVATE',
      taskPrivacy: 'PRIVATE',
      capability: 'TEXT_GENERATION',
    });
    expect(selection.selected?.providerId).toBe('ollama');
    expect(selection.reasons.join(' ')).toContain('privacy overrides cost');
  });

  it('uses default workflow limits and verification config when not injected', () => {
    const fabric = new IntelligenceFabricService();
    expect(fabric.workflowLimits.maxParallelProviders).toBe(4);
    expect(fabric.verificationConfig.maxDepth).toBe(3);
    const decision = fabric.validateWorkflow({
      taskCount: 10,
      depth: 4,
      maxParallelFanout: 2,
      estimatedProviderCalls: 20,
    });
    expect(decision.allowed).toBe(true);
  });

  it('normalizes results and evaluates verification chains through the seam', () => {
    const fabric = new IntelligenceFabricService();
    const normalized = fabric.normalize({ text: 'hello' });
    expect(normalized.kind).toBe('text');

    const plan = fabric.validateVerificationPlan({
      depth: 1,
      providers: 1,
      timeoutMs: 10_000,
      costUsd: 0.1,
    });
    expect(plan.allowed).toBe(true);

    const chain = fabric.evaluateVerificationChain({
      answer: { providerId: 'a', verdict: 'AGREE', note: 'answer' },
      verify: { providerId: 'c', verdict: 'AGREE', note: 'verified' },
    });
    expect(chain.verdict).toBe('VERIFIED');
  });

  it('returns honest empty selection when the provider port has no candidates', async () => {
    const fabric = new IntelligenceFabricService({
      providerPort: { candidates: async (): Promise<StrategyCandidate[]> => [] },
    });
    const selection = await fabric.select({
      strategy: 'QUALITY',
      taskPrivacy: 'PUBLIC',
      capability: 'VIDEO',
    });
    expect(selection.selected).toBeUndefined();
    expect(selection.reasons.join(' ')).toContain('No eligible candidate');
  });
});
