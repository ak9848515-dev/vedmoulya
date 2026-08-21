// ──────────────────────────────────────────────────────────────────
// VedMoulya — Execution Bridge: ExecutionRunService edge cases
// EPIC-014 — not-found paths, cancellation, plan loss, default
// options, ledger filtering and the intelligence view accessor.
// ──────────────────────────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import type {
  CapabilityCandidate,
  FactoryCapabilityPlan,
  PlanStep,
} from '@vedmoulya/capability-marketplace';
import { ExecutionRunService } from '../application/ExecutionRunService.js';
import type {
  ClockPort,
  ExecutionRunStore,
  PreferenceLedgerPort,
  StepExecutionInput,
  StepExecutionPort,
  StepExecutionResult,
} from '../contracts/execution-ports.js';
import { InMemoryExecutionRunStore } from '../infrastructure/InMemoryExecutionRunStore.js';
import { InMemoryPreferenceLedger } from '../infrastructure/InMemoryPreferenceLedger.js';

class FakeClock implements ClockPort {
  private t = 1_700_000_000_000;
  now(): string {
    return new Date(this.t).toISOString();
  }
  timestampMs(): number {
    return this.t;
  }
  async sleep(): Promise<void> {}
}

class FakePort implements StepExecutionPort {
  availability(): { available: boolean; reason?: string } {
    return { available: true };
  }
  async execute(_input: StepExecutionInput): Promise<StepExecutionResult> {
    return {
      ok: true,
      content: 'A sufficiently long output that satisfies the execution contract.',
      provider: 'openai',
      model: 'gpt-4o',
      tokens: { input: 10, output: 20, total: 30 },
      costUsd: 0.001,
      latencyMs: 10,
    };
  }
}

function candidate(overrides: Partial<CapabilityCandidate> = {}): CapabilityCandidate {
  return {
    id: 'provider:openai:gpt-4o',
    kind: 'model',
    name: 'OpenAI · GPT-4o',
    providerFamily: 'openai',
    modelId: 'gpt-4o',
    capability: 'TEXT_GENERATION',
    integrationType: 'NATIVE_API',
    classification: 'READY',
    freeAvailability: 'FREE_WITH_QUOTA',
    localAvailability: 'no',
    quality: 0.9,
    availability: 0.95,
    evidence: [
      { claim: 'supports text generation', source: 'provider-catalog', confidence: 'VERIFIED' },
    ],
    reasons: ['best quality'],
    configurable: false,
    apiAvailable: 'yes',
    ...overrides,
  };
}

function step(overrides: Partial<PlanStep> = {}): PlanStep {
  return {
    id: 's1',
    title: 'Research',
    capability: 'TEXT_GENERATION',
    purpose: 'Gather accurate background information.',
    candidates: [candidate()],
    selectedCandidateId: 'provider:openai:gpt-4o',
    automation: 'FULLY_AUTOMATED',
    irreversible: false,
    reasons: ['best quality'],
    ...overrides,
  };
}

function plan(steps: PlanStep[]): FactoryCapabilityPlan {
  return {
    id: 'plan-1',
    requestedOutcome: 'Create a deliverable',
    createdAt: '2026-08-10T00:00:00.000Z',
    requiredCapabilities: steps.map((s) => s.capability),
    candidates: steps.flatMap((s) => s.candidates),
    steps,
    automationLevel: 'FULLY_AUTOMATED',
    automationPercent: 100,
    evidence: [],
    risks: [],
    humanApprovalPoints: steps.filter((s) => s.irreversible),
    unavailableCapabilities: [],
    recommendations: [],
  };
}

interface Harness {
  service: ExecutionRunService;
  store: ExecutionRunStore;
  ledger: PreferenceLedgerPort;
  planMap: Map<string, FactoryCapabilityPlan>;
}

function harness(
  p: FactoryCapabilityPlan,
  overrides: Partial<ConstructorParameters<typeof ExecutionRunService>[0]> = {},
): Harness {
  const store = new InMemoryExecutionRunStore();
  const ledger = new InMemoryPreferenceLedger();
  const planMap = new Map([[p.id, p]]);
  const service = new ExecutionRunService({
    planSource: {
      getPlan: async (ownerId, planId) => {
        const found = planMap.get(planId);
        return found && found.id === planId ? found : undefined;
      },
    },
    port: new FakePort(),
    store,
    ledger,
    budget: { maxIterations: 3, maxTokens: 100_000, maxCostUsd: 1, maxLatencyMs: 60_000 },
    clock: new FakeClock(),
    traceId: () => 'trace-edge',
    maxRetries: 1,
    ...overrides,
  });
  return { service, store, ledger, planMap };
}

describe('ExecutionRunService — not-found and ownership edges', () => {
  it('refuses start when the plan does not exist', async () => {
    const { service } = harness(plan([step()]));
    const result = await service.start('owner-a', 'missing-plan');
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/Plan not found/);
  });

  it('returns not-found for reads and control actions on unknown executions', async () => {
    const { service } = harness(plan([step()]));
    expect(service.get('owner-a', 'exec-ghost').success).toBe(false);
    expect(service.cancel('owner-a', 'exec-ghost').success).toBe(false);
    expect((await service.approve('owner-a', 'exec-ghost', 's1')).success).toBe(false);
    expect((await service.reject('owner-a', 'exec-ghost', 's1')).success).toBe(false);
    expect((await service.completeHandoff('owner-a', 'exec-ghost', 's1')).success).toBe(false);
  });

  it('refuses approval on a missing step or a step not awaiting approval', async () => {
    const p = plan([
      step({ id: 's1', title: 'Research' }),
      step({ id: 's2', title: 'Publish', irreversible: true }),
    ]);
    const { service } = harness(p);
    const started = await service.start('owner-a', p.id);
    expect(started.data?.status).toBe('WAITING_FOR_APPROVAL');

    const missingStep = await service.approve('owner-a', started.data?.executionId ?? '', 'nope');
    expect(missingStep.success).toBe(false);
    expect(missingStep.error).toMatch(/Step not found/);

    const notAwaiting = await service.approve('owner-a', started.data?.executionId ?? '', 's1');
    expect(notAwaiting.success).toBe(false);
    expect(notAwaiting.error).toMatch(/not awaiting approval/);
  });
});

