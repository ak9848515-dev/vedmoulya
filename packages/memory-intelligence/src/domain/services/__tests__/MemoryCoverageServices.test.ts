// ──────────────────────────────────────────────────────────────────
// VedMoulya — Memory service branch-coverage tests
// EI-010 — Enterprise Memory Intelligence Platform
// Exercises the remaining branches (declared importance, no-op and
// default lifecycle audit actions, duplicate-consumer merges, already
// expired memories, empty-slug ids, rankAll, retrieval limits).
// ──────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import { MemoryCaptureService } from '../MemoryCaptureService.js';
import { MemoryLifecycleService } from '../MemoryLifecycleService.js';
import { MemoryConsolidationService } from '../MemoryConsolidationService.js';
import { MemoryExpirationService } from '../MemoryExpirationService.js';
import { MemoryRankingService } from '../MemoryRankingService.js';
import { MemoryRetrievalService } from '../MemoryRetrievalService.js';
import { generateMemoryId } from '../../value-objects/MemoryId.js';
import type { MemoryItem } from '../../../types/memory-types.js';
import type { MemoryCaptureInput } from '../../../application/MemoryDTO.js';

function item(overrides: Partial<MemoryItem> = {}): MemoryItem {
  return {
    memoryId: 'mem_1',
    type: 'provider',
    title: 'OpenAI reliability memory',
    content: 'Three consecutive runs completed with high quality on the reasoning stage.',
    source: 'execution history',
    sourceType: 'execution',
    owner: 'platform',
    tags: ['openai'],
    importance: { score: 0.8, level: 'high', factors: [] },
    confidence: { score: 0.85, level: 'high', factors: [] },
    usage: { totalRetrievals: 5, totalConsumers: 1, frequency: 2, recency: 0.9 },
    lifecycleStatus: 'active',
    compressionState: 'summarized',
    retentionPolicy: 'long_term',
    consumers: [],
    relationships: [],
    citations: [],
    audit: [],
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
    ...overrides,
  };
}

function captureInput(overrides: Partial<MemoryCaptureInput> = {}): MemoryCaptureInput {
  return {
    type: 'provider',
    title: 'OpenAI reliability memory',
    content: 'Three consecutive runs completed with high quality.',
    source: 'execution history',
    sourceType: 'execution',
    owner: 'platform',
    ...overrides,
  };
}

describe('MemoryCaptureService — branch coverage', () => {
  const svc = new MemoryCaptureService();

  it('honors declared importance and captures with an explicit actor', () => {
    const { item: captured } = svc.capture(
      captureInput({ importance: 0.9, actor: 'sensor' }),
      '2026-08-01T00:00:00.000Z',
    );
    expect(captured.importance.score).toBe(0.9);
    expect(captured.audit[0]?.actor).toBe('sensor');
    expect(captured.importance.factors[0]).toContain('declared importance');
  });

  it('defaults to short-term retention when unspecified', () => {
    const { item: captured } = svc.capture(captureInput({}));
    expect(captured.retentionPolicy).toBe('short_term');
  });

  it('uses a deterministic slug for empty titles', () => {
    const id = generateMemoryId('!!!');
    expect(id).toMatch(/^mem_item_/);
    const slug = generateMemoryId('  OpenAI  Provider  ');
    expect(slug).toContain('openai_provider');
  });
});

describe('MemoryLifecycleService — branch coverage', () => {
  const svc = new MemoryLifecycleService();

  it('writes a learned audit when activating', () => {
    const result = svc.transition(item({ lifecycleStatus: 'compressed' }), 'active', 'platform');
    expect(result.transitioned).toBe(true);
    expect(result.item.audit[0]?.action).toBe('learned');
  });

  it('archives any non-expired memory and never archives expired', () => {
    const archived = svc.transition(item(), 'archived', 'platform');
    expect(archived.transitioned).toBe(true);
    const invalid = svc.transition(item({ lifecycleStatus: 'expired' }), 'archived', 'platform');
    expect(invalid.transitioned).toBe(false);
  });

  it('treats same-status transitions as no-op (allowed)', () => {
    const result = svc.transition(item(), 'active', 'platform');
    expect(result.transitioned).toBe(true);
    expect(result.item.lifecycleStatus).toBe('active');
  });
});

