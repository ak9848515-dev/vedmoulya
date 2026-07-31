// ──────────────────────────────────────────────────────────────────
// VedMoulya — Marketplace ViewModel Factory Tests
// BLD-014 — Marketplace Platform
// ──────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import { MarketplaceViewModelFactory } from '../MarketplaceViewModelFactory.js';
import type { MarketplaceSnapshotDTO } from '../MarketplaceDTO.js';

function makeSnapshot(overrides: Partial<MarketplaceSnapshotDTO> = {}): MarketplaceSnapshotDTO {
  return {
    id: 'snap1',
    userId: 'u1',
    generatedAt: new Date().toISOString(),
    ttl: 300_000,
    catalog: { totalAssets: 0, categories: [], featured: [], popular: [], recent: [] },
    installedAssets: [],
    availableUpdates: [],
    providers: [],
    installedTemplates: [],
    knowledgePacks: [],
    workflowPacks: [],
    compatibility: {
      overall: 'compatible',
      platformVersion: '1.0.0',
      checks: [],
      issues: [],
      warnings: [],
    },
    recommendations: [],
    insights: [],
    versionHistory: [],
    installationHistory: [],
    notifications: [],
    metrics: {
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
      overallHealth: 0,
    },
    health: {
      overall: 'healthy',
      services: [],
      lastChecked: new Date().toISOString(),
      warnings: [],
    },
    timeline: { entries: [], totalEntries: 0, hasMore: false },
    quickActions: [],
    aiContext: { currentFocus: '', recentActivity: [], suggestedQuestions: [], contextSummary: '' },
    ...overrides,
  };
}

describe('MarketplaceViewModelFactory', () => {
  it('createCatalogViewModel extracts catalog summary', () => {
    const factory = new MarketplaceViewModelFactory();
    const snapshot = makeSnapshot({
      catalog: {
        totalAssets: 50,
        categories: [
          { id: 'c1', name: 'AI', slug: 'ai', description: '', icon: 'cpu', assetCount: 10 },
        ],
        featured: [{ id: 'f1' }] as any,
        popular: [{ id: 'p1' }] as any,
        recent: [{ id: 'r1' }, { id: 'r2' }] as any,
      },
    });
    const vm = factory.createCatalogViewModel(snapshot);
    expect(vm.totalAssets).toBe(50);
    expect(vm.categoriesCount).toBe(1);
    expect(vm.featuredCount).toBe(1);
    expect(vm.popularCount).toBe(1);
    expect(vm.recentAdditions).toBe(2);
  });

  it('createAssetHealthViewModel extracts asset health', () => {
    const factory = new MarketplaceViewModelFactory();
    const snapshot = makeSnapshot({
      installedAssets: [{ id: 'a1', isActive: true } as any, { id: 'a2', isActive: false } as any],
      availableUpdates: [{ id: 'u1' }] as any,
      metrics: { installationSuccessRate: 95 } as any,
    });
    const vm = factory.createAssetHealthViewModel(snapshot);
    expect(vm.totalInstalled).toBe(2);
    expect(vm.activeCount).toBe(1);
    expect(vm.updateCount).toBe(1);
    expect(vm.installSuccessRate).toBe(95);
  });

  it('createProviderSummaryViewModel extracts provider summary', () => {
    const factory = new MarketplaceViewModelFactory();
    const snapshot = makeSnapshot({
      providers: [
        { id: 'p1', status: 'active', errorRate: 0.1, isDefault: true } as any,
        { id: 'p2', status: 'error', errorRate: 0.3, isDefault: false } as any,
      ],
    });
    const vm = factory.createProviderSummaryViewModel(snapshot);
    expect(vm.totalProviders).toBe(2);
    expect(vm.activeProviders).toBe(1);
    expect(vm.errorRate).toBeGreaterThan(0);
    expect(vm.hasDefaultProvider).toBe(true);
  });

  it('createProviderSummaryViewModel with no providers', () => {
    const factory = new MarketplaceViewModelFactory();
    const snapshot = makeSnapshot();
    const vm = factory.createProviderSummaryViewModel(snapshot);
    expect(vm.totalProviders).toBe(0);
    expect(vm.errorRate).toBe(0);
    expect(vm.hasDefaultProvider).toBe(false);
  });

  it('createDashboardViewModel creates full view model', () => {
    const factory = new MarketplaceViewModelFactory();
    const snapshot = makeSnapshot();
    const vm = factory.createDashboardViewModel(snapshot);
    expect(vm.catalog).toBeDefined();
    expect(vm.assets).toBeDefined();
    expect(vm.providers).toBeDefined();
    expect(vm.metrics).toBeDefined();
    expect(vm.timeline).toBeDefined();
    expect(vm.health).toBeDefined();
    expect(vm.lastRefreshed).toBe(snapshot.generatedAt);
  });
});
