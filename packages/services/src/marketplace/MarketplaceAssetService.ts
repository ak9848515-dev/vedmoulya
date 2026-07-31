// ──────────────────────────────────────────────────────────────────
// VedMoulya — Marketplace Asset Service
// BLD-014 — Marketplace Platform
// ──────────────────────────────────────────────────────────────────

import type { MarketplaceAssetDTO } from './MarketplaceDTO.js';

export class MarketplaceAssetService {
  private readonly assets = new Map<string, MarketplaceAssetDTO>();
  private readonly userAssets = new Map<string, Set<string>>();

  getInstalledAssets(userId: string): MarketplaceAssetDTO[] {
    const assetIds = this.userAssets.get(userId);
    if (!assetIds) return [];
    return Array.from(assetIds)
      .map((id) => this.assets.get(id))
      .filter((a): a is MarketplaceAssetDTO => !!a);
  }

  getActiveAssets(userId: string): MarketplaceAssetDTO[] {
    return this.getInstalledAssets(userId).filter((a) => a.isActive);
  }

  getAsset(assetId: string): MarketplaceAssetDTO | undefined {
    return this.assets.get(assetId);
  }

  registerAsset(asset: MarketplaceAssetDTO): void {
    this.assets.set(asset.id, asset);
  }

  installAsset(userId: string, asset: MarketplaceAssetDTO): void {
    const installed = { ...asset, isInstalled: true };
    this.assets.set(asset.id, installed);
    const userSet = this.userAssets.get(userId) ?? new Set();
    userSet.add(asset.id);
    this.userAssets.set(userId, userSet);
  }

  uninstallAsset(userId: string, assetId: string): void {
    const userSet = this.userAssets.get(userId);
    if (userSet) {
      userSet.delete(assetId);
      const asset = this.assets.get(assetId);
      if (asset) this.assets.set(assetId, { ...asset, isInstalled: false, isActive: false });
    }
  }

  activateAsset(assetId: string): void {
    const asset = this.assets.get(assetId);
    if (asset) this.assets.set(assetId, { ...asset, isActive: true });
  }

  deactivateAsset(assetId: string): void {
    const asset = this.assets.get(assetId);
    if (asset) this.assets.set(assetId, { ...asset, isActive: false });
  }

  getInstalledCount(userId: string): number {
    return this.userAssets.get(userId)?.size ?? 0;
  }

  getActiveCount(userId: string): number {
    return this.getInstalledAssets(userId).filter((a) => a.isActive).length;
  }
}
