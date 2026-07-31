// ──────────────────────────────────────────────────────────────────
// VedMoulya — Marketplace DTOMapper Tests
// BLD-014 — Marketplace Platform
// ──────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import { MarketplaceDTOMapper } from '../MarketplaceDTOMapper.js';
import type { MarketplaceTimelineEntryDTO } from '../MarketplaceDTO.js';

describe('MarketplaceDTOMapper', () => {
  it('toTimeline returns correct DTO', () => {
    const mapper = new MarketplaceDTOMapper();
    const entries: MarketplaceTimelineEntryDTO[] = [
      {
        id: '1',
        type: 'installation',
        title: 'Installed',
        description: '',
        timestamp: new Date().toISOString(),
        importance: 5,
        icon: 'icon',
      },
    ];
    const timeline = mapper.toTimeline(entries);
    expect(timeline.entries.length).toBe(1);
    expect(timeline.totalEntries).toBe(1);
    expect(timeline.hasMore).toBe(false);
  });

  it('toTimeline hasMore true for 20+ entries', () => {
    const mapper = new MarketplaceDTOMapper();
    const entries: MarketplaceTimelineEntryDTO[] = Array.from({ length: 20 }, (_, i) => ({
      id: `${i}`,
      type: 'installation' as const,
      title: `E${i}`,
      description: '',
      timestamp: new Date().toISOString(),
      importance: 5,
      icon: 'icon',
    }));
    const timeline = mapper.toTimeline(entries);
    expect(timeline.hasMore).toBe(true);
  });

  it('toTimeline hasMore false for 19 entries', () => {
    const mapper = new MarketplaceDTOMapper();
    const entries: MarketplaceTimelineEntryDTO[] = Array.from({ length: 19 }, (_, i) => ({
      id: `${i}`,
      type: 'installation' as const,
      title: `E${i}`,
      description: '',
      timestamp: new Date().toISOString(),
      importance: 5,
      icon: 'icon',
    }));
    const timeline = mapper.toTimeline(entries);
    expect(timeline.hasMore).toBe(false);
  });

  it('toTimeline handles empty array', () => {
    const mapper = new MarketplaceDTOMapper();
    const timeline = mapper.toTimeline([]);
    expect(timeline.totalEntries).toBe(0);
    expect(timeline.hasMore).toBe(false);
  });

  it('createQuickAction creates with defaults', () => {
    const mapper = new MarketplaceDTOMapper();
    const qa = mapper.createQuickAction('act1', 'Test', 'Desc', 'icon', '/route', 1, 'category');
    expect(qa.id).toBe('act1');
    expect(qa.isAvailable).toBe(true);
    expect(qa.disabledReason).toBeUndefined();
  });

  it('createQuickAction with disabled reason', () => {
    const mapper = new MarketplaceDTOMapper();
    const qa = mapper.createQuickAction(
      'act1',
      'Test',
      'Desc',
      'icon',
      '/route',
      1,
      'category',
      false,
      'Not available',
    );
    expect(qa.isAvailable).toBe(false);
    expect(qa.disabledReason).toBe('Not available');
  });

  it('createHealthIndicator returns healthy for all healthy', () => {
    const mapper = new MarketplaceDTOMapper();
    const health = mapper.createHealthIndicator([
      { name: 'catalog', status: 'healthy', latency: 10 },
    ]);
    expect(health.overall).toBe('healthy');
    expect(health.warnings.length).toBe(0);
  });

  it('createHealthIndicator flags critical for down service', () => {
    const mapper = new MarketplaceDTOMapper();
    const health = mapper.createHealthIndicator([{ name: 'registry', status: 'down', latency: 0 }]);
    expect(health.overall).toBe('critical');
    expect(health.warnings.some((w) => w.includes('down'))).toBe(true);
  });

  it('createHealthIndicator flags degraded for degraded service', () => {
    const mapper = new MarketplaceDTOMapper();
    const health = mapper.createHealthIndicator([
      { name: 'catalog', status: 'degraded', latency: 500 },
    ]);
    expect(health.overall).toBe('degraded');
    expect(health.warnings.some((w) => w.includes('degraded'))).toBe(true);
  });

  it('aggregateMetrics computes overallHealth', () => {
    const mapper = new MarketplaceDTOMapper();
    const metrics = mapper.aggregateMetrics({
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
    });
    expect(metrics.totalAssets).toBe(100);
    expect(metrics.averageRating).toBe(4.5);
    expect(metrics.overallHealth).toBeGreaterThan(0);
  });

  it('aggregateMetrics handles zero active count', () => {
    const mapper = new MarketplaceDTOMapper();
    const metrics = mapper.aggregateMetrics({
      totalAssets: 0,
      installedCount: 0,
      activeCount: 0,
      availableUpdates: 0,
      providerCount: 0,
      templateCount: 0,
      packCount: 0,
      averageRating: 0,
      totalDownloads: 0,
      compatibilityScore: 0,
      installationSuccessRate: 0,
    });
    expect(metrics.overallHealth).toBe(0);
  });
});
