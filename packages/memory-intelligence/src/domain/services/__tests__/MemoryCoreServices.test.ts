// ──────────────────────────────────────────────────────────────────
// VedMoulya — Memory core services tests
// EI-010 — Enterprise Memory Intelligence Platform
// Covers Capture, Importance, Ranking, and Lifecycle services.
// ──────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import { MemoryCaptureService } from '../MemoryCaptureService.js';
import { MemoryImportanceService } from '../MemoryImportanceService.js';
import { MemoryRankingService } from '../MemoryRankingService.js';
import { MemoryLifecycleService } from '../MemoryLifecycleService.js';
import type { MemoryCaptureInput } from '../../../application/MemoryDTO.js';
import type { MemoryItem } from '../../../types/memory-types.js';

function captureInput(overrides: Partial<MemoryCaptureInput> = {}): MemoryCaptureInput {
  return {
    type: 'provider',
    title: 'OpenAI reliability memory',
    content: 'Three consecutive runs completed with high quality.',
    source: 'execution history',
    sourceType: 'execution',
    owner: 'platform',
    tags: ['openai'],
    ...overrides,
  };
}

describe('MemoryCaptureService', () => {
  const svc = new MemoryCaptureService();

  it('captures a validated item in the captured lifecycle state', () => {
    const { item } = svc.capture(captureInput());
    expect(item.memoryId).toMatch(/^mem_/);
    expect(item.lifecycleStatus).toBe('captured');
    expect(item.compressionState).toBe('raw');
    expect(item.usage.frequency).toBe(1);
    expect(item.usage.recency).toBe(1);
    expect(item.audit[0]?.action).toBe('captured');
    expect(item.audit[0]?.note).toContain('execution history');
  });

  it('derives confidence from source reliability', () => {
    const { item } = svc.capture(captureInput({ sourceType: 'system' }));
    expect(item.confidence.score).toBeGreaterThan(0.9);
    const manual = svc.capture(captureInput({ sourceType: 'manual' }));
    expect(manual.item.confidence.score).toBeLessThan(0.6);
  });

  it('honors declared confidence and retention policy', () => {
    const { item } = svc.capture(
      captureInput({ confidence: { score: 0.95 }, retentionPolicy: 'permanent' }),
    );
    expect(item.confidence.score).toBe(0.95);
    expect(item.retentionPolicy).toBe('permanent');
    expect(item.expiresAt).toBeUndefined();

    const ephemeral = svc.capture(captureInput({ retentionPolicy: 'ephemeral' }));
    expect(ephemeral.item.expiresAt).toBeDefined();
  });

  it('throws on invalid input', () => {
    expect(() => svc.capture(captureInput({ title: 'x' }))).toThrow();
    expect(() => svc.capture(captureInput({ sourceType: 'ghost' as never }))).toThrow();
  });

  it('computes expiry per retention policy', () => {
    const short = svc.expiryFor('short_term', '2026-08-01T00:00:00.000Z');
    expect(short).toBe('2026-08-08T00:00:00.000Z');
    expect(svc.expiryFor('permanent')).toBeUndefined();
  });
});

