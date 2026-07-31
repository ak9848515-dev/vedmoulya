// ──────────────────────────────────────────────────────────────────
// VedMoulya — Marketplace Provider Service
// BLD-014 — Marketplace Platform
// ──────────────────────────────────────────────────────────────────

import type { MarketplaceProviderDTO, ProviderStatus } from './MarketplaceDTO.js';

export class MarketplaceProviderService {
  private readonly providers = new Map<string, MarketplaceProviderDTO>();

  registerProvider(provider: MarketplaceProviderDTO): void {
    this.providers.set(provider.id, provider);
  }

  getProvider(providerId: string): MarketplaceProviderDTO | undefined {
    return this.providers.get(providerId);
  }

  getAllProviders(): MarketplaceProviderDTO[] {
    return Array.from(this.providers.values());
  }

  getActiveProviders(): MarketplaceProviderDTO[] {
    return Array.from(this.providers.values()).filter((p) => p.status === 'active');
  }

  getProvidersByType(type: MarketplaceProviderDTO['type']): MarketplaceProviderDTO[] {
    return Array.from(this.providers.values()).filter((p) => p.type === type);
  }

  updateProviderStatus(providerId: string, status: ProviderStatus): void {
    const provider = this.providers.get(providerId);
    if (provider)
      this.providers.set(providerId, {
        ...provider,
        status,
        lastChecked: new Date().toISOString(),
      });
  }

  updateProviderLatency(providerId: string, latency: number): void {
    const provider = this.providers.get(providerId);
    if (provider)
      this.providers.set(providerId, {
        ...provider,
        latency,
        lastChecked: new Date().toISOString(),
      });
  }

  updateProviderConfig(providerId: string, config: Record<string, string>): void {
    const provider = this.providers.get(providerId);
    if (provider)
      this.providers.set(providerId, { ...provider, config: { ...provider.config, ...config } });
  }

  setDefaultProvider(providerId: string): void {
    for (const [id, p] of this.providers) {
      this.providers.set(id, { ...p, isDefault: id === providerId });
    }
  }

  getDefaultProvider(): MarketplaceProviderDTO | undefined {
    return Array.from(this.providers.values()).find((p) => p.isDefault);
  }

  getProviderCount(): number {
    return this.providers.size;
  }

  getErrorRate(): number {
    const providers = Array.from(this.providers.values());
    if (providers.length === 0) return 0;
    return providers.reduce((s, p) => s + p.errorRate, 0) / providers.length;
  }

  removeProvider(providerId: string): void {
    this.providers.delete(providerId);
  }
}
