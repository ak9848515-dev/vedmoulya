// ──────────────────────────────────────────────────────────────────
// VedMoulya — Marketplace Version Service Tests
// BLD-014 — Marketplace Platform
// ──────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import { MarketplaceVersionService } from '../MarketplaceVersionService.js';
import type { MarketplaceVersionDTO } from '../MarketplaceDTO.js';

function makeVersion(
  overrides: Partial<MarketplaceVersionDTO> & { assetId: string; version: string },
): MarketplaceVersionDTO {
  return {
    assetName: 'Test',
    changes: [],
    breaking: false,
    publishedAt: new Date().toISOString(),
    isCurrent: false,
    size: 0,
    compatibility: 'compatible',
    ...overrides,
  };
}

describe('MarketplaceVersionService', () => {
  it('getVersions returns empty for unknown asset', () => {
    const svc = new MarketplaceVersionService();
    expect(svc.getVersions('unknown')).toEqual([]);
  });

  it('addVersion and getVersions roundtrips', () => {
    const svc = new MarketplaceVersionService();
    svc.addVersion(makeVersion({ assetId: 'a1', version: '1.0.0' }));
    const versions = svc.getVersions('a1');
    expect(versions.length).toBe(1);
    expect(versions[0].version).toBe('1.0.0');
  });

  it('getVersions returns sorted by date descending', () => {
    const svc = new MarketplaceVersionService();
    svc.addVersion(
      makeVersion({ assetId: 'a1', version: '1.0.0', publishedAt: '2024-01-01T00:00:00Z' }),
    );
    svc.addVersion(
      makeVersion({ assetId: 'a1', version: '2.0.0', publishedAt: '2024-06-01T00:00:00Z' }),
    );
    const versions = svc.getVersions('a1');
    expect(versions[0].version).toBe('2.0.0');
  });

  it('getCurrentVersion finds current', () => {
    const svc = new MarketplaceVersionService();
    svc.addVersion(makeVersion({ assetId: 'a1', version: '1.0.0', isCurrent: true }));
    svc.addVersion(makeVersion({ assetId: 'a1', version: '2.0.0' }));
    const current = svc.getCurrentVersion('a1');
    expect(current?.version).toBe('1.0.0');
  });

  it('getAvailableUpdates returns uninstalled versions', () => {
    const svc = new MarketplaceVersionService();
    svc.addVersion(
      makeVersion({ assetId: 'a1', version: '1.0.0', installedAt: new Date().toISOString() }),
    );
    svc.addVersion(makeVersion({ assetId: 'a1', version: '2.0.0' }));
    const updates = svc.getAvailableUpdates('a1');
    expect(updates.length).toBe(1);
    expect(updates[0].version).toBe('2.0.0');
  });

  it('getAllAvailableUpdates aggregates across assets', () => {
    const svc = new MarketplaceVersionService();
    svc.addVersion(makeVersion({ assetId: 'a1', version: '1.0.0' }));
    svc.addVersion(makeVersion({ assetId: 'a2', version: '1.0.0' }));
    expect(svc.getAllAvailableUpdates().length).toBe(2);
  });

  it('markInstalled sets isCurrent and installedAt', () => {
    const svc = new MarketplaceVersionService();
    svc.addVersion(makeVersion({ assetId: 'a1', version: '1.0.0' }));
    svc.markInstalled('a1', '1.0.0');
    const current = svc.getCurrentVersion('a1');
    expect(current?.isCurrent).toBe(true);
    expect(current?.installedAt).toBeDefined();
  });

  it('markInstalled updates multiple versions', () => {
    const svc = new MarketplaceVersionService();
    svc.addVersion(makeVersion({ assetId: 'a1', version: '1.0.0' }));
    svc.addVersion(makeVersion({ assetId: 'a1', version: '2.0.0' }));
    svc.markInstalled('a1', '2.0.0');
    const v1 = svc.getVersions('a1').find((v) => v.version === '1.0.0');
    const v2 = svc.getVersions('a1').find((v) => v.version === '2.0.0');
    expect(v1?.isCurrent).toBe(false);
    expect(v2?.isCurrent).toBe(true);
  });

  it('getBreakingChanges returns breaking versions', () => {
    const svc = new MarketplaceVersionService();
    svc.addVersion(makeVersion({ assetId: 'a1', version: '1.0.0', breaking: false }));
    svc.addVersion(makeVersion({ assetId: 'a1', version: '2.0.0', breaking: true }));
    const breaking = svc.getBreakingChanges('a1');
    expect(breaking.length).toBe(1);
    expect(breaking[0].version).toBe('2.0.0');
  });

  it('removeAssetVersions deletes all versions', () => {
    const svc = new MarketplaceVersionService();
    svc.addVersion(makeVersion({ assetId: 'a1', version: '1.0.0' }));
    svc.removeAssetVersions('a1');
    expect(svc.getVersions('a1')).toEqual([]);
  });
});
