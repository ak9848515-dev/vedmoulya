// ──────────────────────────────────────────────────────────────────
// VedMoulya — Marketplace Activation Service Tests
// BLD-014 — Marketplace Platform
// ──────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import { MarketplaceActivationService } from '../MarketplaceActivationService.js';

describe('MarketplaceActivationService', () => {
  it('activateAsset creates new activation', () => {
    const svc = new MarketplaceActivationService();
    const act = svc.activateAsset('asset1', 'Test Asset');
    expect(act.assetId).toBe('asset1');
    expect(act.isActive).toBe(true);
    expect(act.usageCount).toBe(0);
  });

  it('activateAsset with config stores config', () => {
    const svc = new MarketplaceActivationService();
    const act = svc.activateAsset('asset1', 'Test', { apiKey: 'sk-123' });
    expect(act.config.apiKey).toBe('sk-123');
  });

  it('activateAsset re-activates existing', () => {
    const svc = new MarketplaceActivationService();
    svc.activateAsset('asset1', 'Test');
    svc.deactivateAsset('asset1');
    const reactivated = svc.activateAsset('asset1', 'Test');
    expect(reactivated.isActive).toBe(true);
    expect(reactivated.deactivatedAt).toBeUndefined();
  });

  it('deactivateAsset returns undefined for missing', () => {
    const svc = new MarketplaceActivationService();
    expect(svc.deactivateAsset('nonexistent')).toBeUndefined();
  });

  it('deactivateAsset sets isActive false', () => {
    const svc = new MarketplaceActivationService();
    svc.activateAsset('asset1', 'Test');
    const deactivated = svc.deactivateAsset('asset1');
    expect(deactivated?.isActive).toBe(false);
    expect(deactivated?.deactivatedAt).toBeDefined();
  });

  it('recordUsage increments usage count', () => {
    const svc = new MarketplaceActivationService();
    svc.activateAsset('asset1', 'Test');
    svc.recordUsage('asset1');
    svc.recordUsage('asset1');
    const act = svc.getActivation('asset1');
    expect(act?.usageCount).toBe(2);
  });

  it('recordUsage no-ops for non-existent asset', () => {
    const svc = new MarketplaceActivationService();
    expect(() => svc.recordUsage('nonexistent')).not.toThrow();
  });

  it('getActivation returns undefined for missing', () => {
    const svc = new MarketplaceActivationService();
    expect(svc.getActivation('nonexistent')).toBeUndefined();
  });

  it('getAllActivations returns all', () => {
    const svc = new MarketplaceActivationService();
    svc.activateAsset('a1', 'Asset 1');
    svc.activateAsset('a2', 'Asset 2');
    expect(svc.getAllActivations().length).toBe(2);
  });

  it('getActiveActivations returns only active', () => {
    const svc = new MarketplaceActivationService();
    svc.activateAsset('a1', 'Active');
    svc.activateAsset('a2', 'Inactive');
    svc.deactivateAsset('a2');
    const active = svc.getActiveActivations();
    expect(active.length).toBe(1);
    expect(active[0].assetId).toBe('a1');
  });

  it('getPendingActivations returns previously active items', () => {
    const svc = new MarketplaceActivationService();
    svc.activateAsset('a1', 'Test');
    svc.deactivateAsset('a1');
    const pending = svc.getPendingActivations();
    expect(pending.length).toBe(1);
  });

  it('getPendingActivations returns empty for never-activated', () => {
    const svc = new MarketplaceActivationService();
    expect(svc.getPendingActivations()).toEqual([]);
  });

  it('removeActivation deletes', () => {
    const svc = new MarketplaceActivationService();
    svc.activateAsset('a1', 'Test');
    svc.removeActivation('a1');
    expect(svc.getActivation('a1')).toBeUndefined();
  });
});