describe('ExecutionRunService — cancellation', () => {
  it('cancels an owner run and persists the CANCELLED state', async () => {
    const p = plan([step()]);
    const { service } = harness(p);
    const started = await service.start('owner-a', p.id);
    expect(started.success).toBe(true);

    const cancelled = service.cancel('owner-a', started.data?.executionId ?? '');
    expect(cancelled.success).toBe(true);
    expect(cancelled.data?.status).toBe('CANCELLED');
    expect(cancelled.data?.finishedAt).toBeDefined();
  });
});

describe('ExecutionRunService — plan loss on resume is fail-closed', () => {
  it('blocks the run when the plan disappears before a resume', async () => {
    const p = plan([
      step({ id: 's1', title: 'Research' }),
      step({ id: 's2', title: 'Publish', irreversible: true }),
    ]);
    const { service, planMap } = harness(p);
    const started = await service.start('owner-a', p.id);
    expect(started.data?.status).toBe('WAITING_FOR_APPROVAL');

    planMap.clear();
    const resumed = await service.approve('owner-a', started.data?.executionId ?? '', 's2');
    expect(resumed.success).toBe(false);
    expect(resumed.error).toMatch(/Plan not found/);
  });
});

describe('ExecutionRunService — default options and reads', () => {
  it('defaults traceId and maxRetries when omitted', async () => {
    const p = plan([step()]);
    const store = new InMemoryExecutionRunStore();
    const service = new ExecutionRunService({
      planSource: { getPlan: async () => p },
      port: new FakePort(),
      store,
      ledger: new InMemoryPreferenceLedger(),
      budget: { maxIterations: 3, maxTokens: 100_000, maxCostUsd: 1, maxLatencyMs: 60_000 },
      clock: new FakeClock(),
    });
    const started = await service.start('owner-a', p.id);
    expect(started.success).toBe(true);
    expect(started.data?.traceId).toMatch(/^exec-/);
  });

  it('filters the preference ledger by executionId', async () => {
    const p = plan([step()]);
    const { service, ledger } = harness(p);
    const started = await service.start('owner-a', p.id);
    const execId = started.data?.executionId ?? '';

    const all = service.preferenceLedger('owner-a');
    expect(all.success).toBe(true);
    expect((all.data as unknown[]).length).toBeGreaterThan(0);

    const filtered = service.preferenceLedger('owner-a', execId);
    expect((filtered.data as unknown[]).length).toBeGreaterThan(0);
    expect(
      (filtered.data as Array<{ executionId: string }>).every((e) => e.executionId === execId),
    ).toBe(true);
    expect(ledger.list('exec-other')).toHaveLength(0);
  });

  it('exposes the run intelligence view', async () => {
    const p = plan([step()]);
    const { service } = harness(p);
    const started = await service.start('owner-a', p.id);
    const view = service.intelligence(started.data!);
    expect(view.completedSteps).toContain('s1');
    expect(view.executionBoundary).toBe('all_automated');
  });

  it('skips artifact attach when expectations are empty', async () => {
    const p = plan([step()]);
    const { service } = harness(p, {
      artifactReader: {
        root: '/r',
        maxBytes: 1000,
        read: async () => ({ found: true, content: '{}', byteLength: 2 }),
        exists: async () => ({ found: true }),
      },
      artifactExpectations: () => [],
    });
    const started = await service.start('owner-a', p.id);
    expect(started.success).toBe(true);
    expect(started.data?.status).toBe('COMPLETED');
  });

  it('fails after retries when the runtime abstains (evidence-first)', async () => {
    class AbstainingPort extends FakePort {
      async execute(): Promise<StepExecutionResult> {
        return { ok: true, content: 'A long enough output for the contract.', abstained: true };
      }
    }
    const p = plan([step()]);
    const store = new InMemoryExecutionRunStore();
    const service = new ExecutionRunService({
      planSource: { getPlan: async () => p },
      port: new AbstainingPort(),
      store,
      ledger: new InMemoryPreferenceLedger(),
      budget: { maxIterations: 3, maxTokens: 100_000, maxCostUsd: 1, maxLatencyMs: 60_000 },
      clock: new FakeClock(),
      traceId: () => 'trace-abstain',
      maxRetries: 0,
    });
    const result = await service.start('owner-a', p.id);
    expect(result.data?.status).toBe('FAILED');
    expect(result.data?.steps[0]?.failureReason).toMatch(/abstained/);
  });
});

describe('ExecutionRunService — completeHandoff edge cases', () => {
  it('refuses a hand-off for a step that has no hand-off record', async () => {
    const p = plan([step({ id: 's1', title: 'Research' })]);
    const { service } = harness(p);
    const started = await service.start('owner-a', p.id);
    const result = await service.completeHandoff('owner-a', started.data?.executionId ?? '', 's1');
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/No hand-off recorded/);
  });

  it('refuses a hand-off for a missing step', async () => {
    const p = plan([
      step({ id: 's1', title: 'Research' }),
      step({ id: 's2', title: 'Publish', irreversible: true }),
    ]);
    const { service } = harness(p);
    const started = await service.start('owner-a', p.id);
    const result = await service.completeHandoff(
      'owner-a',
      started.data?.executionId ?? '',
      'ghost',
    );
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/Step not found/);
  });
});
