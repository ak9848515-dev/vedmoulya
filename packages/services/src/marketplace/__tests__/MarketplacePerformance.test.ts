// ──────────────────────────────────────────────────────────────────
// VedMoulya — Marketplace Performance Tests
// BLD-014 — Marketplace Platform
// ──────────────────────────────────────────────────────────────────

import { describe, it, expect, vi } from 'vitest';
import { MarketplaceCacheService } from '../MarketplaceCacheService.js';
import { MarketplaceMetricsService } from '../MarketplaceMetricsService.js';
import { MarketplaceDTOMapper } from '../MarketplaceDTOMapper.js';

describe('Marketplace Performance', () => {
  it('cache get completes under 50ms', () => {
    const svc = new MarketplaceCacheService();
    svc.set('perf_test', { data: 'test' });
    const start = performance.now();
    svc.get('perf_test');
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(50);
  });

  it('cache miss completes under 50ms', () => {
    const svc = new MarketplaceCacheService();
    const start = performance.now();
    svc.get('nonexistent');
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(50);
  });

  it('metrics calculation completes under 50ms', () => {
    const svc = new MarketplaceMetricsService();
    const start = performance.now();
    svc.aggregate({
      totalAssets: 100,
      installedCount: 20,
      activeCount: 15,
      availableUpdates: 5,
      providerCount: 3,
      templateCount: 8,
      packCount: 4,
      averageRating: 4.5,
      totalDownloads: 1000,
      compatibilityScore: 90,
      installationSuccessRate: 95,
      catalogCompleteness: 80,
      providerHealth: 85,
      updateCoverage: 75,
    });
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(50);
  });

  it('mapper createHealthIndicator completes under 50ms', () => {
    const mapper = new MarketplaceDTOMapper();
    const start = performance.now();
    mapper.createHealthIndicator([
      { name: 'a', status: 'healthy', latency: 10 },
      { name: 'b', status: 'healthy', latency: 20 },
    ]);
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(50);
  });

  it('mapper toTimeline completes under 50ms for 100 entries', () => {
    const mapper = new MarketplaceDTOMapper();
    const entries = Array.from({ length: 100 }, (_, i) => ({
      id: `${i}`,
      type: 'installation' as const,
      title: `E${i}`,
      description: '',
      timestamp: new Date().toISOString(),
      importance: 5,
      icon: 'icon',
    }));
    const start = performance.now();
    mapper.toTimeline(entries);
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(50);
  });

  it('snapshot generation completes under 500ms (assembler simulation)', async () => {
    const mocks = {
      identity: { getUserById: vi.fn().mockResolvedValue({ id: 'u1' }) },
      memory: { getStats: vi.fn().mockResolvedValue({}) },
      decision: { getStats: vi.fn().mockResolvedValue({}) },
      execution: { getStats: vi.fn().mockResolvedValue({}) },
      knowledge: { getStats: vi.fn().mockResolvedValue({}) },
      ai: { orchestrate: vi.fn().mockResolvedValue({ success: true, data: {} }) },
    };
    const { MarketplaceAssembler } = await import('../MarketplaceAssembler.js');
    const assembler = new MarketplaceAssembler(
      mocks.identity as any,
      mocks.memory as any,
      mocks.decision as any,
      mocks.execution as any,
      mocks.knowledge as any,
      mocks.ai as any,
    );
    const start = performance.now();
    await assembler.assemble('u1', 'Perf Test');
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(500);
  });
});
