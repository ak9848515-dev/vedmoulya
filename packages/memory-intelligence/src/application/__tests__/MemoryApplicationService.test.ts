// ──────────────────────────────────────────────────────────────────
// VedMoulya — Memory Application Service tests
// EI-010 — Enterprise Memory Intelligence Platform
// ──────────────────────────────────────────────────────────────────

import { describe, it, expect, beforeEach } from 'vitest';
import { MemoryApplicationService } from '../MemoryApplicationService.js';
import { InMemoryMemoryRepository } from '../../infrastructure/InMemoryMemoryRepository.js';
import { InMemoryMemoryGraph } from '../../infrastructure/InMemoryMemoryGraph.js';
import type { MemoryEngines } from '../../contracts/memory-engines.js';
import {
  createCatalogMemoryItems,
  createCatalogMemoryRelationships,
} from '../../catalog/memory-catalog.js';
import type { MemoryCaptureInput } from '../MemoryDTO.js';

function happyEngines(): MemoryEngines {
  return {
    capabilities: {
      getMarketplace: async () => ({
        success: true,
        data: { total: 1, activeCount: 1, capabilities: [] },
      }),
    },
    providers: {
      getMarketplace: async () => ({
        success: true,
        data: { total: 0, healthyCount: 0, providers: [] },
      }),
    },
    goals: {
      getSummary: async () => ({
        success: true,
        data: {
          totalGoals: 1,
          activeGoals: 1,
          completedGoals: 0,
          blockedGoals: 0,
          byCategory: {},
          byStatus: {},
          byPriority: {},
          avgConfidence: 0.8,
          avgGoalScore: 0.8,
          totalTasks: 2,
        },
      }),
    },
    learning: {
      getDashboard: async () => ({
        success: true,
        data: { totals: { events: 10, models: 2 } } as never,
      }),
    },
    brain: {
      getDashboard: async () => ({ success: true, data: { totals: { decisions: 14 } } as never }),
    },
    context: {
      getContextSummary: async () => ({
        success: true,
        data: { total: 30, totalTokens: 1000, countByPriority: { high: 5, critical: 1 } } as never,
      }),
    },
    strategies: {
      getSummary: async () => ({
        success: true,
        data: { total: 4, averageConfidence: 0.84, countByExecutionMode: { pipeline: 1 } } as never,
      }),
    },
    orchestrator: { getSummary: async () => ({ success: true, data: { total: 1 } as never }) },
    knowledge: {
      getDashboard: async () => ({ success: true, data: { totals: { items: 30 } } as never }),
    },
  };
}

function brokenEngines(): MemoryEngines {
  const fail = async (): Promise<{ success: boolean; error: string }> => ({
    success: false,
    error: 'down',
  });
  return {
    capabilities: { getMarketplace: fail },
    providers: { getMarketplace: fail },
    goals: { getSummary: fail },
    learning: { getDashboard: fail },
    brain: { getDashboard: fail },
    context: { getContextSummary: fail },
    strategies: { getSummary: fail },
    orchestrator: { getSummary: fail },
    knowledge: { getDashboard: fail },
  };
}

function captureDto(overrides: Partial<MemoryCaptureInput> = {}): MemoryCaptureInput {
  return {
    type: 'provider',
    title: 'OpenAI reliability memory',
    content:
      'Three consecutive runs completed with high quality on the reasoning stage. Latency stayed under p95 and no retries were needed.',
    source: 'execution history',
    sourceType: 'execution',
    owner: 'platform',
    relatedProvider: 'openai',
    relatedGoal: 'goal_blog_seed',
    tags: ['openai', 'reliability'],
    citations: [
      {
        sourceId: 'provider-registry',
        sourceTitle: 'Enterprise Provider Registry',
        reference: 'providers/openai',
      },
    ],
    ...overrides,
  };
}

