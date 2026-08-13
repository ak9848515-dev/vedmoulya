// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Gateway: execution.* namespace tests
// EPIC-014 — Capability Execution Engine (PLAN → EXECUTE → VERIFY)
//
// Exercises the execution.* procedures through the REAL tRPC pipeline (auth +
// rate-limit middleware + RouterRegistry handler closures):
//   start           — a real EPIC-013 plan → bounded owner-scoped run
//   get / list      — owner-scoped reads
//   intelligence    — Phase 4 run view (current step, next action)
//   preferenceLedger— Phase 5 provenance events (owner-scoped)
//   approve/reject / completeHandoff / cancel — gate + control semantics
// Plus IDOR: a foreign userId must be refused by the gateway guard on every
// procedure. The provider port is a deterministic fake — no live services.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import {
  CapabilityMarketplaceApplicationService,
  InMemoryCapabilityPlanStore,
} from '@vedmoulya/capability-marketplace';
import type {
  CapabilitySourcePort,
  ProviderCandidateFact,
} from '@vedmoulya/capability-marketplace';
import {
  ExecutionRunService,
  InMemoryExecutionRunStore,
  InMemoryPreferenceLedger,
} from '@vedmoulya/execution-bridge';
import type {
  ClockPort,
  StepExecutionPort,
  StepExecutionResult,
} from '@vedmoulya/execution-bridge';
import { createAppRouter } from '../services/RouterRegistry.js';
import type { ApiApplicationService } from '../services/ApiApplicationService.js';

// ── Deterministic plan source (same fixture as the capability router test) ──
function testSource(): CapabilitySourcePort {
  const openai: ProviderCandidateFact = {
    providerId: 'prov-openai',
    family: 'openai',
    name: 'OpenAI',
    modelId: 'gpt-4o',
    modelName: 'GPT-4o',
    capabilities: ['TEXT_GENERATION', 'REASONING', 'CODING', 'VISION', 'RESEARCH'],
    quality: 0.92,
    costTier: 'medium',
    availability: 0.99,
    configured: true,
    evidence: [
      {
        claim: 'Registered provider with capability matrix',
        source: 'provider-registry',
        confidence: 'VERIFIED',
      },
    ],
  };
  return {
    providerCandidates: async (capability) =>
      ['TEXT_GENERATION', 'REASONING', 'CODING', 'VISION', 'RESEARCH'].includes(capability)
        ? [openai]
        : [],
    discoveryCandidates: async () => [],
    localModelCandidates: async () => [],
  };
}

function makeCapabilityService(): CapabilityMarketplaceApplicationService {
  return new CapabilityMarketplaceApplicationService({
    source: testSource(),
    store: new InMemoryCapabilityPlanStore(),
    now: () => new Date('2026-08-13T09:00:00Z'),
  });
}

// ── Deterministic execution port + clock — no live providers ────────────────
class FakeExecutionPort implements StepExecutionPort {
  calls: string[] = [];
  availability(
    capability: string,
    runtimeCapability: string,
  ): { available: boolean; reason?: string } {
    if (!runtimeCapability) {
      return { available: false, reason: `no runtime path for ${capability}` };
    }
    return { available: true };
  }
  async execute(input: {
    stepId: string;
    capability: string;
    runtimeCapability: string;
  }): Promise<StepExecutionResult> {
    this.calls.push(input.stepId);
    return {
      ok: true,
      content: `Produced the deliverable for step ${input.stepId}. This content is long enough to satisfy the output contract.`,
      provider: 'openai',
      model: 'gpt-4o',
      tokens: { input: 120, output: 420, total: 540 },
      costUsd: 0.001,
      latencyMs: 45,
    };
  }
}

class FixedClock implements ClockPort {
  private readonly t = 1_700_000_000_000;
  now(): string {
    return new Date(this.t).toISOString();
  }
  timestampMs(): number {
    return this.t;
  }
  async sleep(): Promise<void> {}
}

