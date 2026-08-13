// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — API Gateway: EI Router Handler Coverage
// Direct handler coverage for ContextRouter (EI-003), KnowledgeRouter (EI-009)
// and MemoryIntelligenceRouter (EI-010) — the three engine routers that had no
// dedicated describe blocks, using the real seeded in-memory application
// services (same pattern as routers.test.ts). No mocked ports.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest';

import {
  ContextApplicationService,
  InMemoryContextRepository,
  createCatalogContext,
} from '@vedmoulya/context';
import {
  KnowledgeApplicationService,
  InMemoryKnowledgeRepository,
  InMemoryKnowledgeGraph,
  createCatalogKnowledgeItems,
  createCatalogKnowledgeRelationships,
  type KnowledgeEngines,
} from '@vedmoulya/knowledge-intelligence';
import {
  MemoryApplicationService,
  InMemoryMemoryRepository,
  InMemoryMemoryGraph,
  createCatalogMemoryItems,
  createCatalogMemoryRelationships,
  type MemoryEngines,
} from '@vedmoulya/memory-intelligence';
import { createContextRouter } from '../routers/ContextRouter.js';
import { createKnowledgeRouter } from '../routers/KnowledgeRouter.js';
import { createMemoryIntelligenceRouter } from '../routers/MemoryIntelligenceRouter.js';
import type { TRPCContext } from '../router.js';

const testCtx: TRPCContext = { userId: 'test-user', email: 'test@vedmoulya.com', role: 'user' };

// ── Context Router (EPIC-004 / EI-003) ───────────────────────────────────────

