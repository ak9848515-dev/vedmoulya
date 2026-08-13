// ──────────────────────────────────────────────────────────────────
// VedMoulya — Knowledge Application Service tests
// EI-009 — Enterprise Knowledge Intelligence Platform
// ──────────────────────────────────────────────────────────────────

import { describe, it, expect, beforeEach } from 'vitest';
import { KnowledgeApplicationService } from '../KnowledgeApplicationService.js';
import { InMemoryKnowledgeRepository } from '../../infrastructure/InMemoryKnowledgeRepository.js';
import { InMemoryKnowledgeGraph } from '../../infrastructure/InMemoryKnowledgeGraph.js';
import type { KnowledgeEngines } from '../../contracts/knowledge-engines.js';
import {
  createCatalogKnowledgeItems,
  createCatalogKnowledgeRelationships,
} from '../../catalog/knowledge-catalog.js';

function happyEngines(): KnowledgeEngines {
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
  };
}

function brokenEngines(): KnowledgeEngines {
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
  };
}

function createDto(overrides: Record<string, unknown> = {}) {
  return {
    title: 'Provider cost benchmark',
    description:
      'Cost per million tokens across providers, updated quarterly. Source reference: provider benchmark report.',
    source: 'provider benchmark report',
    sourceType: 'report',
    owner: 'platform-team',
    category: 'ai',
    tags: ['provider', 'cost', 'benchmark'],
    citations: [
      {
        sourceId: 'benchmark-report',
        sourceTitle: 'Provider benchmark report',
        reference: 'reports/provider-cost.md',
      },
    ],
    enrich: false,
    ...overrides,
  } as const;
}

