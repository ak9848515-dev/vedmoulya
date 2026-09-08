// ──────────────────────────────────────────────────────────────────
// VedMoulya — Agent Execution Intelligence: Application Service Tests
// Covers: start → status → trace lifecycle · owner scoping (IDOR) ·
// approval gates (ASSISTED + high-risk) · approve → continue ·
// reject → FAILED · cancel → CANCELLED.
// ──────────────────────────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import { AgentExecutionService } from '../application/AgentExecutionService.js';
import {
  aiAction,
  FakeAiPort,
  FakeClock,
  FakeToolPort,
  FakeToolRegistry,
  includesRule,
  plan,
  rulePolicy,
  step,
  toolAction,
} from './fixtures.js';

function makeService(options: {
  ai: FakeAiPort;
  tools?: FakeToolPort;
  registry?: FakeToolRegistry;
  clock?: FakeClock;
}): {
  service: AgentExecutionService;
  ai: FakeAiPort;
  tools?: FakeToolPort;
  registry?: FakeToolRegistry;
} {
  const clock = options.clock ?? new FakeClock();
  return {
    service: new AgentExecutionService({
      ai: options.ai,
      tools: options.tools,
      toolRegistry: options.registry,
      clock,
    }),
    ai: options.ai,
    tools: options.tools,
    registry: options.registry,
  };
}

describe('AgentExecutionService — lifecycle', () => {
  it('start → status → trace for a completed verified run', async () => {
    const ai = new FakeAiPort({ contentFor: () => 'final DONE' });
    const { service } = makeService({ ai });
    const run = await service.start({
      userId: 'user-1',
      goal: 'Write a short report.',
      plan: plan(
        'goal-1',
        'write report',
        [
          step(
            'write',
            'write the report',
            [aiAction('act-write', 'content_generation', 'Write')],
            {
              verificationPolicy: rulePolicy([includesRule('DONE', 'DONE')]),
            },
          ),
        ],
        rulePolicy([includesRule('DONE', 'DONE')]),
      ),
    });

    expect(run.state).toBe('COMPLETED');
    expect(run.outcome).toBe('ACHIEVED');

    const status = service.status(run.runId, 'user-1');
    expect(status.state).toBe('COMPLETED');
    expect(status.completedSteps).toEqual(['write']);
    expect(status.usage.attempts).toBe(1);

    const trace = service.getTrace(run.runId, 'user-1');
    expect(trace.length).toBeGreaterThanOrEqual(3);
    expect(service.list('user-1')).toHaveLength(1);
    expect(service.list('user-2')).toHaveLength(0);
  });

  it('enforces owner scoping — a non-owner cannot read or mutate (IDOR)', async () => {
    const ai = new FakeAiPort({ contentFor: () => 'DONE' });
    const { service } = makeService({ ai });
    const run = await service.start({
      userId: 'owner',
      goal: 'Private goal.',
      plan: plan('goal-1', 'private', [
        step('a', 'answer', [aiAction('act-a', 'reasoning', 'Answer')], {
          verificationPolicy: rulePolicy([includesRule('DONE', 'DONE')]),
        }),
      ]),
    });
    expect(() => service.status(run.runId, 'intruder')).toThrow();
    expect(() => service.getTrace(run.runId, 'intruder')).toThrow();
    expect(() => service.cancel(run.runId, 'intruder')).toThrow();
  });
});