describe('MemoryConsolidationService — branch coverage', () => {
  const svc = new MemoryConsolidationService();

  it('merges consumers with the same id by summing usage', () => {
    const a = item({
      memoryId: 'mem_a',
      title: 'OpenAI reliability note',
      relatedProvider: 'openai',
      consumers: [
        {
          consumerId: 'c1',
          consumerType: 'engine',
          consumerLabel: 'Brain',
          usageCount: 2,
          firstUsedAt: '2026-07-01T00:00:00.000Z',
          lastUsedAt: '2026-07-01T00:00:00.000Z',
        },
      ],
    });
    const b = item({
      memoryId: 'mem_b',
      title: 'OpenAI reliability note two',
      relatedProvider: 'openai',
      consumers: [
        {
          consumerId: 'c1',
          consumerType: 'engine',
          consumerLabel: 'Brain',
          usageCount: 3,
          firstUsedAt: '2026-07-02T00:00:00.000Z',
          lastUsedAt: '2026-07-02T00:00:00.000Z',
        },
      ],
    });
    const { consolidated } = svc.consolidate({ primary: a, duplicates: [b] });
    expect(consolidated.consumers[0]?.usageCount).toBe(5);
    expect(consolidated.tags).toContain('openai');
  });

  it('blends importance and confidence upward', () => {
    const a = item({
      memoryId: 'mem_a',
      title: 'OpenAI reliability note',
      relatedProvider: 'openai',
      importance: { score: 0.5, level: 'medium', factors: [] },
      confidence: { score: 0.5, level: 'medium', factors: [] },
    });
    const b = item({
      memoryId: 'mem_b',
      title: 'OpenAI reliability note two',
      relatedProvider: 'openai',
      importance: { score: 0.9, level: 'high', factors: [] },
      confidence: { score: 0.9, level: 'high', factors: [] },
    });
    const { consolidated } = svc.consolidate({ primary: a, duplicates: [b] });
    expect(consolidated.importance.score).toBeGreaterThan(0.5);
    expect(consolidated.confidence.score).toBeGreaterThan(0.5);
  });
});

describe('MemoryExpirationService — branch coverage', () => {
  const svc = new MemoryExpirationService();

  it('keeps already-expired memories in the expired bucket (purge honors policy)', () => {
    const already = item({
      memoryId: 'mem_old',
      lifecycleStatus: 'expired',
      retentionPolicy: 'long_term',
    });
    const result = svc.expire([already], { now: '2026-08-01T00:00:00.000Z' });
    expect(result.expired.length).toBe(1);

    const ephemeral = item({
      memoryId: 'mem_e',
      lifecycleStatus: 'expired',
      retentionPolicy: 'ephemeral',
    });
    const purged = svc.expire([ephemeral], { purge: true, now: '2026-08-01T00:00:00.000Z' });
    expect(purged.purged.length).toBe(1);
  });
});

describe('MemoryRankingService — branch coverage', () => {
  const svc = new MemoryRankingService();

  it('ranks a list descending', () => {
    const high = item({
      memoryId: 'mem_high',
      importance: { score: 0.9, level: 'high', factors: [] },
      confidence: { score: 0.9, level: 'high', factors: [] },
      usage: { totalRetrievals: 20, totalConsumers: 1, frequency: 10, recency: 1 },
    });
    const low = item({
      memoryId: 'mem_low',
      importance: { score: 0.1, level: 'low', factors: [] },
      confidence: { score: 0.1, level: 'low', factors: [] },
      usage: { totalRetrievals: 0, totalConsumers: 0, frequency: 1, recency: 0.1 },
    });
    const ranked = svc.rankAll([low, high]);
    expect(ranked[0]?.memory.memoryId).toBe('mem_high');
    expect(ranked[0]?.score).toBeGreaterThan(ranked[1]?.score ?? 0);
  });
});

describe('MemoryRetrievalService — branch coverage', () => {
  const svc = new MemoryRetrievalService();

  it('respects the limit and the min-importance filter', () => {
    const memories = Array.from({ length: 5 }, (_, i) =>
      item({
        memoryId: `mem_${i}`,
        title: `OpenAI reliability run ${i}`,
        importance: { score: i === 0 ? 0.2 : 0.8, level: 'high', factors: [] },
      }),
    );
    const limited = svc.retrieve(memories, { query: 'OpenAI reliability', limit: 2 });
    expect(limited.length).toBe(2);
    const important = svc.retrieve(memories, { query: 'OpenAI reliability', minImportance: 0.7 });
    expect(important.length).toBe(4);
  });

  it('matches by business module keywords', () => {
    const career = item({
      memoryId: 'mem_career',
      title: 'Resume optimization memory',
      content: 'Career coaching session about the resume and the job search.',
      tags: ['career'],
    });
    const result = svc.retrieve([career], { query: 'resume job' });
    expect(result.length).toBe(1);
    expect(['business_module', 'similarity', 'keyword']).toContain(result[0]?.matchType);
  });

  it('filters by related entity on both sides', () => {
    const provider = item({ memoryId: 'mem_p', relatedProvider: 'openai' });
    const result = svc.retrieve([provider], { relatedProvider: 'openai' });
    expect(result[0]?.matchType).toBe('provider');
  });
});