describe('ContextRouter (EI-003)', () => {
  const svc = new ContextApplicationService(new InMemoryContextRepository(createCatalogContext()));
  const router = createContextRouter(svc);

  it('getContext returns a seeded context item', async () => {
    const result = await router.getContext(
      { userId: 'test-user', id: 'ctx_user_profile_001' },
      testCtx,
    );
    expect(result.success).toBe(true);
    expect(result.data.contextId).toBe('ctx_user_profile_001');
  });

  it('registerContext registers a new item', async () => {
    const result = await router.registerContext(
      {
        userId: 'test-user',
        source: 'knowledge_base',
        category: 'knowledge',
        priority: 'medium',
        importance: 0.5,
        confidence: 0.8,
        content: 'Router-coverage context item.',
        sourceId: 'router_coverage_001',
      },
      testCtx,
    );
    expect(result.success).toBe(true);
    expect(result.data.contextId).toBeDefined();
  });

  it('bulkRegisterContext registers multiple items', async () => {
    const result = await router.bulkRegisterContext(
      {
        userId: 'test-user',
        items: [
          {
            source: 'documents',
            category: 'document',
            priority: 'low',
            importance: 0.3,
            confidence: 0.9,
            content: 'Bulk item A.',
            sourceId: 'bulk_a_001',
          },
          {
            source: 'documents',
            category: 'document',
            priority: 'low',
            importance: 0.3,
            confidence: 0.9,
            content: 'Bulk item B.',
            sourceId: 'bulk_b_001',
          },
        ],
      },
      testCtx,
    );
    expect(result.success).toBe(true);
    expect(result.data.count).toBe(2);
  });

  it('getSummary and getMetrics aggregate the registry', async () => {
    const summary = await router.getSummary({ userId: 'test-user' }, testCtx);
    expect(summary.success).toBe(true);
    expect(summary.data.total).toBeGreaterThan(0);
    const metrics = await router.getMetrics({ userId: 'test-user' }, testCtx);
    expect(metrics.success).toBe(true);
  });

  it('rank returns scored, ranked context', async () => {
    const result = await router.rank(
      { userId: 'test-user', query: 'content', capability: 'reasoning', maxResults: 10 },
      testCtx,
    );
    expect(result.success).toBe(true);
    expect(Array.isArray(result.data.ranked)).toBe(true);
  });

  it('filter returns retained items', async () => {
    const result = await router.filter(
      { userId: 'test-user', sources: ['knowledge_base'], categories: ['knowledge'] },
      testCtx,
    );
    expect(result.success).toBe(true);
    expect(Array.isArray(result.data.retained)).toBe(true);
  });

  it('compress reduces the item set toward the token budget', async () => {
    const result = await router.compress(
      {
        userId: 'test-user',
        sources: ['knowledge_base'],
        targetTokens: 2000,
        strategy: 'extractive',
      },
      testCtx,
    );
    expect(result.success).toBe(true);
  });

  it('assemble builds an enterprise context package', async () => {
    const result = await router.assemble(
      {
        userId: 'test-user',
        query: 'openai',
        goal: 'Generate a blog post',
        capability: 'content_generation',
        prompt: 'Write the draft.',
        targetTokens: 4000,
      },
      testCtx,
    );
    expect(result.success).toBe(true);
    expect(result.data.assembledPrompt).toBeDefined();
  });

  it('discover returns items with optional scores', async () => {
    const result = await router.discover(
      { userId: 'test-user', query: 'content', capability: 'reasoning' },
      testCtx,
    );
    expect(result.success).toBe(true);
    expect(result.data.total).toBeGreaterThan(0);
  });

  it('search returns matching items', async () => {
    const result = await router.search(
      { userId: 'test-user', query: 'content', sources: ['knowledge_base'] },
      testCtx,
    );
    expect(result.success).toBe(true);
    expect(Array.isArray(result.data.items)).toBe(true);
  });

  it('preview returns a scored preview for a known item', async () => {
    const result = await router.preview(
      { userId: 'test-user', id: 'ctx_user_profile_001', capability: 'reasoning' },
      testCtx,
    );
    expect(result.success).toBe(true);
    expect(result.data.contextId).toBe('ctx_user_profile_001');
  });

  it('explain returns the ranking rationale', async () => {
    const result = await router.explain(
      { userId: 'test-user', id: 'ctx_user_profile_001' },
      testCtx,
    );
    expect(result.success).toBe(true);
  });

  it('listBySource / listByCategory / listByPriority / listByCapability filter', async () => {
    const bySource = await router.listBySource(
      { userId: 'test-user', source: 'knowledge_base' },
      testCtx,
    );
    expect(bySource.success).toBe(true);
    const byCategory = await router.listByCategory(
      { userId: 'test-user', category: 'knowledge' },
      testCtx,
    );
    expect(byCategory.success).toBe(true);
    const byPriority = await router.listByPriority(
      { userId: 'test-user', priority: 'high' },
      testCtx,
    );
    expect(byPriority.success).toBe(true);
    const byCapability = await router.listByCapability(
      { userId: 'test-user', capability: 'reasoning' },
      testCtx,
    );
    expect(byCapability.success).toBe(true);
  });

  it('deleteContext removes an item', async () => {
    const registered = await router.registerContext(
      {
        userId: 'test-user',
        source: 'documents',
        category: 'document',
        priority: 'low',
        importance: 0.2,
        confidence: 0.7,
        content: 'To be deleted through the router.',
        sourceId: 'delete_me_001',
      },
      testCtx,
    );
    const id = registered.data.contextId;
    const deleted = await router.deleteContext({ userId: 'test-user', id }, testCtx);
    expect(deleted.success).toBe(true);
    expect(deleted.data.deleted).toBe(true);
  });
});

// ── Knowledge Router (EPIC-004 / EI-009) ─────────────────────────────────────

