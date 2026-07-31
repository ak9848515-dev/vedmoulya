// ──────────────────────────────────────────────────────────────────
// VedMoulya — Marketplace Installation Service Tests
// BLD-014 — Marketplace Platform
// ──────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import { MarketplaceInstallationService } from '../MarketplaceInstallationService.js';

describe('MarketplaceInstallationService', () => {
  it('startInstallation creates pending installation', () => {
    const svc = new MarketplaceInstallationService();
    const inst = svc.startInstallation('asset1', 'Test Asset', 'ai_provider', '1.0.0');
    expect(inst.assetId).toBe('asset1');
    expect(inst.assetName).toBe('Test Asset');
    expect(inst.status).toBe('pending');
    expect(inst.steps.length).toBe(5);
  });

  it('updateStep updates step status', () => {
    const svc = new MarketplaceInstallationService();
    const inst = svc.startInstallation('asset1', 'Test', 'ai_provider', '1.0.0');
    svc.updateStep(inst.id, 0, 'completed', 500);
    const updated = svc.getInstallation(inst.id);
    expect(updated?.steps[0].status).toBe('completed');
    expect(updated?.steps[0].duration).toBe(500);
  });

  it('updateStep no-ops for non-existent installation', () => {
    const svc = new MarketplaceInstallationService();
    expect(() => svc.updateStep('nonexistent', 0, 'completed')).not.toThrow();
  });

  it('completeInstallation marks as completed', () => {
    const svc = new MarketplaceInstallationService();
    const inst = svc.startInstallation('asset1', 'Test', 'ai_provider', '1.0.0');
    svc.completeInstallation(inst.id);
    const updated = svc.getInstallation(inst.id);
    expect(updated?.status).toBe('completed');
    expect(updated?.completedAt).toBeDefined();
    expect(updated?.duration).toBeGreaterThanOrEqual(0);
  });

  it('failInstallation marks as failed', () => {
    const svc = new MarketplaceInstallationService();
    const inst = svc.startInstallation('asset1', 'Test', 'ai_provider', '1.0.0');
    svc.failInstallation(inst.id, 'Network error');
    const updated = svc.getInstallation(inst.id);
    expect(updated?.status).toBe('failed');
    expect(updated?.error).toBe('Network error');
  });

  it('getInstallation returns undefined for missing', () => {
    const svc = new MarketplaceInstallationService();
    expect(svc.getInstallation('nonexistent')).toBeUndefined();
  });

  it('getInstallationsByAsset filters correctly', () => {
    const svc = new MarketplaceInstallationService();
    svc.startInstallation('a1', 'A', 'ai_provider', '1.0.0');
    svc.startInstallation('a2', 'B', 'knowledge_pack', '1.0.0');
    svc.startInstallation('a1', 'A', 'ai_provider', '2.0.0');
    const a1Insts = svc.getInstallationsByAsset('a1');
    expect(a1Insts.length).toBe(2);
  });

  it('getInstallationHistory returns sorted by date', () => {
    const svc = new MarketplaceInstallationService();
    svc.startInstallation('a1', 'A', 'ai_provider', '1.0.0');
    svc.startInstallation('a2', 'B', 'knowledge_pack', '1.0.0');
    const history = svc.getInstallationHistory();
    expect(history.length).toBe(2);
  });

  it('getSuccessRate returns 1 with no installations', () => {
    const svc = new MarketplaceInstallationService();
    expect(svc.getSuccessRate()).toBe(1);
  });

  it('getSuccessRate calculates correctly', () => {
    const svc = new MarketplaceInstallationService();
    const i1 = svc.startInstallation('a1', 'A', 'ai_provider', '1.0.0');
    const i2 = svc.startInstallation('a2', 'B', 'knowledge_pack', '1.0.0');
    svc.completeInstallation(i1.id);
    svc.failInstallation(i2.id, 'Error');
    expect(svc.getSuccessRate()).toBeCloseTo(0.5);
  });

  it('getErrorCount returns failed count', () => {
    const svc = new MarketplaceInstallationService();
    const i1 = svc.startInstallation('a1', 'A', 'ai_provider', '1.0.0');
    const i2 = svc.startInstallation('a2', 'B', 'knowledge_pack', '1.0.0');
    svc.failInstallation(i1.id, 'E1');
    svc.failInstallation(i2.id, 'E2');
    expect(svc.getErrorCount()).toBe(2);
  });
});
