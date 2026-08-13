// ──────────────────────────────────────────────────────────────────
// VedMoulya — Context Tests: ContextFilteringService
// EI-003 — Enterprise Context Intelligence Engine
// ──────────────────────────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import { ContextFilteringService } from '../services/ContextFilteringService.js';
import type { ContextItem } from '../../types/context-types.js';

function createMockItem(overrides: Partial<ContextItem> = {}): ContextItem {
  return {
    contextId: 'test_ctx_001',
    source: 'knowledge_base',
    category: 'knowledge',
    priority: 'medium',
    importance: 0.7,
    confidence: 0.85,
    freshness: 0.8,
    size: 500,
    estimatedTokens: 125,
    language: 'en',
    tags: ['test', 'knowledge'],
    business: ['platform'],
    capability: ['reasoning'],
    version: '1.0.0',
    content: 'Test content for filtering.',
    metadata: {},
    createdAt: '2026-06-01T00:00:00.000Z',
    updatedAt: '2026-06-01T00:00:00.000Z',
    sourceId: 'test_source_001',
    ...overrides,
  };
}

describe('ContextFilteringService', () => {
  const service = new ContextFilteringService();

  it('removes exact duplicates keeping the highest priority', () => {
    const items = [
      createMockItem({ contextId: 'ctx_001', priority: 'low', sourceId: 'src_001' }),
      createMockItem({ contextId: 'ctx_002', priority: 'high', sourceId: 'src_001' }),
    ];
    const result = service.removeDuplicates(items);
    expect(result.retained).toHaveLength(1);
    expect(result.retained[0]!.contextId).toBe('ctx_002');
    expect(result.removed).toHaveLength(1);
  });

  it('keeps items with different sourceIds', () => {
    const items = [
      createMockItem({ contextId: 'ctx_001', sourceId: 'src_001' }),
      createMockItem({ contextId: 'ctx_002', sourceId: 'src_002' }),
    ];
    const result = service.removeDuplicates(items);
    expect(result.retained).toHaveLength(2);
    expect(result.removed).toHaveLength(0);
  });

  it('filters by source', () => {
    const items = [
      createMockItem({ contextId: 'ctx_001', source: 'knowledge_base' }),
      createMockItem({ contextId: 'ctx_002', source: 'conversation_memory' }),
    ];
    const result = service.filter(items, { sources: ['knowledge_base'] });
    expect(result.retained).toHaveLength(1);
    expect(result.retained[0]!.contextId).toBe('ctx_001');
  });

  it('filters by category', () => {
    const items = [
      createMockItem({ contextId: 'ctx_001', category: 'knowledge' }),
      createMockItem({ contextId: 'ctx_002', category: 'memory' }),
    ];
    const result = service.filter(items, { categories: ['memory'] });
    expect(result.retained).toHaveLength(1);
    expect(result.retained[0]!.contextId).toBe('ctx_002');
  });

  it('filters by priority', () => {
    const items = [
      createMockItem({ contextId: 'ctx_001', priority: 'critical' }),
      createMockItem({ contextId: 'ctx_002', priority: 'low' }),
    ];
    const result = service.filter(items, { priorities: ['critical'] });
    expect(result.retained).toHaveLength(1);
    expect(result.retained[0]!.contextId).toBe('ctx_001');
  });

  it('filters by capability', () => {
    const items = [
      createMockItem({ contextId: 'ctx_001', capability: ['reasoning'] }),
      createMockItem({ contextId: 'ctx_002', capability: ['vision'] }),
    ];
    const result = service.filter(items, { capabilities: ['vision'] });
    expect(result.retained).toHaveLength(1);
    expect(result.retained[0]!.contextId).toBe('ctx_002');
  });

  it('filters by business module', () => {
    const items = [
      createMockItem({ contextId: 'ctx_001', business: ['platform'] }),
      createMockItem({ contextId: 'ctx_002', business: ['content-agency'] }),
    ];
    const result = service.filter(items, { business: ['content-agency'] });
    expect(result.retained).toHaveLength(1);
    expect(result.retained[0]!.contextId).toBe('ctx_002');
  });

  it('filters by tags', () => {
    const items = [
      createMockItem({ contextId: 'ctx_001', tags: ['test', 'knowledge'] }),
      createMockItem({ contextId: 'ctx_002', tags: ['other'] }),
    ];
    const result = service.filter(items, { tags: ['knowledge'] });
    expect(result.retained).toHaveLength(1);
  });

  it('filters by minimum confidence', () => {
    const items = [
      createMockItem({ contextId: 'ctx_001', confidence: 0.9 }),
      createMockItem({ contextId: 'ctx_002', confidence: 0.5 }),
    ];
    const result = service.filter(items, { minConfidence: 0.8 });
    expect(result.retained).toHaveLength(1);
    expect(result.retained[0]!.contextId).toBe('ctx_001');
  });

  it('filters by minimum importance', () => {
    const items = [
      createMockItem({ contextId: 'ctx_001', importance: 0.8 }),
      createMockItem({ contextId: 'ctx_002', importance: 0.3 }),
    ];
    const result = service.filter(items, { minImportance: 0.6 });
    expect(result.retained).toHaveLength(1);
  });

  it('filters by max tokens', () => {
    const items = [
      createMockItem({ contextId: 'ctx_001', estimatedTokens: 50 }),
      createMockItem({ contextId: 'ctx_002', estimatedTokens: 500 }),
    ];
    const result = service.filter(items, { maxTokens: 100 });
    expect(result.retained).toHaveLength(1);
    expect(result.retained[0]!.contextId).toBe('ctx_001');
  });

  it('filters by time range', () => {
    const items = [
      createMockItem({ contextId: 'ctx_001', createdAt: '2026-06-15T00:00:00.000Z' }),
      createMockItem({ contextId: 'ctx_002', createdAt: '2026-01-01T00:00:00.000Z' }),
    ];
    const result = service.filter(items, {
      timeRange: { start: '2026-06-01T00:00:00.000Z', end: '2026-07-01T00:00:00.000Z' },
    });
    expect(result.retained).toHaveLength(1);
    expect(result.retained[0]!.contextId).toBe('ctx_001');
  });

  it('filters by exclude IDs', () => {
    const items = [
      createMockItem({ contextId: 'ctx_001' }),
      createMockItem({ contextId: 'ctx_002' }),
    ];
    const result = service.filter(items, { excludeIds: ['ctx_001'] });
    expect(result.retained).toHaveLength(1);
    expect(result.retained[0]!.contextId).toBe('ctx_002');
  });

  it('runs full pipeline with deduplicate + filter', () => {
    const items = [
      createMockItem({
        contextId: 'ctx_001',
        priority: 'high',
        source: 'knowledge_base',
        sourceId: 'src_001',
      }),
      createMockItem({
        contextId: 'ctx_002',
        priority: 'low',
        source: 'knowledge_base',
        sourceId: 'src_001',
      }),
      createMockItem({ contextId: 'ctx_003', source: 'conversation_memory', sourceId: 'src_002' }),
    ];
    const result = service.process(items, { sources: ['knowledge_base'] });
    expect(result.retained).toHaveLength(1);
    // After dedup: ctx_001 kept (high priority), ctx_002 removed (duplicate)
    // After filter: ctx_001 retained (knowledge_base)
    expect(result.retained[0]!.contextId).toBe('ctx_001');
  });

  it('returns empty retained when all items filtered out', () => {
    const items = [createMockItem({ source: 'knowledge_base' })];
    const result = service.filter(items, { sources: ['conversation_memory'] });
    expect(result.retained).toHaveLength(0);
    expect(result.removed).toHaveLength(1);
  });
});