describe('KnowledgeRouter (EI-009)', () => {
  const repo = new InMemoryKnowledgeRepository({
    items: createCatalogKnowledgeItems(),
    relationships: createCatalogKnowledgeRelationships(),
  });
  const svc = new KnowledgeApplicationService(
    repo,
    new InMemoryKnowledgeGraph(repo),
    {} as KnowledgeEngines,
  );
  const router = createKnowledgeRouter(svc);

  it('getItem returns a seeded knowledge item', async () => {
    const result = await router.getItem(
      { userId: 'test-user', knowledgeId: 'kn_openai_provider_profile' },
      testCtx,
    );
    expect(result.success).toBe(true);
    expect(result.data.knowledgeId).toBe('kn_openai_provider_profile');
  });

  it('listItems returns the catalog', async () => {
    const result = await router.listItems({ userId: 'test-user', category: 'ai' }, testCtx);
    expect(result.success).toBe(true);
    expect(result.data.total).toBeGreaterThan(0);
  });

  it('search finds items across the catalog', async () => {
    const result = await router.search({ userId: 'test-user', query: 'openai' }, testCtx);
    expect(result.success).toBe(true);
    expect(Array.isArray(result.data)).toBe(true);
  });

  it('explain returns the trust rationale', async () => {
    const result = await router.explain(
      { userId: 'test-user', knowledgeId: 'kn_openai_provider_profile' },
      testCtx,
    );
    expect(result.success).toBe(true);
  });

  it('validate reports the validation status', async () => {
    const result = await router.validate(
      { userId: 'test-user', knowledgeId: 'kn_openai_provider_profile', actor: 'test-actor' },
      testCtx,
    );
    expect(result.success).toBe(true);
  });

  it('create → update → version → diff → delete lifecycle', async () => {
    const created = await router.create(
      {
        userId: 'test-user',
        title: 'Router-coverage knowledge item',
        description: 'Created through the KnowledgeRouter.',
        source: 'router test',
        sourceType: 'repository',
        owner: 'test-owner',
        category: 'ai',
        tags: ['router', 'coverage'],
      },
      testCtx,
    );
    expect(created.success).toBe(true);
    const knowledgeId = created.data.knowledgeId;

    const updated = await router.update(
      { userId: 'test-user', knowledgeId, title: 'Router-coverage knowledge item (updated)' },
      testCtx,
    );
    expect(updated.success).toBe(true);
    expect(updated.data.title).toContain('(updated)');

    const versioned = await router.createVersion(
      {
        userId: 'test-user',
        knowledgeId,
        changeSummary: 'Router coverage bump',
        actor: 'test-actor',
      },
      testCtx,
    );
    expect(versioned.success).toBe(true);

    const versions = await router.listVersions({ userId: 'test-user', knowledgeId }, testCtx);
    expect(versions.success).toBe(true);
    expect(versions.data.length).toBeGreaterThan(0);

    const version = await router.getVersion(
      { userId: 'test-user', knowledgeId, versionNumber: versions.data[0]?.versionNumber ?? 1 },
      testCtx,
    );
    expect(version.success).toBe(true);

    const diff = await router.diff(
      {
        userId: 'test-user',
        knowledgeId,
        fromVersion: versions.data[0]?.versionNumber ?? 1,
        toVersion: (versions.data[0]?.versionNumber ?? 1) + 1,
      },
      testCtx,
    );
    expect(diff.success).toBe(true);

    const deleted = await router.delete({ userId: 'test-user', knowledgeId }, testCtx);
    expect(deleted.success).toBe(true);
    expect(deleted.data.deleted).toBe(true);
  });

  it('relate connects two seeded items through the router', async () => {
    const result = await router.relate(
      {
        userId: 'test-user',
        sourceId: 'kn_openai_provider_profile',
        targetId: 'kn_blog_pipeline_playbook',
        type: 'related_to',
        weight: 0.5,
        actor: 'test-actor',
      },
      testCtx,
    );
    expect(result.success).toBe(true);
    expect(result.data.sourceId).toBe('kn_openai_provider_profile');
  });

  it('detectRelationships surfaces existing links', async () => {
    const result = await router.detectRelationships(
      { userId: 'test-user', knowledgeId: 'kn_openai_provider_profile', actor: 'test-actor' },
      testCtx,
    );
    expect(result.success).toBe(true);
    expect(Array.isArray(result.data)).toBe(true);
  });

  it('listRelationships returns relationships by type', async () => {
    const result = await router.listRelationships(
      { userId: 'test-user', type: 'related_to' },
      testCtx,
    );
    expect(result.success).toBe(true);
    expect(Array.isArray(result.data)).toBe(true);
  });

  it('graph returns a traversal from a seeded item', async () => {
    const result = await router.graph(
      { userId: 'test-user', knowledgeId: 'kn_openai_provider_profile', maxDepth: 2 },
      testCtx,
    );
    expect(result.success).toBe(true);
  });

  it('shortestPath returns a path envelope', async () => {
    const result = await router.shortestPath(
      {
        userId: 'test-user',
        fromId: 'kn_openai_provider_profile',
        toId: 'kn_blog_pipeline_playbook',
      },
      testCtx,
    );
    expect(result.success).toBe(true);
    expect(Array.isArray(result.data)).toBe(true);
  });

  it('listConsumers / recordConsumerUsage / listDependencies', async () => {
    const consumers = await router.listConsumers(
      { userId: 'test-user', knowledgeId: 'kn_openai_provider_profile' },
      testCtx,
    );
    expect(consumers.success).toBe(true);
    expect(consumers.data.length).toBeGreaterThan(0);

    const usage = await router.recordConsumerUsage(
      {
        userId: 'test-user',
        knowledgeId: 'kn_openai_provider_profile',
        consumerType: 'engine',
        consumerLabel: 'Certification audit (OS-002)',
        actor: 'test-actor',
      },
      testCtx,
    );
    expect(usage.success).toBe(true);

    const deps = await router.listDependencies(
      { userId: 'test-user', knowledgeId: 'kn_openai_provider_profile' },
      testCtx,
    );
    expect(deps.success).toBe(true);
  });

  it('transitionLifecycle walks active → deprecated', async () => {
    const result = await router.transitionLifecycle(
      {
        userId: 'test-user',
        knowledgeId: 'kn_openai_provider_profile',
        to: 'deprecated',
        actor: 'test-actor',
      },
      testCtx,
    );
    expect(result.success).toBe(true);
    expect(result.data.lifecycleStatus).toBe('deprecated');
  });

  it('getAnalytics / getTimeline / getDashboard aggregate the registry', async () => {
    const analytics = await router.getAnalytics({ userId: 'test-user' }, testCtx);
    expect(analytics.success).toBe(true);
    const timeline = await router.getTimeline({ userId: 'test-user', limit: 5 }, testCtx);
    expect(timeline.success).toBe(true);
    const dashboard = await router.getDashboard({ userId: 'test-user' }, testCtx);
    expect(dashboard.success).toBe(true);
  });
});

