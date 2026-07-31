// ──────────────────────────────────────────────────────────────────
// VedMoulya — Marketplace Asset Service Tests
// BLD-014 — Marketplace Platform
// ──────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import { MarketplaceAssetService } from '../MarketplaceAssetService.js';
import type { MarketplaceAssetDTO } from '../MarketplaceDTO.js';

function makeAsset(
  overrides: Partial<MarketplaceAssetDTO> & { id: string; name: string },
): MarketplaceAssetDTO {
  return {
    type: 'ai_provider',
    description: '',
    category: 'general',
    version: '1.0.0',
    author: 'test',
    publisher: 'test',
    tags: [],
    rating: 3,
    downloadCount: 0,
    isInstalled: false,
    isActive: false,
    isBuiltIn: false,
    size: 0,
    requirements: [],
    screenshots: [],
    changelog: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('MarketplaceAssetService', () => {
  it('getInstalledAssets returns empty for new user', () => {
    const svc = new MarketplaceAssetService();
    expect(svc.getInstalledAssets('user1')).toEqual([]);
  });

  it('installAsset adds to user installed set', () => {
    const svc = new MarketplaceAssetService();
    const asset = makeAsset({ id: 'a1', name: 'Test Provider' });
    svc.registerAsset(asset);
    svc.installAsset('user1', asset);
    const installed = svc.getInstalledAssets('user1');
    expect(installed.length).toBe(1);
    expect(installed[0].isInstalled).toBe(true);
  });

  it('getInstalledCount returns correct count', () => {
    const svc = new MarketplaceAssetService();
    svc.registerAsset(makeAsset({ id: 'a1', name: 'A' }));
    svc.registerAsset(makeAsset({ id: 'a2', name: 'B' }));
    svc.installAsset('user1', makeAsset({ id: 'a1', name: 'A' }));
    expect(svc.getInstalledCount('user1')).toBe(1);
    svc.installAsset('user1', makeAsset({ id: 'a2', name: 'B' }));
    expect(svc.getInstalledCount('user1')).toBe(2);
  });

  it('uninstallAsset removes from installed set', () => {
    const svc = new MarketplaceAssetService();
    svc.registerAsset(makeAsset({ id: 'a1', name: 'Test' }));
    svc.installAsset('user1', makeAsset({ id: 'a1', name: 'Test' }));
    svc.uninstallAsset('user1', 'a1');
    expect(svc.getInstalledAssets('user1').length).toBe(0);
  });

  it('activateAsset sets isActive true', () => {
    const svc = new MarketplaceAssetService();
    svc.registerAsset(makeAsset({ id: 'a1', name: 'Test' }));
    svc.activateAsset('a1');
    expect(svc.getAsset('a1')?.isActive).toBe(true);
  });

  it('deactivateAsset sets isActive false', () => {
    const svc = new MarketplaceAssetService();
    svc.registerAsset(makeAsset({ id: 'a1', name: 'Test', isActive: true }));
    svc.deactivateAsset('a1');
    expect(svc.getAsset('a1')?.isActive).toBe(false);
  });

  it('getActiveAssets returns only active installed assets', () => {
    const svc = new MarketplaceAssetService();
    svc.registerAsset(makeAsset({ id: 'a1', name: 'Active' }));
    svc.registerAsset(makeAsset({ id: 'a2', name: 'Inactive' }));
    svc.installAsset('user1', makeAsset({ id: 'a1', name: 'Active', isActive: true }));
    svc.installAsset('user1', makeAsset({ id: 'a2', name: 'Inactive' }));
    const active = svc.getActiveAssets('user1');
    expect(active.length).toBe(1);
    expect(active[0].id).toBe('a1');
  });

  it('getActiveCount returns correct count', () => {
    const svc = new MarketplaceAssetService();
    svc.registerAsset(makeAsset({ id: 'a1', name: 'A' }));
    svc.installAsset('user1', makeAsset({ id: 'a1', name: 'A', isActive: true }));
    expect(svc.getActiveCount('user1')).toBe(1);
    svc.deactivateAsset('a1');
    expect(svc.getActiveCount('user1')).toBe(0);
  });

  it('uninstallAsset no-ops for unknown user', () => {
    const svc = new MarketplaceAssetService();
    expect(() => svc.uninstallAsset('unknown', 'a1')).not.toThrow();
  });
});
