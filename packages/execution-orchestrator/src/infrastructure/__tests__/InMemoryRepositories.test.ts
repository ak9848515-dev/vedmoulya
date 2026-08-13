// ──────────────────────────────────────────────────────────────────
// VedMoulya — Execution Orchestrator Tests: In-Memory Repositories
// EI-005 — Enterprise Execution Orchestrator
// ──────────────────────────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import { InMemoryExecutionGraphRepository } from '../InMemoryExecutionGraphRepository.js';
import { InMemoryExecutionSessionRepository } from '../InMemoryExecutionSessionRepository.js';
import { InMemoryExecutionQueueRepository } from '../InMemoryExecutionQueueRepository.js';
import { InMemoryExecutionHistoryRepository } from '../InMemoryExecutionHistoryRepository.js';
import { InMemoryWorkerRegistry } from '../InMemoryWorkerRegistry.js';
import { ExecutionGraphBuilderService } from '../../domain/services/ExecutionGraphBuilderService.js';
import { createBlogGraphInput, createCatalogWorkers } from '../../catalog/orchestrator-catalog.js';
import { createSessionId, createWorkerId } from '../../domain/value-objects/Identifiers.js';
import type {
  ExecutionGraph,
  ExecutionSession,
  ExecutionQueue,
} from '../../types/orchestrator-types.js';

describe('InMemory graph + session repositories', () => {
  it('persists and retrieves graphs by id and strategy', async () => {
    const repo = new InMemoryExecutionGraphRepository();
    const graph = new ExecutionGraphBuilderService().build(createBlogGraphInput());
    await repo.save(graph);
    const found = await repo.findById(graph.graphId as never);
    expect(found?.graphId).toBe(graph.graphId);
    expect(await repo.exists(graph.graphId as never)).toBe(true);
    const byStrategy = await repo.findByStrategy('strategy_blog_seed');
    expect(byStrategy).toHaveLength(1);
    expect((await repo.listAll()).length).toBe(1);
    expect(await repo.delete(graph.graphId as never)).toBe(true);
    expect(await repo.exists(graph.graphId as never)).toBe(false);
  });

  it('persists sessions and lists by status', async () => {
    const repo = new InMemoryExecutionSessionRepository();
    const session: ExecutionSession = {
      sessionId: 'session_s1',
      strategyId: 'strategy_x',
      graphId: 'graph_g1',
      currentStage: 'stage_1',
      status: 'running',
      progress: 0.5,
      results: {},
      events: [],
      updatedAt: new Date().toISOString(),
      checkpoints: [],
    };
    await repo.save(session);
    expect((await repo.findById(createSessionId('session_s1')))?.status).toBe('running');
    expect((await repo.listByStatus('running')).length).toBe(1);
    expect((await repo.listByStrategy('strategy_x')).length).toBe(1);
    expect(await repo.exists(createSessionId('session_s1'))).toBe(true);
    expect(await repo.delete(createSessionId('session_s1'))).toBe(true);
  });
});

describe('InMemory queue + history repositories', () => {
  it('saves a queue and finds it by session', async () => {
    const repo = new InMemoryExecutionQueueRepository();
    const queue: ExecutionQueue = {
      queueId: 'queue_session_q1',
      entries: [
        {
          entryId: 'entry_1',
          nodeId: 'node_a',
          sessionId: 'session_q1',
          kind: 'sequential',
          priority: 3,
          availableAt: new Date().toISOString(),
          attempts: 0,
          metadata: {},
        },
      ],
    };
    await repo.save(queue);
    const found = await repo.findBySession(createSessionId('session_q1'));
    expect(found?.entries).toHaveLength(1);
    await repo.enqueue('queue_session_q1', {
      entryId: 'entry_2',
      nodeId: 'node_b',
      sessionId: 'session_q1',
      kind: 'parallel',
      priority: 1,
      availableAt: new Date().toISOString(),
      attempts: 0,
      metadata: {},
    });
    expect((await repo.findBySession(createSessionId('session_q1')))?.entries).toHaveLength(2);
    await repo.dequeue('queue_session_q1', 'entry_1');
    expect((await repo.findBySession(createSessionId('session_q1')))?.entries).toHaveLength(1);
  });

  it('saves history records with aggregates', async () => {
    const repo = new InMemoryExecutionHistoryRepository();
    await repo.save({
      sessionId: 'session_h1',
      events: [],
      results: {},
      recoveryActions: [],
      summary: {
        completed: 3,
        failed: 1,
        skipped: 0,
        totalCostUsd: 1.2,
        totalTokens: 9000,
        totalLatencyMs: 5000,
      },
      updatedAt: new Date().toISOString(),
    });
    const found = await repo.findBySession(createSessionId('session_h1'));
    expect(found?.summary.completed).toBe(3);
    expect((await repo.listAll()).length).toBe(1);
  });
});

describe('InMemoryWorkerRegistry', () => {
  it('registers, lists, and filters workers by kind', async () => {
    const registry = new InMemoryWorkerRegistry();
    for (const w of createCatalogWorkers()) await registry.register(w);
    expect((await registry.listAll()).length).toBe(11);
    expect((await registry.listByKind('review')).length).toBe(1);
  });

  it('claims the least-loaded idle worker for a capability', async () => {
    const registry = new InMemoryWorkerRegistry();
    for (const w of createCatalogWorkers()) await registry.register(w);
    const claimed = await registry.claim('content_generation');
    expect(claimed).toBeDefined();
    expect(claimed?.capabilities).toContain('content_generation');
    expect(claimed?.activeTasks).toBe(1);
  });

  it('claims a different worker when the first is busy', async () => {
    const registry = new InMemoryWorkerRegistry();
    for (const w of createCatalogWorkers()) await registry.register(w);
    // Writing worker has concurrency 3; claiming 4 times must spill to publishing.
    const ids = new Set<string>();
    for (let i = 0; i < 4; i++) {
      const claimed = await registry.claim('content_generation');
      expect(claimed).toBeDefined();
      ids.add(claimed?.workerId ?? '');
    }
    expect(ids.size).toBeGreaterThan(1);
  });

  it('releases a worker back to idle', async () => {
    const registry = new InMemoryWorkerRegistry();
    for (const w of createCatalogWorkers()) await registry.register(w);
    const claimed = await registry.claim('reasoning');
    expect(claimed?.activeTasks).toBe(1);
    await registry.release(createWorkerId(claimed?.workerId ?? ''));
    const reloaded = await registry.findById(createWorkerId(claimed?.workerId ?? ''));
    expect(reloaded?.activeTasks).toBe(0);
    expect(reloaded?.status).toBe('idle');
  });

  it('returns undefined when no worker can run a capability', async () => {
    const registry = new InMemoryWorkerRegistry();
    for (const w of createCatalogWorkers()) await registry.register(w);
    const claimed = await registry.claim('speech');
    expect(claimed).toBeUndefined();
  });
});

describe('Graph + session repository round-trip via builder', () => {
  it('persists a full built graph (deep-clone safety)', async () => {
    const repo = new InMemoryExecutionGraphRepository();
    const graph: ExecutionGraph = new ExecutionGraphBuilderService().build(createBlogGraphInput());
    await repo.save(graph);
    // Mutate the local copy — stored copy must be unaffected.
    graph.nodes[0]!.label = 'MUTATED';
    const stored = await repo.findById(graph.graphId as never);
    expect(stored?.nodes[0]?.label).not.toBe('MUTATED');
  });
});
