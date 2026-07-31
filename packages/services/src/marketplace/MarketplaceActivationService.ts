// ──────────────────────────────────────────────────────────────────
// VedMoulya — Marketplace Activation Service
// BLD-014 — Marketplace Platform
// ──────────────────────────────────────────────────────────────────

import type { MarketplaceActivationDTO } from './MarketplaceDTO.js';

export class MarketplaceActivationService {
  private readonly activations = new Map<string, MarketplaceActivationDTO>();

  activateAsset(
    assetId: string,
    assetName: string,
    config?: Record<string, unknown>,
  ): MarketplaceActivationDTO {
    const existing = this.getActivation(assetId);
    if (existing) {
      const updated: MarketplaceActivationDTO = {
        ...existing,
        isActive: true,
        activatedAt: new Date().toISOString(),
        deactivatedAt: undefined,
        lastUsed: new Date().toISOString(),
        config: config ?? existing.config,
      };
      this.activations.set(assetId, updated);
      return updated;
    }
    const activation: MarketplaceActivationDTO = {
      id: `mact_${String(Date.now())}_${Math.random().toString(36).slice(2, 8)}`,
      assetId,
      assetName,
      isActive: true,
      activatedAt: new Date().toISOString(),
      lastUsed: new Date().toISOString(),
      usageCount: 0,
      config: config ?? {},
    };
    this.activations.set(assetId, activation);
    return activation;
  }

  deactivateAsset(assetId: string): MarketplaceActivationDTO | undefined {
    const activation = this.activations.get(assetId);
    if (!activation) return undefined;
    const updated: MarketplaceActivationDTO = {
      ...activation,
      isActive: false,
      deactivatedAt: new Date().toISOString(),
    };
    this.activations.set(assetId, updated);
    return updated;
  }

  recordUsage(assetId: string): void {
    const activation = this.activations.get(assetId);
    if (activation) {
      this.activations.set(assetId, {
        ...activation,
        usageCount: activation.usageCount + 1,
        lastUsed: new Date().toISOString(),
      });
    }
  }

  getActivation(assetId: string): MarketplaceActivationDTO | undefined {
    return this.activations.get(assetId);
  }

  getAllActivations(): MarketplaceActivationDTO[] {
    return Array.from(this.activations.values());
  }

  getActiveActivations(): MarketplaceActivationDTO[] {
    return Array.from(this.activations.values()).filter((a) => a.isActive);
  }

  getPendingActivations(): MarketplaceActivationDTO[] {
    return Array.from(this.activations.values()).filter((a) => !a.isActive && !!a.deactivatedAt);
  }

  removeActivation(assetId: string): void {
    this.activations.delete(assetId);
  }
}
