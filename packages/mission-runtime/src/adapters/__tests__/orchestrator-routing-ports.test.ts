// ──────────────────────────────────────────────────────────────────
// VedMoulya — Mission Runtime: Routing Ports (BLD-023)
//
// Proves the BLD-023 live-activation seam: when a registered adapter
// publishes the exact model it executes (`configuredModel`, e.g. the
// local OllamaProvider), the runtime's routing intelligence advertises
// THAT model — never a different catalog entry the adapter would
// honestly refuse to execute. Catalog-backed adapters (no configured
// model) keep their existing catalog mapping (regression guard).
// Hermetic: no network, no real provider.
// ──────────────────────────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import { AIOrchestrationService } from '@vedmoulya/services';
import type { ProviderAdapter } from '@vedmoulya/services';
import type { AIResponse, CapabilityType, ProviderHealth } from '@vedmoulya/ai';
import { MockProvider } from '@vedmoulya/orchestrator';
import { createOrchestratorRoutingPorts } from '../OrchestratorRoutingPorts.js';

const ALL_CAPABILITIES: CapabilityType[] = [
  'reasoning',
  'coding',
  'vision',
  'embeddings',
  'summarization',
  'classification',
  'translation',
  'speech',
  'image_understanding',
  'general_conversation',
  'content_generation',
];

/** Minimal adapter mirroring OllamaProvider's published-model contract. */
class SingleModelAdapter implements ProviderAdapter {
  name: string;
  family = 'local-test';
  capabilities: CapabilityType[] = ALL_CAPABILITIES;
  constructor(
    name: string,
    private readonly model: string,
  ) {
    this.name = name;
  }
  get configuredModel(): string {
    return this.model;
  }
  async isHealthy(): Promise<boolean> {
    return true;
  }
  async getHealth(): Promise<ProviderHealth> {
    return {
      providerId: this.name,
      status: 'healthy',
      latency: 1,
      errorRate: 0,
      lastChecked: new Date(),
      isRateLimited: false,
    };
  }
  async execute(): Promise<AIResponse> {
    throw new Error('unused in routing tests');
  }
}

describe('OrchestratorRoutingPorts — configured-model advertising (BLD-023)', () => {
  it('routes a single-model local adapter to the model it actually executes', async () => {
    const orchestrator = new AIOrchestrationService();
    orchestrator.registerProvider(new SingleModelAdapter('ollama', 'qwen2.5-coder:3b'));
    orchestrator.configureIntelligence(createOrchestratorRoutingPorts(orchestrator));

    const decision = await orchestrator.explainSelection({
      capability: 'reasoning',
      estimatedInputTokens: 200,
    });
    expect(decision.selected.providerId).toBe('ollama');
    expect(decision.selected.modelId).toBe('qwen2.5-coder:3b');
    // Catalog family entry (a different model) must never be substituted.
    expect(decision.selected.modelId).not.toBe('llama3.3:70b');
  });

  it('keeps catalog model mapping for adapters that do not publish a configured model', async () => {
    const orchestrator = new AIOrchestrationService();
    orchestrator.registerProvider(new MockProvider());
    orchestrator.configureIntelligence(createOrchestratorRoutingPorts(orchestrator));

    const decision = await orchestrator.explainSelection({
      capability: 'coding',
      estimatedInputTokens: 200,
    });
    expect(decision.selected.providerId).toBe('mock');
    expect(decision.selected.modelId).toBe('mock-1'); // unchanged catalog path
  });
});