describe('AgentExecutionService — approval gates', () => {
  it('high-risk tool (DEPLOYMENT) pauses WAITING_FOR_APPROVAL under SUPERVISED; approval continues', async () => {
    const ai = new FakeAiPort({ contentFor: () => 'x' });
    const tools = new FakeToolPort({
      results: new Map([['publish', { ok: true, denied: false, outcome: 'PUBLISHED to prod' }]]),
    });
    const registry = new FakeToolRegistry([{ toolName: 'publish', permissionClass: 'DEPLOYMENT' }]);
    const { service } = makeService({ ai, tools, registry });

    const paused = await service.start({
      userId: 'user-1',
      goal: 'Ship the change.',
      plan: plan('goal-1', 'ship', [
        step('publish-step', 'publish', [toolAction('act-publish', 'publish')], {
          allowedTools: ['publish'],
          verificationPolicy: rulePolicy([includesRule('PUBLISHED', 'PUBLISHED')]),
        }),
      ]),
    });

    expect(paused.state).toBe('WAITING_FOR_APPROVAL');
    expect(paused.approvals).toHaveLength(1);
    expect(paused.approvals[0]?.reason).toContain('high-risk');
    expect(tools?.calls).toHaveLength(0); // nothing executed past the gate

    const continued = await service.approveStep(paused.runId, 'user-1', 'publish-step');
    expect(continued.state).toBe('COMPLETED');
    expect(continued.outcome).toBe('ACHIEVED');
    expect(continued.approvalDecisions[0]?.decision).toBe('approved');
    expect(continued.approvalDecisions[0]?.decidedBy).toBe('user-1');
    expect(tools?.calls).toHaveLength(1);
  });

  it('ASSISTED autonomy gates EVERY tool action (even READ)', async () => {
    const ai = new FakeAiPort({ contentFor: () => 'x' });
    const tools = new FakeToolPort();
    const registry = new FakeToolRegistry([{ toolName: 'fs.read', permissionClass: 'READ' }]);
    const { service } = makeService({ ai, tools, registry });

    const paused = await service.start({
      userId: 'user-1',
      goal: 'Read a file.',
      plan: plan('goal-1', 'read', [
        step('read-step', 'read', [toolAction('act-read', 'fs.read')], {
          allowedTools: ['fs.read'],
          verificationPolicy: rulePolicy([includesRule('executed', 'executed')]),
        }),
      ]),
      autonomyLevel: 'ASSISTED',
    });
    expect(paused.state).toBe('WAITING_FOR_APPROVAL');
    expect(paused.approvals[0]?.riskClass).toBe('AUTONOMY');
    expect(tools?.calls).toHaveLength(0);

    const continued = await service.approveStep(paused.runId, 'user-1', 'read-step');
    expect(continued.state).toBe('COMPLETED');
  });

  it('low-risk READ tool executes WITHOUT approval under SUPERVISED', async () => {
    const ai = new FakeAiPort({ contentFor: () => 'x' });
    const tools = new FakeToolPort({
      results: new Map([['fs.read', { ok: true, denied: false, outcome: 'file content' }]]),
    });
    const registry = new FakeToolRegistry([{ toolName: 'fs.read', permissionClass: 'READ' }]);
    const { service } = makeService({ ai, tools, registry });
    const run = await service.start({
      userId: 'user-1',
      goal: 'Read a file.',
      plan: plan('goal-1', 'read', [
        step('read-step', 'read', [toolAction('act-read', 'fs.read')], {
          allowedTools: ['fs.read'],
          verificationPolicy: rulePolicy([includesRule('content', 'file content')]),
        }),
      ]),
    });
    expect(run.state).toBe('COMPLETED');
    expect(run.outcome).toBe('ACHIEVED');
    expect(tools?.calls).toHaveLength(1);
  });

  it('a rejected approval fails the step and the goal honestly', async () => {
    const ai = new FakeAiPort({ contentFor: () => 'x' });
    const tools = new FakeToolPort();
    const registry = new FakeToolRegistry([{ toolName: 'drop', permissionClass: 'DELETE' }]);
    const { service } = makeService({ ai, tools, registry });

    const paused = await service.start({
      userId: 'user-1',
      goal: 'Clean up.',
      plan: plan('goal-1', 'delete', [
        step('drop-step', 'drop data', [toolAction('act-drop', 'drop')], {
          allowedTools: ['drop'],
        }),
      ]),
    });
    expect(paused.state).toBe('WAITING_FOR_APPROVAL');

    const rejected = service.rejectStep(paused.runId, 'user-1', 'drop-step', 'do not delete');
    expect(rejected.state).toBe('FAILED_FINAL');
    expect(rejected.outcome).toBe('FAILED');
    expect(rejected.approvalDecisions[0]?.decision).toBe('rejected');
    const sr = rejected.stepResults.find((s) => s.stepId === 'drop-step');
    expect(sr?.status).toBe('failed');
    expect(tools?.calls).toHaveLength(0);
  });

  it('cancel stops a paused run (CANCELLED)', async () => {
    const ai = new FakeAiPort({ contentFor: () => 'x' });
    const tools = new FakeToolPort();
    const registry = new FakeToolRegistry([{ toolName: 'drop', permissionClass: 'DELETE' }]);
    const { service } = makeService({ ai, tools, registry });
    const paused = await service.start({
      userId: 'user-1',
      goal: 'Clean up.',
      plan: plan('goal-1', 'delete', [
        step('drop-step', 'drop data', [toolAction('act-drop', 'drop')], {
          allowedTools: ['drop'],
        }),
      ]),
    });
    expect(paused.state).toBe('WAITING_FOR_APPROVAL');

    const cancelled = service.cancel(paused.runId, 'user-1');
    expect(cancelled.state).toBe('CANCELLED');
    expect(cancelled.outcomeReasons).toContain('cancelled by the user');
  });

  it('refuses to approve a step that is not waiting for approval', async () => {
    const ai = new FakeAiPort({ contentFor: () => 'DONE' });
    const { service } = makeService({ ai });
    const run = await service.start({
      userId: 'user-1',
      goal: 'Simple.',
      plan: plan('goal-1', 'answer', [
        step('a', 'answer', [aiAction('act-a', 'reasoning', 'Answer')], {
          verificationPolicy: rulePolicy([includesRule('DONE', 'DONE')]),
        }),
      ]),
    });
    expect(run.state).toBe('COMPLETED');
    await expect(service.approveStep(run.runId, 'user-1', 'a')).rejects.toThrow();
    expect(() => service.rejectStep(run.runId, 'user-1', 'a')).toThrow();
  });
});

