// ──────────────────────────────────────────────────────────────────
// VedMoulya — FINAL-04: Durable Execution Learning
//
// Proves the production learning path survives process recreation and
// that a persistence FAILURE is observable — learning is never silently
// reported as saved when the durable write failed:
//   A. execution learning survives repository/process recreation (a brand
//      new service over the SAME enterprise memory repository),
//   P. persistence failure is observable (observer hook) and honest (the
//      ingest rethrows instead of claiming a save),
//   plus: no plaintext secrets are persisted into durable learning records.
// ──────────────────────────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import { InMemoryMemoryRepository } from '@vedmoulya/memory-intelligence';
import { ExecutionMemoryService } from '../application/ExecutionMemoryService.js';
import { MemoryIntelligenceStoreAdapter } from '../infrastructure/MemoryIntelligenceStoreAdapter.js';
import type { ExecutionMemoryStore } from '../contracts/execution-memory-ports.js';
import type { MemoryEntry } from '../types/execution-memory-types.js';
import { makeCompletedRun } from './fixtures.js';

/**
 * A store whose durable WRITE always fails (database outage model). Reads
 * behave like an empty store, so the failure is isolated to the save — the
 * exact path that must be observable.
 */
function failingStore(): ExecutionMemoryStore {
  return {
    save: () => Promise.reject(new Error('database unavailable')),
    get: () => Promise.resolve(undefined),
    getByFingerprint: () => Promise.resolve(undefined),
    list: () => Promise.resolve([]),
    delete: () => Promise.resolve(),
  };
}

/** Minimal in-memory store that records delete failures (for delete coverage). */
class DeleteFailingStore implements ExecutionMemoryStore {
  private readonly entries = new Map<string, MemoryEntry>();
  async save(entry: MemoryEntry): Promise<void> {
    this.entries.set(entry.entryId, entry);
  }
  async get(entryId: string): Promise<MemoryEntry | undefined> {
    return this.entries.get(entryId);
  }
  async getByFingerprint(fingerprint: string): Promise<MemoryEntry | undefined> {
    for (const entry of this.entries.values()) {
      if (entry.fingerprint === fingerprint) return entry;
    }
    return undefined;
  }
  async list(): Promise<MemoryEntry[]> {
    return [...this.entries.values()];
  }
  async delete(): Promise<void> {
    throw new Error('delete rejected by store');
  }
}

describe('FINAL-04 — durable execution learning survives process recreation (A)', () => {
  it('a brand-new service over the SAME repository sees the learned memory (owner-scoped preserved)', async () => {
    const repository = new InMemoryMemoryRepository();

    // ── Process A: learn from a real verified run. ──
    const first = new ExecutionMemoryService({
      store: new MemoryIntelligenceStoreAdapter(repository),
    });
    const { run, traces } = makeCompletedRun({
      userId: 'user-1',
      outcome: 'ACHIEVED',
      actionTraces: [
        { stepId: 'step-1', toolName: 'test-runner', status: 'succeeded', verdict: 'VERIFIED' },
      ],
    });
    const ingest = await first.ingestRun(run, traces, { knownTools: ['test-runner'] });
    expect(ingest.accepted.length).toBeGreaterThan(0);

    // ── Process B (recreation): a FRESH service + FRESH adapter over the
    //    SAME durable repository — no shared in-process object. ──
    const restarted = new ExecutionMemoryService({
      store: new MemoryIntelligenceStoreAdapter(repository),
    });
    const entries = await restarted.listEntries();
    expect(entries.length).toBe(ingest.accepted.length);
    const tool = entries.find((entry) => entry.category === 'TOOL_RELIABILITY');
    expect(tool?.subject).toBe('test-runner');
    expect(tool?.sampleCount).toBe(1);

    // Mission/owner scoping survived: the learning is retrievable for the
    // owning user, and a user-scoped entry never leaks to another user.
    await restarted.recordUserPreference({
      userId: 'user-1',
      subject: 'outputFormat',
      value: 'docx',
      source: 'user-request',
    });
    const own = await restarted.retrieve({ userId: 'user-1', tools: ['test-runner'], limit: 10 });
    expect(own.length).toBeGreaterThan(0);
    const foreign = await restarted.retrieve({ userId: 'user-2', limit: 10 });
    expect(foreign.some((e) => e.scope === 'USER')).toBe(false);
  });

  it('aggregates across process recreation instead of duplicating the entry', async () => {
    const repository = new InMemoryMemoryRepository();
    const run = makeCompletedRun({
      outcome: 'ACHIEVED',
      actionTraces: [
        { stepId: 'step-1', toolName: 'test-runner', status: 'succeeded', verdict: 'VERIFIED' },
      ],
    });

    // Process A learns once; process B (fresh) learns the same evidence again.
    const a = new ExecutionMemoryService({
      store: new MemoryIntelligenceStoreAdapter(repository),
    });
    await a.ingestRun(run.run, run.traces, { knownTools: ['test-runner'] });
    const b = new ExecutionMemoryService({
      store: new MemoryIntelligenceStoreAdapter(repository),
    });
    await b.ingestRun(run.run, run.traces, { knownTools: ['test-runner'] });

    const entries = await b.listEntries({ category: 'TOOL_RELIABILITY' });
    expect(entries).toHaveLength(1);
    expect(entries[0]?.sampleCount).toBe(2);
  });
});

