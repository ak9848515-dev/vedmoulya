// ──────────────────────────────────────────────────────────────────
// VedMoulya — Marketplace Insight Service Tests
// BLD-014 — Marketplace Platform
// ──────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import { MarketplaceInsightService } from '../MarketplaceInsightService.js';

describe('MarketplaceInsightService', () => {
  it('generateInsights returns empty for zero triggers', () => {
    const svc = new MarketplaceInsightService();
    const insights = svc.generateInsights({
      installErrors: 0,
      providerErrors: 0,
      compatibilityIssues: 0,
      availableUpdates: 0,
      newAssetsCount: 0,
      pendingActivations: 0,
      totalInstalled: 0,
      activeCount: 0,
    });
    expect(insights).toEqual([]);
  });

  it('generates warning for multiple install errors', () => {
    const svc = new MarketplaceInsightService();
    const insights = svc.generateInsights({
      installErrors: 3,
      providerErrors: 0,
      compatibilityIssues: 0,
      availableUpdates: 0,
      newAssetsCount: 0,
      pendingActivations: 0,
      totalInstalled: 0,
      activeCount: 0,
    });
    expect(insights.some((i) => i.type === 'warning' && i.title.includes('Installation'))).toBe(
      true,
    );
  });

  it('does not generate install error insight for few errors', () => {
    const svc = new MarketplaceInsightService();
    const insights = svc.generateInsights({
      installErrors: 1,
      providerErrors: 0,
      compatibilityIssues: 0,
      availableUpdates: 0,
      newAssetsCount: 0,
      pendingActivations: 0,
      totalInstalled: 0,
      activeCount: 0,
    });
    expect(insights.some((i) => i.title.includes('Installation'))).toBe(false);
  });

  it('generates critical insight for provider errors', () => {
    const svc = new MarketplaceInsightService();
    const insights = svc.generateInsights({
      installErrors: 0,
      providerErrors: 1,
      compatibilityIssues: 0,
      availableUpdates: 0,
      newAssetsCount: 0,
      pendingActivations: 0,
      totalInstalled: 0,
      activeCount: 0,
    });
    expect(insights.some((i) => i.severity === 'critical')).toBe(true);
  });

  it('uses plural text for multiple provider errors', () => {
    const svc = new MarketplaceInsightService();
    const insights = svc.generateInsights({
      installErrors: 0,
      providerErrors: 2,
      compatibilityIssues: 0,
      availableUpdates: 0,
      newAssetsCount: 0,
      pendingActivations: 0,
      totalInstalled: 0,
      activeCount: 0,
    });
    expect(insights[0].description).toContain('providers');
  });

  it('generates info insight for many updates', () => {
    const svc = new MarketplaceInsightService();
    const insights = svc.generateInsights({
      installErrors: 0,
      providerErrors: 0,
      compatibilityIssues: 0,
      availableUpdates: 6,
      newAssetsCount: 0,
      pendingActivations: 0,
      totalInstalled: 0,
      activeCount: 0,
    });
    expect(insights.some((i) => i.title.includes('Updates'))).toBe(true);
  });

  it('does not generate update insight for few updates', () => {
    const svc = new MarketplaceInsightService();
    const insights = svc.generateInsights({
      installErrors: 0,
      providerErrors: 0,
      compatibilityIssues: 0,
      availableUpdates: 3,
      newAssetsCount: 0,
      pendingActivations: 0,
      totalInstalled: 0,
      activeCount: 0,
    });
    expect(insights.some((i) => i.title.includes('Updates'))).toBe(false);
  });

  it('generates compatibility warning insight', () => {
    const svc = new MarketplaceInsightService();
    const insights = svc.generateInsights({
      installErrors: 0,
      providerErrors: 0,
      compatibilityIssues: 2,
      availableUpdates: 0,
      newAssetsCount: 0,
      pendingActivations: 0,
      totalInstalled: 0,
      activeCount: 0,
    });
    expect(insights.some((i) => i.title.includes('Compatibility'))).toBe(true);
  });

  it('uses singular text for single compatibility issue', () => {
    const svc = new MarketplaceInsightService();
    const insights = svc.generateInsights({
      installErrors: 0,
      providerErrors: 0,
      compatibilityIssues: 1,
      availableUpdates: 0,
      newAssetsCount: 0,
      pendingActivations: 0,
      totalInstalled: 0,
      activeCount: 0,
    });
    expect(insights[0].description).toContain('asset has');
  });

  it('uses plural text for multiple compatibility issues', () => {
    const svc = new MarketplaceInsightService();
    const insights = svc.generateInsights({
      installErrors: 0,
      providerErrors: 0,
      compatibilityIssues: 3,
      availableUpdates: 0,
      newAssetsCount: 0,
      pendingActivations: 0,
      totalInstalled: 0,
      activeCount: 0,
    });
    expect(insights[0].description).toContain('assets have');
  });

  it('does not generate update insight for exactly 5 updates (boundary)', () => {
    const svc = new MarketplaceInsightService();
    const insights = svc.generateInsights({
      installErrors: 0,
      providerErrors: 0,
      compatibilityIssues: 0,
      availableUpdates: 5,
      newAssetsCount: 0,
      pendingActivations: 0,
      totalInstalled: 0,
      activeCount: 0,
    });
    expect(insights.some((i) => i.title.includes('Updates'))).toBe(false);
  });

  it('generates positive insight for new assets', () => {
    const svc = new MarketplaceInsightService();
    const insights = svc.generateInsights({
      installErrors: 0,
      providerErrors: 0,
      compatibilityIssues: 0,
      availableUpdates: 0,
      newAssetsCount: 3,
      pendingActivations: 0,
      totalInstalled: 0,
      activeCount: 0,
    });
    expect(insights.some((i) => i.severity === 'positive')).toBe(true);
  });

  it('sorts insights by severity order', () => {
    const svc = new MarketplaceInsightService();
    const insights = svc.generateInsights({
      installErrors: 3,
      providerErrors: 1,
      compatibilityIssues: 2,
      availableUpdates: 6,
      newAssetsCount: 3,
      pendingActivations: 0,
      totalInstalled: 0,
      activeCount: 0,
    });
    const severities = insights.map((i) => i.severity);
    const critIdx = severities.indexOf('critical');
    const warnIdx = severities.indexOf('warning');
    const posIdx = severities.indexOf('positive');
    const infoIdx = severities.indexOf('info');
    expect(critIdx).toBeLessThan(warnIdx);
    expect(warnIdx).toBeLessThan(posIdx);
    expect(posIdx).toBeLessThan(infoIdx);
  });

  it('getActionableInsights filters correctly', () => {
    const svc = new MarketplaceInsightService();
    const insights = svc.generateInsights({
      installErrors: 3,
      providerErrors: 1,
      compatibilityIssues: 0,
      availableUpdates: 0,
      newAssetsCount: 3,
      pendingActivations: 0,
      totalInstalled: 0,
      activeCount: 0,
    });
    const actionable = svc.getActionableInsights(insights);
    expect(actionable.every((i) => i.actionable)).toBe(true);
  });
});
