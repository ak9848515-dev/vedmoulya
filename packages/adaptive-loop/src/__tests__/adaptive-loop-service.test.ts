// ──────────────────────────────────────────────────────────────────
// AdaptiveLoopService application tests: start a run from a READY plan,
// explicit approve/reject resume surface, and owner isolation.
//
// Approvals are recorded and explicit: approve()/reject() (acting for a
// human) are the ONLY way a WAITING_FOR_APPROVAL run resumes — there is
// no model-facing approve path (the model cannot approve itself).
// ──────────────────────────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import { AdaptiveLoopService } from '../application/AdaptiveLoopService.js';
import type { AgentClockPort } from '@vedmoulya/agent-execution';
import {
  FakeAiPort,
  FakeClock,
  FakeToolPort,
  makeToolRegistry,
  ScriptedDecisionModel,
  aiStep,
  simplePlan,
  toolStep,
  REQUEST_APPROVAL,
} from './fixtures.js';

function makeService(
  options: {
    ai?: FakeAiPort;
    tools?: FakeToolPort;
    toolRegistry?: ReturnType<typeof makeToolRegistry>;
    decisionModel?: ScriptedDecisionModel;
    clock?: FakeClock;
  } = {},
): {
  service: AdaptiveLoopService;
  clock: FakeClock;
  ai: FakeAiPort | undefined;
  tools: FakeToolPort | undefined;
} {
  const clock = options.clock ?? new FakeClock();
  const ai = options.ai;
  const tools = options.tools;
  const service = new AdaptiveLoopService({
    decisionModel: options.decisionModel,
    approvals: undefined,
    store: undefined,
    clock: clock as unknown as { now(): string; timestampMs(): number },
    ports: {
      ai,
      tools,
      toolRegistry: options.toolRegistry,
    },
  });
  return { service, clock, ai, tools };
}