describe('FINAL-04 — persistence failures are observable and honest (P)', () => {
  it('surfaces a failed durable save to the observer AND rethrows (no fabricated save)', async () => {
    const failures: Array<{ operation: string; fingerprint?: string }> = [];
    const service = new ExecutionMemoryService({
      store: failingStore(),
      observer: {
        onPersistenceFailure: (_error, context) => {
          failures.push({ operation: context.operation, fingerprint: context.fingerprint });
        },
      },
    });
    const { run, traces } = makeCompletedRun({
      outcome: 'ACHIEVED',
      actionTraces: [
        { stepId: 'step-1', toolName: 'test-runner', status: 'succeeded', verdict: 'VERIFIED' },
      ],
    });

    await expect(service.ingestRun(run, traces, { knownTools: ['test-runner'] })).rejects.toThrow(
      'database unavailable',
    );
    expect(failures.length).toBeGreaterThan(0);
    expect(failures[0]?.operation).toBe('save');
    expect(failures[0]?.fingerprint).toBeTruthy();
  });

  it('surfaces a failed preference save and a failed delete honestly', async () => {
    const failures: string[] = [];
    const saving = new ExecutionMemoryService({
      store: failingStore(),
      observer: {
        onPersistenceFailure: (_error, context) => {
          failures.push(`${context.operation}:${context.entryId ?? ''}`);
        },
      },
    });
    await expect(
      saving.recordUserPreference({
        userId: 'user-1',
        subject: 'theme',
        value: 'dark',
        source: 'user-request',
      }),
    ).rejects.toThrow('database unavailable');
    expect(failures.some((f) => f.startsWith('save:'))).toBe(true);

    const deleting = new ExecutionMemoryService({
      store: new DeleteFailingStore(),
      observer: {
        onPersistenceFailure: (_error, context) => {
          failures.push(`${context.operation}:${context.entryId ?? ''}`);
        },
      },
    });
    await expect(deleting.deleteEntry('mem-1')).rejects.toThrow('delete rejected by store');
    expect(failures).toContain('delete:mem-1');
  });
});

describe('FINAL-04 — no plaintext secrets in durable learning records (Part 14)', () => {
  it('sanitizes secrets out of the evidence before it is persisted', async () => {
    const repository = new InMemoryMemoryRepository();
    const service = new ExecutionMemoryService({
      store: new MemoryIntelligenceStoreAdapter(repository),
    });
    const planted = 'sk-live-SUPERSECRET-abcdef1234567890';
    const { run, traces } = makeCompletedRun({
      outcome: 'ACHIEVED',
      error: `provider rejected the request (authorization: Bearer ${planted})`,
      actionTraces: [
        { stepId: 'step-1', toolName: 'test-runner', status: 'succeeded', verdict: 'VERIFIED' },
      ],
    });
    await service.ingestRun(run, traces, { knownTools: ['test-runner'] });

    const persisted = JSON.stringify(await repository.listAllItems());
    expect(persisted).not.toContain(planted);
  });
});