describe('MemoryImportanceService', () => {
  const svc = new MemoryImportanceService();

  function item(overrides: Partial<MemoryItem> = {}): MemoryItem {
    return {
      memoryId: 'mem_1',
      type: 'decision',
      title: 'Brain approved handoff',
      content: 'Approval record.',
      source: 'brain registry',
      sourceType: 'decision',
      owner: 'platform',
      tags: [],
      importance: { score: 0.5, level: 'medium', factors: [] },
      confidence: { score: 0.9, level: 'high', factors: [] },
      usage: { totalRetrievals: 3, totalConsumers: 1, frequency: 2, recency: 0.8 },
      lifecycleStatus: 'active',
      compressionState: 'compressed',
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

  it('scores important types and well-linked memories higher', () => {
    const important = svc.score(item());
    expect(important.score).toBeGreaterThan(0.7);
    expect(important.factors.length).toBeGreaterThan(0);

    const trivial = svc.score(
      item({
        type: 'working',
        confidence: { score: 0.4, level: 'low', factors: [] },
        usage: { totalRetrievals: 0, totalConsumers: 0, frequency: 1, recency: 0.1 },
      }),
    );
    expect(trivial.score).toBeLessThan(important.score);
  });

  it('awards a linkage bonus when related entities are present', () => {
    const linked = svc.score(
      item({ relatedGoal: 'goal_1', relatedProvider: 'openai', relatedCapability: 'reasoning' }),
    );
    const unlinked = svc.score(item());
    expect(linked.score).toBeGreaterThan(unlinked.score);
  });

  it('reinforcement from frequency and retrievals raises the score', () => {
    const fresh = svc.score(
      item({ usage: { totalRetrievals: 0, totalConsumers: 0, frequency: 1, recency: 0.1 } }),
    );
    const reinforced = svc.score(
      item({ usage: { totalRetrievals: 50, totalConsumers: 4, frequency: 30, recency: 1 } }),
    );
    expect(reinforced.score).toBeGreaterThan(fresh.score);
  });
});

describe('MemoryRankingService', () => {
  const svc = new MemoryRankingService();

  it('produces normalized composite scores in [0, 1]', () => {
    const memory = {
      memoryId: 'mem_1',
      type: 'provider',
      title: 't',
      content: 'c',
      source: 's',
      sourceType: 'event',
      owner: 'o',
      tags: [],
      importance: { score: 0.9, level: 'high', factors: [] },
      confidence: { score: 0.8, level: 'high', factors: [] },
      usage: { totalRetrievals: 10, totalConsumers: 0, frequency: 10, recency: 1 },
      lifecycleStatus: 'active',
      compressionState: 'compressed',
      retentionPolicy: 'long_term',
      consumers: [],
      relationships: [],
      citations: [],
      audit: [],
      createdAt: '2026-08-01T00:00:00.000Z',
      updatedAt: '2026-08-01T00:00:00.000Z',
    } satisfies MemoryItem;
    const ranked = svc.rank(memory);
    expect(ranked.score).toBeGreaterThan(0.8);
    expect(ranked.score).toBeLessThanOrEqual(1);
    expect(ranked.contributions.length).toBe(4);
  });

  it('sorts by score descending and defends against zero weights', () => {
    const zero = new MemoryRankingService({
      importance: 0,
      confidence: 0,
      recency: 0,
      frequency: 0,
    });
    const memory = {
      memoryId: 'mem_1',
      type: 'provider',
      title: 't',
      content: 'c',
      source: 's',
      sourceType: 'event',
      owner: 'o',
      tags: [],
      importance: { score: 0.9, level: 'high', factors: [] },
      confidence: { score: 0.8, level: 'high', factors: [] },
      usage: { totalRetrievals: 10, totalConsumers: 0, frequency: 10, recency: 1 },
      lifecycleStatus: 'active',
      compressionState: 'compressed',
      retentionPolicy: 'long_term',
      consumers: [],
      relationships: [],
      citations: [],
      audit: [],
      createdAt: '2026-08-01T00:00:00.000Z',
      updatedAt: '2026-08-01T00:00:00.000Z',
    } satisfies MemoryItem;
    expect(zero.rank(memory).score).toBeGreaterThanOrEqual(0);
  });
});

describe('MemoryLifecycleService', () => {
  const svc = new MemoryLifecycleService();

  function item(): MemoryItem {
    return {
      memoryId: 'mem_1',
      type: 'provider',
      title: 't',
      content: 'c',
      source: 's',
      sourceType: 'event',
      owner: 'o',
      tags: [],
      importance: { score: 0.5, level: 'medium', factors: [] },
      confidence: { score: 0.7, level: 'medium', factors: [] },
      usage: { totalRetrievals: 0, totalConsumers: 0, frequency: 1, recency: 1 },
      lifecycleStatus: 'captured',
      compressionState: 'raw',
      retentionPolicy: 'short_term',
      consumers: [],
      relationships: [],
      citations: [],
      audit: [],
      createdAt: '2026-08-01T00:00:00.000Z',
      updatedAt: '2026-08-01T00:00:00.000Z',
    };
  }

  it('transitions through the pipeline with audits', () => {
    let current = svc.transition(item(), 'validated', 'platform').item;
    expect(current.lifecycleStatus).toBe('validated');
    expect(current.audit[0]?.action).toBe('validated');

    current = svc.transition(current, 'consolidated', 'platform').item;
    current = svc.transition(current, 'ranked', 'platform').item;
    current = svc.transition(current, 'compressed', 'platform').item;
    current = svc.transition(current, 'active', 'platform').item;
    expect(current.lifecycleStatus).toBe('active');
    expect(svc.isRetrievable(current)).toBe(true);
  });

  it('rejects illegal transitions without mutating', () => {
    const result = svc.transition(item(), 'active', 'platform');
    expect(result.transitioned).toBe(false);
    expect(result.message).toBeDefined();
    expect(result.item.lifecycleStatus).toBe('captured');
  });

  it('allows archive → active restore', () => {
    const archived = svc.transition(
      { ...item(), lifecycleStatus: 'active' },
      'archived',
      'platform',
    ).item;
    expect(archived.lifecycleStatus).toBe('archived');
    const restored = svc.transition(archived, 'active', 'platform').item;
    expect(restored.lifecycleStatus).toBe('active');
  });
});
