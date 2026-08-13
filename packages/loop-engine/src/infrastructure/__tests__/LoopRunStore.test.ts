import { describe, expect, it } from 'vitest';
import { InMemoryLoopRunStore } from '../LoopRunStore.js';
import type { LoopRun } from '../../types/loop-types.js';

function run(id: string, userId = 'u1', createdAt = '2026-01-01T00:00:00.000Z'): LoopRun {
  return {
    runId: id,
    goalId: 'g',
    userId,
    goal: 'goal',
    specification: {} as LoopRun['specification'],
    graph: {
      goalId: 'g',
      tasks: [],
      entryTaskIds: [],
      terminalTaskIds: [],
      validated: true,
      validationReasons: [],
      createdAt: '',
      version: '1',
    },
    steps: [],
    budgetConfig: {
      maxIterations: 8,
      maxTokens: 8_000,
      maxCostUsd: 1,
      maxLatencyMs: 300_000,
      maxProviderCalls: 32,
      maxToolCalls: 16,
    },
    budgetUsage: {
      tokensInput: 0,
      tokensOutput: 0,
      tokensTotal: 0,
      costUsd: 0,
      latencyMs: 0,
      providerCalls: 0,
      toolCalls: 0,
      iterations: 0,
    },
    status: 'pending',
    evidenceStates: [],
    proposedMemories: [],
    createdAt,
    updatedAt: createdAt,
  };
}

describe('InMemoryLoopRunStore', () => {
  it('saves, reads, lists and deletes runs', () => {
    const store = new InMemoryLoopRunStore();
    store.save(run('a', 'u1', '2026-01-02T00:00:00.000Z'));
    store.save(run('b', 'u1', '2026-01-01T00:00:00.000Z'));
    store.save(run('c', 'u2'));
    expect(store.get('a')?.userId).toBe('u1');
    expect(store.get('nope')).toBeUndefined();
    // Newest first.
    expect(store.list('u1').map((r) => r.runId)).toEqual(['a', 'b']);
    expect(store.list().map((r) => r.runId)).toEqual(['a', 'b', 'c']);
    expect(store.delete('c')).toBe(true);
    expect(store.delete('c')).toBe(false);
  });

  it('overwrites on re-save (checkpoint updates)', () => {
    const store = new InMemoryLoopRunStore();
    const r = run('a');
    store.save(r);
    store.save({ ...r, status: 'completed' });
    expect(store.get('a')?.status).toBe('completed');
  });
});