function makeServices(): {
  services: ApiApplicationService;
  port: FakeExecutionPort;
  capability: CapabilityMarketplaceApplicationService;
} {
  const capability = makeCapabilityService();
  const port = new FakeExecutionPort();
  const services = {
    capability,
    executionRun: new ExecutionRunService({
      planSource: {
        getPlan: async (ownerId, planId) => {
          const plan = await capability.getPlan(ownerId, planId);
          return plan ?? undefined;
        },
      },
      port,
      store: new InMemoryExecutionRunStore(),
      ledger: new InMemoryPreferenceLedger(),
      budget: { maxIterations: 3, maxTokens: 100_000, maxCostUsd: 1, maxLatencyMs: 60_000 },
      clock: new FixedClock(),
      maxRetries: 1,
    }),
  } as unknown as ApiApplicationService;
  return { services, port, capability };
}

const ctx = (userId: string) => ({ userId, email: `${userId}@vm.local`, role: 'user' });

describe('execution namespace (EPIC-014)', () => {
  it('start executes the executable steps of a REAL plan through the port (bounded, verified)', async () => {
    const { services, port } = makeServices();
    const router = createAppRouter(services);
    const caller = router.createCaller(ctx('exec-1'));

    const plan = (
      await caller.capability.plan({
        userId: 'exec-1',
        outcome: 'Create a 60-second educational video about the solar system',
      })
    ).data as { id: string };

    const started = await caller.execution.start({ userId: 'exec-1', planId: plan.id });
    expect(started.success).toBe(true);
    const run = started.data as {
      status: string;
      steps: Array<{
        stepId: string;
        state: string;
        disposition: string;
        verification?: { post?: { passed: boolean } };
      }>;
      handoffs: Array<{ stepId: string; kind: string; what: string }>;
    };

    // Executable steps actually ran through the port (never faked).
    expect(port.calls.length).toBeGreaterThanOrEqual(1);
    // Every executed step was verified (EXECUTION + OUTPUT + VALIDATION).
    for (const step of run.steps.filter((s) => s.state === 'completed')) {
      expect(step.verification?.post?.passed).toBe(true);
    }
    // The run honestly stopped at a human gate (the plan's Final Export is
    // irreversible + manual with no deploy candidate) — never a fake DONE.
    expect(run.status).not.toBe('COMPLETED');
    expect(['MANUAL_REQUIRED', 'WAITING_FOR_APPROVAL', 'PARTIAL', 'BLOCKED']).toContain(run.status);
    if (run.handoffs.length > 0) {
      expect(run.handoffs[0]?.what.length).toBeGreaterThan(0);
    }
  });

  it('get reads back the run owner-scoped and intelligence exposes the Phase 4 view', async () => {
    const { services } = makeServices();
    const router = createAppRouter(services);
    const caller = router.createCaller(ctx('exec-2'));

    const plan = (await caller.capability.plan({ userId: 'exec-2', outcome: 'Write a blog post' }))
      .data as { id: string };
    const started = (await caller.execution.start({ userId: 'exec-2', planId: plan.id })).data as {
      executionId: string;
    };

    const read = await caller.execution.get({ userId: 'exec-2', executionId: started.executionId });
    expect(read.success).toBe(true);
    expect((read.data as { executionId: string }).executionId).toBe(started.executionId);

    const intelligence = await caller.execution.intelligence({
      userId: 'exec-2',
      executionId: started.executionId,
    });
    expect(intelligence.success).toBe(true);
    const view = intelligence.data as {
      completedSteps: string[];
      executionBoundary: string;
      nextAction?: string;
      totalCostUsd: number;
    };
    expect(Array.isArray(view.completedSteps)).toBe(true);
    expect(view.executionBoundary.length).toBeGreaterThan(0);
  });

  it('list returns only the caller’s runs', async () => {
    const { services } = makeServices();
    const router = createAppRouter(services);
    const caller = router.createCaller(ctx('exec-3'));

    const plan = (await caller.capability.plan({ userId: 'exec-3', outcome: 'Write a blog post' }))
      .data as { id: string };
    await caller.execution.start({ userId: 'exec-3', planId: plan.id });

    const listed = await caller.execution.list({ userId: 'exec-3' });
    expect(listed.success).toBe(true);
    const runs = listed.data as Array<{ ownerId: string }>;
    expect(runs.length).toBeGreaterThan(0);
    expect(runs.every((r) => r.ownerId === 'exec-3')).toBe(true);
  });

  it('approve/reject/cancel return honest results through the real pipeline', async () => {
    const { services } = makeServices();
    const router = createAppRouter(services);
    const caller = router.createCaller(ctx('exec-4'));

    const plan = (await caller.capability.plan({ userId: 'exec-4', outcome: 'Write a blog post' }))
      .data as { id: string };
    const started = (await caller.execution.start({ userId: 'exec-4', planId: plan.id })).data as {
      executionId: string;
      steps: Array<{ stepId: string; state: string }>;
    };

    const approvalStep = started.steps.find((s) => s.state === 'waiting_approval');
    if (approvalStep) {
      const approved = await caller.execution.approve({
        userId: 'exec-4',
        executionId: started.executionId,
        stepId: approvalStep.stepId,
      });
      expect(approved.success).toBe(true);
    }

    const cancelled = await caller.execution.cancel({
      userId: 'exec-4',
      executionId: started.executionId,
    });
    expect(cancelled.success).toBe(true);
    expect((cancelled.data as { status: string }).status).toBe('CANCELLED');

    // Rejecting a step that is not awaiting approval is an honest error.
    const rejected = await caller.execution.reject({
      userId: 'exec-4',
      executionId: started.executionId,
      stepId: 'no-such-step',
    });
    expect(rejected.success).toBe(false);
  });

  it('preferenceLedger exposes provenance events for the caller’s runs only', async () => {
    const { services } = makeServices();
    const router = createAppRouter(services);
    const caller = router.createCaller(ctx('exec-5'));

    const plan = (await caller.capability.plan({ userId: 'exec-5', outcome: 'Write a blog post' }))
      .data as { id: string };
    await caller.execution.start({ userId: 'exec-5', planId: plan.id });

    const ledger = await caller.execution.preferenceLedger({ userId: 'exec-5' });
    expect(ledger.success).toBe(true);
    const events = ledger.data as Array<{ source: string; fact: string; confidence: number }>;
    expect(events.length).toBeGreaterThan(0);
    // Inferred observations never outrank explicit facts.
    for (const e of events.filter((ev) => ev.source === 'inferred_observation')) {
      expect(e.confidence).toBeLessThanOrEqual(0.5);
    }
  });

  it('refuses a foreign userId (IDOR) on every execution procedure', async () => {
    const { services } = makeServices();
    const router = createAppRouter(services);
    const caller = router.createCaller(ctx('exec-owner'));

    await expect(
      caller.execution.start({ userId: 'exec-attacker', planId: 'plan-x' }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(
      caller.execution.get({ userId: 'exec-attacker', executionId: 'exec-x' }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(caller.execution.list({ userId: 'exec-attacker' })).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
    await expect(
      caller.execution.approve({ userId: 'exec-attacker', executionId: 'exec-x', stepId: 's1' }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(
      caller.execution.reject({ userId: 'exec-attacker', executionId: 'exec-x', stepId: 's1' }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(
      caller.execution.completeHandoff({
        userId: 'exec-attacker',
        executionId: 'exec-x',
        stepId: 's1',
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(
      caller.execution.cancel({ userId: 'exec-attacker', executionId: 'exec-x' }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(
      caller.execution.preferenceLedger({ userId: 'exec-attacker' }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(
      caller.execution.intelligence({ userId: 'exec-attacker', executionId: 'exec-x' }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
});