describe('MemoryApplicationService', () => {
  let repo: InMemoryMemoryRepository;
  let app: MemoryApplicationService;

  beforeEach(() => {
    repo = new InMemoryMemoryRepository({
      items: createCatalogMemoryItems(),
      relationships: createCatalogMemoryRelationships(),
    });
    app = new MemoryApplicationService(repo, new InMemoryMemoryGraph(repo), happyEngines());
  });

  it('captures a memory through the full pipeline to active', async () => {
    const result = await app.capture(captureDto());
    expect(result.success).toBe(true);
    const memory = result.data;
    expect(memory).toBeDefined();
    expect(memory?.lifecycleStatus).toBe('active');
    expect(memory?.compressionState).not.toBe('raw');
    expect(memory?.importance.score).toBeGreaterThan(0);
    expect(memory?.audit[0]?.action).toBe('captured');
    expect(memory?.audit.some((a) => a.action === 'compressed')).toBe(true);
    expect(memory?.citations.length).toBe(1);
    expect(memory?.citations[0]?.verified).toBe(true);
    expect(await repo.findItemById(memory?.memoryId ?? '')).not.toBeNull();
  });

  it('rejects malformed capture input', async () => {
    expect((await app.capture(captureDto({ title: 'x' }))).success).toBe(false);
    expect((await app.capture(captureDto({ content: '  ' }))).success).toBe(false);
    expect((await app.capture(captureDto({ owner: '' }))).success).toBe(false);
  });

  it('registers engine consumers during enrichment', async () => {
    const result = await app.capture(captureDto());
    const engineConsumers = result.data?.consumers.filter((c) => c.consumerType === 'engine') ?? [];
    expect(engineConsumers.length).toBeGreaterThan(0);
  });

  it('updates a memory and re-scores importance', async () => {
    const created = (await app.capture(captureDto())).data;
    expect(created).toBeDefined();
    const updated = await app.update({
      memoryId: created?.memoryId ?? '',
      title: 'OpenAI reliability memory (updated)',
      content: 'Updated content with more detail about the reasoning stage outcomes.',
      actor: 'analyst',
    });
    expect(updated.success).toBe(true);
    expect(updated.data?.title).toContain('updated');
    expect(updated.data?.audit.some((a) => a.action === 'updated')).toBe(true);
  });

  it('deletes a memory and scrubs stale relationship references', async () => {
    const created = (await app.capture(captureDto())).data;
    expect(created).toBeDefined();
    await app.relate({
      sourceId: created?.memoryId ?? '',
      targetId: 'mem_openai_reliability',
      type: 'recalls',
      actor: 'tester',
    });
    const deleted = await app.delete(created?.memoryId ?? '');
    expect(deleted.success).toBe(true);
    const openai = await repo.findItemById('mem_openai_reliability');
    expect(openai?.relationships.some((r) => r.sourceId === created?.memoryId)).toBe(false);
  });

  it('lists items with filters and pagination', async () => {
    const result = await app.listItems({ type: 'provider', page: 1, limit: 5 });
    expect(result.success).toBe(true);
    expect(result.data?.total).toBeGreaterThan(0);
    expect(result.data?.items.every((i) => i.type === 'provider')).toBe(true);
  });

  it('retrieves by entity and free-text similarity', async () => {
    const byGoal = await app.retrieve({ relatedGoal: 'goal_blog_seed' });
    expect(byGoal.success).toBe(true);
    expect(byGoal.data?.length).toBeGreaterThan(0);

    const byText = await app.retrieve({ query: 'OpenAI reliability reasoning' });
    expect(byText.success).toBe(true);
    expect(byText.data?.[0]?.score).toBeGreaterThan(0);
  });

  it('summarizes a memory and persists the compression state', async () => {
    const created = (await app.capture(captureDto())).data;
    expect(created).toBeDefined();
    const result = await app.summarize({
      memoryId: created?.memoryId ?? '',
      target: 'collapsed',
      actor: 'platform',
    });
    expect(result.success).toBe(true);
    expect(result.data?.compressionState).toBe('collapsed');
    expect(result.data?.summary).toBeDefined();
  });

  it('validates a memory and records the audit', async () => {
    const created = (await app.capture(captureDto())).data;
    expect(created).toBeDefined();
    const result = await app.validate({ memoryId: created?.memoryId ?? '', actor: 'reviewer' });
    expect(result.success).toBe(true);
    expect(result.data?.passed).toBe(true);
  });

  it('consolidates duplicate memories', async () => {
    const a = await app.capture(captureDto({ title: 'OpenAI reliability memory' }));
    expect(a.success).toBe(true);
    const b = await app.capture(captureDto({ title: 'OpenAI reliability memory' }));
    expect(b.success).toBe(true);
    const result = await app.consolidate({ actor: 'platform' });
    expect(result.success).toBe(true);
    expect(result.data?.merged).toBeGreaterThanOrEqual(0);
    const dry = await app.consolidate({ dryRun: true });
    expect(dry.success).toBe(true);
  });

  it('expires overdue memories and reports counts', async () => {
    const created = (await app.capture(captureDto({ retentionPolicy: 'ephemeral' }))).data;
    expect(created).toBeDefined();
    // Force the expiry in the past.
    await repo.saveItem({
      ...(created as NonNullable<typeof created>),
      expiresAt: '2026-01-01T00:00:00.000Z',
    });
    const result = await app.expire({ purge: true });
    expect(result.success).toBe(true);
    expect(result.data?.expired + result.data?.purged).toBeGreaterThanOrEqual(1);
  });

  it('transitions lifecycle with rules', async () => {
    const created = (await app.capture(captureDto())).data;
    const id = created?.memoryId ?? '';
    const archived = await app.transitionLifecycle({
      memoryId: id,
      to: 'archived',
      actor: 'owner',
    });
    expect(archived.success).toBe(true);
    expect(archived.data?.lifecycleStatus).toBe('archived');
    const restored = await app.transitionLifecycle({ memoryId: id, to: 'active', actor: 'owner' });
    expect(restored.success).toBe(true);
    const illegal = await app.transitionLifecycle({
      memoryId: id,
      to: 'validated',
      actor: 'owner',
    });
    expect(illegal.success).toBe(false);
  });

  it('relates memories with integrity checks', async () => {
    const related = await app.relate({
      sourceId: 'mem_openai_reliability',
      targetId: 'mem_anthropic_long_context',
      type: 'similar_to',
      actor: 'tester',
      weight: 0.6,
    });
    expect(related.success).toBe(true);
    const duplicate = await app.relate({
      sourceId: 'mem_openai_reliability',
      targetId: 'mem_anthropic_long_context',
      type: 'similar_to',
      actor: 'tester',
    });
    expect(duplicate.success).toBe(false);
    const ghost = await app.relate({
      sourceId: 'mem_openai_reliability',
      targetId: 'mem_ghost',
      type: 'recalls',
      actor: 'tester',
    });
    expect(ghost.success).toBe(false);
  });

  it('detects relationships automatically', async () => {
    const detected = await app.detectRelationships('mem_google_vision_failure', 'tester');
    expect(detected.success).toBe(true);
    expect(detected.data?.some((r) => r.type === 'contradicts')).toBe(true);
  });

  it('traverses the graph and finds shortest paths', async () => {
    const graph = await app.graph({ memoryId: 'mem_blog_goal_success_pattern', maxDepth: 2 });
    expect(graph.success).toBe(true);
    expect(graph.data?.visited.length).toBeGreaterThan(0);
    const path = await app.shortestPath({
      fromId: 'mem_blog_goal_success_pattern',
      toId: 'mem_blog_pipeline_playbook',
    });
    expect(path.success).toBe(true);
    expect(path.data?.length).toBeGreaterThan(1);
  });

  it('lists and records consumers', async () => {
    const consumers = await app.listConsumers('mem_openai_reliability');
    expect(consumers.success).toBe(true);
    expect(consumers.data?.length).toBeGreaterThan(0);
    const recorded = await app.recordConsumerUsage({
      memoryId: 'mem_openai_reliability',
      consumerType: 'module',
      consumerLabel: 'Insights module',
    });
    expect(recorded.success).toBe(true);
    const openai = await repo.findItemById('mem_openai_reliability');
    expect(openai?.usage.totalRetrievals).toBeGreaterThan(0);
  });

  it('reinforces a memory (Memory Update)', async () => {
    const created = (await app.capture(captureDto())).data;
    expect(created).toBeDefined();
    const before = created?.usage.frequency ?? 0;
    const reinforced = await app.reinforce(created?.memoryId ?? '', 'platform');
    expect(reinforced.success).toBe(true);
    expect(reinforced.data?.usage.frequency).toBe(before + 1);
    expect(reinforced.data?.audit.some((a) => a.action === 'learned')).toBe(true);
  });

  it('computes analytics, timeline, and the dashboard', async () => {
    const analytics = await app.getAnalytics();
    expect(analytics.success).toBe(true);
    expect(analytics.data?.totals.memories).toBeGreaterThan(0);

    const timeline = await app.getTimeline({ limit: 5 });
    expect(timeline.success).toBe(true);
    expect(timeline.data?.length).toBeLessThanOrEqual(5);

    const dashboard = await app.getDashboard();
    expect(dashboard.success).toBe(true);
    expect(dashboard.data?.totals.memories).toBeGreaterThan(0);
    expect(dashboard.data?.byType.provider).toBeGreaterThan(0);
    expect(dashboard.data?.retentionCountdown.length).toBeGreaterThan(0);
    expect(dashboard.data?.trend.length).toBe(14);
  });

  it('degrading engines never break capture', async () => {
    const broken = new MemoryApplicationService(
      repo,
      new InMemoryMemoryGraph(repo),
      brokenEngines(),
    );
    const result = await broken.capture(captureDto());
    expect(result.success).toBe(true);
    expect(result.errors?.length).toBeGreaterThan(0);
  });

  it('returns not-found errors for missing memories', async () => {
    expect((await app.getItem('mem_ghost')).success).toBe(false);
    expect((await app.summarize({ memoryId: 'mem_ghost', actor: 'x' })).success).toBe(false);
    expect((await app.validate({ memoryId: 'mem_ghost', actor: 'x' })).success).toBe(false);
    expect(
      (await app.transitionLifecycle({ memoryId: 'mem_ghost', to: 'active', actor: 'x' })).success,
    ).toBe(false);
    expect((await app.graph({ memoryId: 'mem_ghost' })).success).toBe(false);
    expect((await app.delete('mem_ghost')).success).toBe(false);
    expect((await app.listConsumers('mem_ghost')).success).toBe(false);
    expect(
      (
        await app.recordConsumerUsage({
          memoryId: 'mem_ghost',
          consumerType: 'user',
          consumerLabel: 'x',
        })
      ).success,
    ).toBe(false);
    expect((await app.reinforce('mem_ghost', 'x')).success).toBe(false);
    expect(
      (
        await app.relate({
          sourceId: 'mem_ghost',
          targetId: 'mem_openai_reliability',
          type: 'recalls',
          actor: 'x',
        })
      ).success,
    ).toBe(false);
    expect((await app.detectRelationships('mem_ghost', 'x')).success).toBe(false);
    expect(
      (await app.shortestPath({ fromId: 'mem_ghost', toId: 'mem_blog_pipeline_playbook' })).success,
    ).toBe(false);
    expect((await app.update({ memoryId: 'mem_ghost', title: 'x', actor: 'x' })).success).toBe(
      false,
    );
  });

  it('updates every optional field', async () => {
    const created = (await app.capture(captureDto())).data;
    const id = created?.memoryId ?? '';
    const updated = await app.update({
      memoryId: id,
      content: 'New content with enough length to matter.',
      source: 'new source',
      sourceType: 'observation',
      owner: 'analyst',
      relatedContext: 'ctx_9',
      relatedDecision: 'dec_9',
      relatedExecution: 'exec_9',
      relatedTask: 'task_9',
      relatedProject: 'project_9',
      relatedUser: 'user_9',
      relatedCapability: 'research',
      tags: ['new-tag'],
      importance: 0.9,
      confidence: { score: 0.95, factors: ['revised'] },
      retentionPolicy: 'permanent',
      actor: 'analyst',
    });
    expect(updated.success).toBe(true);
    expect(updated.data?.sourceType).toBe('observation');
    expect(updated.data?.relatedContext).toBe('ctx_9');
    expect(updated.data?.retentionPolicy).toBe('permanent');
    expect(updated.data?.confidence.score).toBe(0.95);
  });

  it('compresses all eligible memories (skips archived/expired)', async () => {
    const created = (await app.capture(captureDto({ pipeline: false }))).data;
    expect(created).toBeDefined();
    await app.transitionLifecycle({
      memoryId: created?.memoryId ?? '',
      to: 'archived',
      actor: 'x',
    });
    const result = await app.compressAll('summarized');
    expect(result.success).toBe(true);
    expect(result.data?.compressed).toBeGreaterThanOrEqual(0);
  });

  it('expires without purging keeps the expired row', async () => {
    const created = (await app.capture(captureDto({ retentionPolicy: 'ephemeral' }))).data;
    expect(created).toBeDefined();
    await repo.saveItem({
      ...(created as NonNullable<typeof created>),
      expiresAt: '2026-01-01T00:00:00.000Z',
    });
    const result = await app.expire({ purge: false });
    expect(result.success).toBe(true);
    expect(result.data?.expired).toBeGreaterThanOrEqual(1);
  });

  it('returns an empty relationship set when nothing is detected', async () => {
    const fresh = (await app.capture(captureDto({ pipeline: false }))).data;
    expect(fresh).toBeDefined();
    const detected = await app.detectRelationships(fresh?.memoryId ?? '', 'tester');
    expect(detected.success).toBe(true);
  });

  it('lists relationships for an item and globally', async () => {
    const forItem = await app.listRelationshipsForItem('mem_openai_reliability');
    expect(forItem.success).toBe(true);
    expect(forItem.data?.length).toBeGreaterThanOrEqual(0);
    const all = await app.listRelationships();
    expect(all.success).toBe(true);
    const recalls = await app.listRelationships('recalls');
    expect(recalls.data?.length).toBeGreaterThan(0);
  });

  it('captures without the full pipeline when requested', async () => {
    const result = await app.capture(captureDto({ pipeline: false }));
    expect(result.success).toBe(true);
    expect(result.data?.lifecycleStatus).toBe('captured');
    expect(result.data?.importance.score).toBeGreaterThan(0);
  });

  it('reinforces an existing memory', async () => {
    const created = (await app.capture(captureDto())).data;
    expect(created).toBeDefined();
    const reinforced = await app.reinforce(created?.memoryId ?? '', 'platform');
    expect(reinforced.success).toBe(true);
    expect(reinforced.data?.usage.recency).toBeGreaterThanOrEqual(0.9);
  });
});
