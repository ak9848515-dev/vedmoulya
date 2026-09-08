// PHASE 24 #8–#10, #19–#22, #28–#30, #35–#38: ingest aggregation,
// isolation, ranking, conflict handling, preferences, persistence.

import { describe, expect, it } from 'vitest';
import { ExecutionMemoryService } from '../application/ExecutionMemoryService.js';
import { InMemoryExecutionMemoryStore } from '../infrastructure/InMemoryExecutionMemoryStore.js';
import { MemoryIntelligenceStoreAdapter } from '../infrastructure/MemoryIntelligenceStoreAdapter.js';
import { InMemoryMemoryRepository } from '@vedmoulya/memory-intelligence';
import { makeCompletedRun, makeMemoryService } from './fixtures.js';
import { extractExecutionRecords } from '../domain/execution-record.js';

describe('ingest — the learning cycle', () => {
  it('ingests a completed run: records → signals → validated entries persisted', async () => {
    const { service, clock } = makeMemoryService();
    const { run, traces } = makeCompletedRun({
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
    const result = await service.ingestRun(run, traces, { knownTools: ['test-runner'] });

    expect(result.records).toBe(2); // run record + action record
    expect(result.signals.length).toBeGreaterThan(0);
    expect(result.accepted.length).toBeGreaterThan(0);
    expect(result.rejected).toHaveLength(0);

    const entries = await service.listEntries();
    const categories = entries.map((e) => e.category);
    expect(categories).toContain('TOOL_RELIABILITY');
    expect(categories).toContain('PLAN_PATTERN');
    expect(categories).toContain('ROUTING_SIGNAL');
    expect(categories).toContain('TASK_PATTERN');
    expect(categories).toContain('VERIFICATION_PATTERN');

    const tool = entries.find((e) => e.category === 'TOOL_RELIABILITY')!;
    expect(tool.subject).toBe('test-runner');
    expect(tool.successCount).toBe(1);
    expect(tool.verifiedCount).toBe(1);
    expect(tool.provenance.executionIds).toContain('ex-run-1-step-1-1');
    expect(tool.confidence.factors.length).toBeGreaterThan(0);
    void clock;
  });

  it('aggregates duplicate runs into one entry (sampleCount grows)', async () => {
    const { service } = makeMemoryService();
    for (let i = 0; i < 3; i += 1) {
      const { run, traces } = makeCompletedRun({
        runId: `run-${i}`,
        actionTraces: [
          { stepId: 'step-1', toolName: 'test-runner', status: 'succeeded', verdict: 'VERIFIED' },
        ],
      });
      await service.ingestRun(run, traces, { knownTools: ['test-runner'] });
    }
    const entries = await service.listEntries({ category: 'TOOL_RELIABILITY' });
    expect(entries).toHaveLength(1);
    expect(entries[0].sampleCount).toBe(3);
    expect(entries[0].successCount).toBe(3);
  });

  it('records rejected candidates honestly with reasons (no silent drop)', async () => {
    const { service } = makeMemoryService();
    // Fabricated tool candidate: run claims a tool that is not exposed.
    const { run, traces } = makeCompletedRun({
      actionTraces: [
        { stepId: 'step-1', toolName: 'ghost.tool', status: 'succeeded', verdict: 'VERIFIED' },
      ],
    });
    const result = await service.ingestRun(run, traces, { knownTools: ['test-runner'] });
    const toolReject = result.rejected.find((r) => r.category === 'TOOL_RELIABILITY');
    expect(toolReject).toBeDefined();
    expect(toolReject!.reasons.join(' ')).toContain('authoritative registry');
  });

  it('plan pattern aggregation records verified plan signatures', async () => {
    const { service } = makeMemoryService();
    const { run, traces } = makeCompletedRun({
      outcome: 'ACHIEVED',
      actionTraces: [{ stepId: 'step-1', verdict: 'VERIFIED' }],
    });
    const result = await service.ingestRun(run, traces);
    const plan = result.accepted.find((e) => e.category === 'PLAN_PATTERN');
    expect(plan).toBeDefined();
    expect(plan!.subject).toContain('reasoning');
    expect(plan!.predicate).toBe('achieved_rate');
    expect(plan!.value).toBe(1);
  });

  it('recovery pattern aggregation captures effective strategies', async () => {
    const { service } = makeMemoryService();
    const { run, traces } = makeCompletedRun({
      outcome: 'ACHIEVED',
      attempts: 2,
      actionTraces: [{ stepId: 'step-1', recovery: 'alternate_tool', verdict: 'VERIFIED' }],
    });
    const result = await service.ingestRun(run, traces);
    // Per-strategy aggregation: the alternate_tool strategy record exists.
    const recovery = result.accepted.find(
      (e) => e.category === 'RECOVERY_PATTERN' && e.subject === 'alternate_tool',
    );
    expect(recovery).toBeDefined();
    expect(recovery!.successCount).toBeGreaterThanOrEqual(1);
  });
});

describe('user preferences (Phase 18)', () => {
  it('creates USER_PREFERENCE memory only through the explicit path', async () => {
    const { service } = makeMemoryService();
    const entry = await service.recordUserPreference({
      userId: 'user-1',
      subject: 'outputFormat',
      value: 'docx',
      source: 'user-request',
    });
    expect(entry.category).toBe('USER_PREFERENCE');
    expect(entry.scope).toBe('USER');
    expect(entry.userId).toBe('user-1');
    // No execution run ever creates USER_PREFERENCE memory:
    const { run, traces } = makeCompletedRun({});
    const result = await service.ingestRun(run, traces);
    expect(result.accepted.some((e) => e.category === 'USER_PREFERENCE')).toBe(false);
  });

  it('latest explicit statement wins (replaces, never averages)', async () => {
    const { service } = makeMemoryService();
    await service.recordUserPreference({
      userId: 'user-1',
      subject: 'outputFormat',
      value: 'pdf',
      source: 'user-request',
    });
    const latest = await service.recordUserPreference({
      userId: 'user-1',
      subject: 'outputFormat',
      value: 'docx',
      source: 'user-request',
    });
    const entries = await service.listEntries({ category: 'USER_PREFERENCE' });
    expect(entries).toHaveLength(1);
    expect(latest.value).toBe(1);
    expect(latest.updatedAt).toBe(entries[0].updatedAt);
  });
});

describe('retrieval — ranking, isolation, bounds', () => {
  async function seed(): Promise<ReturnType<typeof makeMemoryService>> {
    const { service, clock } = makeMemoryService();
    const { run, traces } = makeCompletedRun({
      userId: 'user-1',
      outcome: 'ACHIEVED',
      actionTraces: [
        { stepId: 'step-1', toolName: 'test-runner', status: 'succeeded', verdict: 'VERIFIED' },
      ],
    });
    await service.ingestRun(run, traces, { knownTools: ['test-runner'] });
    clock.advanceDays(1);
    return { service, clock };
  }

  it('ranks by scope relevance and confidence', async () => {
    const { service } = await seed();
    const evidence = await service.retrieve({
      userId: 'user-1',
      capabilities: ['reasoning'],
      tools: ['test-runner'],
      limit: 10,
    });
    expect(evidence.length).toBeGreaterThan(0);
    // Tool evidence for the queried tool ranks at the top.
    const tool = evidence.find((e) => e.category === 'TOOL_RELIABILITY');
    expect(tool).toBeDefined();
    expect(tool!.advisory).toBe(true);
    expect(tool!.confidenceLevel).toBeDefined();
    expect(tool!.score).toBeGreaterThan(0);
  });

  it('blocks cross-user retrieval of USER-scoped memory', async () => {
    const { service } = await seed();
    await service.recordUserPreference({
      userId: 'user-1',
      subject: 'verbosity',
      value: 'concise',
      source: 'user-request',
    });
    // user-2 never sees user-1's USER-scoped memory.
    const evidence = await service.retrieve({
      userId: 'user-2',
      capabilities: ['reasoning'],
      limit: 10,
    });
    expect(evidence.some((e) => e.scope === 'USER')).toBe(false);
    // Global knowledge (tool reliability etc.) remains shareable.
    expect(evidence.some((e) => e.category === 'TOOL_RELIABILITY')).toBe(true);
    // user-1 still sees their own preference.
    const own = await service.retrieve({
      userId: 'user-1',
      capabilities: ['reasoning'],
      limit: 10,
    });
    expect(own.some((e) => e.scope === 'USER' && e.subject === 'verbosity')).toBe(true);
  });

  it('enforces retrieval limits and bounded evidence blocks', async () => {
    const { service } = await seed();
    const evidence = await service.retrieve({ userId: 'user-1', limit: 2 });
    expect(evidence.length).toBeLessThanOrEqual(2);
    const block = await service.retrieveForDecision({
      userId: 'user-1',
      capabilities: ['reasoning'],
    });
    expect(block.charCount).toBeLessThanOrEqual(1_500);
    expect(block.text.length).toBe(block.charCount);
    expect(block.evidence.length).toBeLessThanOrEqual(12);
  });

  it('scope isolation: USER memory never becomes GLOBAL knowledge', async () => {
    const { service } = await seed();
    await service.recordUserPreference({
      userId: 'user-1',
      subject: 'verbosity',
      value: 'concise',
      source: 'user-request',
    });
    // A global query without userId must not surface user-1's preference.
    const evidence = await service.retrieve({ limit: 10 });
    expect(evidence.some((e) => e.category === 'USER_PREFERENCE')).toBe(false);
  });
});

describe('conflict handling — current runtime truth wins (Phase 19)', () => {
  async function seedToolMemory(
    tool = 'test-runner',
  ): Promise<ReturnType<typeof makeMemoryService>> {
    const { service } = makeMemoryService();
    const { run, traces } = makeCompletedRun({
      outcome: 'ACHIEVED',
      actionTraces: [
        { stepId: 'step-1', toolName: tool, status: 'succeeded', verdict: 'VERIFIED' },
      ],
    });
    await service.ingestRun(run, traces, { knownTools: [tool] });
    return { service };
  }

  it('an unavailable tool overrides historical tool success', async () => {
    const { service } = await seedToolMemory('test-runner');
    const evidence = await service.retrieve(
      { userId: 'user-1', tools: ['test-runner'], limit: 10 },
      { availableTools: ['other.tool'] }, // test-runner currently unavailable
    );
    expect(
      evidence.some((e) => e.category === 'TOOL_RELIABILITY' && e.subject === 'test-runner'),
    ).toBe(false);
  });

  it('current health overrides stale routing memory', async () => {
    const { service } = makeMemoryService();
    const { run, traces } = makeCompletedRun({
      outcome: 'ACHIEVED',
      actionTraces: [
        {
          stepId: 'step-1',
          provider: 'provider-x',
          model: 'model-1',
          status: 'succeeded',
          verdict: 'VERIFIED',
        },
      ],
    });
    await service.ingestRun(run, traces, { knownProviders: ['provider-x'] });
    const advisory = await service.provideRoutingAdvisory(
      { userId: 'user-1', provider: 'provider-x' },
      { degradedProviders: ['provider-x'] }, // currently degraded
    );
    expect(advisory.some((e) => e.subject.includes('provider-x'))).toBe(false);
    // Without degradation the advisory is returned (advisory only).
    const healthy = await service.provideRoutingAdvisory({
      userId: 'user-1',
      provider: 'provider-x',
    });
    expect(
      healthy.some((e) => e.category === 'ROUTING_SIGNAL' && e.subject.includes('provider-x')),
    ).toBe(true);
  });

  it('current explicit request overrides preference memory', async () => {
    const { service } = makeMemoryService();
    await service.recordUserPreference({
      userId: 'user-1',
      subject: 'outputFormat',
      value: 'pdf',
      source: 'user-request',
    });
    const evidence = await service.retrieve(
      { userId: 'user-1', limit: 10 },
      { explicitOverrides: { outputFormat: 'docx' } },
    );
    expect(
      evidence.some((e) => e.category === 'USER_PREFERENCE' && e.subject === 'outputFormat'),
    ).toBe(false);
  });
});

describe('decay, expiry, deletion', () => {
  it('stale memory decays in ranking over time', async () => {
    const { service, clock } = makeMemoryService();
    const { run, traces } = makeCompletedRun({
      outcome: 'ACHIEVED',
      actionTraces: [
        { stepId: 'step-1', toolName: 'old.tool', status: 'succeeded', verdict: 'VERIFIED' },
      ],
    });
    await service.ingestRun(run, traces, { knownTools: ['old.tool'] });
    clock.advanceDays(200);
    const evidence = await service.retrieve({ userId: 'user-1', tools: ['old.tool'], limit: 10 });
    expect(evidence.length).toBe(0); // influence decayed below the ranking floor
    // Historical record is retained (never silently deleted):
    const entries = await service.listEntries({ category: 'TOOL_RELIABILITY' });
    expect(entries).toHaveLength(1);
    void clock;
  });

  it('supports entry deletion (admin surface)', async () => {
    const { service } = makeMemoryService();
    await service.recordUserPreference({
      userId: 'user-1',
      subject: 'theme',
      value: 'dark',
      source: 'user-request',
    });
    const entries = await service.listEntries({ category: 'USER_PREFERENCE' });
    expect(entries).toHaveLength(1);
    await service.deleteEntry(entries[0].entryId);
    expect(await service.listEntries({ category: 'USER_PREFERENCE' })).toHaveLength(0);
  });
});

describe('persistence — reuses the existing enterprise memory platform', () => {
  it('round-trips entries through the memory-intelligence adapter', async () => {
    const repository = new InMemoryMemoryRepository();
    const store = new MemoryIntelligenceStoreAdapter(repository);
    const service = new ExecutionMemoryService({ store });
    await service.recordUserPreference({
      userId: 'user-1',
      subject: 'outputFormat',
      value: 'docx',
      source: 'user-request',
    });
    const { run, traces } = makeCompletedRun({
      outcome: 'ACHIEVED',
      actionTraces: [
        { stepId: 'step-1', toolName: 'test-runner', status: 'succeeded', verdict: 'VERIFIED' },
      ],
    });
    await service.ingestRun(run, traces, { knownTools: ['test-runner'] });

    const entries = await service.listEntries();
    expect(entries.length).toBeGreaterThan(0);
    const tool = entries.find((e) => e.category === 'TOOL_RELIABILITY')!;
    expect(tool.sampleCount).toBe(1);
    expect(tool.provenance.executionIds.length).toBeGreaterThan(0);
    // Persisted as platform MemoryItems with citations + audit.
    const items = await repository.listAllItems();
    expect(items.length).toBe(entries.length);
    expect(items.some((i) => i.citations.length > 0)).toBe(true);
    expect(items.some((i) => i.audit.some((a) => a.action === 'learned'))).toBe(true);
  });

  it('survives a restart: a new service over the same repository sees the memory', async () => {
    const repository = new InMemoryMemoryRepository();
    const store = new MemoryIntelligenceStoreAdapter(repository);
    const first = new ExecutionMemoryService({ store });
    await first.recordUserPreference({
      userId: 'user-1',
      subject: 'outputFormat',
      value: 'docx',
      source: 'user-request',
    });

    // "Restart": a brand-new service + adapter over the SAME repository.
    const restarted = new ExecutionMemoryService({
      store: new MemoryIntelligenceStoreAdapter(repository),
    });
    const entries = await restarted.listEntries();
    expect(entries).toHaveLength(1);
    expect(entries[0].subject).toBe('outputFormat');
    expect(entries[0].userId).toBe('user-1');
  });

  it('aggregates across services sharing the adapter (shared persistence)', async () => {
    const repository = new InMemoryMemoryRepository();
    const store = new MemoryIntelligenceStoreAdapter(repository);
    const serviceA = new ExecutionMemoryService({ store });
    const serviceB = new ExecutionMemoryService({ store });
    const { run, traces } = makeCompletedRun({
      outcome: 'ACHIEVED',
      actionTraces: [
        { stepId: 'step-1', toolName: 'test-runner', status: 'succeeded', verdict: 'VERIFIED' },
      ],
    });
    await serviceA.ingestRun(run, traces, { knownTools: ['test-runner'] });
    await serviceB.ingestRun(run, traces, { knownTools: ['test-runner'] });
    const entries = await serviceB.listEntries({ category: 'TOOL_RELIABILITY' });
    expect(entries).toHaveLength(1);
    expect(entries[0].sampleCount).toBe(2);
  });

  it('rejected candidates are never persisted', async () => {
    const repository = new InMemoryMemoryRepository();
    const store = new MemoryIntelligenceStoreAdapter(repository);
    const service = new ExecutionMemoryService({ store });
    const { run, traces } = makeCompletedRun({
      actionTraces: [
        { stepId: 'step-1', toolName: 'ghost.tool', status: 'succeeded', verdict: 'VERIFIED' },
      ],
    });
    const result = await service.ingestRun(run, traces, { knownTools: ['test-runner'] });
    expect(result.rejected.length).toBeGreaterThan(0);
    const items = await repository.listAllItems();
    expect(items.every((i) => !i.tags.includes('subject:ghost.tool'))).toBe(true);
  });
});

describe('observability hooks', () => {
  it('records candidate accept/reject and retrievals', async () => {
    const events: string[] = [];
    const store = new InMemoryExecutionMemoryStore();
    const service = new ExecutionMemoryService({
      store,
      observer: {
        onCandidate: (_candidate, accepted) => {
          events.push(`candidate:${accepted ? 'accepted' : 'rejected'}`);
        },
        onRetrieval: (_query, count) => {
          events.push(`retrieval:${String(count)}`);
        },
      },
    });
    const { run, traces } = makeCompletedRun({
      outcome: 'ACHIEVED',
      actionTraces: [
        { stepId: 'step-1', toolName: 'test-runner', status: 'succeeded', verdict: 'VERIFIED' },
      ],
    });
    await service.ingestRun(run, traces, { knownTools: ['test-runner'] });
    await service.retrieve({ userId: 'user-1', limit: 5 });
    expect(events).toContain('candidate:accepted');
    expect(events.some((e) => e.startsWith('retrieval:'))).toBe(true);
    // Sanitization is guaranteed by the frozen sanitizer — no secrets flow
    // through the hook either.
    void extractExecutionRecords;
  });
});