describe('AgentExecutionService — engine reuse over multi-step plans', () => {
  it('two gated steps require two separate human approvals (each recorded)', async () => {
    const ai = new FakeAiPort({ contentFor: () => 'x' });
    const tools = new FakeToolPort({
      results: new Map([
        ['publish-1', { ok: true, denied: false, outcome: 'P1' }],
        ['publish-2', { ok: true, denied: false, outcome: 'P2' }],
      ]),
    });
    const registry = new FakeToolRegistry([
      { toolName: 'publish-1', permissionClass: 'DEPLOYMENT' },
      { toolName: 'publish-2', permissionClass: 'DEPLOYMENT' },
    ]);
    const { service } = makeService({ ai, tools, registry });
    const run = await service.start({
      userId: 'user-1',
      goal: 'Ship both.',
      plan: plan('goal-1', 'ship twice', [
        step('one', 'first publish', [toolAction('act-1', 'publish-1')], {
          allowedTools: ['publish-1'],
          verificationPolicy: rulePolicy([includesRule('P1', 'P1')]),
        }),
        step('two', 'second publish', [toolAction('act-2', 'publish-2')], {
          allowedTools: ['publish-2'],
          verificationPolicy: rulePolicy([includesRule('P2', 'P2')]),
        }),
      ]),
    });
    expect(run.state).toBe('WAITING_FOR_APPROVAL');
    expect(run.approvals).toHaveLength(1);

    const afterFirst = await service.approveStep(run.runId, 'user-1', 'one');
    expect(afterFirst.state).toBe('WAITING_FOR_APPROVAL');
    expect(afterFirst.approvals).toHaveLength(2);
    expect(afterFirst.approvalDecisions).toHaveLength(1);

    const done = await service.approveStep(run.runId, 'user-1', 'two');
    expect(done.state).toBe('COMPLETED');
    expect(done.outcome).toBe('ACHIEVED');
    expect(done.approvalDecisions.map((d) => d.stepId)).toEqual(['one', 'two']);
  });
});