describe('AdaptiveLoopService — application surface', () => {
  it('starts a deterministic run from a READY plan and finishes ACHIEVED', async () => {
    const ai = new FakeAiPort({ content: 'pass verified' });
    const { service, ai: wiredAi } = makeService({ ai });
    const plan = simplePlan({ steps: [aiStep('step-1', { verification: 'includes-pass' })] });

    const run = await service.start({
      userId: 'user-1',
      goal: 'Complete the repository task',
      plan,
      autonomyLevel: 'SUPERVISED',
      allowedTools: [],
      grantedPermissionClasses: ['READ'],
    });

    expect(run.outcome).toBe('ACHIEVED');
    expect(run.state).toBe('VERIFIED');
    expect(wiredAi!.calls.length).toBe(1);
    const dto = service.toDTO(run);
    expect(dto.runId).toBe(run.runId);
    expect(dto.outcome).toBe('ACHIEVED');
    expect(service.getRun(run.runId, 'user-1')).toBeDefined();
  });

  it('pauses for approval on REQUEST_APPROVAL and resumes only via service.approve', async () => {
    const ai = new FakeAiPort({ content: 'pass verified' });
    const decisionModel = new ScriptedDecisionModel(REQUEST_APPROVAL());
    const { service } = makeService({ ai, decisionModel });
    const plan = simplePlan({ steps: [aiStep('step-1', { verification: 'includes-pass' })] });

    const waiting = await service.start({
      userId: 'user-1',
      goal: 'Complete the repository task',
      plan,
      allowedTools: [],
      grantedPermissionClasses: ['READ'],
    });
    expect(waiting.state).toBe('WAITING_FOR_APPROVAL');

    // Rejecting the pending proposal fails honestly and never executes.
    const proposalId = waiting.pendingApprovalProposal!.proposalId;
    const rejected = await service.reject(waiting.runId, proposalId, 'user-1');
    expect(rejected.state).toBe('FAILED_FINAL');
    expect(rejected.terminationReason).toBe('APPROVAL_REJECTED');

    // A second run that gets approved completes.
    const decisionModel2 = new ScriptedDecisionModel(REQUEST_APPROVAL());
    const { service: service2 } = makeService({ ai, decisionModel: decisionModel2 });
    const waiting2 = await service2.start({
      userId: 'user-1',
      goal: 'Complete the repository task',
      plan,
      allowedTools: [],
      grantedPermissionClasses: ['READ'],
    });
    const approved = await service2.approve(
      waiting2.runId,
      waiting2.pendingApprovalProposal!.proposalId,
      'user-1',
    );
    expect(approved.state).toBe('VERIFIED');
    expect(approved.outcome).toBe('ACHIEVED');
  });

  it('gates ASSISTED tool runs behind service.approve', async () => {
    const tools = new FakeToolPort({ permissionClass: 'READ', outcome: 'ok' });
    const toolRegistry = makeToolRegistry({ 'read.file': { permissionClass: 'READ' } });
    const { service } = makeService({ tools, toolRegistry });
    const plan = simplePlan({
      steps: [toolStep('step-1', { toolName: 'read.file', verification: 'artifact' })],
    });

    const waiting = await service.start({
      userId: 'user-1',
      goal: 'Read the file',
      plan,
      autonomyLevel: 'ASSISTED',
      allowedTools: ['read.file'],
      grantedPermissionClasses: ['READ'],
    });
    expect(waiting.state).toBe('WAITING_FOR_APPROVAL');
    expect(tools.calls).toHaveLength(0);

    const done = await service.approve(
      waiting.runId,
      waiting.pendingApprovalProposal!.proposalId,
      'user-1',
    );
    expect(done.state).toBe('VERIFIED');
    expect(tools.calls).toHaveLength(1);
  });

  it("enforces run ownership — a foreign actor cannot approve or read another user's run", async () => {
    const ai = new FakeAiPort({ content: 'pass verified' });
    const decisionModel = new ScriptedDecisionModel(REQUEST_APPROVAL());
    const { service } = makeService({ ai, decisionModel });
    const plan = simplePlan({ steps: [aiStep('step-1', { verification: 'includes-pass' })] });

    const waiting = await service.start({
      userId: 'user-1',
      goal: 'Complete the repository task',
      plan,
      allowedTools: [],
      grantedPermissionClasses: ['READ'],
    });

    expect(service.getRun(waiting.runId, 'user-2')).toBeUndefined();
    const proposalId = waiting.pendingApprovalProposal!.proposalId;
    await expect(service.approve(waiting.runId, proposalId, 'user-2')).rejects.toThrow(
      /does not own/,
    );
    // The legitimate owner still can — nothing was corrupted by the attempt.
    const done = await service.approve(waiting.runId, proposalId, 'user-1');
    expect(done.state).toBe('VERIFIED');
  });

  it("lists only the owner's runs", async () => {
    const ai = new FakeAiPort({ content: 'pass verified' });
    const clock = new FakeClock();
    const { service } = makeService({ ai, clock });
    const plan = simplePlan({ steps: [aiStep('step-1', { verification: 'includes-pass' })] });
    await service.start({
      userId: 'user-1',
      goal: 'g1',
      plan,
      allowedTools: [],
      grantedPermissionClasses: ['READ'],
    });
    clock.advance(1);
    await service.start({
      userId: 'user-2',
      goal: 'g2',
      plan,
      allowedTools: [],
      grantedPermissionClasses: ['READ'],
    });

    expect(service.listRuns('user-1')).toHaveLength(1);
    expect(service.listRuns('user-1')[0].goal).toBe('g1');
    expect(service.listRuns('user-2')).toHaveLength(1);
    expect(service.listRuns()).toHaveLength(2);
  });

  it('is deterministic-clock driven (no wall-clock surprises in tests)', async () => {
    const clock = new FakeClock();
    const ai = new FakeAiPort({ content: 'pass verified' });
    const { service } = makeService({ ai, clock });
    const plan = simplePlan({ steps: [aiStep('step-1', { verification: 'includes-pass' })] });
    const run = await service.start({
      userId: 'user-1',
      goal: 'Complete the repository task',
      plan,
      allowedTools: [],
      grantedPermissionClasses: ['READ'],
    });
    const clockPort: AgentClockPort = clock;
    expect(clockPort.now()).toBe(run.createdAt);
    expect(run.finishedAt).toBeDefined();
  });

  it('works without an injected clock (default wall clock)', async () => {
    const ai = new FakeAiPort({ content: 'pass verified' });
    const { service } = makeService({ ai }); // no clock option → default Date-based clock
    const plan = simplePlan({ steps: [aiStep('step-1', { verification: 'includes-pass' })] });

    const run = await service.start({
      userId: 'user-1',
      goal: 'Complete the repository task',
      plan,
      allowedTools: [],
      grantedPermissionClasses: ['READ'],
    });

    expect(run.outcome).toBe('ACHIEVED');
    expect(run.createdAt).toBeTruthy();
  });

  it('never resumes on a phantom approval (no pending request for the proposal)', async () => {
    const ai = new FakeAiPort({ content: 'pass verified' });
    const { service } = makeService({ ai });
    const plan = simplePlan({ steps: [aiStep('step-1', { verification: 'includes-pass' })] });
    const run = await service.start({
      userId: 'user-1',
      goal: 'Complete the repository task',
      plan,
      allowedTools: [],
      grantedPermissionClasses: ['READ'],
    });

    const result = await service.approve(run.runId, 'ghost-proposal', 'user-1');

    expect(result.error).toContain('no pending approval for proposal ghost-proposal');
  });

  it('throws when approving a run that does not exist (no cross-user fallback)', async () => {
    const { service } = makeService({});
    await expect(service.approve('no-such-run', 'p-1', 'user-1')).rejects.toThrow('not found');
  });
});
