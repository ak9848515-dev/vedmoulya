// ──────────────────────────────────────────────────────────────────
// VedMoulya — Context Tests: ContextApplicationService
// EI-003 — Enterprise Context Intelligence Engine
// ──────────────────────────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import { ContextApplicationService } from '../ContextApplicationService.js';
import { InMemoryContextRepository } from '../../infrastructure/InMemoryContextRepository.js';
import { createCatalogContext, SEED_CONTEXT_SIZE } from '../../catalog/context-catalog.js';
import type { RegisterContextDTO } from '../ContextDTO.js';

function createService(): ContextApplicationService {
  return new ContextApplicationService(new InMemoryContextRepository(createCatalogContext()));
}

describe('ContextApplicationService', () => {
  it('serves the context registry summary', async () => {
    const svc = createService();
    const result = await svc.getContextSummary();
    expect(result.success).toBe(true);
    expect(result.data?.total).toBe(SEED_CONTEXT_SIZE);
    expect(result.data?.totalTokens).toBeGreaterThan(0);
    expect(result.data?.countBySource.knowledge_base).toBeGreaterThan(0);
    expect(result.data?.countByCategory.knowledge).toBeGreaterThan(0);
    expect(result.data?.countByPriority.critical).toBeGreaterThan(0);
  });

  it('registers a new context item', async () => {
    const svc = createService();
    const dto: RegisterContextDTO = {
      source: 'knowledge_base',
      category: 'knowledge',
      priority: 'high',
      importance: 0.8,
      confidence: 0.9,
      content: 'Newly registered context item.',
      sourceId: 'new_source_001',
      tags: ['new'],
      business: ['platform'],
      capability: ['reasoning'],
    };
    const result = await svc.registerContext(dto);
    expect(result.success).toBe(true);
    expect(result.data?.source).toBe('knowledge_base');
    expect(result.data?.contextId).toBeTruthy();
    expect(result.data?.version).toBe('1.0.0');
  });

  it('bulk registers context items', async () => {
    const svc = createService();
    const dtos: RegisterContextDTO[] = [
      {
        source: 'knowledge_base',
        category: 'knowledge',
        priority: 'low',
        importance: 0.5,
        confidence: 0.8,
        content: 'Item 1',
        sourceId: 's1',
      },
      {
        source: 'conversation_memory',
        category: 'conversation',
        priority: 'medium',
        importance: 0.6,
        confidence: 0.9,
        content: 'Item 2',
        sourceId: 's2',
      },
    ];
    const result = await svc.bulkRegisterContext(dtos);
    expect(result.success).toBe(true);
    expect(result.data?.count).toBe(2);
  });

  it('gets a context item by id', async () => {
    const svc = createService();
    const result = await svc.getContext('ctx_user_profile_001');
    expect(result.success).toBe(true);
    expect(result.data?.source).toBe('conversation_memory');
  });

  it('returns error for unknown context id', async () => {
    const svc = createService();
    const result = await svc.getContext('nope');
    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
  });

  it('deletes a context item', async () => {
    const svc = createService();
    const result = await svc.deleteContext('ctx_system_002');
    expect(result.success).toBe(true);
    expect(result.data?.deleted).toBe(true);
    const getResult = await svc.getContext('ctx_system_002');
    expect(getResult.success).toBe(false);
  });

  it('returns error when deleting an unknown context item', async () => {
    const svc = createService();
    const result = await svc.deleteContext('nope');
    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
  });

  it('ranks context items by capability', async () => {
    const svc = createService();
    const result = await svc.rankContext({}, 'reasoning', undefined, undefined, 5);
    expect(result.success).toBe(true);
    expect(result.data?.ranked.length).toBeGreaterThan(0);
    expect(result.data?.ranked.length).toBeLessThanOrEqual(5);
    expect(Object.keys(result.data!.scores).length).toBeGreaterThan(0);
  });

  it('filters context items', async () => {
    const svc = createService();
    const result = await svc.filterContext({
      sources: ['knowledge_base'],
      priorities: ['critical'],
    });
    expect(result.success).toBe(true);
    expect(
      result.data?.retained.every(
        (i) => i.source === 'knowledge_base' && i.priority === 'critical',
      ),
    ).toBe(true);
  });

  it('compresses context items', async () => {
    const svc = createService();
    const result = await svc.compressContext({}, 2000, 'extractive', true);
    expect(result.success).toBe(true);
    expect(result.data?.strategy).toBe('extractive');
    expect(result.data?.reductionPercent).toBeGreaterThanOrEqual(0);
    expect(result.data?.originalTokens).toBeGreaterThan(0);
  });

  it('assembles an enterprise context package', async () => {
    const svc = createService();
    const result = await svc.assembleContext(
      {},
      'Generate a project status report',
      'content_generation',
      'Write a concise status report based on the available context.',
      undefined,
      ['platform'],
      3000,
      'extractive',
    );
    expect(result.success).toBe(true);
    expect(result.data?.packageId).toBeTruthy();
    expect(result.data?.goal).toBe('Generate a project status report');
    expect(result.data?.capability).toBe('content_generation');
    expect(result.data?.assembledPrompt).toContain('# Goal');
    expect(result.data?.metadata.totalItems).toBeGreaterThan(0);
    expect(result.data?.metadata.estimatedTokens).toBeGreaterThan(0);
    expect(result.data?.metadata.confidence).toBeGreaterThan(0);
  });

  it('discovers context items', async () => {
    const svc = createService();
    const result = await svc.discoverContext(
      { sources: ['knowledge_base'], page: 1, limit: 10 },
      'reasoning',
      ['platform'],
    );
    expect(result.success).toBe(true);
    expect(result.data?.total).toBeGreaterThan(0);
    expect(result.data?.items.length).toBeGreaterThan(0);
    expect(Object.keys(result.data!.scores).length).toBeGreaterThan(0);
  });

  it('discovers context items without a request capability', async () => {
    const svc = createService();
    const result = await svc.discoverContext({ page: 1, limit: 10 });
    expect(result.success).toBe(true);
    expect(result.data?.total).toBeGreaterThan(0);
    expect(Object.keys(result.data!.scores)).toHaveLength(0);
  });

  it('assembles a package without a token target (no compression step)', async () => {
    const svc = createService();
    const result = await svc.assembleContext(
      {},
      'Generate a report',
      'content_generation',
      'Write it.',
      'status report',
    );
    expect(result.success).toBe(true);
    expect(result.data?.assembledPrompt).toContain('# Goal');
    expect(result.data?.metadata.compressionSteps).toHaveLength(1); // initial top_k only
  });

  it('explains a context item without compression savings', async () => {
    const svc = createService();
    const result = await svc.explainContext('ctx_knowledge_arch_001', 'reasoning');
    expect(result.success).toBe(true);
    expect(result.data?.compressionSavings).toBeUndefined();
  });

  it('previews a context item with the default capability', async () => {
    const svc = createService();
    const result = await svc.previewContext('ctx_knowledge_arch_001');
    expect(result.success).toBe(true);
    expect(result.data?.contextId).toBe('ctx_knowledge_arch_001');
    expect(result.data?.score).toBeDefined();
  });

  it('previews a context item', async () => {
    const svc = createService();
    const result = await svc.previewContext('ctx_knowledge_arch_001', 'reasoning');
    expect(result.success).toBe(true);
    expect(result.data?.contextId).toBe('ctx_knowledge_arch_001');
    expect(result.data?.snippet).toBeTruthy();
    expect(result.data?.score).toBeDefined();
  });

  it('explains a context item', async () => {
    const svc = createService();
    const result = await svc.explainContext('ctx_knowledge_arch_001', 'reasoning', 5000, 2000);
    expect(result.success).toBe(true);
    expect(result.data?.whyRelevant).toBeTruthy();
    expect(result.data?.scoreBreakdown).toContain('Priority');
    expect(result.data?.compressionSavings).toContain('60.0%');
  });

  it('returns baseline metrics', async () => {
    const svc = createService();
    const result = await svc.getContextMetrics();
    expect(result.success).toBe(true);
    expect(result.data?.itemsProcessed).toBe(SEED_CONTEXT_SIZE);
    expect(result.data?.originalTokens).toBeGreaterThan(0);
  });

  it('returns compression metrics', async () => {
    const svc = createService();
    const result = await svc.getContextMetrics({
      originalTokens: 5000,
      compressedTokens: 2000,
      reductionPercent: 60,
      compressionTimeMs: 15,
      itemsProcessed: 28,
      itemsRemoved: 15,
      itemsMerged: 3,
    });
    expect(result.success).toBe(true);
    expect(result.data?.reductionPercent).toBe(60);
    expect(result.data?.qualityEstimate).toBeGreaterThan(0);
  });

  it('searches context items', async () => {
    const svc = createService();
    const result = await svc.searchContext({ query: 'architecture', page: 1, limit: 10 });
    expect(result.success).toBe(true);
    expect(result.data?.total).toBeGreaterThan(0);
    expect(result.data?.items.some((i) => i.content.toLowerCase().includes('architecture'))).toBe(
      true,
    );
  });

  it('lists by source', async () => {
    const svc = createService();
    const result = await svc.listBySource('knowledge_base');
    expect(result.success).toBe(true);
    expect(result.data!.length).toBeGreaterThan(0);
  });

  it('lists by category', async () => {
    const svc = createService();
    const result = await svc.listByCategory('knowledge');
    expect(result.success).toBe(true);
    expect(result.data!.length).toBeGreaterThan(0);
  });

  it('lists by priority', async () => {
    const svc = createService();
    const result = await svc.listByPriority('critical');
    expect(result.success).toBe(true);
    expect(result.data!.length).toBeGreaterThan(0);
  });

  it('lists by capability', async () => {
    const svc = createService();
    const result = await svc.listByCapability('reasoning');
    expect(result.success).toBe(true);
    expect(result.data!.length).toBeGreaterThan(0);
  });

  it('handles duplicate registration gracefully', async () => {
    const svc = createService();
    const dto: RegisterContextDTO = {
      source: 'knowledge_base',
      category: 'knowledge',
      priority: 'medium',
      importance: 0.5,
      confidence: 0.8,
      content: 'Duplicate check.',
      sourceId: 'dup_001',
    };
    const first = await svc.registerContext(dto);
    expect(first.success).toBe(true);
    // Second registration with same content but different sourceId is fine
    const second = await svc.registerContext({ ...dto, sourceId: 'dup_002' });
    expect(second.success).toBe(true);
    expect(second.data?.contextId).not.toBe(first.data?.contextId);
  });
});
