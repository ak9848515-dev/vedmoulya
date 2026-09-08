// ──────────────────────────────────────────────────────────────────
// VedMoulya — Adaptive Agent Loop: AIOrchestrationDecisionPort tests.
//
// The decision model boundary is the ONLY way the loop consults a model.
// These tests are hermetic: they stub AIOrchestrationService.orchestrate,
// so no provider SDK is ever called. They assert that the port:
//   - builds the decision sections for the (untrusted) model input,
//   - maps the runtime response (content/provider/model/tokens/cost/
//     latency/abstained) into the DecisionProposalResult shape,
//   - maps a runtime error into an evidence-first abstention (no crash).
// ──────────────────────────────────────────────────────────────────

import { describe, expect, it, vi } from 'vitest';
import { AIOrchestrationService } from '@vedmoulya/services';
import type { AgentDecisionModelPort, DecisionContext } from '../contracts/adaptive-loop-ports.js';
import { AIOrchestrationDecisionPort } from '../infrastructure/AIOrchestrationDecisionPort.js';

function decisionContext(overrides: Partial<DecisionContext> = {}): DecisionContext {
  return {
    goal: 'Harden the repository',
    goalId: 'goal-1',
    planId: 'plan-1',
    currentStep: {
      stepId: 'step-1',
      objective: 'Add tests',
      capability: 'coding',
      requiredCapabilities: ['coding'],
    },
    recentObservations: [
      {
        observationId: 'obs-1',
        actionId: 'act-1',
        stepId: 'step-1',
        status: 'verified',
        resultSummary: 'tests green',
      },
    ],
    availableTools: ['run.tests'],
    allowedCapabilities: ['coding', 'reasoning'],
    remainingBudget: {
      actions: 10,
      toolCalls: 8,
      tokens: 5000,
      costUsd: 0.5,
      decisionIterations: 3,
    },
    verificationState: 'PENDING',
    recoveryState: { attempts: 1, revisions: 0, replans: 0, abstains: 0 },
    allowedDecisionKinds: ['CONTINUE', 'TOOL_CALL', 'AI_ACTION', 'COMPLETE', 'ABSTAIN'],
    ...overrides,
  };
}

function makePort(orchestrate: unknown): {
  port: AgentDecisionModelPort;
  ai: AIOrchestrationService;
} {
  const ai = { orchestrate, explainSelection: vi.fn() } as unknown as AIOrchestrationService;
  return { port: new AIOrchestrationDecisionPort(ai), ai };
}

describe('AIOrchestrationDecisionPort — decision consultation boundary', () => {
  it('delegates to the frozen orchestrator and maps the full response into a proposal', async () => {
    const orchestrate = vi.fn(async () => ({
      content: '{"kind":"AI_ACTION","rationale":"add tests"}',
      provider: 'mock',
      model: 'mock-v1',
      confidence: 0.9,
      qualityScore: 8,
      latency: 41,
      cost: 0.0012,
      tokenUsage: { input: 120, output: 60, total: 180 },
      validation: { passed: true, checks: [], overallScore: 8, decision: 'pass' },
      traceId: 't',
      routingDecision: {
        selectedProvider: 'mock',
        reason: 'only',
        alternativesConsidered: [],
        strategy: 'balanced',
      },
    }));
    const { port } = makePort(orchestrate);
    const context = decisionContext();

    const result = await port.decide(context);

    expect(orchestrate).toHaveBeenCalledTimes(1);
    expect(result.content).toContain('AI_ACTION');
    expect(result.provider).toBe('mock');
    expect(result.model).toBe('mock-v1');
    expect(result.tokens).toEqual({ input: 120, output: 60, total: 180 });
    expect(result.costUsd).toBe(0.0012);
    expect(result.latencyMs).toBe(41);
    expect(result.abstained).toBe(false);
    expect(result.error).toBeUndefined();
  });

  it('serializes a goal-level decision (no current step) with empty observations/tools', async () => {
    const orchestrate = vi.fn(async () => ({
      content: '{"kind":"CONTINUE","rationale":"keep going"}',
      provider: 'mock',
      model: 'mock-v1',
      confidence: 0.5,
      qualityScore: 5,
      latency: 10,
      cost: 0,
      tokenUsage: { input: 1, output: 1, total: 2 },
      validation: { passed: true, checks: [], overallScore: 5, decision: 'pass' },
      traceId: 't',
      routingDecision: {
        selectedProvider: 'mock',
        reason: 'only',
        alternativesConsidered: [],
        strategy: 'balanced',
      },
    }));
    const { port } = makePort(orchestrate);
    const context = decisionContext({
      currentStep: undefined,
      recentObservations: [],
      availableTools: [],
      allowedCapabilities: ['reasoning'],
    });

    const result = await port.decide(context);

    expect(result.content).toContain('CONTINUE');
    const [sent] = orchestrate.mock.calls[0] as unknown as Array<{ userInput: string }>;
    expect(sent.userInput).toContain('Current step: none');
    expect(sent.userInput).toContain('Recent observations (bounded): none');
    expect(sent.userInput).toContain('Available tools (authorized): none');
  });

  it('omits the capability suffix when the current step has no capability', async () => {
    const orchestrate = vi.fn(async () => ({
      content:
        '{"kind":"ABSTAIN","rationale":"not enough evidence","abstainReason":"no observations"}',
      provider: 'mock',
      model: 'mock-v1',
      confidence: 0,
      qualityScore: 0,
      latency: 10,
      cost: 0,
      tokenUsage: { input: 1, output: 1, total: 2 },
      validation: { passed: false, checks: [], overallScore: 0, decision: 'fail' },
      abstained: true,
      traceId: 't',
      routingDecision: {
        selectedProvider: 'mock',
        reason: 'abstain',
        alternativesConsidered: [],
        strategy: 'balanced',
      },
    }));
    const { port } = makePort(orchestrate);
    const context = decisionContext({
      currentStep: { stepId: 'step-1', objective: 'Add tests' },
    });

    const result = await port.decide(context);

    const [sent] = orchestrate.mock.calls[0] as unknown as Array<{ userInput: string }>;
    expect(sent.userInput).toContain('Current step: step-1 — Add tests');
    expect(sent.userInput).not.toContain('(capability:');
    // A runtime abstention is surfaced as abstained, evidence-first.
    expect(result.abstained).toBe(true);
  });

  it('maps a non-Error orchestrator throw into a string abstention', async () => {
    const orchestrate = vi.fn(async () => {
      throw 'gateway exploded'; // non-Error rejection — must not crash the loop
    });
    const { port } = makePort(orchestrate);

    const result = await port.decide(decisionContext());

    expect(result.error).toBe('gateway exploded');
    expect(result.abstained).toBe(true);
  });

  it('maps an orchestrator throw into an evidence-first abstention (no crash)', async () => {
    const orchestrate = vi.fn(async () => {
      throw new Error('provider unavailable (timeout)');
    });
    const { port } = makePort(orchestrate);

    const result = await port.decide(decisionContext());

    expect(result.error).toContain('provider unavailable');
    expect(result.abstained).toBe(true);
    expect(result.content).toBeUndefined();
  });
});
