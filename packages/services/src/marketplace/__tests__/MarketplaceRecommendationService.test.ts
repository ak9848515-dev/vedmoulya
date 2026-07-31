// ──────────────────────────────────────────────────────────────────
// VedMoulya — Marketplace Recommendation Service Tests
// BLD-014 — Marketplace Platform
// ──────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import { MarketplaceRecommendationService } from '../MarketplaceRecommendationService.js';

describe('MarketplaceRecommendationService', () => {
  it('generateRecommendations returns base recommendations for empty input', () => {
    const svc = new MarketplaceRecommendationService();
    const recs = svc.generateRecommendations({
      availableUpdates: 0,
      uninstalledPopular: [],
      providersWithErrors: 0,
      pendingActivations: 0,
      incompatibleAssets: 0,
      newHighRatedAssets: [],
    });
    expect(recs.length).toBe(2); // explore + review templates always added
  });

  it('generates provider error recommendation', () => {
    const svc = new MarketplaceRecommendationService();
    const recs = svc.generateRecommendations({
      availableUpdates: 0,
      uninstalledPopular: [],
      providersWithErrors: 2,
      pendingActivations: 0,
      incompatibleAssets: 0,
      newHighRatedAssets: [],
    });
    expect(recs.some((r) => r.category === 'provider')).toBe(true);
  });

  it('uses singular text for single provider error', () => {
    const svc = new MarketplaceRecommendationService();
    const recs = svc.generateRecommendations({
      availableUpdates: 0,
      uninstalledPopular: [],
      providersWithErrors: 1,
      pendingActivations: 0,
      incompatibleAssets: 0,
      newHighRatedAssets: [],
    });
    expect(recs[0].description).toContain('1 provider');
  });

  it('generates pending activation recommendation', () => {
    const svc = new MarketplaceRecommendationService();
    const recs = svc.generateRecommendations({
      availableUpdates: 0,
      uninstalledPopular: [],
      providersWithErrors: 0,
      pendingActivations: 3,
      incompatibleAssets: 0,
      newHighRatedAssets: [],
    });
    expect(recs.some((r) => r.title.includes('Activate'))).toBe(true);
  });

  it('generates update recommendation', () => {
    const svc = new MarketplaceRecommendationService();
    const recs = svc.generateRecommendations({
      availableUpdates: 5,
      uninstalledPopular: [],
      providersWithErrors: 0,
      pendingActivations: 0,
      incompatibleAssets: 0,
      newHighRatedAssets: [],
    });
    expect(recs.some((r) => r.category === 'update')).toBe(true);
  });

  it('uses singular text for single update', () => {
    const svc = new MarketplaceRecommendationService();
    const recs = svc.generateRecommendations({
      availableUpdates: 1,
      uninstalledPopular: [],
      providersWithErrors: 0,
      pendingActivations: 0,
      incompatibleAssets: 0,
      newHighRatedAssets: [],
    });
    expect(recs[0].description).toContain('1 update');
  });

  it('generates compatibility recommendation', () => {
    const svc = new MarketplaceRecommendationService();
    const recs = svc.generateRecommendations({
      availableUpdates: 0,
      uninstalledPopular: [],
      providersWithErrors: 0,
      pendingActivations: 0,
      incompatibleAssets: 2,
      newHighRatedAssets: [],
    });
    expect(recs.some((r) => r.title.includes('Compatibility'))).toBe(true);
  });

  it('generates recommendation for high-rated new assets', () => {
    const svc = new MarketplaceRecommendationService();
    const recs = svc.generateRecommendations({
      availableUpdates: 0,
      uninstalledPopular: [],
      providersWithErrors: 0,
      pendingActivations: 0,
      incompatibleAssets: 0,
      newHighRatedAssets: [{ id: 'new1', name: 'GPT-5 Turbo', rating: 4.9 }] as any,
    });
    expect(recs.some((r) => r.title.includes('GPT-5'))).toBe(true);
  });

  it('generates recommendation for popular uninstalled assets', () => {
    const svc = new MarketplaceRecommendationService();
    const recs = svc.generateRecommendations({
      availableUpdates: 0,
      uninstalledPopular: [{ id: 'pop1', name: 'LangChain Pro', downloadCount: 100000 }] as any,
      providersWithErrors: 0,
      pendingActivations: 0,
      incompatibleAssets: 0,
      newHighRatedAssets: [],
    });
    expect(recs.some((r) => r.title.includes('LangChain'))).toBe(true);
  });

  it('prioritizeRecommendations filters dismissed and sorts', () => {
    const svc = new MarketplaceRecommendationService();
    const recs = svc.generateRecommendations({
      availableUpdates: 2,
      uninstalledPopular: [],
      providersWithErrors: 1,
      pendingActivations: 0,
      incompatibleAssets: 0,
      newHighRatedAssets: [],
    });
    const dismissed = svc.dismissRecommendation(recs, recs[0].id);
    const prioritized = svc.prioritizeRecommendations(dismissed, 10);
    expect(prioritized.length).toBe(recs.length - 1);
  });

  it('dismissRecommendation marks as dismissed', () => {
    const svc = new MarketplaceRecommendationService();
    const recs = svc.generateRecommendations({
      availableUpdates: 1,
      uninstalledPopular: [],
      providersWithErrors: 0,
      pendingActivations: 0,
      incompatibleAssets: 0,
      newHighRatedAssets: [],
    });
    const dismissed = svc.dismissRecommendation(recs, recs[0].id);
    expect(dismissed[0].isDismissed).toBe(true);
  });
});
