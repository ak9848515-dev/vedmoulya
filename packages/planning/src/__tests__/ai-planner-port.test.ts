// ──────────────────────────────────────────────────────────────────
// VedMoulya — Planning: AIOrchestrationPlannerPort tests.
//
// The planner's ONLY AI boundary. These tests are hermetic: they stub
// AIOrchestrationService, so no provider SDK is ever called. They assert
// that the port builds the (untrusted) proposal prompt with correct tool/
// capability guidance and maps the runtime response faithfully, and that
// canRoute is a pure feasibility query that never executes anything.
// ──────────────────────────────────────────────────────────────────

import { describe, expect, it, vi } from 'vitest';
import { AIOrchestrationService } from '@vedmoulya/services';
import type { CapabilityType } from '@vedmoulya/ai';
import { AIOrchestrationPlannerPort } from '../infrastructure/AIOrchestrationPlannerPort.js';

function makePort(
  overrides: {
    orchestrate?: unknown;
    explainSelection?: unknown;
  } = {},
): AIOrchestrationPlannerPort {
  const ai = {
    orchestrate: overrides.orchestrate ?? vi.fn(),
    explainSelection: overrides.explainSelection ?? vi.fn(),
  } as unknown as AIOrchestrationService;
  return new AIOrchestrationPlannerPort(ai);
}

function proposalInput(
  overrides: {
    goal?: string;
    objective?: string;
    userId?: string;
    requiredCapabilities?: CapabilityType[];
    availableTools?: string[];
    constraints?: { maxSteps: number; autonomyLevel: string; allowToolUse: boolean };
  } = {},
) {
  return {
    goal: 'Ship the fix',
    objective: 'Fix the failing test',
    userId: 'user-1',
    requiredCapabilities: ['coding'] as CapabilityType[],
    availableTools: ['run.tests'],
    constraints: { maxSteps: 5, autonomyLevel: 'SUPERVISED', allowToolUse: true },
    ...overrides,
  };
}

function orchestrateResponse(overrides: Record<string, unknown> = {}) {
  return {
    content: '{"objective":"fix","steps":[]}',
    provider: 'mock',
    model: 'mock-v1',
    confidence: 0.9,
    qualityScore: 8,
    latency: 37,
    cost: 0.002,
    tokenUsage: { input: 90, output: 40, total: 130 },
    validation: { passed: true, checks: [], overallScore: 8, decision: 'pass' },
    traceId: 't',
    routingDecision: {
      selectedProvider: 'mock',
      reason: 'only',
      alternativesConsidered: [],
      strategy: 'balanced',
    },
    ...overrides,
  };
}

describe('AIOrchestrationPlannerPort — proposal boundary', () => {
  it('delegates to the frozen orchestrator and maps the response faithfully', async () => {
    const orchestrate = vi.fn(async () => orchestrateResponse());
    const port = makePort({ orchestrate });

    const result = await port.propose(proposalInput());

    expect(orchestrate).toHaveBeenCalledTimes(1);
    expect(result.content).toContain('objective');
    expect(result.provider).toBe('mock');
    expect(result.model).toBe('mock-v1');
    expect(result.tokens).toEqual({ input: 90, output: 40, total: 130 });
    expect(result.costUsd).toBe(0.002);
    expect(result.latencyMs).toBe(37);
    expect(result.abstained).toBe(false);
  });

  it('offers the tool allowlist when tool use is permitted and tools exist', async () => {
    const orchestrate = vi.fn(async () => orchestrateResponse());
    const port = makePort({ orchestrate });

    await port.propose(proposalInput({ availableTools: ['run.tests', 'read.files'] }));

    const [sent] = orchestrate.mock.calls[0] as unknown as Array<{
      userInput: string;
      userId?: string;
    }>;
    expect(sent.userInput).toContain(
      'Available tools (select ONLY from this list): run.tests, read.files',
    );
    expect(sent.userInput).toContain(
      'The goal already requires these capabilities (preserve them in FULL across the plan): coding',
    );
    expect(sent.userInput).toContain('Maximum steps: 5');
    expect(sent.userId).toBe('user-1');
  });

  it('forbids tools when tool use is not permitted', async () => {
    const orchestrate = vi.fn(async () => orchestrateResponse());
    const port = makePort({ orchestrate });

    await port.propose(
      proposalInput({
        constraints: { maxSteps: 3, autonomyLevel: 'ASSISTED', allowToolUse: false },
      }),
    );

    const [sent] = orchestrate.mock.calls[0] as unknown as Array<{ userInput: string }>;
    expect(sent.userInput).toContain(
      'No tools are available on this platform. Use AI actions only.',
    );
  });

  it('asks the model to infer capabilities only from the frozen taxonomy when none are known', async () => {
    const orchestrate = vi.fn(async () => orchestrateResponse());
    const port = makePort({ orchestrate });

    await port.propose(proposalInput({ requiredCapabilities: [] }));

    const [sent] = orchestrate.mock.calls[0] as unknown as Array<{ userInput: string }>;
    expect(sent.userInput).toContain('The goal capabilities are not yet inferred');
  });

  it('maps a runtime abstention to the abstained flag (evidence-first)', async () => {
    const orchestrate = vi.fn(async () =>
      orchestrateResponse({
        content: '',
        abstained: true,
        validation: { passed: false, checks: [], overallScore: 0, decision: 'fail' },
      }),
    );
    const port = makePort({ orchestrate });

    const result = await port.propose(proposalInput());

    expect(result.abstained).toBe(true);
  });
});

describe('AIOrchestrationPlannerPort — canRoute (pure feasibility query)', () => {
  it('returns ok when the runtime can route the capability', async () => {
    const explainSelection = vi.fn(async () => ({ explanation: 'mock can code' }));
    const port = makePort({ explainSelection });

    const verdict = await port.canRoute({ capability: 'coding', requiredCapabilities: ['coding'] });

    expect(verdict.ok).toBe(true);
    expect(explainSelection).toHaveBeenCalledWith(
      expect.objectContaining({ capability: 'coding', requiredCapabilities: ['coding'] }),
    );
  });

  it('returns a bounded reason when routing is infeasible (Error)', async () => {
    const explainSelection = vi.fn(async () => {
      throw new Error('no healthy provider for capability coding');
    });
    const port = makePort({ explainSelection });

    const verdict = await port.canRoute({ capability: 'coding' });

    expect(verdict.ok).toBe(false);
    expect(verdict.reason).toBe('no healthy provider for capability coding');
  });

  it('stringifies non-Error routing failures', async () => {
    const explainSelection = vi.fn(async () => {
      throw 'network down';
    });
    const port = makePort({ explainSelection });

    const verdict = await port.canRoute({ capability: 'reasoning' });

    expect(verdict.ok).toBe(false);
    expect(verdict.reason).toBe('network down');
  });
});
