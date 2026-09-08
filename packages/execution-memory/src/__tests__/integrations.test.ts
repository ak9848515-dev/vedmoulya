// PHASE 24 #23–#27 + PHASE 13/14/15: memory is advisory — it can never
// grant tool availability, bypass ToolRuntime/AIOrchestrationService, or
// override routing health.

import { describe, expect, it } from 'vitest';
import { ExecutionMemoryService } from '../application/ExecutionMemoryService.js';
import { InMemoryExecutionMemoryStore } from '../infrastructure/InMemoryExecutionMemoryStore.js';
import {
  PlanningMemoryAdapter,
  AdaptiveMemoryAdapter,
  RoutingMemoryAdapter,
} from '../infrastructure/integration-adapters.js';
import { makeCompletedRun } from './fixtures.js';

async function seedService(
  store: InMemoryExecutionMemoryStore,
  userId = 'user-1',
): Promise<ExecutionMemoryService> {
  const service = new ExecutionMemoryService({ store });
  // Verified tool success + verified model success + achieved plan.
  const { run, traces } = makeCompletedRun({
    userId,
    outcome: 'ACHIEVED',
    actionTraces: [
      {
        stepId: 'step-1',
        toolName: 'test-runner',
        provider: 'mock',
        model: 'mock-1',
        status: 'succeeded',
        verdict: 'VERIFIED',
      },
    ],
  });
  await service.ingestRun(run, traces, { knownTools: ['test-runner'], knownProviders: ['mock'] });
  // A second tool with verified success (relevant for tool switching).
  const { run: run2, traces: traces2 } = makeCompletedRun({
    runId: 'run-2',
    userId,
    outcome: 'ACHIEVED',
    actionTraces: [
      {
        stepId: 'step-1',
        toolName: 'test-runner',
        provider: 'mock',
        model: 'mock-1',
        status: 'succeeded',
        verdict: 'VERIFIED',
      },
    ],
  });
  await service.ingestRun(run2, traces2, { knownTools: ['test-runner'], knownProviders: ['mock'] });
  return service;
}

describe('planner integration (Phase 13) — advisory only', () => {
  it('supplies relevant verified plan/tool memory to the planner', async () => {
    const store = new InMemoryExecutionMemoryStore();
    const service = await seedService(store);
    const adapter = new PlanningMemoryAdapter(service);

    const evidence = await adapter.retrieve({
      userId: 'user-1',
      capabilities: ['reasoning'],
      tools: ['test-runner'],
      goalType: 'fix',
    });
    expect(evidence.length).toBeGreaterThan(0);
    expect(evidence.some((e) => e.category === 'PLAN_PATTERN')).toBe(true);
    expect(evidence.some((e) => e.category === 'TOOL_RELIABILITY')).toBe(true);
    // Advisory flag is structural — consumers can never mistake it for authority.
    expect(evidence.every((e) => e.advisory === true)).toBe(true);
  });

  it('memory suggesting an unavailable tool cannot grant tool availability', async () => {
    const store = new InMemoryExecutionMemoryStore();
    const service = await seedService(store);
    const adapter = new PlanningMemoryAdapter(service);

    // The planner consults memory — and the memory surfaces a tool that is
    // NOT exposed by the current registry.
    const evidence = await adapter.retrieve({ userId: 'user-1', tools: ['ghost.tool'], limit: 10 });
    // Even if the adapter could surface it (no registry here), the PLANNER
    // still validates against the authoritative registry — memory has no
    // tool-granting authority. The frozen planning boundary rejects any
    // plan step that references a tool outside the registry (proven by the
    // planning package's own suite). Here we assert the advisory contract:
    // the adapter returns evidence, never a tool grant.
    expect(evidence.every((e) => e.advisory === true)).toBe(true);
    // And a memory entry cannot be created for a fabricated tool at all.
    const ghostRun = makeCompletedRun({
      runId: 'run-ghost',
      actionTraces: [
        { stepId: 'step-1', toolName: 'ghost.tool', status: 'succeeded', verdict: 'VERIFIED' },
      ],
    });
    const result = await service.ingestRun(ghostRun.run, ghostRun.traces, {
      knownTools: ['test-runner'],
    });
    expect(result.rejected.some((r) => r.reasons.join(' ').includes('registry'))).toBe(true);
    expect((await store.list({ subject: 'ghost.tool' })).length).toBe(0);
  });
});

