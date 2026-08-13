// ──────────────────────────────────────────────────────────────────
// VedMoulya — Knowledge Analytics tests
// EI-009 — Enterprise Knowledge Intelligence Platform
// ──────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import { KnowledgeAnalyticsService } from '../KnowledgeAnalyticsService.js';
import { createCatalogKnowledgeItems } from '../../../catalog/knowledge-catalog.js';

describe('KnowledgeAnalyticsService', () => {
  const service = new KnowledgeAnalyticsService();
  const items = createCatalogKnowledgeItems();

  it('aggregates totals over the registry', () => {
    const analytics = service.aggregate(items);
    expect(analytics.totals.items).toBe(items.length);
    expect(analytics.totals.relationships).toBe(
      items.reduce((sum, i) => sum + i.relationships.length, 0),
    );
    expect(analytics.totals.citations).toBeGreaterThan(0);
    expect(analytics.totals.avgTrust).toBeGreaterThan(0);
    expect(analytics.totals.avgTrust).toBeLessThanOrEqual(1);
    expect(analytics.totals.active).toBeGreaterThan(0);
  });

  it('counts per category with every category zero-filled', () => {
    const analytics = service.aggregate(items);
    const present = Object.values(analytics.byCategory).filter((count) => count > 0).length;
    expect(present).toBe(14);
    expect(analytics.byCategory.ai).toBeGreaterThan(0);
    expect(analytics.byCategory.sap).toBeGreaterThan(0);
  });

  it('builds a trust distribution across all four bands', () => {
    const analytics = service.aggregate(items);
    expect(analytics.trustDistribution.map((b) => b.band)).toEqual([
      'low',
      'medium',
      'strong',
      'high',
    ]);
    expect(analytics.trustDistribution.reduce((sum, b) => sum + b.count, 0)).toBe(items.length);
  });

  it('ranks usage top and consumers top', () => {
    const analytics = service.aggregate(items);
    expect(analytics.usageTop[0].reads).toBeGreaterThanOrEqual(
      analytics.usageTop[analytics.usageTop.length - 1].reads,
    );
    expect(analytics.consumersTop[0].consumerLabel.length).toBeGreaterThan(0);
  });

  it('zero-fills the 14-day trend', () => {
    const analytics = service.aggregate(items);
    expect(analytics.trend.length).toBe(14);
    expect(analytics.trend[analytics.trend.length - 1].date).toBe(
      new Date().toISOString().slice(0, 10),
    );
    // Only items created inside the 14-day window land on the trend buckets.
    expect(analytics.trend.reduce((sum, t) => sum + t.items, 0)).toBeGreaterThan(0);
  });

  it('handles an empty registry', () => {
    const analytics = service.aggregate([]);
    expect(analytics.totals.items).toBe(0);
    expect(analytics.totals.avgTrust).toBe(0);
    expect(analytics.byCategory.business).toBe(0);
    expect(analytics.usageTop.length).toBe(0);
    expect(analytics.trustDistribution.reduce((sum, b) => sum + b.count, 0)).toBe(0);
  });
});
