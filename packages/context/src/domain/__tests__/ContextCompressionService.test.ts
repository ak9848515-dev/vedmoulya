// ──────────────────────────────────────────────────────────────────
// VedMoulya — Context Tests: ContextCompressionService
// EI-003 — Enterprise Context Intelligence Engine
// ──────────────────────────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import { ContextCompressionService } from '../services/ContextCompressionService.js';
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
    tags: ['test'],
    business: ['platform'],
    capability: ['reasoning'],
    version: '1.0.0',
    content: 'A'.repeat(500),
    metadata: {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    sourceId: 'test_source_001',
    ...overrides,
  };
}

describe('ContextCompressionService', () => {
  const service = new ContextCompressionService();

  it('compresses with extractive strategy', () => {
    const items = [
      createMockItem({ contextId: 'ctx_001', priority: 'critical', estimatedTokens: 200 }),
      createMockItem({ contextId: 'ctx_002', priority: 'high', estimatedTokens: 150 }),
      createMockItem({ contextId: 'ctx_003', priority: 'low', estimatedTokens: 100 }),
    ];
    const result = service.compress({
      items,
      targetTokens: 300,
      strategy: 'extractive',
    });
    expect(result.originalTokens).toBe(450);
    expect(result.compressedTokens).toBeLessThanOrEqual(300);
    expect(result.strategy).toBe('extractive');
    expect(result.reductionPercent).toBeGreaterThan(0);
    expect(result.confidence).toBeGreaterThan(0);
    expect(result.chunksRemoved).toBeGreaterThan(0);
  });

  it('preserves critical items when requested', () => {
    const items = [
      createMockItem({ contextId: 'ctx_001', priority: 'critical', estimatedTokens: 300 }),
      createMockItem({ contextId: 'ctx_002', priority: 'low', estimatedTokens: 100 }),
    ];
    const result = service.compress({
      items,
      targetTokens: 100,
      strategy: 'extractive',
      preserveCritical: true,
    });
    expect(result.items.some((i) => i.contextId === 'ctx_001')).toBe(true);
  });

  it('does not preserve critical items when not requested', () => {
    const items = [
      createMockItem({ contextId: 'ctx_001', priority: 'critical', estimatedTokens: 300 }),
      createMockItem({ contextId: 'ctx_002', priority: 'low', estimatedTokens: 100 }),
    ];
    const result = service.compress({
      items,
      targetTokens: 100,
      strategy: 'extractive',
      preserveCritical: false,
    });
    expect(result.items.some((i) => i.contextId === 'ctx_002')).toBe(true);
  });

  it('applies summary strategy by selecting top per category', () => {
    const items = [
      createMockItem({
        contextId: 'ctx_001',
        category: 'knowledge',
        priority: 'critical',
        estimatedTokens: 100,
      }),
      createMockItem({
        contextId: 'ctx_002',
        category: 'knowledge',
        priority: 'low',
        estimatedTokens: 100,
      }),
      createMockItem({
        contextId: 'ctx_003',
        category: 'memory',
        priority: 'high',
        estimatedTokens: 100,
      }),
      createMockItem({
        contextId: 'ctx_004',
        category: 'business',
        priority: 'medium',
        estimatedTokens: 100,
      }),
    ];
    const result = service.compress({
      items,
      targetTokens: 500,
      strategy: 'summary',
    });
    // Should have at most 1 item per category, so 3 max
    expect(result.items.length).toBeLessThanOrEqual(3);
    expect(result.items.length).toBeGreaterThanOrEqual(1);
  });

  it('applies threshold strategy', () => {
    const items = [
      createMockItem({
        contextId: 'ctx_001',
        priority: 'critical',
        importance: 0.9,
        estimatedTokens: 100,
      }),
      createMockItem({
        contextId: 'ctx_002',
        priority: 'background',
        importance: 0.1,
        estimatedTokens: 100,
      }),
    ];
    const result = service.compress({
      items,
      targetTokens: 150,
      strategy: 'threshold',
    });
    expect(result.items.length).toBeLessThan(items.length);
  });

  it('applies hybrid strategy', () => {
    const items = [
      createMockItem({ contextId: 'ctx_001', priority: 'critical', estimatedTokens: 100 }),
      createMockItem({ contextId: 'ctx_002', priority: 'high', estimatedTokens: 100 }),
      createMockItem({ contextId: 'ctx_003', priority: 'medium', estimatedTokens: 100 }),
    ];
    const result = service.compress({
      items,
      targetTokens: 250,
      strategy: 'hybrid',
    });
    expect(result.items.length).toBeGreaterThan(0);
    expect(result.items.length).toBeLessThanOrEqual(items.length);
  });

  it('estimates tokens from text length', () => {
    const tokens = service.estimateTokens('Hello, world!');
    expect(tokens).toBeGreaterThan(0);
    expect(tokens).toBeLessThanOrEqual(20);
  });

  it('returns reasonable compression time', () => {
    const items = [
      createMockItem({ contextId: 'ctx_001', estimatedTokens: 100 }),
      createMockItem({ contextId: 'ctx_002', estimatedTokens: 100 }),
    ];
    const result = service.compress({ items, targetTokens: 150, strategy: 'extractive' });
    expect(result.compressionTimeMs).toBeGreaterThanOrEqual(0);
  });

  it('handles empty items gracefully', () => {
    const result = service.compress({
      items: [],
      targetTokens: 1000,
      strategy: 'extractive',
    });
    expect(result.items).toHaveLength(0);
    expect(result.originalTokens).toBe(0);
    expect(result.reductionPercent).toBe(0);
  });

  it('handles all items fitting within budget', () => {
    const items = [
      createMockItem({ contextId: 'ctx_001', estimatedTokens: 50 }),
      createMockItem({ contextId: 'ctx_002', estimatedTokens: 50 }),
    ];
    const result = service.compress({
      items,
      targetTokens: 1000,
      strategy: 'extractive',
    });
    expect(result.items).toHaveLength(2);
    expect(result.reductionPercent).toBe(0);
  });

  it('filters by minConfidence in threshold strategy', () => {
    const items = [
      createMockItem({
        contextId: 'ctx_001',
        confidence: 0.9,
        priority: 'critical',
        estimatedTokens: 100,
      }),
      createMockItem({
        contextId: 'ctx_002',
        confidence: 0.2,
        priority: 'high',
        estimatedTokens: 100,
      }),
    ];
    const result = service.compress({
      items,
      targetTokens: 150,
      strategy: 'threshold',
      minConfidence: 0.5,
    });
    expect(result.items.some((i) => i.contextId === 'ctx_001')).toBe(true);
    expect(result.items.some((i) => i.contextId === 'ctx_002')).toBe(false);
  });
});