describe('KnowledgeApplicationService', () => {
  let repo: InMemoryKnowledgeRepository;
  let app: KnowledgeApplicationService;

  beforeEach(() => {
    repo = new InMemoryKnowledgeRepository({
      items: createCatalogKnowledgeItems(),
      relationships: createCatalogKnowledgeRelationships(),
    });
    app = new KnowledgeApplicationService(repo, new InMemoryKnowledgeGraph(repo), happyEngines());
  });

  it('creates an item with trust scored, citations verified, and audit', async () => {
    const result = await app.create(createDto());
    expect(result.success).toBe(true);
    const item = result.data;
    expect(item).toBeDefined();
    expect(item?.trust.score).toBeGreaterThan(0);
    expect(item?.version).toBe(1);
    expect(item?.versionHistory.length).toBe(1); // initial registration snapshot
    expect(item?.validationStatus).toBe('pending');
    expect(item?.lifecycleStatus).toBe('draft');
    expect(item?.audit[0]?.action).toBe('created');
    expect(await repo.findItemById(item?.knowledgeId ?? '')).not.toBeNull();
  });

  it('rejects malformed create input', async () => {
    expect((await app.create(createDto({ title: 'x' }))).success).toBe(false);
    expect((await app.create(createDto({ description: '  ' }))).success).toBe(false);
    expect((await app.create(createDto({ owner: '' }))).success).toBe(false);
  });

  it('enriches by default (registers engine consumers) unless enrich: false', async () => {
    const enriched = await app.create(createDto({ enrich: true }));
    expect(enriched.data?.consumers.some((c) => c.consumerType === 'engine')).toBe(true);

    const plain = await app.create(createDto({ enrich: false }));
    expect(plain.data?.consumers.length ?? 0).toBe(0);
  });

  it('updates an item with a version snapshot and re-scored trust', async () => {
    const created = (await app.create(createDto())).data;
    expect(created).toBeDefined();
    const updated = await app.update({
      knowledgeId: created?.knowledgeId ?? '',
      title: 'Provider cost benchmark (2026)',
      description: 'Updated description.',
      actor: 'analyst',
    });
    expect(updated.success).toBe(true);
    expect(updated.data?.version).toBe(2);
    // v1 initial-registration snapshot + the pre-update snapshot.
    expect(updated.data?.versionHistory.length).toBe(2);
    expect(updated.data?.audit.some((a) => a.action === 'updated')).toBe(true);
  });

  it('deletes an item and scrubs stale relationship references', async () => {
    const created = (await app.create(createDto())).data;
    expect(created).toBeDefined();
    await app.relate({
      sourceId: 'kn_openai_provider_profile',
      targetId: created?.knowledgeId ?? '',
      type: 'related_to',
      actor: 'tester',
    });
    const deleted = await app.delete(created?.knowledgeId ?? '');
    expect(deleted.success).toBe(true);
    const openai = await repo.findItemById('kn_openai_provider_profile');
    expect(openai?.relationships.some((r) => r.targetId === created?.knowledgeId)).toBe(false);
  });

  it('lists items with pagination and filters', async () => {
    const result = await app.listItems({ category: 'sap', page: 1, limit: 5 });
    expect(result.success).toBe(true);
    expect(result.data?.total).toBeGreaterThan(0);
    expect(result.data?.items.every((i) => i.category === 'sap')).toBe(true);
  });

  it('searches across the registry', async () => {
    const result = await app.search({ query: 'provider profile' });
    expect(result.success).toBe(true);
    expect(result.data?.length).toBeGreaterThan(0);
    expect(result.data?.[0].score).toBeGreaterThan(0);
  });

  it('explains an item', async () => {
    const result = await app.explain('kn_openai_provider_profile');
    expect(result.success).toBe(true);
    expect(result.data?.why).toContain('OpenAI');
    expect(result.data?.rankingContributions.length).toBe(4);
    expect((await app.explain('kn_ghost')).success).toBe(false);
  });

  it('validates an item and persists the outcome', async () => {
    const created = (await app.create(createDto())).data;
    const report = await app.validate({
      knowledgeId: created?.knowledgeId ?? '',
      actor: 'reviewer',
    });
    expect(report.success).toBe(true);
    expect(report.data?.passed).toBe(true);
    const after = await repo.findItemById(created?.knowledgeId ?? '');
    expect(after?.validationStatus).toBe('validated');
  });

  it('validates items whose relationship targets resolve in the registry', async () => {
    const created = (await app.create(createDto())).data;
    expect(created).toBeDefined();
    await app.relate({
      sourceId: created?.knowledgeId ?? '',
      targetId: 'kn_openai_provider_profile',
      type: 'related_to',
      actor: 'tester',
    });
    const report = await app.validate({
      knowledgeId: created?.knowledgeId ?? '',
      actor: 'reviewer',
    });
    expect(report.success).toBe(true);
    expect(report.data?.passed).toBe(true);
  });

  it('creates versions, lists them, and diffs them', async () => {
    const created = (await app.create(createDto())).data;
    const id = created?.knowledgeId ?? '';
    await app.createVersion({ knowledgeId: id, changeSummary: 'Revision A', actor: 'owner' });
    await app.createVersion({ knowledgeId: id, changeSummary: 'Revision B', actor: 'owner' });
    const versions = await app.listVersions(id);
    // v1 initial-registration snapshot + Revision A + Revision B.
    expect(versions.data?.length).toBe(3);
    const one = await app.getVersion(id, 2);
    expect(one.data?.changeSummary).toBe('Revision A');
    const diff = await app.diff({ knowledgeId: id });
    expect(diff.success).toBe(true);
    expect(diff.data?.fromVersion).toBe(2);
    expect(diff.data?.toVersion).toBe(3);
  });

  it('relates items with integrity checks', async () => {
    const related = await app.relate({
      sourceId: 'kn_openai_provider_profile',
      targetId: 'kn_anthropic_provider_profile',
      type: 'uses',
      actor: 'tester',
      weight: 0.6,
    });
    expect(related.success).toBe(true);
    expect(related.data?.weight).toBe(0.6);

    const duplicate = await app.relate({
      sourceId: 'kn_openai_provider_profile',
      targetId: 'kn_anthropic_provider_profile',
      type: 'uses',
      actor: 'tester',
    });
    expect(duplicate.success).toBe(false);
    expect(duplicate.error).toContain('duplicate');

    const selfLoop = await app.relate({
      sourceId: 'kn_openai_provider_profile',
      targetId: 'kn_openai_provider_profile',
      type: 'related_to',
      actor: 'tester',
    });
    expect(selfLoop.success).toBe(false);

    const ghost = await app.relate({
      sourceId: 'kn_openai_provider_profile',
      targetId: 'kn_ghost',
      type: 'related_to',
      actor: 'tester',
    });
    expect(ghost.success).toBe(false);
  });

  it('detects relationships automatically', async () => {
    const benchmark = (await app.create(createDto())).data;
    expect(benchmark).toBeDefined();
    // Created with distinct tags + a description that references nothing, so
    // the create-time detection adds no edges.
    const guide = (
      await app.create(
        createDto({
          title: 'OpenAI pricing guide',
          description: 'Consolidated pricing notes for the OpenAI provider.',
          tags: ['pricing', 'openai', 'rates'],
          enrich: false,
        }),
      )
    ).data;
    expect(guide).toBeDefined();
    // The supersession reference arrives with an update — detection is not
    // re-run on update, so the explicit detect pass finds it.
    await app.update({
      knowledgeId: guide?.knowledgeId ?? '',
      description: `This pricing guide supersedes the ${benchmark?.title ?? 'benchmark'} and updates provider cost assumptions.`,
      version: false,
      actor: 'tester',
    });
    const detected = await app.detectRelationships(guide?.knowledgeId ?? '', 'tester');
    expect(detected.success).toBe(true);
    expect(
      detected.data?.some((r) => r.type === 'supersedes' && r.targetId === benchmark?.knowledgeId),
    ).toBe(true);
  });

  it('traverses the graph and finds shortest paths', async () => {
    const graph = await app.graph({ knowledgeId: 'kn_blog_pipeline_playbook', maxDepth: 2 });
    expect(graph.success).toBe(true);
    expect(graph.data?.visited.length).toBeGreaterThan(0);

    const path = await app.shortestPath({
      fromId: 'kn_blog_seed_goal',
      toId: 'kn_capability_research',
    });
    expect(path.success).toBe(true);
    expect(path.data?.length).toBeGreaterThan(1);
  });

  it('lists and records consumers', async () => {
    const consumers = await app.listConsumers('kn_openai_provider_profile');
    expect(consumers.success).toBe(true);
    expect(consumers.data?.length).toBeGreaterThan(0);

    const recorded = await app.recordConsumerUsage({
      knowledgeId: 'kn_openai_provider_profile',
      consumerType: 'module',
      consumerLabel: 'Insights module',
    });
    expect(recorded.success).toBe(true);
    const openai = await repo.findItemById('kn_openai_provider_profile');
    expect(openai?.usage.totalReads).toBe(49);
    expect(openai?.usage.lastAccessedAt).toBeDefined();
  });

  it('lists dependencies derived from edges', async () => {
    const dependencies = await app.listDependencies('kn_blog_pipeline_playbook');
    expect(dependencies.success).toBe(true);
    expect(dependencies.data?.map((d) => d.targetId)).toContain('kn_capability_research');
  });

  it('transitions lifecycle with rules', async () => {
    const created = (await app.create(createDto())).data;
    const id = created?.knowledgeId ?? '';
    // draft → active is illegal (must pass through review).
    const illegal = await app.transitionLifecycle({
      knowledgeId: id,
      to: 'active',
      actor: 'owner',
    });
    expect(illegal.success).toBe(false);
    const review = await app.transitionLifecycle({ knowledgeId: id, to: 'review', actor: 'owner' });
    expect(review.success).toBe(true);
    expect(review.data?.lifecycleStatus).toBe('review');
    const active = await app.transitionLifecycle({ knowledgeId: id, to: 'active', actor: 'owner' });
    expect(active.success).toBe(true);
    expect(active.data?.lifecycleStatus).toBe('active');
  });

  it('computes analytics, timeline, and the dashboard', async () => {
    const analytics = await app.getAnalytics();
    expect(analytics.success).toBe(true);
    expect(analytics.data?.totals.items).toBeGreaterThan(0);

    const timeline = await app.getTimeline({ limit: 5 });
    expect(timeline.success).toBe(true);
    expect(timeline.data?.length).toBeLessThanOrEqual(5);
    expect(timeline.data?.[0].timestamp).toBeDefined();

    const dashboard = await app.getDashboard();
    expect(dashboard.success).toBe(true);
    expect(dashboard.data?.totals.items).toBeGreaterThan(0);
    expect(dashboard.data?.byCategory.ai).toBeGreaterThan(0);
    expect(dashboard.data?.trend.length).toBe(14);
    expect(dashboard.data?.recentItems.length).toBeGreaterThan(0);
  });

  it('degrading engines never break create', async () => {
    const broken = new KnowledgeApplicationService(
      repo,
      new InMemoryKnowledgeGraph(repo),
      brokenEngines(),
    );
    const result = await broken.create(createDto({ enrich: true }));
    expect(result.success).toBe(true);
    expect(result.errors?.length).toBeGreaterThan(0);
  });

  it('returns not-found errors for missing items', async () => {
    expect((await app.getItem('kn_ghost')).success).toBe(false);
    expect((await app.listVersions('kn_ghost')).success).toBe(false);
    expect((await app.diff({ knowledgeId: 'kn_ghost' })).success).toBe(false);
    expect(
      (await app.transitionLifecycle({ knowledgeId: 'kn_ghost', to: 'active', actor: 'x' }))
        .success,
    ).toBe(false);
    expect((await app.graph({ knowledgeId: 'kn_ghost' })).success).toBe(false);
    expect((await app.delete('kn_ghost')).success).toBe(false);
  });
});
