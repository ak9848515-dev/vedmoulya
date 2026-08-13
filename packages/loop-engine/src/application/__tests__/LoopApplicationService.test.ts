import { describe, expect, it } from 'vitest';
import { LoopApplicationService } from '../LoopApplicationService.js';
import { InMemoryLoopRunStore } from '../../infrastructure/LoopRunStore.js';
import {
  FakeClock,
  FakeRagPort,
  FakeSpecialistPort,
  FakeToolPort,
  FULL_ANSWER,
} from '../../domain/__tests__/fixtures.js';

function app(specialist: FakeSpecialistPort) {
  const store = new InMemoryLoopRunStore();
  const service = new LoopApplicationService({
    specialist,
    rag: new FakeRagPort(),
    tools: new FakeToolPort(),
    clock: new FakeClock(),
    store,
  });
  return { service, store };
}

const GOAL = 'Build a modern restaurant application with reservations.';

describe('LoopApplicationService', () => {
  it('starts a run, returning the derived spec + plan immediately', () => {
    const { service, store } = app(
      new FakeSpecialistPort({ content: () => FULL_ANSWER, evidenceState: 'SUFFICIENT_EVIDENCE' }),
    );
    const started = service.start({ goal: GOAL, userId: 'user-1' });
    expect(started.runId).toMatch(/^run-/);
    expect(started.specification.pattern).toBe('app-builder');
    expect(started.graph.tasks.length).toBe(6);
    // The background run starts synchronously up to its first provider call,
    // so the stored status is already pending→running by the time start() returns.
    expect(['pending', 'running']).toContain(store.get(started.runId)?.status);
  });

  it('executes the started run asynchronously to completion', async () => {
    const { service, store } = app(
      new FakeSpecialistPort({ content: () => FULL_ANSWER, evidenceState: 'SUFFICIENT_EVIDENCE' }),
    );
    const started = service.start({ goal: GOAL, userId: 'user-1' });
    // Wait for the background run to finish (poll the store).
    const deadline = Date.now() + 2_000;
    while (Date.now() < deadline) {
      const run = store.get(started.runId);
      if (run?.status !== 'pending' && run?.status !== 'running') break;
      await new Promise((r) => setTimeout(r, 5));
    }
    const finished = store.get(started.runId);
    expect(finished?.status).toBe('completed');
    expect(finished?.terminationReason).toBe('SUCCESS');
    expect(finished?.budgetUsage.providerCalls).toBe(6);
  });

  it('reports status and full trace', async () => {
    const { service } = app(
      new FakeSpecialistPort({ content: () => FULL_ANSWER, evidenceState: 'SUFFICIENT_EVIDENCE' }),
    );
    const started = service.start({ goal: GOAL, userId: 'user-1' });
    const status = service.status(started.runId, 'user-1');
    expect(status.runId).toBe(started.runId);
    expect(['pending', 'running', 'completed']).toContain(status.status);
    const trace = service.getTrace(started.runId, 'user-1');
    expect(trace.goal).toBe(GOAL);
    expect(trace.specification.pattern).toBe('app-builder');
  });

  it('rejects cross-user access to a run (IDOR)', () => {
    const { service } = app(new FakeSpecialistPort({ content: () => FULL_ANSWER }));
    const started = service.start({ goal: GOAL, userId: 'user-1' });
    expect(() => service.status(started.runId, 'user-2')).toThrow();
    expect(() => service.getTrace(started.runId, 'user-2')).toThrow();
  });

  it('throws for an unknown run id', () => {
    const { service } = app(new FakeSpecialistPort());
    expect(() => service.status('run-unknown', 'user-1')).toThrow();
  });

  it('cancels a running run explicitly', async () => {
    const { service, store } = app(
      new FakeSpecialistPort({ content: () => FULL_ANSWER, evidenceState: 'SUFFICIENT_EVIDENCE' }),
    );
    const started = service.start({ goal: GOAL, userId: 'user-1' });
    const result = service.cancel(started.runId, 'user-1');
    expect(result.cancelled).toBe(true);
    expect(result.status).toBe('cancelled');
    expect(store.get(started.runId)?.terminationReason).toBe('CANCELLED');
    // Cancelling again is a no-op.
    const again = service.cancel(started.runId, 'user-1');
    expect(again.cancelled).toBe(false);
  });

  it('resumes a suspended run with a clarification', async () => {
    const { service } = app(
      new FakeSpecialistPort({ content: () => FULL_ANSWER, evidenceState: 'SUFFICIENT_EVIDENCE' }),
    );
    const started = service.start({ goal: 'Do the thing please.', userId: 'user-1' });
    // Give the background run a moment to suspend.
    await new Promise((r) => setTimeout(r, 20));
    const before = service.status(started.runId, 'user-1');
    expect(before.status).toBe('suspended');
    const resumed = await service.resume(
      started.runId,
      'user-1',
      'Build a restaurant reservation app with a web UI.',
    );
    expect(resumed.runId).toBe(started.runId);
    expect(resumed.status).toBe('completed');
    expect(resumed.terminationReason).toBe('SUCCESS');
  });

  it('refuses to resume a run that is not suspended', async () => {
    const { service } = app(new FakeSpecialistPort({ content: () => FULL_ANSWER }));
    const started = service.start({ goal: GOAL, userId: 'user-1' });
    await expect(service.resume(started.runId, 'user-1', 'clarify')).rejects.toThrow();
  });

  it('lists runs and patterns', async () => {
    const { service } = app(new FakeSpecialistPort());
    service.start({ goal: GOAL, userId: 'user-1' });
    expect(service.listRuns('user-1').length).toBe(1);
    expect(service.listRuns('user-2')).toHaveLength(0);
    const patterns = service.listPatterns();
    expect(patterns.map((p) => p.id)).toContain('abap-debugger');
    expect(patterns.map((p) => p.id)).toContain('app-builder');
  });

  it('runs synchronously for deterministic tests', async () => {
    const { service } = app(
      new FakeSpecialistPort({ content: () => FULL_ANSWER, evidenceState: 'SUFFICIENT_EVIDENCE' }),
    );
    const run = await service.runSync({ goal: GOAL, userId: 'user-1' });
    expect(run.terminationReason).toBe('SUCCESS');
    expect(run.status).toBe('completed');
  });

  it('rejects an empty goal', () => {
    const { service } = app(new FakeSpecialistPort());
    expect(() => service.start({ goal: '  ', userId: 'user-1' })).toThrow();
  });
});
