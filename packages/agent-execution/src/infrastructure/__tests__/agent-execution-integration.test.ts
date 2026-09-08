// ──────────────────────────────────────────────────────────────────
// VedMoulya — Agent Execution Intelligence: Integration Tests
//
// THE BRIDGE PROOF: the controlled agent loop wired to the FROZEN estate
// through the real adapters — AIOrchestrationAgentPort (AIOrchestration
// Service → routing/evidence/health/capability-gates/CostLedger) and
// ToolRegistryAgentPort (ToolRuntime security chain). Hermetic: real
// runtime + MockProvider + real ToolRegistry, no network, no keys.
// ──────────────────────────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import { AIOrchestrationService } from '@vedmoulya/services';
import type { ExecutionStrategyPort, ProviderIntelligencePort } from '@vedmoulya/services';
import { MockProvider } from '@vedmoulya/orchestrator';
import { ToolRegistry, registerSafeTools } from '@vedmoulya/services/ai/runtime/ToolRuntime';
import { AgentExecutionService } from '../../application/AgentExecutionService.js';
import type { AgentPlan } from '../../types/agent-execution-types.js';
import { AIOrchestrationAgentPort } from '../AIOrchestrationAgentPort.js';
import { ToolRegistryAgentPort } from '../ToolRegistryAgentPort.js';

