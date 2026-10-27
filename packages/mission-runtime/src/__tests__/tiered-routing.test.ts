import { describe, expect, it } from 'vitest';
import {
  createMissionExecutionStrategy,
  createOrchestratorProviderIntelligence,
} from '../adapters/OrchestratorRoutingPorts.js';
import { AIOrchestrationService } from '@vedmoulya/services';
import type { ProviderAdapter } from '@vedmoulya/services';

describe('Tiered Model Routing', () => {
  it('selects quality-first strategy for planning and frontier preference', async () => {
    const planningStrategy = createMissionExecutionStrategy({ capability: 'planning' });
    const planningContext = await planningStrategy.getRoutingContext();
    expect(planningContext.strategy).toBe('quality-first');

    const reasoningStrategy = createMissionExecutionStrategy({ capability: 'reasoning' });
    const reasoningContext = await reasoningStrategy.getRoutingContext();
    expect(reasoningContext.strategy).toBe('quality-first');

    const frontierStrategy = createMissionExecutionStrategy({ preferredTier: 'FRONTIER' });
    const frontierContext = await frontierStrategy.getRoutingContext();
    expect(frontierContext.strategy).toBe('quality-first');
  });

  it('selects cost-first strategy for code_generation and local/efficiency preference', async () => {
    const codeStrategy = createMissionExecutionStrategy({ capability: 'code_generation' });
    const codeContext = await codeStrategy.getRoutingContext();
    expect(codeContext.strategy).toBe('cost-first');

    const localStrategy = createMissionExecutionStrategy({ preferredTier: 'LOCAL' });
    const localContext = await localStrategy.getRoutingContext();
    expect(localContext.strategy).toBe('cost-first');

    const efficiencyStrategy = createMissionExecutionStrategy({ preferredTier: 'EFFICIENCY' });
    const efficiencyContext = await efficiencyStrategy.getRoutingContext();
    expect(efficiencyContext.strategy).toBe('cost-first');
  });

  it('defaults to balanced strategy when no capability or tier is specified', async () => {
    const defaultStrategy = createMissionExecutionStrategy();
    const defaultContext = await defaultStrategy.getRoutingContext();
    expect(defaultContext.strategy).toBe('balanced');
  });

  it('differentiates benchmark and cost scores across catalog providers and local ollama', async () => {
    const orchestrator = new AIOrchestrationService();

    // Register an OpenAI provider adapter
    const openaiAdapter = {
      name: 'openai',
      family: 'openai',
      capabilities: ['chat', 'code_generation', 'reasoning'] as CapabilityType[],
      isConfigured: () => true,
      healthCheck: async () => ({ status: 'healthy' as const, latency: 300 }),
      execute: async () => ({ output: 'ok' }),
    } as unknown as ProviderAdapter;

    // Register a local Ollama provider adapter
    const ollamaAdapter = {
      name: 'ollama',
      family: 'ollama',
      capabilities: ['chat', 'code_generation'] as CapabilityType[],
      isConfigured: () => true,
      healthCheck: async () => ({ status: 'healthy' as const, latency: 150 }),
      execute: async () => ({ output: 'local ok' }),
    } as unknown as ProviderAdapter;

    orchestrator.registerProvider(openaiAdapter);
    orchestrator.registerProvider(ollamaAdapter);

    const providerIntelligence = createOrchestratorProviderIntelligence(orchestrator);
    const candidates = await providerIntelligence.getCandidates('code_generation');

    expect(candidates).toHaveLength(2);

    const ollamaCandidate = candidates.find((c) => c.providerId === 'ollama')!;
    expect(ollamaCandidate).toBeDefined();
    expect(ollamaCandidate.costPer1KInput).toBe(0);
    expect(ollamaCandidate.costPer1KOutput).toBe(0);
    expect(ollamaCandidate.benchmarkScore).toBeGreaterThanOrEqual(80);

    const openaiCandidate = candidates.find((c) => c.providerId === 'openai')!;
    expect(openaiCandidate).toBeDefined();
    expect(openaiCandidate.benchmarkScore).toBeGreaterThanOrEqual(90);
  });
});