// ── Memory Intelligence Router (EPIC-004 / EI-010) ───────────────────────────

describe('MemoryIntelligenceRouter (EI-010)', () => {
  const repo = new InMemoryMemoryRepository({
    items: createCatalogMemoryItems(),
    relationships: createCatalogMemoryRelationships(),
  });
  const svc = new MemoryApplicationService(
    repo,
    new InMemoryMemoryGraph(repo),
    {} as MemoryEngines,
  );
  const router = createMemoryIntelligenceRouter(svc);

  it('getItem returns a seeded memory item', async () => {
    const result = await router.getItem(
      { userId: 'test-user', memoryId: 'mem_openai_reliability' },
      testCtx,
    );
    expect(result.success).toBe(true);
    expect(result.data.memoryId).toBe('mem_openai_reliability');
  });

  it('listItems returns the catalog', async () => {
    const result = await router.listItems({ userId: 'test-user', type: 'provider' }, testCtx);
    expect(result.success).toBe(true);
    expect(result.data.total).toBeGreaterThan(0);
  });

  it('capture runs the full capture pipeline', async () => {
    const result = await router.capture(
      {
        userId: 'test-user',
        type: 'provider',
        title: 'Router-coverage memory item',
        content: 'Captured through the MemoryIntelligenceRouter.',
        source: 'certification audit (OS-002)',
        sourceType: 'observation',
        owner: 'test-owner',
        tags: ['router', 'coverage'],
      },
      testCtx,
    );
    expect(result.success).toBe(true);
    expect(result.data.memoryId).toBeDefined();
  });

  it('retrieve returns ranked memories', async () => {
    const result = await router.retrieve({ userId: 'test-user', query: 'openai' }, testCtx);
    expect(result.success).toBe(true);
    expect(Array.isArray(result.data)).toBe(true);
  });

  it('summarize compresses a known memory', async () => {
    const result = await router.summarize(
      {
        userId: 'test-user',
        memoryId: 'mem_openai_reliability',
        target: 'compressed',
        actor: 'test-actor',
      },
      testCtx,
    );
    expect(result.success).toBe(true);
  });

  it('validate returns the validation report', async () => {
    const result = await router.validate(
      { userId: 'test-user', memoryId: 'mem_openai_reliability', actor: 'test-actor' },
      testCtx,
    );
    expect(result.success).toBe(true);
  });

  it('consolidate merges duplicate candidates', async () => {
    const result = await router.consolidate({ userId: 'test-user', dryRun: true }, testCtx);
    expect(result.success).toBe(true);
  });

  it('compress runs the batch compression pass', async () => {
    const result = await router.compress({ userId: 'test-user', target: 'summarized' }, testCtx);
    expect(result.success).toBe(true);
  });

  it('expire runs the retention pass', async () => {
    const result = await router.expire(
      { userId: 'test-user', purge: true, actor: 'test-actor' },
      testCtx,
    );
    expect(result.success).toBe(true);
  });

  it('reinforce boosts a known memory', async () => {
    const result = await router.reinforce(
      { userId: 'test-user', memoryId: 'mem_openai_reliability', actor: 'test-actor' },
      testCtx,
    );
    expect(result.success).toBe(true);
  });

  it('update edits a memory through the router', async () => {
    const result = await router.update(
      {
        userId: 'test-user',
        memoryId: 'mem_openai_reliability',
        title: 'OpenAI reliability (updated)',
        actor: 'test-actor',
      },
      testCtx,
    );
    expect(result.success).toBe(true);
    expect(result.data.title).toContain('(updated)');
  });

  it('relate connects two seeded memories through the router', async () => {
    const result = await router.relate(
      {
        userId: 'test-user',
        sourceId: 'mem_openai_reliability',
        targetId: 'mem_anthropic_long_context',
        type: 'supports',
        weight: 0.6,
        actor: 'test-actor',
      },
      testCtx,
    );
    expect(result.success).toBe(true);
    expect(result.data.sourceId).toBe('mem_openai_reliability');
  });

  it('detectRelationships surfaces existing links', async () => {
    const result = await router.detectRelationships(
      { userId: 'test-user', memoryId: 'mem_openai_reliability', actor: 'test-actor' },
      testCtx,
    );
    expect(result.success).toBe(true);
    expect(Array.isArray(result.data)).toBe(true);
  });

  it('listRelationships returns relationships by type', async () => {
    const result = await router.listRelationships(
      { userId: 'test-user', type: 'similar_to' },
      testCtx,
    );
    expect(result.success).toBe(true);
    expect(Array.isArray(result.data)).toBe(true);
  });

  it('graph returns a traversal from a seeded memory', async () => {
    const result = await router.graph(
      { userId: 'test-user', memoryId: 'mem_openai_reliability', maxDepth: 2 },
      testCtx,
    );
    expect(result.success).toBe(true);
  });

  it('shortestPath returns a path envelope', async () => {
    const result = await router.shortestPath(
      { userId: 'test-user', fromId: 'mem_openai_reliability', toId: 'mem_anthropic_long_context' },
      testCtx,
    );
    expect(result.success).toBe(true);
    expect(Array.isArray(result.data)).toBe(true);
  });

  it('listConsumers / recordConsumerUsage', async () => {
    const consumers = await router.listConsumers(
      { userId: 'test-user', memoryId: 'mem_openai_reliability' },
      testCtx,
    );
    expect(consumers.success).toBe(true);
    expect(consumers.data.length).toBeGreaterThan(0);

    const usage = await router.recordConsumerUsage(
      {
        userId: 'test-user',
        memoryId: 'mem_openai_reliability',
        consumerType: 'engine',
        consumerLabel: 'Certification audit (OS-002)',
        actor: 'test-actor',
      },
      testCtx,
    );
    expect(usage.success).toBe(true);
  });

  it('transitionLifecycle walks active → archived', async () => {
    const result = await router.transitionLifecycle(
      {
        userId: 'test-user',
        memoryId: 'mem_openai_reliability',
        to: 'archived',
        actor: 'test-actor',
      },
      testCtx,
    );
    expect(result.success).toBe(true);
    expect(result.data.lifecycleStatus).toBe('archived');
  });

  it('getAnalytics / getTimeline / getDashboard aggregate the registry', async () => {
    const analytics = await router.getAnalytics({ userId: 'test-user' }, testCtx);
    expect(analytics.success).toBe(true);
    const timeline = await router.getTimeline({ userId: 'test-user', limit: 5 }, testCtx);
    expect(timeline.success).toBe(true);
    const dashboard = await router.getDashboard({ userId: 'test-user' }, testCtx);
    expect(dashboard.success).toBe(true);
  });

  it('delete removes a captured memory', async () => {
    const captured = await router.capture(
      {
        userId: 'test-user',
        type: 'working',
        title: 'Memory to delete',
        content: 'Will be removed through the router.',
        source: 'certification audit (OS-002)',
        sourceType: 'event',
        owner: 'test-owner',
      },
      testCtx,
    );
    const memoryId = captured.data.memoryId;
    const deleted = await router.delete({ userId: 'test-user', memoryId }, testCtx);
    expect(deleted.success).toBe(true);
    expect(deleted.data.deleted).toBe(true);
  });
});