function makeRuntime(): { aiPort: AIOrchestrationAgentPort; toolPort: ToolRegistryAgentPort } {
  const ai = new AIOrchestrationService();
  ai.registerProvider(new MockProvider());
  const providerIntelligence: ProviderIntelligencePort = {
    getCandidates: async () => [
      {
        providerId: 'mock',
        family: 'mock',
        capabilities: ['reasoning', 'coding', 'content_generation'],
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

  const tools = new ToolRegistry({
    grantedCapabilities: ['reasoning', 'calculation', 'productivity'],
    allowlist: ['echo', 'calculator', 'current_time'],
  });
  registerSafeTools(tools);

  return { aiPort: new AIOrchestrationAgentPort(ai), toolPort: new ToolRegistryAgentPort(tools) };
}

function reportPlan(): AgentPlan {
  return {
    planId: 'plan-int-1',
    goalId: 'goal-int-1',
    objective: 'summarize then compute',
    steps: [
      {
        stepId: 'summarize',
        objective: 'produce the summary',
        capability: 'reasoning',
        actions: [
          {
            actionId: 'act-summarize',
            kind: 'ai',
            capability: 'reasoning',
            instruction: 'Summarize the monthly report.',
          },
        ],
        allowedTools: [],
        dependencies: [],
        verificationPolicy: {
          kind: 'rule',
          description: 'runtime output present',
          checks: [{ name: 'responded', kind: 'includes', text: 'Mock response' }],
        },
      },
      {
        stepId: 'compute',
        objective: 'compute 1+1',
        actions: [
          {
            actionId: 'act-calc',
            kind: 'tool',
            toolName: 'calculator',
            arguments: { expression: '1+1' },
          },
        ],
        allowedTools: ['calculator'],
        dependencies: ['summarize'],
        verificationPolicy: {
          kind: 'rule',
          description: 'tool succeeded',
          checks: [{ name: 'succeeded', kind: 'includes', text: 'success' }],
        },
      },
    ],
  };
}
describe('AgentExecution — end-to-end through the frozen estate', () => {
  it('executes a multi-step plan (AI → tool) to COMPLETED + ACHIEVED through the real adapters', async () => {
    const { aiPort, toolPort } = makeRuntime();
    const service = new AgentExecutionService({
      ai: aiPort,
      tools: toolPort,
      toolRegistry: toolPort,
    });

    const run = await service.start({
      userId: 'user-1',
      goal: 'Summarize the report and compute 1+1.',
      plan: reportPlan(),
    });

    expect(run.state).toBe('COMPLETED');
    expect(run.outcome).toBe('ACHIEVED');

    const summarize = run.stepResults.find((s) => s.stepId === 'summarize');
    expect(summarize?.status).toBe('completed');
    expect(summarize?.verified).toBe(true);
    expect(summarize?.verdict).toBe('VERIFIED');
    // AI routing evidence on the action record: provider + model + capability.
    expect(summarize?.actions[0]?.provider).toBe('mock');
    expect(summarize?.actions[0]?.model).toBe('mock-v1');
    expect(summarize?.actions[0]?.capability).toBe('reasoning');
    // Action-level outcome: succeeded on first attempt, no fallback invoked.
    expect(summarize?.actions[0]?.status).toBe('succeeded');
    expect(summarize?.actions[0]?.fallbackUsed).toBe(false);
    // Routing evidence also propagated into the observation record — proving
    // the routing decision flowed through action → observation, not just one.
    const summarizeObs = summarize?.observations[0];
    expect(summarizeObs?.provider).toBe('mock');
    expect(summarizeObs?.model).toBe('mock-v1');
    expect(summarizeObs?.capability).toBe('reasoning');
    expect(summarizeObs?.status).toBe('succeeded');

    const compute = run.stepResults.find((s) => s.stepId === 'compute');
    expect(compute?.status).toBe('completed');
    expect(compute?.verified).toBe(true);
    expect(compute?.actions[0]?.toolName).toBe('calculator');
    // Dependency enforcement: compute only ran AFTER summarize verified (public timestamps).
    if (summarize?.endedAt && compute?.startedAt) {
      expect(Date.parse(compute.startedAt)).toBeGreaterThanOrEqual(Date.parse(summarize.endedAt));
    }

    // Trace correlation: every phase present and sanitized.
    const trace = service.getTrace(run.runId, 'user-1');
    expect(trace.filter((r) => r.phase === 'action').length).toBe(2);
    expect(trace.filter((r) => r.phase === 'verification').length).toBe(2);
    expect(trace.some((r) => r.phase === 'outcome')).toBe(true);
    // Observation-phase trace records also carry routing evidence (action → observation → trace).
    expect(trace.filter((r) => r.phase === 'observation').length).toBe(2);
    const obsTrace = trace.find((r) => r.phase === 'observation' && r.kind === 'ai');
    expect(obsTrace?.provider).toBe('mock');
    expect(obsTrace?.model).toBe('mock-v1');
    expect(obsTrace?.capability).toBe('reasoning');
    // Routing transparency on the trace: provider/model/capability survive the real path.
    const aiTrace = trace.find((r) => r.phase === 'action' && r.kind === 'ai');
    expect(aiTrace?.provider).toBe('mock');
    expect(aiTrace?.model).toBe('mock-v1');
    expect(aiTrace?.capability).toBe('reasoning');

    // The actual runtime usage/cost flowed into the agent budget ledger.
    expect(run.usage.costUsd).toBeGreaterThan(0);
    expect(service.status(run.runId, 'user-1').usage.tokensUsed).toBeGreaterThan(0);
  });

  it('the frozen ToolRuntime permission boundary cannot be bypassed by the agent', async () => {
    const { aiPort } = makeRuntime();
    // A registry WITHOUT the calculation capability granted.
    const locked = new ToolRegistry({ grantedCapabilities: ['reasoning'], allowlist: ['echo'] });
    registerSafeTools(locked);
    const lockedToolPort = new ToolRegistryAgentPort(locked);
    const service = new AgentExecutionService({
      ai: aiPort,
      tools: lockedToolPort,
      toolRegistry: lockedToolPort,
    });

    const run = await service.start({
      userId: 'user-1',
      goal: 'Try the calculator.',
      plan: {
        planId: 'plan-int-2',
        goalId: 'goal-int-2',
        objective: 'compute',
        steps: [
          {
            stepId: 'compute',
            objective: 'compute 1+1',
            actions: [
              {
                actionId: 'act-calc',
                kind: 'tool',
                toolName: 'calculator',
                arguments: { expression: '1+1' },
              },
            ],
            allowedTools: ['calculator'],
            dependencies: [],
            verificationPolicy: {
              kind: 'rule',
              description: 'succeeded',
              checks: [{ name: 'ok', kind: 'includes', text: 'success' }],
            },
          },
        ],
      },
    });

    // The security chain denied it — a model request is NOT authorization.
    expect(run.state).toBe('BLOCKED');
    expect(run.outcomeReasons.join(' ')).toContain('never bypassed');
    const sr = run.stepResults[0];
    expect(sr?.status).toBe('blocked');
    expect(sr?.observations[0]?.status).toBe('denied');
  });
});
