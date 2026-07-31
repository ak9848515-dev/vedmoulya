// ──────────────────────────────────────────────────────────────────
// VedMoulya — Marketplace Version Service
// BLD-014 — Marketplace Platform
// ──────────────────────────────────────────────────────────────────

import type { MarketplaceVersionDTO } from './MarketplaceDTO.js';

export class MarketplaceVersionService {
  private readonly versions = new Map<string, MarketplaceVersionDTO[]>();

  addVersion(version: MarketplaceVersionDTO): void {
    const existing = this.versions.get(version.assetId) ?? [];
    this.versions.set(version.assetId, [...existing, version]);
  }

  getVersions(assetId: string): MarketplaceVersionDTO[] {
    return (this.versions.get(assetId) ?? []).sort(
      (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime(),
    );
  }

  getCurrentVersion(assetId: string): MarketplaceVersionDTO | undefined {
    return this.getVersions(assetId).find((v) => v.isCurrent);
  }

  getAvailableUpdates(assetId: string): MarketplaceVersionDTO[] {
    return this.getVersions(assetId).filter((v) => !v.installedAt);
  }

  getAllAvailableUpdates(): MarketplaceVersionDTO[] {
    const all: MarketplaceVersionDTO[] = [];
    for (const versions of this.versions.values()) {
      for (const v of versions) {
        if (!v.installedAt) all.push(v);
      }
    }
    return all.sort(
      (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime(),
    );
  }

  markInstalled(assetId: string, version: string): void {
    const versions = this.versions.get(assetId) ?? [];
    this.versions.set(
      assetId,
      versions.map((v) => ({
        ...v,
        isCurrent: v.version === version,
        installedAt: v.version === version ? new Date().toISOString() : v.installedAt,
      })),
    );
  }

  getBreakingChanges(assetId: string): MarketplaceVersionDTO[] {
    return this.getVersions(assetId).filter((v) => v.breaking);
  }

  removeAssetVersions(assetId: string): void {
    this.versions.delete(assetId);
  }
}
