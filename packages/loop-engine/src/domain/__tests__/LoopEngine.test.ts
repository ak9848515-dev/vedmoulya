import { describe, expect, it } from 'vitest';
import { LoopEngine } from '../LoopEngine.js';
import {
  FakeClock,
  FakeRagPort,
  FakeSpecialistPort,
  FakeToolPort,
  FULL_ANSWER,
} from './fixtures.js';
import type { LoopEnginePorts } from '../../contracts/loop-ports.js';

function makeEngine(
  specialist: FakeSpecialistPort,
  overrides: Partial<{ rag: FakeRagPort; tools: FakeToolPort; clock: FakeClock }> = {},
): {
  engine: LoopEngine;
  specialist: FakeSpecialistPort;
  rag: FakeRagPort;
  tools: FakeToolPort;
  clock: FakeClock;
} {
  const rag = overrides.rag ?? new FakeRagPort();
  const tools = overrides.tools ?? new FakeToolPort();
  const clock = overrides.clock ?? new FakeClock();
  const ports: LoopEnginePorts = { specialist, rag, tools, clock };
  return { engine: new LoopEngine(ports), specialist, rag, tools, clock };
}

const ABAP_GOAL = 'Build an ABAP debugger for short dumps in production SAP code.';

describe('LoopEngine — bounded orchestration loop', () => {
  it('solves a simple goal in one iteration (SUCCESS, no refinement)', async () => {
    const { engine, specialist } = makeEngine(
      new FakeSpecialistPort({ content: () => FULL_ANSWER, evidenceState: 'SUFFICIENT_EVIDENCE' }),
    );
    const run = await engine.run({ goal: ABAP_GOAL, userId: 'user-1' });
    expect(run.terminationReason).toBe('SUCCESS');
    expect(run.status).toBe('completed');
    expect(run.budgetUsage.iterations).toBe(1);
    expect(run.finalCritic?.verdict).toBe('PASS');
    expect(run.finalContent).toContain('## Diagnosis');
    expect(specialist.calls.length).toBe(7); // the full ABAP graph
  });

  it('records a full explainable trace (WHO/WHY/HOW MUCH/WHAT)', async () => {
    const { engine } = makeEngine(
      new FakeSpecialistPort({ content: () => FULL_ANSWER, evidenceState: 'SUFFICIENT_EVIDENCE' }),
    );
    const run = await engine.run({ goal: ABAP_GOAL, userId: 'user-1' });
    expect(run.steps).toHaveLength(7);
    for (const step of run.steps) {
      expect(step.provider).toBe('mock');
      expect(step.model).toBe('mock-v1');
      expect(step.selectionReason).toContain('Selected mock');
      expect(step.tokens.total).toBeGreaterThan(0);
      expect(step.costUsd).toBeGreaterThan(0);
      expect(step.iteration).toBe(1);
      expect(step.status).toBe('completed');
    }
    expect(run.budgetUsage.providerCalls).toBe(7);
    expect(run.budgetUsage.tokensTotal).toBe(7 * 180);
  });

  it('respects dependency slots when composing specialist prompts', async () => {
    const { engine, specialist } = makeEngine(
      new FakeSpecialistPort({
        content: (input) => `OUTPUT-${input.taskId}`,
        evidenceState: 'SUFFICIENT_EVIDENCE',
      }),
    );
    await engine.run({ goal: ABAP_GOAL, userId: 'user-1' });
    const analyze = specialist.calls.find((c) => c.taskId === 'task-3');
    expect(analyze?.userInput).toContain('OUTPUT-task-2'); // {evidence} slot
    const produce = specialist.calls.find((c) => c.taskId === 'task-4');
    expect(produce?.userInput).toContain('OUTPUT-task-3'); // {analysis} slot
    // Evidence context flows as knowledge context to downstream tasks.
    expect(analyze?.context?.knowledgeContext).toContain('OUTPUT-task-2');
  });

  it('executes the parallel wave (understand + retrieve) in iteration 1', async () => {
    const { engine, specialist } = makeEngine(
      new FakeSpecialistPort({ content: () => FULL_ANSWER, evidenceState: 'SUFFICIENT_EVIDENCE' }),
    );
    const run = await engine.run({ goal: ABAP_GOAL, userId: 'user-1' });
    expect(run.terminationReason).toBe('SUCCESS');
    const wave0Tasks = new Set(['task-1', 'task-2']);
    const wave0Steps = run.steps.filter((s) => wave0Tasks.has(s.taskId));
    expect(wave0Steps.map((s) => s.iteration)).toEqual([1, 1]);
    expect(specialist.calls[0]?.taskId).toBe('task-1');
    expect(specialist.calls[1]?.taskId).toBe('task-2');
  });

  it('terminates with PROVIDER_FAILURE after retries when the specialist always throws', async () => {
    const { engine, specialist } = makeEngine(new FakeSpecialistPort({ throwFor: () => true }));
    const run = await engine.run({ goal: ABAP_GOAL, userId: 'user-1' });
    expect(run.terminationReason).toBe('PROVIDER_FAILURE');
    expect(run.status).toBe('completed');
    expect(run.steps[0]?.status).toBe('failed');
    // 3 attempts (1 + maxRetries 2) for the first task.
    expect(specialist.calls.length).toBe(3);
  });

  it('terminates with BUDGET_EXCEEDED when the provider-call bound is hit mid-run', async () => {
    const { engine } = makeEngine(
      new FakeSpecialistPort({ content: () => FULL_ANSWER, evidenceState: 'SUFFICIENT_EVIDENCE' }),
    );
    const run = await engine.run({
      goal: ABAP_GOAL,
      userId: 'user-1',
      budgetOverride: { maxProviderCalls: 1 },
    });
    expect(run.terminationReason).toBe('BUDGET_EXCEEDED');
    expect(run.budgetUsage.providerCalls).toBe(1);
    const blocked = run.steps.find((s) => s.status === 'blocked');
    expect(blocked).toBeDefined();
  });

  it('terminates with ITERATION_LIMIT when the critic keeps failing (no infinite loop)', async () => {
    const { engine, specialist } = makeEngine(
      new FakeSpecialistPort({
        content: () => '## Diagnosis\npartial',
        evidenceState: 'SUFFICIENT_EVIDENCE',
      }),
    );
    const run = await engine.run({
      goal: ABAP_GOAL,
      userId: 'user-1',
      budgetOverride: { maxIterations: 3 },
    });
    expect(run.terminationReason).toBe('ITERATION_LIMIT');
    expect(run.budgetUsage.iterations).toBe(3);
    // 7 base tasks + 2 refinement tasks — strictly bounded, no runaway.
    expect(specialist.calls.length).toBe(9);
    expect(run.steps.length).toBe(9);
    // The refinement actions are recorded (adaptive, Phase 7).
    expect(run.steps.filter((s) => s.refinementAction === 'fix_output').length).toBe(2);
  });

  it('refines successfully when later outputs satisfy the critic (successful refinement)', async () => {
    const { engine, specialist } = makeEngine(
      new FakeSpecialistPort({
        content: (input, callIndex) =>
          callIndex >= 8 ? FULL_ANSWER : `## Diagnosis\npartial #${String(callIndex)}`,
        evidenceState: 'SUFFICIENT_EVIDENCE',
      }),
    );
    const run = await engine.run({
      goal: ABAP_GOAL,
      userId: 'user-1',
      budgetOverride: { maxIterations: 4 },
    });
    expect(run.terminationReason).toBe('SUCCESS');
    expect(run.budgetUsage.iterations).toBe(3);
    expect(run.finalCritic?.verdict).toBe('PASS');
    expect(specialist.calls.length).toBe(9);
    // Two refinement cycles were needed and recorded (adaptive, Phase 7).
    expect(run.steps.filter((s) => s.refinementAction === 'fix_output')).toHaveLength(2);
  });

  it('abstains with EVIDENCE_INSUFFICIENT when grounding fails and no budget remains', async () => {
    const { engine } = makeEngine(
      new FakeSpecialistPort({
        content: () => FULL_ANSWER,
        evidenceState: 'INSUFFICIENT_EVIDENCE',
        abstainFor: (input) => input.groundingRequired === true,
      }),
    );
    const run = await engine.run({
      goal: ABAP_GOAL,
      userId: 'user-1',
      budgetOverride: { maxIterations: 1 },
    });
    expect(run.terminationReason).toBe('EVIDENCE_INSUFFICIENT');
    expect(run.evidenceStates).toContain('INSUFFICIENT_EVIDENCE');
  });

  it('retrieves more evidence adaptively when the budget allows', async () => {
    const { engine, specialist } = makeEngine(
      new FakeSpecialistPort({
        content: () => FULL_ANSWER,
        evidenceState: 'INSUFFICIENT_EVIDENCE',
        abstainFor: (input) => input.groundingRequired === true,
      }),
    );
    const run = await engine.run({
      goal: ABAP_GOAL,
      userId: 'user-1',
      budgetOverride: { maxIterations: 3 },
    });
    expect(run.terminationReason).toBe('EVIDENCE_INSUFFICIENT');
    const retrievalSteps = run.steps.filter((s) => s.title === 'Retrieve additional evidence');
    expect(retrievalSteps.length).toBeGreaterThanOrEqual(1);
    expect(
      run.steps.filter((s) => s.refinementAction === 'retrieve_more_evidence').length,
    ).toBeGreaterThanOrEqual(1);
    expect(specialist.calls.length).toBeLessThanOrEqual(30);
  });

  it('terminates with EVIDENCE_CONFLICT on conflicting evidence with no budget', async () => {
    const { engine } = makeEngine(
      new FakeSpecialistPort({
        content: () => FULL_ANSWER,
        evidenceState: 'CONFLICTING_EVIDENCE',
        abstainFor: (input) => input.groundingRequired === true,
      }),
    );
    const run = await engine.run({
      goal: ABAP_GOAL,
      userId: 'user-1',
      budgetOverride: { maxIterations: 1 },
    });
    expect(run.terminationReason).toBe('EVIDENCE_CONFLICT');
  });

  it('blocks the run with SECURITY_BLOCK when a tool is denied', async () => {
    const tools = new FakeToolPort();
    tools.deniedTools.add('calculator');
    const { engine } = makeEngine(
      new FakeSpecialistPort({ content: () => FULL_ANSWER, evidenceState: 'SUFFICIENT_EVIDENCE' }),
      { tools },
    );
    const run = await engine.run({ goal: ABAP_GOAL, userId: 'user-1' });
    expect(run.terminationReason).toBe('SECURITY_BLOCK');
    const blocked = run.steps.find((s) => s.status === 'blocked');
    expect(blocked?.message).toContain('denied');
  });

  it('terminates with TOOL_FAILURE when a tool fails', async () => {
    const tools = new FakeToolPort();
    tools.failingTools.add('calculator');
    const { engine } = makeEngine(
      new FakeSpecialistPort({ content: () => FULL_ANSWER, evidenceState: 'SUFFICIENT_EVIDENCE' }),
      { tools },
    );
    const run = await engine.run({ goal: ABAP_GOAL, userId: 'user-1' });
    expect(run.terminationReason).toBe('TOOL_FAILURE');
  });

  it('terminates with TIMEOUT when the wall-clock bound is exceeded', async () => {
    const clock = new FakeClock(200); // every read advances 200ms
    const { engine } = makeEngine(
      new FakeSpecialistPort({ content: () => FULL_ANSWER, evidenceState: 'SUFFICIENT_EVIDENCE' }),
      { clock },
    );
    const run = await engine.run({
      goal: ABAP_GOAL,
      userId: 'user-1',
      budgetOverride: { maxLatencyMs: 100 },
    });
    expect(run.terminationReason).toBe('TIMEOUT');
  });

  it('cancels cleanly with CANCELLED when the signal is aborted', async () => {
    const { engine } = makeEngine(
      new FakeSpecialistPort({ content: () => FULL_ANSWER, evidenceState: 'SUFFICIENT_EVIDENCE' }),
    );
    const controller = new AbortController();
    controller.abort();
    const run = await engine.run({ goal: ABAP_GOAL, userId: 'user-1', signal: controller.signal });
    expect(run.terminationReason).toBe('CANCELLED');
    expect(run.status).toBe('cancelled');
    expect(run.steps).toHaveLength(0);
  });

  it('suspends with USER_CLARIFICATION_REQUIRED for underspecified goals', async () => {
    const { engine } = makeEngine(
      new FakeSpecialistPort({ content: () => FULL_ANSWER, evidenceState: 'SUFFICIENT_EVIDENCE' }),
    );
    const run = await engine.run({ goal: 'Do the thing please.', userId: 'user-1' });
    expect(run.terminationReason).toBe('USER_CLARIFICATION_REQUIRED');
    expect(run.status).toBe('suspended');
    expect(run.steps).toHaveLength(0);
    expect(run.finalCritic?.verdict).toBe('ABSTAIN');
    expect(run.proposedMemories).toHaveLength(0); // nothing durable without approval
  });

  it('never proposes long-term memory on failed runs (Phase 9)', async () => {
    const { engine } = makeEngine(
      new FakeSpecialistPort({
        content: () => '## Diagnosis\npartial',
        evidenceState: 'SUFFICIENT_EVIDENCE',
      }),
    );
    const run = await engine.run({
      goal: ABAP_GOAL,
      userId: 'user-1',
      budgetOverride: { maxIterations: 1 },
    });
    expect(run.terminationReason).not.toBe('SUCCESS');
    expect(run.proposedMemories).toHaveLength(0);
  });

  it('proposes a memory only for a SUCCESS with a PASS critic (still requires approval)', async () => {
    const { engine } = makeEngine(
      new FakeSpecialistPort({ content: () => FULL_ANSWER, evidenceState: 'SUFFICIENT_EVIDENCE' }),
    );
    const run = await engine.run({ goal: ABAP_GOAL, userId: 'user-1' });
    expect(run.terminationReason).toBe('SUCCESS');
    expect(run.proposedMemories).toHaveLength(1);
    expect(run.proposedMemories[0]?.type).toBe('goal_outcome');
    expect(run.proposedMemories[0]?.content).toContain(ABAP_GOAL);
  });

  it('keeps provider calls strictly within the budget (no uncontrolled calls)', async () => {
    const { engine, specialist } = makeEngine(
      new FakeSpecialistPort({
        content: () => '## Diagnosis\npartial',
        evidenceState: 'SUFFICIENT_EVIDENCE',
      }),
    );
    const run = await engine.run({
      goal: ABAP_GOAL,
      userId: 'user-1',
      budgetOverride: { maxProviderCalls: 10, maxIterations: 10 },
    });
    expect(specialist.calls.length).toBeLessThanOrEqual(10);
    expect(run.budgetUsage.providerCalls).toBe(specialist.calls.length);
    expect(run.budgetUsage.iterations).toBeLessThanOrEqual(10);
  });

  it('runs the restaurant app-builder demo to SUCCESS', async () => {
    const { engine } = makeEngine(
      new FakeSpecialistPort({ content: () => FULL_ANSWER, evidenceState: 'SUFFICIENT_EVIDENCE' }),
    );
    const run = await engine.run({
      goal: 'Build a modern restaurant application with reservations.',
      userId: 'user-1',
    });
    expect(run.specification.pattern).toBe('app-builder');
    expect(run.terminationReason).toBe('SUCCESS');
    expect(run.graph.tasks).toHaveLength(6);
  });

  it('does NOT force evidence-less patterns to abstain when the runtime reports no evidence state (regression: grounding is derived from the graph)', async () => {
    // Real runtime behavior: app-builder tasks are ungrounded, so the gateway
    // specialist port reports NO evidenceState at all (undefined). Before the
    // fix the critic hardcoded groundingRequired: true, which made every
    // evidence-less pattern spuriously ABSTAIN → EVIDENCE_INSUFFICIENT.
    const { engine } = makeEngine(new FakeSpecialistPort({ content: () => FULL_ANSWER }));
    const run = await engine.run({
      goal: 'Build a modern restaurant application with reservations.',
      userId: 'user-1',
    });
    expect(run.specification.pattern).toBe('app-builder');
    expect(run.evidenceStates).toHaveLength(0);
    expect(run.terminationReason).toBe('SUCCESS');
    expect(run.finalCritic?.verdict).toBe('PASS');
  });

  it('runs the AI app-builder demo to SUCCESS', async () => {
    const { engine } = makeEngine(
      new FakeSpecialistPort({ content: () => FULL_ANSWER, evidenceState: 'SUFFICIENT_EVIDENCE' }),
    );
    const run = await engine.run({
      goal: 'Build an AI application for customer support.',
      userId: 'user-1',
    });
    expect(run.specification.pattern).toBe('ai-app-builder');
    expect(run.terminationReason).toBe('SUCCESS');
  });

  it('honors resume with a clarification (fresh bounded budget, same runId)', async () => {
    const { engine } = makeEngine(
      new FakeSpecialistPort({ content: () => FULL_ANSWER, evidenceState: 'SUFFICIENT_EVIDENCE' }),
    );
    const suspended = await engine.run({ goal: 'Do the thing please.', userId: 'user-1' });
    expect(suspended.status).toBe('suspended');
    const resumed = await engine.run({
      goal: 'Do the thing please.',
      userId: 'user-1',
      runId: suspended.runId,
      clarification: 'Build a restaurant reservation application with a web UI and Postgres.',
    });
    expect(resumed.runId).toBe(suspended.runId);
    expect(resumed.status).toBe('completed');
    expect(resumed.terminationReason).toBe('SUCCESS');
    expect(resumed.specification.clarificationNeeded).toBeUndefined();
  });
});
