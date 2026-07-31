// ──────────────────────────────────────────────────────────────────
// VedMoulya — Marketplace Provider Service Tests
// BLD-014 — Marketplace Platform
// ──────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import { MarketplaceProviderService } from '../MarketplaceProviderService.js';
import type { MarketplaceProviderDTO } from '../MarketplaceDTO.js';

function makeProvider(
  overrides: Partial<MarketplaceProviderDTO> & { id: string; name: string },
): MarketplaceProviderDTO {
  return {
    type: 'ai',
    provider: 'test',
    version: '1.0.0',
    status: 'active',
    config: {},
    capabilities: [],
    isDefault: false,
    apiKeyConfigured: false,
    latency: 0,
    errorRate: 0,
    lastChecked: new Date().toISOString(),
    installedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('MarketplaceProviderService', () => {
  it('getAllProviders returns empty initially', () => {
    const svc = new MarketplaceProviderService();
    expect(svc.getAllProviders()).toEqual([]);
  });

  it('registerProvider and getProvider roundtrips', () => {
    const svc = new MarketplaceProviderService();
    svc.registerProvider(makeProvider({ id: 'p1', name: 'OpenAI' }));
    expect(svc.getProvider('p1')?.name).toBe('OpenAI');
  });

  it('getActiveProviders returns only active', () => {
    const svc = new MarketplaceProviderService();
    svc.registerProvider(makeProvider({ id: 'p1', name: 'Active', status: 'active' }));
    svc.registerProvider(makeProvider({ id: 'p2', name: 'Inactive', status: 'inactive' }));
    const active = svc.getActiveProviders();
    expect(active.length).toBe(1);
    expect(active[0].id).toBe('p1');
  });

  it('getProvidersByType filters correctly', () => {
    const svc = new MarketplaceProviderService();
    svc.registerProvider(makeProvider({ id: 'p1', name: 'AI', type: 'ai' }));
    svc.registerProvider(makeProvider({ id: 'p2', name: 'Storage', type: 'storage' }));
    expect(svc.getProvidersByType('ai').length).toBe(1);
    expect(svc.getProvidersByType('storage').length).toBe(1);
  });

  it('updateProviderStatus changes status', () => {
    const svc = new MarketplaceProviderService();
    svc.registerProvider(makeProvider({ id: 'p1', name: 'Test' }));
    svc.updateProviderStatus('p1', 'error');
    expect(svc.getProvider('p1')?.status).toBe('error');
  });

  it('updateProviderLatency updates latency', () => {
    const svc = new MarketplaceProviderService();
    svc.registerProvider(makeProvider({ id: 'p1', name: 'Test' }));
    svc.updateProviderLatency('p1', 150);
    expect(svc.getProvider('p1')?.latency).toBe(150);
  });

  it('updateProviderConfig merges config', () => {
    const svc = new MarketplaceProviderService();
    svc.registerProvider(makeProvider({ id: 'p1', name: 'Test', config: { apiKey: 'old' } }));
    svc.updateProviderConfig('p1', { apiKey: 'new', model: 'gpt-4' });
    expect(svc.getProvider('p1')?.config.apiKey).toBe('new');
    expect(svc.getProvider('p1')?.config.model).toBe('gpt-4');
  });

  it('setDefaultProvider sets exactly one default', () => {
    const svc = new MarketplaceProviderService();
    svc.registerProvider(makeProvider({ id: 'p1', name: 'Primary' }));
    svc.registerProvider(makeProvider({ id: 'p2', name: 'Secondary' }));
    svc.setDefaultProvider('p1');
    expect(svc.getDefaultProvider()?.id).toBe('p1');
    expect(svc.getProvider('p1')?.isDefault).toBe(true);
    expect(svc.getProvider('p2')?.isDefault).toBe(false);
  });

  it('getProviderCount returns correct count', () => {
    const svc = new MarketplaceProviderService();
    svc.registerProvider(makeProvider({ id: 'p1', name: 'A' }));
    svc.registerProvider(makeProvider({ id: 'p2', name: 'B' }));
    expect(svc.getProviderCount()).toBe(2);
  });

  it('getErrorRate returns average', () => {
    const svc = new MarketplaceProviderService();
    svc.registerProvider(makeProvider({ id: 'p1', name: 'A', errorRate: 0.1 }));
    svc.registerProvider(makeProvider({ id: 'p2', name: 'B', errorRate: 0.3 }));
    expect(svc.getErrorRate()).toBeCloseTo(0.2);
  });

  it('getErrorRate returns 0 with no providers', () => {
    const svc = new MarketplaceProviderService();
    expect(svc.getErrorRate()).toBe(0);
  });

  it('removeProvider deletes provider', () => {
    const svc = new MarketplaceProviderService();
    svc.registerProvider(makeProvider({ id: 'p1', name: 'Test' }));
    svc.removeProvider('p1');
    expect(svc.getProvider('p1')).toBeUndefined();
  });
});
