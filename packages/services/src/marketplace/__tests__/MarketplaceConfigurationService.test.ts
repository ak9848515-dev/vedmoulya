// ──────────────────────────────────────────────────────────────────
// VedMoulya — Marketplace Configuration Service Tests
// BLD-014 — Marketplace Platform
// ──────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import { MarketplaceConfigurationService } from '../MarketplaceConfigurationService.js';

describe('MarketplaceConfigurationService', () => {
  it('getConfig returns default config for new user', () => {
    const svc = new MarketplaceConfigurationService();
    const config = svc.getConfig('user1');
    expect(config.userId).toBe('user1');
    expect(config.autoUpdate).toBe(true);
    expect(config.cacheTTL).toBe(300_000);
    expect(config.registryUrl).toBe('https://marketplace.vedmoulya.com/api/v1');
  });

  it('getConfig returns same config for existing user', () => {
    const svc = new MarketplaceConfigurationService();
    const first = svc.getConfig('user2');
    const second = svc.getConfig('user2');
    expect(first).toBe(second);
  });

  it('updateConfig merges partial updates', () => {
    const svc = new MarketplaceConfigurationService();
    svc.getConfig('user3');
    const updated = svc.updateConfig('user3', { autoUpdate: false, allowBetaVersions: true });
    expect(updated.autoUpdate).toBe(false);
    expect(updated.allowBetaVersions).toBe(true);
    expect(updated.userId).toBe('user3');
    expect(updated.cacheTTL).toBe(300_000);
  });

  it('resetConfig restores defaults', () => {
    const svc = new MarketplaceConfigurationService();
    svc.getConfig('user4');
    svc.updateConfig('user4', { autoUpdate: false, allowBetaVersions: true });
    const reset = svc.resetConfig('user4');
    expect(reset.autoUpdate).toBe(true);
    expect(reset.allowBetaVersions).toBe(false);
  });
});
