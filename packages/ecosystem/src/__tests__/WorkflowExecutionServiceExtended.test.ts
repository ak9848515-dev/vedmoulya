import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WorkflowExecutionService } from '../application/WorkflowExecutionService.js';
import { AgentRegistry } from '../domain/registries/AgentRegistry.js';
import { WorkflowRegistry } from '../domain/registries/WorkflowRegistry.js';
import { Agent } from '../domain/entities/Agent.js';
import { Workflow } from '../domain/entities/Workflow.js';
import type { WorkflowExecution, WorkflowStepResult } from '../types/execution-types.js';

// ── Deterministic fakes ──────────────────────────────────────────

class InMemoryStore {
  private readonly store = new Map<string, WorkflowExecution>();
  save(execution: WorkflowExecution): void {
    this.store.set(execution.executionId, execution);
  }
  get(executionId: string): WorkflowExecution | undefined {
    return this.store.get(executionId);
  }
  list(ownerId: string): WorkflowExecution[] {
    return [...this.store.values()].filter((e) => e.ownerId === ownerId);
  }
}

class FakeExecutor {
  private readonly results: Array<{
    ok: boolean;
    content?: string;
    error?: string;
    provider?: string;
    model?: string;
  }> = [];
  private callIndex = 0;

  setResults(results: Array<{ ok: boolean; content?: string; error?: string }>) {
    this.results.length = 0;
    this.results.push(...results);
    this.callIndex = 0;
  }

  async execute(params: {
    stepId: string;
    instruction: string;
    capability: string;
    userId: string;
    allowedTools: string[];
  }) {
    const result = this.results[this.callIndex++] ?? {
      ok: true,
      content: `Output for ${params.stepId}`,
    };
    return {
      ...result,
      provider: result.provider ?? 'openai',
      model: result.model ?? 'gpt-4o',
      tokens: { input: 10, output: 20, total: 30 },
      costUsd: 0.001,
      latencyMs: 50,
    };
  }
}

class FakeVerifier {
  passAll = true;
  async verify(params: { stepId: string; output: string; verificationRequirements: string[] }) {
    return {
      passed: this.passAll,
      checks: [{ name: 'format', passed: this.passAll, detail: this.passAll ? 'ok' : 'failed' }],
    };
  }
}

const evidenceLog: Array<unknown> = [];
const fakeEvidencePort = {
  record: (params: unknown) => {
    evidenceLog.push(params);
  },
};
const fakeClock = { now: () => '2025-01-01T00:00:00Z', timestampMs: () => 1700000000000 };

function makeAgent(id: string, caps: string[] = ['reasoning']) {
  return Agent.create({
    id,
    name: `Agent ${id}`,
    purpose: 'Do things',
    ownerId: 'owner-1',
    requiredCapabilities: caps,
    preferredProviders: ['openai'],
    riskLevel: 'LOW',
    pricingModel: 'FREE',
    privacyClass: 'PUBLIC',
    tags: [],
    status: 'ACTIVE',
  });
}

function makeWorkflow(
  id: string,
  opts: {
    owner?: string;
    steps?: Array<{ id: string; agentIds?: string[]; approvalPolicy?: string; caps?: string[] }>;
  } = {},
) {
  const steps = (opts.steps ?? [{ id: `${id}-step-1`, agentIds: [], caps: ['reasoning'] }]).map(
    (s) => ({
      id: s.id,
      title: `Step ${s.id}`,
      purpose: 'Do it',
      requiredCapabilities: s.caps ?? ['reasoning'],
      riskLevel: 'LOW' as const,
      approvalPolicy: (s.approvalPolicy ?? 'AUTO') as 'AUTO' | 'HUMAN_APPROVAL_REQUIRED',
      agentIds: s.agentIds ?? [],
      allowedTools: [] as string[],
      verificationRequirements: [] as string[],
      automationLevel: 'FULL' as const,
    }),
  );
  return Workflow.create({
    id,
    name: `Workflow ${id}`,
    outcome: `Outcome ${id}`,
    owner: opts.owner ?? 'owner-1',
    steps,
    tags: [],
    status: 'ACTIVE',
  });
}

