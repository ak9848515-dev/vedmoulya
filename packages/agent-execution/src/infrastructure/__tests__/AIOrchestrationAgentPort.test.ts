// ──────────────────────────────────────────────────────────────────
// VedMoulya — Agent Execution Intelligence: AI Runtime Port Tests
// The agent's AI boundary delegates to the frozen AIOrchestrationService
// (routing/evidence/health/capability-gates/retry/CostLedger). These
// tests are hermetic: real runtime + MockProvider, no network, no keys.
// ──────────────────────────────────────────────────────────────────

import { describe, expect, it, vi } from 'vitest';
import { AIOrchestrationService } from '@vedmoulya/services';
import type { ExecutionStrategyPort, ProviderIntelligencePort } from '@vedmoulya/services';
import { MockProvider } from '@vedmoulya/orchestrator';
import type { AgentAiActionInput } from '../../contracts/agent-execution-ports.js';
import { AIOrchestrationAgentPort } from '../AIOrchestrationAgentPort.js';

function makePort(): { ai: AIOrchestrationService; port: AIOrchestrationAgentPort } {
  const ai = new AIOrchestrationService();
  ai.registerProvider(new MockProvider());
  // Wire EI-002/EI-004 stubs so the runtime's advisor (AI-SELECT) is live.
  const providerIntelligence: ProviderIntelligencePort = {
    getCandidates: async () => [
      {
        providerId: 'mock',
        family: 'mock',
        capabilities: ['reasoning', 'coding', 'vision', 'content_generation'],
        healthy: true,
        models: [{ id: 'mock-v1', contextWindow: 8000, maxOutputTokens: 2000, streaming: false }],
        benchmarkScore: 7,
        averageLatencyMs: 50,
        costPer1KInput: 0.001,
        costPer1KOutput: 0.002,
      },
    ],
  };
  const executionStrategy: ExecutionStrategyPort = {
    getRoutingContext: async () => ({ strategy: 'balanced' as const }),
  };
  ai.configureIntelligence({ providerIntelligence, executionStrategy });
  return { ai, port: new AIOrchestrationAgentPort(ai) };
}

function aiInput(overrides: Partial<AgentAiActionInput> = {}): AgentAiActionInput {
  return {
    actionId: 'act-1',
    stepId: 'step-1',
    goalId: 'goal-1',
    planId: 'plan-1',
    userId: 'user-1',
    capability: 'reasoning',
    qualityTier: 'standard',
    instruction: 'Analyze the short dump and propose a fix.',
    attempt: 1,
    revision: 0,
    fallbackExpected: false,
    ...overrides,
  };
}

describe('AIOrchestrationAgentPort — routing integration', () => {
  it('executes an AI action through the frozen runtime (never provider SDKs)', async () => {
    const { port } = makePort();
    const result = await port.execute(aiInput());
    expect(result.content).toContain('Mock response');
    expect(result.provider).toBe('mock');
    expect(result.model).toBeDefined();
    expect(result.tokens?.total).toBeGreaterThan(0);
    expect(result.costUsd).toBeGreaterThan(0);
    expect(result.selectionExplanation).toBeDefined();
    expect(result.abstained).toBe(false);
  });

  it('forwards requiredCapabilities in FULL so routing gates on every requirement', async () => {
    const orchestrate = vi.fn(async () => ({
      content: 'ok',
      provider: 'mock',
      model: 'mock-v1',
      confidence: 0.9,
      qualityScore: 8,
      latency: 1,
      cost: 0,
      tokenUsage: { input: 1, output: 1, total: 2 },
      validation: { passed: true, checks: [], overallScore: 8, decision: 'pass' },
      traceId: 't',
      routingDecision: {
        selectedProvider: 'mock',
        reason: 'test',
        alternativesConsidered: [],
        strategy: 'balanced',
      },
      providerSelection: {
        capability: 'coding',
        selected: { providerId: 'mock', modelId: 'mock-v1', reasons: ['mock only'], score: 1 },
        fallback: [],
        candidatesConsidered: [],
        strategy: 'balanced',
        estimatedInputTokens: 100,
        estimatedCost: 0,
        evaluatedAt: new Date().toISOString(),
      },
    }));
    const ai = { orchestrate, explainSelection: vi.fn() } as unknown as AIOrchestrationService;
    const port = new AIOrchestrationAgentPort(ai);
    await port.execute(
      aiInput({ capability: 'coding', requiredCapabilities: ['coding', 'reasoning'] }),
    );
    expect(orchestrate).toHaveBeenCalledWith(
      expect.objectContaining({
        capability: 'coding',
        requiredCapabilities: ['coding', 'reasoning'],
      }),
    );
  });

  it('maps a runtime abstention to the agent abstained flag (evidence-first)', async () => {
    const orchestrate = vi.fn(async () => ({
      content: '',
      provider: 'mock',
      model: 'mock-v1',
      confidence: 0,
      qualityScore: 0,
      latency: 1,
      cost: 0,
      tokenUsage: { input: 1, output: 0, total: 1 },
      validation: { passed: false, checks: [], overallScore: 0, decision: 'fail' },
      traceId: 't',
      routingDecision: {
        selectedProvider: 'mock',
        reason: 'abstain',
        alternativesConsidered: [],
        strategy: 'balanced',
      },
      abstained: true,
    }));
    const ai = { orchestrate } as unknown as AIOrchestrationService;
    const port = new AIOrchestrationAgentPort(ai);
    const result = await port.execute(aiInput());
    expect(result.abstained).toBe(true);
  });

  it('propagates provider failures to the agent recovery layer', async () => {
    const failing: MockProvider = Object.assign(
      Object.create(Object.getPrototypeOf(new MockProvider())),
      {
        name: 'mock',
        family: 'mock',
        capabilities: ['reasoning'],
        execute: async () => {
          throw new Error('provider 503 unavailable');
        },
      },
    );
    const ai = new AIOrchestrationService();
    ai.registerProvider(failing);
    const port = new AIOrchestrationAgentPort(ai);
    await expect(port.execute(aiInput())).rejects.toThrow();
  });
});
describe('AIOrchestrationAgentPort — plan validation feasibility', () => {
  it('canRoute is ok when the runtime can select a model for the capability set', async () => {
    const { port } = makePort();
    const result = await port.canRoute({ capability: 'reasoning' });
    expect(result.ok).toBe(true);
  });

  it('canRoute fails honestly when the runtime cannot route the capability set', async () => {
    const ai = new AIOrchestrationService();
    ai.registerProvider(new MockProvider());
    const port = new AIOrchestrationAgentPort(ai);
    const result = await port.canRoute({ capability: 'vision' });
    // mock-v1 declares no vision model → the advisor rejects the route.
    expect(result.ok).toBe(false);
    expect(result.reason).toBeTruthy();
  });
});