describe('adaptive loop integration (Phase 14) — memory suggests, validation governs', () => {
  it('supplies a bounded evidence block to the decision model', async () => {
    const store = new InMemoryExecutionMemoryStore();
    const service = await seedService(store);
    const adapter = new AdaptiveMemoryAdapter(service);

    const block = await adapter.retrieveForDecision({
      userId: 'user-1',
      capabilities: ['reasoning'],
      tools: ['test-runner'],
    });
    expect(block.text.length).toBeLessThanOrEqual(1_500);
    expect(block.evidence.length).toBeLessThanOrEqual(12);
    expect(block.text).toContain('test-runner');
  });

  it('a memory-suggested tool must still pass the frozen tool chain', async () => {
    const store = new InMemoryExecutionMemoryStore();
    const service = await seedService(store);
    const adapter = new AdaptiveMemoryAdapter(service);
    const evidence = await adapter.retrieveForDecision({
      userId: 'user-1',
      tools: ['test-runner'],
    });

    // The adaptive loop's decision VALIDATION (frozen) is the gate: a
    // TOOL_CALL for a tool outside the registry/allowlist is BLOCKED even
    // if memory suggested it. This package never executes anything — the
    // frozen ToolRuntime chain remains the ONLY tool execution path.
    const suggested = evidence.evidence.find((e) => e.subject === 'test-runner');
    expect(suggested).toBeDefined();
    // The suggestion is structured advisory data — no executable directive,
    // no permission grant, no registry bypass field.
    expect(Object.keys(suggested!).sort()).toEqual(
      [
        'advisory',
        'capability',
        'category',
        'confidenceLevel',
        'confidenceScore',
        'entryId',
        'failureCount',
        'predicate',
        'recency',
        'sampleCount',
        'score',
        'scope',
        'subject',
        'successCount',
        'value',
        'verifiedCount',
      ].sort(),
    );
  });

  it('memory cannot bypass AIOrchestrationService — no provider/model directives', async () => {
    const store = new InMemoryExecutionMemoryStore();
    const service = await seedService(store);
    const adapter = new AdaptiveMemoryAdapter(service);
    const block = await adapter.retrieveForDecision({ userId: 'user-1', model: 'mock-1' });
    // Evidence about model success exists but contains NO routing DIRECTIVE
    // for the decision — routing stays with the frozen runtime.
    expect(block.text).not.toMatch(/use provider|route to|select provider|switch to provider/i);
    const evidence = block.evidence.find((e) => e.category === 'ROUTING_SIGNAL');
    expect(evidence?.advisory).toBe(true);
  });
});

describe('routing integration (Phase 15) — advisory signal only', () => {
  it('returns only ROUTING_SIGNAL evidence as an advisory source', async () => {
    const store = new InMemoryExecutionMemoryStore();
    const service = await seedService(store);
    const adapter = new RoutingMemoryAdapter(service);

    const advisory = await adapter.provideAdvisory({ userId: 'user-1', provider: 'mock' });
    expect(advisory.length).toBeGreaterThan(0);
    expect(advisory.every((e) => e.category === 'ROUTING_SIGNAL')).toBe(true);
    expect(advisory.every((e) => e.advisory === true)).toBe(true);
  });

  it('current health always overrides stale routing memory', async () => {
    const store = new InMemoryExecutionMemoryStore();
    const service = await seedService(store);
    const adapter = new RoutingMemoryAdapter(service);

    const healthy = await adapter.provideAdvisory({ userId: 'user-1', provider: 'mock' });
    expect(healthy.some((e) => e.subject.includes('mock'))).toBe(true);

    const degraded = await adapter.provideAdvisory(
      { userId: 'user-1', provider: 'mock' },
      { degradedProviders: ['mock'] },
    );
    expect(degraded.some((e) => e.subject.includes('mock'))).toBe(false);
  });
});