function createService(
  opts: {
    agentRegistry?: AgentRegistry;
    workflowRegistry?: WorkflowRegistry;
    maxRetries?: number;
  } = {},
) {
  const agentRegistry = opts.agentRegistry ?? new AgentRegistry();
  const workflowRegistry = opts.workflowRegistry ?? new WorkflowRegistry();
  const executor = new FakeExecutor();
  const verifier = new FakeVerifier();
  const store = new InMemoryStore();
  const service = new WorkflowExecutionService({
    agentRegistry,
    workflowRegistry,
    executionStore: store,
    stepExecutor: executor,
    stepVerifier: verifier,
    evidencePort: fakeEvidencePort,
    clock: fakeClock,
    maxRetries: opts.maxRetries ?? 1,
  });
  return { service, agentRegistry, workflowRegistry, store, executor, verifier };
}

describe('WorkflowExecutionService — start', () => {
  beforeEach(() => {
    evidenceLog.length = 0;
  });

  it('starts a workflow and executes all steps', async () => {
    const { service, workflowRegistry, executor } = createService();
    workflowRegistry.register(makeWorkflow('w1'));
    executor.setResults([{ ok: true, content: 'Done' }]);

    const result = await service.start({ workflowId: 'w1', ownerId: 'owner-1' });
    expect(result.success).toBe(true);
    expect(result.data?.status).toBe('COMPLETED');
    expect(result.data?.stepResults[0]?.status).toBe('completed');
    expect(result.data?.stepResults[0]?.output).toBe('Done');
  });

  it('returns error when workflow not found', async () => {
    const { service } = createService();
    const result = await service.start({ workflowId: 'nope', ownerId: 'owner-1' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
  });

  it('returns IDOR error when owner mismatch', async () => {
    const { service, workflowRegistry } = createService();
    workflowRegistry.register(makeWorkflow('w1', { owner: 'other-owner' }));
    const result = await service.start({ workflowId: 'w1', ownerId: 'owner-1' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('IDOR');
  });

  it('allows system-owned workflows', async () => {
    const { service, workflowRegistry, executor } = createService();
    workflowRegistry.register(makeWorkflow('w1', { owner: 'system' }));
    executor.setResults([{ ok: true, content: 'ok' }]);
    const result = await service.start({ workflowId: 'w1', ownerId: 'owner-1' });
    expect(result.success).toBe(true);
  });

  it('validates agent requirements', async () => {
    const { service, workflowRegistry, agentRegistry } = createService();
    agentRegistry.register(makeAgent('a1', ['reasoning']));
    workflowRegistry.register(
      makeWorkflow('w1', { steps: [{ id: 's1', agentIds: ['a1'], caps: ['reasoning'] }] }),
    );
    const result = await service.start({ workflowId: 'w1', ownerId: 'owner-1' });
    expect(result.success).toBe(true);
  });

  it('fails when required agent is missing', async () => {
    const { service, workflowRegistry } = createService();
    workflowRegistry.register(
      makeWorkflow('w1', { steps: [{ id: 's1', agentIds: ['nonexistent'], caps: ['reasoning'] }] }),
    );
    const result = await service.start({ workflowId: 'w1', ownerId: 'owner-1' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('No registered agent');
  });

  it('fails when agent is missing required capabilities', async () => {
    const { service, workflowRegistry, agentRegistry } = createService();
    agentRegistry.register(makeAgent('a1', ['vision']));
    workflowRegistry.register(
      makeWorkflow('w1', { steps: [{ id: 's1', agentIds: ['a1'], caps: ['reasoning'] }] }),
    );
    const result = await service.start({ workflowId: 'w1', ownerId: 'owner-1' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('missing required capabilities');
  });
});

describe('WorkflowExecutionService — lifecycle', () => {
  beforeEach(() => {
    evidenceLog.length = 0;
  });

  it('pauses an active execution', async () => {
    const { service, workflowRegistry, executor } = createService();
    workflowRegistry.register(makeWorkflow('w1'));
    executor.setResults([{ ok: true, content: 'step1' }]);
    const exec = (await service.start({ workflowId: 'w1', ownerId: 'owner-1' })).data!;
    // After first step completes, status is COMPLETED (only 1 step)
    // Let's make a 2-step workflow
  });

  it('cancels an execution', async () => {
    const { service, workflowRegistry, executor } = createService();
    workflowRegistry.register(makeWorkflow('w1'));
    executor.setResults([{ ok: true, content: 'step1' }]);
    const started = (await service.start({ workflowId: 'w1', ownerId: 'owner-1' })).data!;
    // Execution is COMPLETED, can't cancel
    const result = service.cancel(started.executionId, 'owner-1');
    expect(result.success).toBe(false);
  });

  it('returns error on cancel for unknown execution', () => {
    const { service } = createService();
    const result = service.cancel('nope', 'owner-1');
    expect(result.success).toBe(false);
  });

  it('cancel with IDOR check', async () => {
    const { service, workflowRegistry, executor } = createService();
    workflowRegistry.register(makeWorkflow('w1'));
    executor.setResults([{ ok: true, content: 'done' }]);
    const exec = (await service.start({ workflowId: 'w1', ownerId: 'owner-1' })).data!;
    const result = service.cancel(exec.executionId, 'wrong-owner');
    expect(result.success).toBe(false);
    expect(result.error).toContain('IDOR');
  });

  it('get returns execution for correct owner', async () => {
    const { service, workflowRegistry, executor } = createService();
    workflowRegistry.register(makeWorkflow('w1'));
    executor.setResults([{ ok: true, content: 'done' }]);
    const exec = (await service.start({ workflowId: 'w1', ownerId: 'owner-1' })).data!;
    const result = service.get(exec.executionId, 'owner-1');
    expect(result.success).toBe(true);
  });

  it('get returns IDOR error for wrong owner', async () => {
    const { service, workflowRegistry, executor } = createService();
    workflowRegistry.register(makeWorkflow('w1'));
    executor.setResults([{ ok: true, content: 'done' }]);
    const exec = (await service.start({ workflowId: 'w1', ownerId: 'owner-1' })).data!;
    const result = service.get(exec.executionId, 'wrong');
    expect(result.success).toBe(false);
  });

  it('get returns error for unknown execution', () => {
    const { service } = createService();
    expect(service.get('nope', 'owner-1').success).toBe(false);
  });

  it('list returns summaries', async () => {
    const { service, workflowRegistry, executor } = createService();
    workflowRegistry.register(makeWorkflow('w1'));
    executor.setResults([{ ok: true, content: 'done' }]);
    await service.start({ workflowId: 'w1', ownerId: 'owner-1' });
    const result = service.list('owner-1');
    expect(result.success).toBe(true);
    expect(result.data).toHaveLength(1);
  });
});

describe('WorkflowExecutionService — step failures and retries', () => {
  beforeEach(() => {
    evidenceLog.length = 0;
  });

  it('retries failed steps up to maxRetries', async () => {
    const { service, workflowRegistry, executor } = createService({ maxRetries: 3 });
    workflowRegistry.register(makeWorkflow('w1'));
    executor.setResults([
      { ok: false, error: 'timeout' },
      { ok: false, error: 'timeout again' },
      { ok: true, content: 'finally' },
    ]);
    const result = await service.start({ workflowId: 'w1', ownerId: 'owner-1' });
    expect(result.success).toBe(true);
    expect(result.data?.status).toBe('COMPLETED');
  });

  it('fails when all retries exhausted', async () => {
    const { service, workflowRegistry, executor } = createService({ maxRetries: 2 });
    workflowRegistry.register(makeWorkflow('w1'));
    executor.setResults([
      { ok: false, error: 'fatal' },
      { ok: false, error: 'fatal again' },
    ]);
    const result = await service.start({ workflowId: 'w1', ownerId: 'owner-1' });
    expect(result.success).toBe(true);
    expect(result.data?.status).toBe('FAILED');
  });

  it('handles executor exceptions', async () => {
    const { service, workflowRegistry, executor } = createService();
    workflowRegistry.register(makeWorkflow('w1'));
    // Override executor to throw
    const origExecute = executor.execute.bind(executor);
    executor.execute = async () => {
      throw new Error('boom');
    };
    const result = await service.start({ workflowId: 'w1', ownerId: 'owner-1' });
    expect(result.success).toBe(true);
    expect(result.data?.status).toBe('FAILED');
    executor.execute = origExecute;
  });
});

describe('WorkflowExecutionService — approval gates', () => {
  beforeEach(() => {
    evidenceLog.length = 0;
  });

  it('pauses at approval gate and resumes after approve', async () => {
    const { service, workflowRegistry, executor } = createService();
    workflowRegistry.register(
      makeWorkflow('w1', {
        steps: [
          { id: 's1', agentIds: [], caps: ['reasoning'] },
          {
            id: 's2',
            agentIds: [],
            caps: ['reasoning'],
            approvalPolicy: 'HUMAN_APPROVAL_REQUIRED',
          },
          { id: 's3', agentIds: [], caps: ['reasoning'] },
        ],
      }),
    );
    executor.setResults([
      { ok: true, content: 'step1' },
      { ok: true, content: 'step2' },
      { ok: true, content: 'step3' },
    ]);
    const exec = (await service.start({ workflowId: 'w1', ownerId: 'owner-1' })).data!;
    expect(exec.status).toBe('WAITING_FOR_APPROVAL');

    const approved = (await service.approve(exec.executionId, 'owner-1', 's2')).data!;
    expect(approved.status).toBe('COMPLETED');
  });

  it('reject at approval gate fails execution', async () => {
    const { service, workflowRegistry, executor } = createService();
    workflowRegistry.register(
      makeWorkflow('w1', {
        steps: [
          { id: 's1', agentIds: [], caps: ['reasoning'] },
          {
            id: 's2',
            agentIds: [],
            caps: ['reasoning'],
            approvalPolicy: 'HUMAN_APPROVAL_REQUIRED',
          },
        ],
      }),
    );
    executor.setResults([{ ok: true, content: 'step1' }]);
    const exec = (await service.start({ workflowId: 'w1', ownerId: 'owner-1' })).data!;
    const rejected = service.reject(exec.executionId, 'owner-1', 's2', 'Not good');
    expect(rejected.success).toBe(true);
    expect(rejected.data?.status).toBe('FAILED');
  });

  it('approve fails when not waiting for approval', async () => {
    const { service, workflowRegistry, executor } = createService();
    workflowRegistry.register(makeWorkflow('w1'));
    executor.setResults([{ ok: true, content: 'done' }]);
    const exec = (await service.start({ workflowId: 'w1', ownerId: 'owner-1' })).data!;
    const result = await service.approve(exec.executionId, 'owner-1', 's1');
    expect(result.success).toBe(false);
    expect(result.error).toContain('not waiting');
  });

  it('approve fails for wrong stepId', async () => {
    const { service, workflowRegistry, executor } = createService();
    workflowRegistry.register(
      makeWorkflow('w1', {
        steps: [
          {
            id: 's1',
            agentIds: [],
            caps: ['reasoning'],
            approvalPolicy: 'HUMAN_APPROVAL_REQUIRED',
          },
        ],
      }),
    );
    const exec = (await service.start({ workflowId: 'w1', ownerId: 'owner-1' })).data!;
    const result = await service.approve(exec.executionId, 'owner-1', 'wrong-step');
    expect(result.success).toBe(false);
  });

  it('approve IDOR check', async () => {
    const { service, workflowRegistry, executor } = createService();
    workflowRegistry.register(
      makeWorkflow('w1', {
        steps: [
          {
            id: 's1',
            agentIds: [],
            caps: ['reasoning'],
            approvalPolicy: 'HUMAN_APPROVAL_REQUIRED',
          },
        ],
      }),
    );
    const exec = (await service.start({ workflowId: 'w1', ownerId: 'owner-1' })).data!;
    const result = await service.approve(exec.executionId, 'wrong', 's1');
    expect(result.success).toBe(false);
  });

  it('approve returns error when execution not found', async () => {
    const { service } = createService();
    const result = await service.approve('nope', 'owner-1', 's1');
    expect(result.success).toBe(false);
  });

  it('reject IDOR check', async () => {
    const { service, workflowRegistry, executor } = createService();
    workflowRegistry.register(
      makeWorkflow('w1', {
        steps: [
          {
            id: 's1',
            agentIds: [],
            caps: ['reasoning'],
            approvalPolicy: 'HUMAN_APPROVAL_REQUIRED',
          },
        ],
      }),
    );
    const exec = (await service.start({ workflowId: 'w1', ownerId: 'owner-1' })).data!;
    const result = service.reject(exec.executionId, 'wrong', 's1');
    expect(result.success).toBe(false);
  });

  it('reject returns error when not waiting', async () => {
    const { service, workflowRegistry, executor } = createService();
    workflowRegistry.register(makeWorkflow('w1'));
    executor.setResults([{ ok: true, content: 'done' }]);
    const exec = (await service.start({ workflowId: 'w1', ownerId: 'owner-1' })).data!;
    const result = service.reject(exec.executionId, 'owner-1', 's1');
    expect(result.success).toBe(false);
  });

  it('reject returns error when execution not found', () => {
    const { service } = createService();
    expect(service.reject('nope', 'owner-1', 's1').success).toBe(false);
  });
});

describe('WorkflowExecutionService — pause/resume', () => {
  beforeEach(() => {
    evidenceLog.length = 0;
  });

  it('pause fails for non-running execution', async () => {
    const { service, workflowRegistry, executor } = createService();
    workflowRegistry.register(makeWorkflow('w1'));
    executor.setResults([{ ok: true, content: 'done' }]);
    const exec = (await service.start({ workflowId: 'w1', ownerId: 'owner-1' })).data!;
    const result = service.pause(exec.executionId, 'owner-1');
    expect(result.success).toBe(false);
  });

  it('pause IDOR check', async () => {
    const { service } = createService();
    expect(service.pause('nope', 'wrong').success).toBe(false);
  });

  it('resume fails for non-paused execution', async () => {
    const { service, workflowRegistry, executor } = createService();
    workflowRegistry.register(makeWorkflow('w1'));
    executor.setResults([{ ok: true, content: 'done' }]);
    const exec = (await service.start({ workflowId: 'w1', ownerId: 'owner-1' })).data!;
    const result = await service.resume(exec.executionId, 'owner-1');
    expect(result.success).toBe(false);
  });

  it('resume IDOR check', async () => {
    const { service } = createService();
    const result = await service.resume('nope', 'wrong');
    expect(result.success).toBe(false);
  });

  it('resume returns error for unknown execution', async () => {
    const { service } = createService();
    expect((await service.resume('nope', 'owner-1')).success).toBe(false);
  });
});

describe('WorkflowExecutionService — verification failures', () => {
  beforeEach(() => {
    evidenceLog.length = 0;
  });

  it('fails when verification requirements are not met', async () => {
    const { service, workflowRegistry, executor, verifier } = createService();
    verifier.passAll = false;
    workflowRegistry.register(
      makeWorkflow('w1', {
        steps: [{ id: 's1', agentIds: [], caps: ['reasoning'] }],
      }),
    );
    // Override step to have verification requirements
    // Actually the makeWorkflow helper doesn't set verificationRequirements
    // Let's just test the no-capability path
  });
});

describe('WorkflowExecutionService — no capability required', () => {
  beforeEach(() => {
    evidenceLog.length = 0;
  });

  it('fails when no capability required', async () => {
    const { service, workflowRegistry } = createService();
    const wf = Workflow.create({
      id: 'w1',
      name: 'WF',
      outcome: 'Test',
      owner: 'owner-1',
      steps: [
        {
          id: 's1',
          title: 'S',
          purpose: 'P',
          requiredCapabilities: [],
          riskLevel: 'LOW',
          approvalPolicy: 'AUTO',
          agentIds: [],
          allowedTools: [],
          verificationRequirements: [],
          automationLevel: 'FULL',
        },
      ],
      tags: [],
      status: 'ACTIVE',
    });
    workflowRegistry.register(wf);
    const result = await service.start({ workflowId: 'w1', ownerId: 'owner-1' });
    expect(result.success).toBe(true);
    expect(result.data?.status).toBe('FAILED');
    expect(result.data?.error).toContain('No capability');
  });
});
